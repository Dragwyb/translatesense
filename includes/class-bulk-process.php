<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_Error;
use TranslateSense\Includes\Content_Parser\Content_Parser;
use TranslateSense\Includes\Translate\Translate;

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
	private static function get_table_name(): string {
		global $wpdb;
		return esc_sql( $wpdb->prefix . 'translatesense_bulk_translations' );
	}

	/**
	 * Check if a translated post already exists for a post and target language.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @return int Target post ID if exists, or 0 if not
	 */
	public static function get_existing_translation_post_id( int $post_id, string $target_lang ): int {
		if ( $post_id <= 0 || empty( $target_lang ) ) {
			return 0;
		}

		// 1. If post itself is already in the target language
		$post_lang = Polylang_Bridge::get_post_language( $post_id );
		if ( ! empty( $post_lang ) && strtolower( $post_lang ) === strtolower( $target_lang ) ) {
			return $post_id;
		}

		// 2. Check Polylang translations if active
		if ( Polylang_Bridge::is_polylang_active() ) {
			$translations = Polylang_Bridge::get_post_translations( $post_id );
			if ( ! empty( $translations[ $target_lang ] ) ) {
				$trans_id = (int) $translations[ $target_lang ];
				if ( $trans_id > 0 && $trans_id !== $post_id && get_post( $trans_id ) && 'trash' !== get_post_status( $trans_id ) ) {
					return $trans_id;
				}
			}
		}

		// 3. Fallback check: look for post with _translatesense_source_id meta
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$found_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT p.ID FROM {$wpdb->posts} p
				 INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
				 WHERE pm.meta_key = '_translatesense_source_id' AND pm.meta_value = %d
				 AND p.post_status NOT IN ('trash', 'auto-draft')
				 LIMIT 1",
				$post_id
			)
		);

		if ( $found_id > 0 && $found_id !== $post_id && get_post( $found_id ) ) {
			$found_post_lang = Polylang_Bridge::get_post_language( $found_id );

			if ( $found_post_lang === $target_lang ) {
				return $found_id;
			}
		}

		return 0;
	}

	/**
	 * Create a new bulk translation batch.
	 *
	 * @param array  $post_ids
	 * @param array  $target_languages
	 * @param string $provider
	 * @return array
	 */
	public static function create_batch( array $post_ids, array $target_languages, string $provider = 'openai' ): array {
		global $wpdb;

		$table        = self::get_table_name();
		$batch_id     = 'batch_' . wp_generate_uuid4();
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

				$already_exists = ( $existing_trans_id > 0 );

				$job_status      = $already_exists ? 'already_exists' : 'pending';
				$progress_status = $already_exists ? 'Already Exists' : 'Queued';
				$target_post_id  = $already_exists ? $existing_trans_id : 0;

				$insert_data = array(
					'batch_id'                 => $batch_id,
					'post_id'                  => $post_id,
					'target_language'          => $target_lang,
					'provider'                 => $provider,
					'status'                   => $job_status,
					'progress_status'          => $progress_status,
					'total_strings'            => 0,
					'completed_strings'        => 0,
					'sent_ai_request_data'     => null,
					'received_ai_request_data' => null,
					'error_message'            => null,
					'target_post_id'           => $target_post_id,
					'created_at'               => current_time( 'mysql' ),
					'updated_at'               => current_time( 'mysql' ),
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$wpdb->insert(
					$table,
					$insert_data,
					array( '%s', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
				);

				$job_id                           = (int) $wpdb->insert_id;
				$insert_data['id']                = $job_id;
				$insert_data['editor_type']       = Editor_Integration::get_post_editor_type( $already_exists ? $target_post_id : $post_id );
				$insert_data['post_title']        = get_the_title( $post_id ) ?: sprintf( '#%d', $post_id );
				$insert_data['target_post_title'] = $already_exists ? ( get_the_title( $target_post_id ) ?: '' ) : '';
				$insert_data['view_url']          = $already_exists ? get_permalink( $target_post_id ) : '';
				$insert_data['edit_url']          = $already_exists && $target_post_id ? Editor_Integration::get_post_edit_link( $target_post_id ) : '';
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
		$table = self::get_table_name();
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
		$table = self::get_table_name();

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

		$job_id      = (int) $job['id'];
		$post_id     = (int) $job['post_id'];
		$target_lang = $job['target_language'];
		$provider    = $job['provider'];

		// Mark as running
		self::update_job(
			$job_id,
			array(
				'status'          => 'running',
				'progress_status' => 'Extracting strings...',
				'updated_at'      => current_time( 'mysql' ),
			)
		);

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

			$post_title = get_the_title( $post_id );

			if ( ! empty( $post_title ) ) {
				$post_title_hash = Hashing_Db::generate_hash( 'post_title', $post_title );
				$packages[]      = array(
					'hash'   => $post_title_hash,
					'name'   => 'post_title',
					'key'    => 'Post/Page Title',
					'source' => $post_title,
					'value'  => $post_title,
				);
			}

			$post_slug = get_post_field( 'post_name', $post_id );

			if ( ! empty( $post_slug ) ) {
				$post_slug_hash = Hashing_Db::generate_hash( 'post_name', $post_slug );
				$packages[]     = array(
					'hash'   => $post_slug_hash,
					'name'   => 'post_name',
					'key'    => 'Post/Page Slug',
					'source' => $post_slug,
					'value'  => $post_slug,
				);
			}

			$post_excerpt = get_post_field( 'post_excerpt', $post_id );

			if ( ! empty( $post_excerpt ) ) {
				$post_excerpt_hash = Hashing_Db::generate_hash( 'post_excerpt', $post_excerpt );
				$packages[]        = array(
					'hash'   => $post_excerpt_hash,
					'name'   => 'post_excerpt',
					'key'    => 'Post/Page Excerpt',
					'source' => $post_excerpt,
					'value'  => $post_excerpt,
				);
			}

			$packages = array_values( (array) $packages );

			// Extract pure strings indexed by array index
			$strings_to_send = array();

			foreach ( $packages as $idx => $pkg ) {
				if ( isset( $pkg['value'] ) && ! empty( $pkg['value'] ) ) {
					$str                     = (string) $pkg['value'];
					$strings_to_send[ $idx ] = $str;
				}
			}

			$total_str = count( $strings_to_send );

			// Save AI request data with clean source strings array
			self::update_job(
				$job_id,
				array(
					'total_strings'        => $total_str,
					'progress_status'      => sprintf( 'Translating strings (%d found)...', $total_str ),
					'sent_ai_request_data' => wp_json_encode( $strings_to_send ),
					'updated_at'           => current_time( 'mysql' ),
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
						// Set translated value to hash in DB
						if ( Translate::should_cache_provider( $provider ) ) {
							Hashing_Db::save_translation_result( $hash, $target_lang, $translated_str );
						}
						$in_memory_translations[ $hash ] = $translated_str;
					}
				}

				if ( ! empty( $orig_str ) ) {
					$in_memory_translations[ $orig_str ] = $translated_str;
				}
			}

			// 4. Execute post translation
			$result = self::execute_post_translation_sync( $post_id, $target_lang, $provider, $in_memory_translations );

			if ( is_wp_error( $result ) ) {
				throw new \Exception( $result->get_error_message() );
			}

			$target_post_id = $result['target_post_id'] ?? 0;

			// 5. Mark as completed and save translated strings array
			self::update_job(
				$job_id,
				array(
					'status'                   => 'completed',
					'progress_status'          => 'Completed successfully',
					'completed_strings'        => $total_str,
					'target_post_id'           => $target_post_id,
					'received_ai_request_data' => wp_json_encode( $translated_content ),
					'error_message'            => null,
					'updated_at'               => current_time( 'mysql' ),
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
		return Translate::translate_post( $post_id, $target_lang, $provider, $in_memory_translations );
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
		$table = self::get_table_name();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d LIMIT 1",
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
		$table = self::get_table_name();

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

		$table = self::get_table_name();

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

			if ( 'already_exists' === $status ) {
				$item_progress = 100;
			} else {
				$item_progress = 0;
				if ( 'completed' === $status ) {
					$item_progress = 100;
				} elseif ( $t_str > 0 ) {
					$item_progress = (int) round( ( $c_str / $t_str ) * 100 );
				}
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

		// Calculate overall batch progress percentage
		$overall_progress = 0;
		if ( $total_jobs > 0 ) {
			$done_jobs = $completed_jobs + $already_exists_jobs + $failed_jobs;
			if ( $done_jobs === $total_jobs ) {
				$overall_progress = 100;
			} else {
				$job_pct = ( $done_jobs / $total_jobs ) * 100;
				if ( $total_strings > 0 ) {
					$str_pct          = ( $completed_strings / $total_strings ) * 100;
					$overall_progress = (int) round( ( $job_pct * 0.5 ) + ( $str_pct * 0.5 ) );
				} else {
					$overall_progress = (int) round( $job_pct );
				}
				$overall_progress = min( 99, max( 0, $overall_progress ) );
			}
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
