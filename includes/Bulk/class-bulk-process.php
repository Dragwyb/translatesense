<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Bulk;

use TranslateSense\Includes\Content\Parser\Content_Parser;
use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Admin\Editor_Integration;
use TranslateSense\Includes\Translation\Statics;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bulk_Process {

	const CRON_HOOK = 'translatesense_bulk_process_cron';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'add_cron_intervals' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'process_cron_tick' ) );
	}

	/**
	 * Add custom batch intervals (every minute / 30 seconds).
	 */
	public static function add_cron_intervals( $schedules ) {
		if ( ! isset( $schedules['translatesense_batch_interval'] ) ) {
			$schedules['translatesense_batch_interval'] = array(
				'interval' => 60,
				'display'  => __( 'Every Minute (TranslateSense Bulk Queue)', 'translatesense' ),
			);
		}
		return $schedules;
	}

	/**
	 * Get table name.
	 */
	private static function get_table_name_internal(): string {
		global $wpdb;
		return esc_sql( $wpdb->prefix . 'translatesense_bulk_translations' );
	}

	/**
	 * Get table name (legacy compatibility).
	 *
	 * @return string
	 */
	final public static function get_table_name(): string {
		return self::get_table_name_internal();
	}

	/**
	 * Check if a translated post already exists for a post and target language.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @return int Target post ID if exists, or 0 if not
	 */
	public static function get_existing_translation_post_id( int $post_id, string $target_lang ): int {
		return Polylang_Bridge::get_existing_translation_post_id(
			absint( $post_id ),
			sanitize_key( $target_lang )
		);
	}

	/**
	 * Create a bulk translation batch.
	 *
	 * Existing target translations are queued for in-place re-translation.
	 * Only a source post already in the requested language is marked as
	 * already_exists and skipped.
	 *
	 * @param array  $post_ids
	 * @param array  $target_languages
	 * @param string $provider
	 * @return array
	 */
	public static function create_batch( array $post_ids, array $target_languages, string $provider = 'openai' ): array {
		global $wpdb;

		$table        = self::get_table_name_internal();
		$batch_id     = wp_generate_uuid4();
		$provider     = sanitize_text_field( $provider );
		$is_chrome_ai = ( 'chrome_ai' === $provider || 'chrome_local_ai' === $provider );

		$created_jobs = array();

		foreach ( $post_ids as $p_id ) {
			$post_id = (int) $p_id;
			if ( $post_id <= 0 || ! get_post( $post_id ) ) {
				continue;
			}

			foreach ( $target_languages as $lang ) {
				$target_lang = sanitize_text_field( $lang );
				if ( empty( $target_lang ) ) {
					continue;
				}

				// Check if translation already exists for this post & target language
				$existing_trans_id = self::get_existing_translation_post_id( $post_id, $target_lang );

				// If the selected source itself is already in the requested
				// language, there is nothing to translate. A different existing
				// translation is queued for re-translation/update in place.
				$is_source_in_target_language = $existing_trans_id === $post_id;
				$has_existing_target          = $existing_trans_id > 0 && ! $is_source_in_target_language;

				$job_status      = $is_source_in_target_language ? 'already_exists' : 'pending';
				$progress_status = $is_source_in_target_language
					? 'Source already uses target language'
					: ( $has_existing_target ? 'Queued to update existing translation' : 'Queued' );
				$target_post_id  = $has_existing_target ? $existing_trans_id : 0;

				$insert_data = array(
					'batch_id'          => $batch_id,
					'post_id'           => $post_id,
					'target_language'   => $target_lang,
					'provider'          => $provider,
					'status'            => $job_status,
					'progress_status'   => $progress_status,
					'total_strings'     => 0,
					'completed_strings' => 0,
					'sent_data'         => null,
					'receive_data'      => null,
					'error_message'     => null,
					'target_post_id'    => $target_post_id,
					'created_at'        => current_time( 'mysql' ),
					'updated_at'        => current_time( 'mysql' ),
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$wpdb->insert(
					$table,
					$insert_data,
					array( '%s', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
				);

				$job_id                           = (int) $wpdb->insert_id;
				$insert_data['id']                = $job_id;
				$insert_data['editor_type']       = Editor_Integration::get_post_editor_type( $has_existing_target ? $target_post_id : $post_id );
				$insert_data['post_title']        = get_the_title( $post_id ) ?: sprintf( '#%d', $post_id );
				$insert_data['target_post_title'] = $has_existing_target ? ( get_the_title( $target_post_id ) ?: '' ) : '';
				$insert_data['view_url']          = $has_existing_target ? get_permalink( $target_post_id ) : '';
				$insert_data['edit_url']          = $has_existing_target && $target_post_id ? Editor_Integration::get_post_edit_link( $target_post_id ) : '';
				$created_jobs[]                   = $insert_data;
			}
		}

		// If backend provider (OpenAI, Gemini, etc.), schedule cron and trigger immediate background processing if there are pending jobs
		if ( ! $is_chrome_ai && ! empty( $created_jobs ) && self::has_pending_or_running_jobs() ) {
			self::schedule_cron_if_needed();
			self::trigger_async_cron();
		}

		return array(
			'batch_id'   => $batch_id,
			'total_jobs' => count( $created_jobs ),
			'jobs'       => $created_jobs,
			'is_backend' => ! $is_chrome_ai,
			'provider'   => $provider,
		);
	}

	/**
	 * Check if table has pending or running jobs that require backend processing.
	 */
	public static function has_pending_or_running_jobs(): bool {
		global $wpdb;
		$table = self::get_table_name_internal();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$count = (int) $wpdb->get_var(
			"SELECT COUNT(id) FROM {$table} WHERE status IN ('pending', 'running') AND provider NOT IN ('chrome_ai', 'chrome_local_ai')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		return $count > 0;
	}

	/**
	 * Schedule cron if needed for backend jobs.
	 */
	public static function schedule_cron_if_needed(): void {
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'translatesense_batch_interval', self::CRON_HOOK );
		}
	}

	/**
	 * Unschedule / Remove cron if no pending or running jobs exist.
	 */
	public static function unschedule_cron_if_idle(): void {
		if ( ! self::has_pending_or_running_jobs() ) {
			$timestamp = wp_next_scheduled( self::CRON_HOOK );
			if ( $timestamp ) {
				wp_unschedule_event( $timestamp, self::CRON_HOOK );
			}
			wp_clear_scheduled_hook( self::CRON_HOOK );
		}
	}

	/**
	 * Trigger non-blocking async background tick.
	 */
	public static function trigger_async_cron(): void {
		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
	}

	/**
	 * Main Cron Batch Execution Tick.
	 * Executes pending backend translation jobs one by one.
	 */
	public static function process_cron_tick(): void {
		global $wpdb;
		$table = self::get_table_name_internal();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			"UPDATE {$table} SET status = 'pending', progress_status = 'Restarting after timeout' WHERE status = 'running' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)AND provider NOT IN ('chrome_ai', 'chrome_local_ai')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$job = $wpdb->get_row(
			"SELECT * FROM {$table}  WHERE status = 'pending' AND provider NOT IN ('chrome_ai', 'chrome_local_ai') ORDER BY id ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			ARRAY_A
		);

		if ( ! $job ) {
			// No more pending jobs, remove cron if everything is completed/failed
			self::unschedule_cron_if_idle();
			return;
		}

		$job_id                  = (int) $job['id'];
		$post_id                 = (int) $job['post_id'];
		$target_lang             = $job['target_language'];
		$provider                = $job['provider'];
		$existing_target_post_id = absint( $job['target_post_id'] );
		$is_retranslation        = $existing_target_post_id > 0 && $existing_target_post_id !== $post_id;

		// Mark as running
		self::update_job(
			$job_id,
			array(
				'status'          => 'running',
				'progress_status' => $is_retranslation ? 'Preparing existing translation update...' : 'Extracting strings...',
				'updated_at'      => current_time( 'mysql' ),
			)
		);

		$start_time  = microtime( true );
		$total_str   = 0;
		$total_chars = 0;

		try {
			$source_post = get_post( $post_id );
			if ( ! $source_post ) {
				throw new \Exception( sprintf( 'Post #%d does not exist.', $post_id ) );
			}

			$source_lang = Polylang_Bridge::get_post_language( $post_id );
			$editor_type = Editor_Integration::get_post_editor_type( $post_id );

			// 1. Extract packages array (contains hash, strings, widget info)
			$packages = Hashing_Db::get_post_package( $post_id, $source_lang, $editor_type );

			if ( empty( $packages ) ) {
				$packages = Content_Parser::parse( '', $post_id, $source_lang, $editor_type );
			}

			$packages = array_values( (array) $packages );

			// Extract pure strings indexed by array index
			$settings         = get_option( 'translatesense_settings', array() );
			$raw_slug_trans   = ! empty( $settings['slug_translation'] ) ? sanitize_key( (string) $settings['slug_translation'] ) : 'slug_translate';
			$slug_translation = in_array( $raw_slug_trans, array( 'keep_orignal', 'title_based', 'slug_translate' ), true ) ? $raw_slug_trans : 'slug_translate';
			$strings_to_send  = array();

			foreach ( $packages as $idx => $pkg ) {
				$pkg_name = sanitize_key( is_array( $pkg ) ? ( $pkg['name'] ?? ( $pkg['widget_name'] ?? '' ) ) : '' );
				if ( ( $is_retranslation || 'slug_translate' !== $slug_translation ) && 'post_name' === $pkg_name ) {
					continue;
				}
				if ( isset( $pkg['value'] ) && ! empty( $pkg['value'] ) ) {
					$str                     = (string) $pkg['value'];
					$strings_to_send[ $idx ] = $str;
				}
			}

			$total_str   = count( $strings_to_send );
			$total_chars = 0;
			foreach ( $strings_to_send as $str_to_count ) {
				$total_chars += mb_strlen( (string) $str_to_count );
			}

			// Save AI request data with clean source strings array
			self::update_job(
				$job_id,
				array(
					'total_strings'   => $total_str,
					'progress_status' => $is_retranslation
						? sprintf( 'Updating existing translation (%d strings)...', $total_str )
						: sprintf( 'Translating strings (%d found)...', $total_str ),
					'sent_data'       => wp_json_encode( $strings_to_send ),
					'updated_at'      => current_time( 'mysql' ),
				)
			);

			// 2. Send indexed string array to AI
			$ai_response = Translate::translate_batch(
				$strings_to_send,
				$source_lang,
				$target_lang,
				array( 'provider' => $provider )
			);

			if ( is_wp_error( $ai_response ) ) {
				throw new \Exception( 'Failed to translate strings: ' . $ai_response->get_error_message() );
			}

			$translated_content     = array();
			$in_memory_translations = array();

			// 3. Match AI response by index in packages array and set translated value to hash
			foreach ( $strings_to_send as $idx => $orig_str ) {
				$translated_str = isset( $ai_response[ $idx ]['translated'] ) ? (string) $ai_response[ $idx ]['translated'] : (string) $orig_str;

				// Save translated content in smart indexed format
				$translated_content[ $idx ] = $translated_str;

				// Match index with packages array to resolve hash
				if ( isset( $packages[ $idx ] ) ) {
					$pkg  = $packages[ $idx ];
					$hash = is_array( $pkg ) ? ( $pkg['hash'] ?? ( $pkg['package_hash'] ?? '' ) ) : '';

					if ( empty( $hash ) && '' !== $orig_str ) {
						$w_id = is_array( $pkg ) ? ( $pkg['widget_name'] ?? ( $pkg['widget_id'] ?? 'generic' ) ) : 'generic';
						$hash = Hashing_Db::generate_hash( (string) $w_id, (string) $orig_str );
					}

					if ( ! empty( $hash ) ) {
						$in_memory_translations[ $hash ] = $translated_str;
					}
				}

				if ( ! empty( $orig_str ) ) {
					$in_memory_translations[ $orig_str ] = $translated_str;
					if ( Translate::should_cache_provider( $provider ) ) {
						$string_hash = md5( (string) $orig_str );
						Hashing_Db::save_translation_result( $string_hash, $target_lang, $translated_str );
					}
				}
			}

			// 4. Execute post translation
			$result = self::execute_post_translation_sync( $post_id, $target_lang, $provider, $in_memory_translations );

			if ( is_wp_error( $result ) ) {
				throw new \Exception( $result->get_error_message() );
			}

			$target_post_id  = isset( $result['target_post_id'] ) ? absint( $result['target_post_id'] ) : 0;
			$sync_warnings   = ! empty( $result['sync_warnings'] ) ? (array) $result['sync_warnings'] : array();
			$completed_label = $is_retranslation
				? __( 'Existing translation updated successfully', 'translatesense' )
				: __( 'Completed successfully', 'translatesense' );

			if ( ! empty( $sync_warnings ) ) {
				$completed_label = __( 'Translation completed with synchronization warnings. Review the target post.', 'translatesense' );
			}

			// If target post contains Gutenberg blocks, mark for block recovery check
			if ( $target_post_id > 0 ) {
				$target_post = get_post( $target_post_id );
				if ( $target_post && function_exists( 'has_blocks' ) && has_blocks( $target_post->post_content ) ) {
					update_post_meta( $target_post_id, '_block_repair_pending', '1' );
				}
			}

			// 5. Mark as completed and save translated strings array
			self::update_job(
				$job_id,
				array(
					'status'            => 'completed',
					'progress_status'   => $completed_label,
					'completed_strings' => $total_str,
					'target_post_id'    => $target_post_id,
					'receive_data'      => wp_json_encode( $translated_content ),
					'error_message'     => null,
					'updated_at'        => current_time( 'mysql' ),
				)
			);

			$elapsed_ms = (int) round( ( microtime( true ) - $start_time ) * 1000 );
			Statics::update_translation_statistics(
				array(
					'status'           => 'success',
					'total_characters' => $total_chars,
					'total_strings'    => $total_str,
					'provider'         => $provider,
					'time_take'        => $elapsed_ms,
					'request_id'       => 'bulk_cron_job_' . $job_id,
				)
			);
		} catch ( \Throwable $e ) {
			self::update_job(
				$job_id,
				array(
					'status'          => 'failed',
					'progress_status' => 'Failed: ' . substr( $e->getMessage(), 0, 80 ),
					'error_message'   => $e->getMessage(),
					'updated_at'      => current_time( 'mysql' ),
				)
			);

			$elapsed_ms = isset( $start_time ) ? (int) round( ( microtime( true ) - $start_time ) * 1000 ) : 0;
			Statics::update_translation_statistics(
				array(
					'status'           => 'failed',
					'total_characters' => isset( $total_chars ) ? $total_chars : 0,
					'total_strings'    => isset( $total_str ) ? $total_str : 0,
					'provider'         => $provider,
					'time_take'        => $elapsed_ms,
					'request_id'       => 'bulk_cron_job_' . $job_id,
				)
			);
		}

		// Check if more pending jobs exist
		if ( self::has_pending_or_running_jobs() ) {
			// Trigger next tick immediately
			self::trigger_async_cron();
		} else {
			// All jobs completed or failed -> remove/clear cron
			self::unschedule_cron_if_idle();
		}
	}

	/**
	 * Synchronously translate a complete post (Title, Content, Elementor/Gutenberg data) and create Polylang linked post.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $in_memory_translations
	 * @return array|WP_Error
	 */
	public static function execute_post_translation_sync( int $post_id, string $target_lang, string $provider, array $in_memory_translations = array() ) {
		return Translate::translate_post( $post_id, $target_lang, $provider, $in_memory_translations, array( 'is_bulk' => true ) );
	}

	/**
	 * Get a single job row by ID.
	 *
	 * @param int $job_id
	 * @return object|null
	 */
	public static function get_job( int $job_id ) {
		if ( $job_id <= 0 ) {
			return null;
		}

		global $wpdb;
		$table = self::get_table_name_internal();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$job_id
			)
		);
	}

	/**
	 * Update a job row in the bulk translation table.
	 *
	 * @param int   $job_id
	 * @param array $data
	 * @return bool
	 */
	public static function update_job( int $job_id, array $data ): bool {
		global $wpdb;
		$table = self::get_table_name_internal();

		if ( ! isset( $data['updated_at'] ) ) {
			$data['updated_at'] = current_time( 'mysql' );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = $wpdb->update(
			$table,
			$data,
			array( 'id' => $job_id )
		);

		return false !== $result;
	}

	/**
	 * Get aggregated batch status for 5-second polling endpoint.
	 *
	 * @param string $batch_id
	 * @param int    $post_id
	 * @return array
	 */
	public static function get_batch_status( string $batch_id, int $post_id = 0 ): array {
		global $wpdb;

		$table = self::get_table_name_internal();

		if ( ! empty( $batch_id ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$rows = $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE batch_id = %s ORDER BY id ASC", $batch_id ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				ARRAY_A
			);
		} elseif ( $post_id > 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$rows = $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE post_id = %d ORDER BY id DESC LIMIT 20", $post_id ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$rows = $wpdb->get_results(
				"SELECT * FROM {$table} ORDER BY id DESC LIMIT 50", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				ARRAY_A
			);
		}

		$total_jobs          = count( $rows );
		$completed_jobs      = 0;
		$already_exists_jobs = 0;
		$failed_jobs         = 0;
		$running_jobs        = 0;
		$pending_jobs        = 0;

		$total_strings     = 0;
		$completed_strings = 0;

		$items = array();

		foreach ( $rows as $row ) {
			$post_id = (int) $row['post_id'];
			if ( $post_id > 0 && ! current_user_can( 'edit_post', $post_id ) ) {
				continue;
			}

			$status = $row['status'];
			if ( 'completed' === $status ) {
				++$completed_jobs;
			} elseif ( 'already_exists' === $status ) {
				++$already_exists_jobs;
			} elseif ( 'failed' === $status ) {
				++$failed_jobs;
			} elseif ( 'running' === $status ) {
				++$running_jobs;
			} else {
				++$pending_jobs;
			}

			$t_str = (int) $row['total_strings'];
			$c_str = (int) $row['completed_strings'];

			$total_strings     += $t_str;
			$completed_strings += $c_str;

			$post       = get_post( (int) $row['post_id'] );
			$post_title = $post ? $post->post_title : sprintf( '#%d', (int) $row['post_id'] );

			$target_post_id    = (int) $row['target_post_id'];
			$target_post       = $target_post_id ? get_post( $target_post_id ) : null;
			$target_post_title = $target_post ? $target_post->post_title : '';
			$editor_type       = $target_post_id ? Editor_Integration::get_post_editor_type( $target_post_id ) : ( $row['editor_type'] ?? 'classic' );

			$edit_url = $target_post_id ? Editor_Integration::get_post_edit_link( $target_post_id ) : '';
			$view_url = $target_post_id ? get_permalink( $target_post_id ) : '';

			if ( 'completed' === $status || 'already_exists' === $status ) {
				$item_progress = 100;
			} elseif ( 'running' === $status || 'processing' === $status ) {
				$item_progress = $t_str > 0 ? (int) round( min( 100, max( 0, ( $c_str / $t_str ) * 100 ) ) ) : 0;
			} elseif ( 'failed' === $status ) {
				$item_progress = $t_str > 0 ? (int) round( min( 100, max( 0, ( $c_str / $t_str ) * 100 ) ) ) : 0;
			} else {
				$item_progress = 0;
			}

			$items[] = array(
				'id'                => (int) $row['id'],
				'batch_id'          => $row['batch_id'],
				'post_id'           => (int) $row['post_id'],
				'post_title'        => $post_title,
				'target_language'   => $row['target_language'],
				'provider'          => $row['provider'],
				'editor_type'       => $editor_type,
				'status'            => $status,
				'progress_status'   => $row['progress_status'],
				'progress_percent'  => $item_progress,
				'total_strings'     => $t_str,
				'completed_strings' => $c_str,
				'pending_strings'   => max( 0, $t_str - $c_str ),
				'target_post_id'    => $target_post_id,
				'target_post_title' => $target_post_title,
				'edit_url'          => $edit_url,
				'view_url'          => $view_url,
				'error_message'     => $row['error_message'],
				'created_at'        => $row['created_at'],
				'updated_at'        => $row['updated_at'],
			);
		}

		$pending_strings = max( 0, $total_strings - $completed_strings );

		// Calculate overall batch progress percentage (post-weighted: each post contributes equally)
		$overall_progress = 0;
		if ( $total_jobs > 0 ) {
			$total_progress_sum = 0;
			foreach ( $items as $it ) {
				$st = $it['status'];
				if ( 'completed' === $st || 'already_exists' === $st ) {
					$total_progress_sum += 100;
				} elseif ( 'running' === $st || 'processing' === $st || 'failed' === $st ) {
					$it_t = (int) $it['total_strings'];
					$it_c = (int) $it['completed_strings'];
					if ( $it_t > 0 ) {
						$total_progress_sum += min( 100, max( 0, ( $it_c / $it_t ) * 100 ) );
					}
				}
			}
			$overall_progress = (int) round( min( 100, max( 0, $total_progress_sum / $total_jobs ) ) );
		}

		$overall_status = 'pending';
		$done_jobs      = $completed_jobs + $already_exists_jobs + $failed_jobs;
		if ( $total_jobs > 0 && $done_jobs === $total_jobs ) {
			$overall_status = ( $failed_jobs === $total_jobs ) ? 'failed' : 'completed';
		} elseif ( $running_jobs > 0 || $completed_jobs > 0 ) {
			$overall_status = 'running';
		}

		$current_status = 'Queued';
		if ( 'completed' === $overall_status ) {
			if ( $already_exists_jobs > 0 && $completed_jobs > 0 ) {
				/* translators: 1: Number of translated posts, 2: Number of already existing posts */
				$current_status = sprintf( __( 'Completed! %1$d posts translated, %2$d already existed.', 'translatesense' ), $completed_jobs, $already_exists_jobs );
			} elseif ( $already_exists_jobs > 0 && 0 === $completed_jobs ) {
				/* translators: %d: Number of already existing posts */
				$current_status = sprintf( __( 'All %d selected translations already exist.', 'translatesense' ), $already_exists_jobs );
			} else {
				/* translators: %d: Number of translated posts */
				$current_status = sprintf( __( 'Completed! %d posts translated successfully.', 'translatesense' ), $completed_jobs );
			}
		} elseif ( 'failed' === $overall_status ) {
			$current_status = __( 'Batch translation failed.', 'translatesense' );
		} elseif ( $running_jobs > 0 ) {
			/* translators: 1: Completed jobs count, 2: Total jobs count */
			$current_status = sprintf( __( 'Processing (%1$d/%2$d jobs)...', 'translatesense' ), $completed_jobs + $already_exists_jobs + 1, $total_jobs );
		}

		return array(
			'success'             => true,
			'batch_id'            => $batch_id,
			'overall_status'      => $overall_status,
			'progress_percent'    => $overall_progress,
			'current_status'      => $current_status,
			'total_jobs'          => $total_jobs,
			'completed_jobs'      => $completed_jobs,
			'already_exists_jobs' => $already_exists_jobs,
			'failed_jobs'         => $failed_jobs,
			'running_jobs'        => $running_jobs,
			'pending_jobs'        => $pending_jobs,
			'total_strings'       => $total_strings,
			'completed_strings'   => $completed_strings,
			'pending_strings'     => $pending_strings,
			'items'               => $items,
		);
	}
}
