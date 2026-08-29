<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_Error;
use TranslateSense\Includes\Content_Parser\Content_Parser;

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
	public static function get_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_bulk_translations';
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

				$insert_data = array(
					'batch_id'                 => $batch_id,
					'post_id'                  => $post_id,
					'target_language'          => $target_lang,
					'provider'                 => $provider,
					'status'                   => 'pending',
					'progress_status'          => 'Queued',
					'total_strings'            => 0,
					'completed_strings'        => 0,
					'sent_ai_request_data'     => null,
					'received_ai_request_data' => null,
					'error_message'            => null,
					'target_post_id'           => 0,
					'created_at'               => current_time( 'mysql' ),
					'updated_at'               => current_time( 'mysql' ),
				);

				$wpdb->insert(
					$table,
					$insert_data,
					array( '%s', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
				);

				$job_id                     = (int) $wpdb->insert_id;
				$insert_data['id']          = $job_id;
				$insert_data['editor_type'] = Editor_Integration::get_post_editor_type( $post_id );
				$created_jobs[]             = $insert_data;
			}
		}

		// If backend provider, schedule cron and trigger immediate processing
		if ( ! $is_chrome_ai && ! empty( $created_jobs ) ) {
			self::schedule_cron_if_needed();
			// Attempt to spawn cron or run immediate non-blocking tick
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
		$count = (int) $wpdb->get_var(
			"SELECT COUNT(id) FROM {$table} 
			 WHERE status IN ('pending', 'running') 
			 AND provider NOT IN ('chrome_ai', 'chrome_local_ai')"
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

		// Check if any job has been stuck in 'running' state for over 10 minutes, reset to pending
		$wpdb->query(
			"UPDATE {$table} 
			 SET status = 'pending', progress_status = 'Restarting after timeout' 
			 WHERE status = 'running' 
			 AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
			 AND provider NOT IN ('chrome_ai', 'chrome_local_ai')"
		);

		// Get next pending backend job
		$job = $wpdb->get_row(
			"SELECT * FROM {$table} 
			 WHERE status = 'pending' 
			 AND provider NOT IN ('chrome_ai', 'chrome_local_ai') 
			 ORDER BY id ASC 
			 LIMIT 1",
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

			// 1. Extract translatable strings
			$extracted = Content_Parser::parse( '', $post_id, $source_lang, $editor_type );
			$total_str = count( $extracted );

			self::update_job(
				$job_id,
				array(
					'total_strings'        => $total_str,
					'progress_status'      => sprintf( 'Translating strings (%d found)...', $total_str ),
					'sent_ai_request_data' => wp_json_encode(
						array(
							'post_id'     => $post_id,
							'title'       => $source_post->post_title,
							'source_lang' => $source_lang,
							'target_lang' => $target_lang,
							'strings'     => $extracted,
						)
					),
					'updated_at'           => current_time( 'mysql' ),
				)
			);

			// 2. Execute post translation
			$result = self::execute_post_translation_sync( $post_id, $target_lang, $provider );

			if ( is_wp_error( $result ) ) {
				throw new \Exception( $result->get_error_message() );
			}

			$target_post_id = $result['target_post_id'] ?? 0;

			// 3. Mark as completed
			self::update_job(
				$job_id,
				array(
					'status'                   => 'completed',
					'progress_status'          => 'Completed successfully',
					'completed_strings'        => $total_str,
					'target_post_id'           => $target_post_id,
					'received_ai_request_data' => wp_json_encode( $result ),
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
	 * Synchronously translate a complete post using backend provider.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $in_memory_translations
	 * @return array|WP_Error
	 */
	public static function execute_post_translation_sync( int $post_id, string $target_lang, string $provider, array $in_memory_translations = array() ) {
		$source_post = get_post( $post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Source post not found.', 'translatesense' ) );
		}

		$source_lang = Polylang_Bridge::get_post_language( $post_id );
		$custom_opts = array(
			'provider'               => $provider,
			'in_memory_translations' => $in_memory_translations,
		);

		// 1. Translate Title
		$title_res        = Translator::translate_string(
			$source_post->post_title,
			$source_lang,
			$target_lang,
			'post_title',
			$post_id,
			$custom_opts
		);
		$translated_title = $title_res['translated'];

		// 2. Check if Elementor or Gutenberg or Classic
		$is_elementor       = ( 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ) );
		$new_elementor_data = null;
		$translated_content = $source_post->post_content;

		if ( $is_elementor ) {
			$elementor_data_raw = get_post_meta( $post_id, '_elementor_data', true );
			$elements           = is_string( $elementor_data_raw ) ? json_decode( $elementor_data_raw, true ) : $elementor_data_raw;
			if ( is_array( $elements ) ) {
				$rules = Xml_Engine::get_all_rules();
				Rest_Api::translate_elementor_elements_tree( $elements, $rules['elementor'], $source_lang, $target_lang, $post_id, $custom_opts );
				$new_elementor_data = $elements;
			}
		} elseif ( function_exists( 'has_blocks' ) && has_blocks( $source_post->post_content ) ) {
			$blocks = parse_blocks( $source_post->post_content );
			$rules  = Xml_Engine::get_all_rules();
			Rest_Api::translate_gutenberg_blocks_tree( $blocks, $rules['gutenberg'], $source_lang, $target_lang, $post_id, $custom_opts );
			$translated_content = serialize_blocks( $blocks );
		} else {
			$content_res        = Translator::translate_string(
				$source_post->post_content,
				$source_lang,
				$target_lang,
				'post_content',
				$post_id,
				$custom_opts
			);
			$translated_content = $content_res['translated'];
		}

		// 3. Create or update Polylang translated post
		$created_post_id = Polylang_Bridge::create_or_update_translated_post(
			$post_id,
			$target_lang,
			$translated_title,
			$translated_content,
			$new_elementor_data
		);

		if ( is_wp_error( $created_post_id ) ) {
			return $created_post_id;
		}

		return array(
			'success'          => true,
			'source_post_id'   => $post_id,
			'target_post_id'   => $created_post_id,
			'target_language'  => $target_lang,
			'translated_title' => $translated_title,
			'edit_url'         => get_edit_post_link( $created_post_id, 'raw' ),
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
			$rows = $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE batch_id = %s ORDER BY id ASC", $batch_id ),
				ARRAY_A
			);
		} elseif ( $post_id > 0 ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE post_id = %d ORDER BY id DESC LIMIT 20", $post_id ),
				ARRAY_A
			);
		} else {
			$rows = $wpdb->get_results(
				"SELECT * FROM {$table} ORDER BY id DESC LIMIT 50",
				ARRAY_A
			);
		}

		$total_jobs     = count( $rows );
		$completed_jobs = 0;
		$failed_jobs    = 0;
		$running_jobs   = 0;
		$pending_jobs   = 0;

		$total_strings     = 0;
		$completed_strings = 0;

		$items = array();

		foreach ( $rows as $row ) {
			$status = $row['status'];
			if ( 'completed' === $status ) {
				++$completed_jobs;
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

			$item_progress = 0;
			if ( 'completed' === $status ) {
				$item_progress = 100;
			} elseif ( $t_str > 0 ) {
				$item_progress = (int) round( ( $c_str / $t_str ) * 100 );
			}

			$target_post_id = (int) $row['target_post_id'];
			$edit_url       = $target_post_id ? get_edit_post_link( $target_post_id, 'raw' ) : '';

			$items[] = array(
				'id'                => (int) $row['id'],
				'batch_id'          => $row['batch_id'],
				'post_id'           => (int) $row['post_id'],
				'post_title'        => $post_title,
				'target_language'   => $row['target_language'],
				'provider'          => $row['provider'],
				'status'            => $status,
				'progress_status'   => $row['progress_status'],
				'progress_percent'  => $item_progress,
				'total_strings'     => $t_str,
				'completed_strings' => $c_str,
				'pending_strings'   => max( 0, $t_str - $c_str ),
				'target_post_id'    => $target_post_id,
				'edit_url'          => $edit_url,
				'error_message'     => $row['error_message'],
				'created_at'        => $row['created_at'],
				'updated_at'        => $row['updated_at'],
			);
		}

		$pending_strings = max( 0, $total_strings - $completed_strings );

		// Calculate overall batch progress percentage
		$overall_progress = 0;
		if ( $total_jobs > 0 ) {
			$done_jobs = $completed_jobs + $failed_jobs;
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
		if ( $total_jobs > 0 && ( $completed_jobs + $failed_jobs ) === $total_jobs ) {
			$overall_status = ( $failed_jobs === $total_jobs ) ? 'failed' : 'completed';
		} elseif ( $running_jobs > 0 || $completed_jobs > 0 ) {
			$overall_status = 'running';
		}

		$current_status = 'Queued';
		if ( 'completed' === $overall_status ) {
			$current_status = sprintf( __( 'Completed! %d posts translated successfully.', 'translatesense' ), $completed_jobs );
		} elseif ( 'failed' === $overall_status ) {
			$current_status = __( 'Batch translation failed.', 'translatesense' );
		} elseif ( $running_jobs > 0 ) {
			$current_status = sprintf( __( 'Processing (%1$d/%2$d jobs)...', 'translatesense' ), $completed_jobs + 1, $total_jobs );
		}

		return array(
			'success'           => true,
			'batch_id'          => $batch_id,
			'overall_status'    => $overall_status,
			'progress_percent'  => $overall_progress,
			'current_status'    => $current_status,
			'total_jobs'        => $total_jobs,
			'completed_jobs'    => $completed_jobs,
			'failed_jobs'       => $failed_jobs,
			'running_jobs'      => $running_jobs,
			'pending_jobs'      => $pending_jobs,
			'total_strings'     => $total_strings,
			'completed_strings' => $completed_strings,
			'pending_strings'   => $pending_strings,
			'items'             => $items,
		);
	}
}
