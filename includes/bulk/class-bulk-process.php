<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Bulk;

use TranslateSense\Includes\Content\Parser\Content_Parser;
use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Manager;
use TranslateSense\Includes\Content\Parser\Taxonomy\Taxonomy_Parser;
use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\Translation\Taxonomy\Taxonomy_Translator;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Admin\Editor_Integration;
use TranslateSense\Includes\Translation\Statics;
use TranslateSense\Includes\Content\Processor\Block_Processor;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bulk_Process {

	const CRON_HOOK           = 'translatesense_bulk_process_cron';
	const IMMEDIATE_CRON_HOOK = 'translatesense_bulk_process_now';
	const CRON_INTERVAL       = 'translatesense_batch_interval';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'add_cron_intervals' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'process_cron_tick' ) );
		add_action( self::IMMEDIATE_CRON_HOOK, array( __CLASS__, 'process_cron_tick' ) );
	}

	/**
	 * Add custom batch intervals (every minute / 30 seconds).
	 */
	public static function add_cron_intervals( $schedules ) {
		if ( ! isset( $schedules[ self::CRON_INTERVAL ] ) ) {
			$schedules[ self::CRON_INTERVAL ] = array(
				'interval' => 60,
				'display'  => __( 'Every Minute (TranslateSense Bulk Queue)', 'translatesense' ),
			);
		}
		return $schedules;
	}

	/**
	 * Get queue table name.
	 *
	 * @return string
	 */
	final public static function get_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_queue';
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
	 * Filter and deduplicate user-passed post IDs for bulk translation so that
	 * linked translations of the same content are not duplicated in the batch.
	 *
	 * @param array $post_ids Raw or sanitized post IDs passed by the user.
	 * @return int[] Filtered post IDs with linked duplicates removed.
	 */
	public static function filter_linked_posts( array $post_ids ): array {
		$clean_post_ids = array_values(
			array_unique(
				array_filter(
					array_map( 'absint', $post_ids )
				)
			)
		);

		if ( empty( $clean_post_ids ) ) {
			return array();
		}

		// If Polylang is not active, posts cannot be linked translations via Polylang
		if ( ! class_exists( Polylang_Bridge::class ) || ! Polylang_Bridge::is_polylang_active() ) {
			return $clean_post_ids;
		}

		$default_lang = Polylang_Bridge::get_default_language();

		$processed_group_keys = array();
		$filtered_post_ids    = array();
		$selected_lookup      = array_fill_keys( $clean_post_ids, true );
		$filtered_lookup      = array();

		foreach ( $clean_post_ids as $post_id ) {
			if ( $post_id <= 0 ) {
				continue;
			}

			// Retrieve all linked translations for this post
			$translations = (array) Polylang_Bridge::get_post_translations( $post_id );

			// If no linked translations found, keep the post as-is
			if ( empty( $translations ) ) {
				if ( ! isset( $filtered_lookup[ $post_id ] ) ) {
					$filtered_post_ids[]         = $post_id;
					$filtered_lookup[ $post_id ] = true;
				}
				continue;
			}

			// Create a unique group key based on sorted translation post IDs
			$group_ids = array_values( array_unique( array_filter( array_map( 'absint', $translations ) ) ) );
			sort( $group_ids );
			$group_key = implode( '_', $group_ids );

			// If this translation group has already been handled, skip
			if ( isset( $processed_group_keys[ $group_key ] ) ) {
				continue;
			}
			$processed_group_keys[ $group_key ] = true;

			// Posts from this translation group that were passed in the user's post_ids
			$selected_in_group = array();
			foreach ( $group_ids as $pid ) {
				if ( isset( $selected_lookup[ $pid ] ) ) {
					$selected_in_group[] = $pid;
				}
			}

			if ( empty( $selected_in_group ) ) {
				continue;
			}

			// Identify default language post ID for this group
			$default_post_id      = isset( $translations[ $default_lang ] ) ? absint( $translations[ $default_lang ] ) : 0;
			$default_in_user_list = ( $default_post_id > 0 && in_array( $default_post_id, $selected_in_group, true ) );

			// Check which selected posts have package strings saved in translatesense_packages
			$posts_with_packages = array();
			if ( class_exists( Hashing_Db::class ) ) {
				foreach ( $selected_in_group as $pid ) {
					if ( Hashing_Db::has_post_packages( $pid ) ) {
						$posts_with_packages[] = $pid;
					}
				}
			}

			$chosen_id = 0;

			if ( ! empty( $posts_with_packages ) ) {
				if ( $default_in_user_list && in_array( $default_post_id, $posts_with_packages, true ) ) {
					$chosen_id = $default_post_id;
				} else {
					$chosen_id = $posts_with_packages[0];
				}
			} elseif ( $default_in_user_list ) {
					$chosen_id = $default_post_id;
			} else {
				$chosen_id = $selected_in_group[0];
			}

			if ( $chosen_id > 0 && ! isset( $filtered_lookup[ $chosen_id ] ) ) {
				$filtered_post_ids[]           = $chosen_id;
				$filtered_lookup[ $chosen_id ] = true;
			}
		}

		return $filtered_post_ids;
	}

	public static function create_batch( array $post_ids, array $target_languages, string $provider = 'openai', array $options = array() ): array {
		global $wpdb;

		$table    = self::get_table_name();
		$batch_id = wp_generate_uuid4();
		$provider = sanitize_key( $provider );

		if ( '' === $provider ) {
			return array(
				'batch_id'   => '',
				'total_jobs' => 0,
				'jobs'       => array(),
				'post_ids'   => array(),
				'is_backend' => false,
				'provider'   => '',
				'error'      => __( 'Please select a valid translation provider.', 'translatesense' ),
			);
		}

		$subtype = sanitize_key( (string) ( $options['subtype'] ?? '' ) );
		$type    = sanitize_key( (string) ( $options['type'] ?? '' ) );
		if ( 'term' !== $type && '' !== $subtype && taxonomy_exists( $subtype ) ) {
			$type = 'term';
		} elseif ( 'term' !== $type ) {
			$type = 'post';
		}

		$is_term = ( 'term' === $type );
		if ( $is_term && '' === $subtype && ! empty( $post_ids ) ) {
			$first_term = get_term( absint( reset( $post_ids ) ) );
			if ( $first_term instanceof \WP_Term ) {
				$subtype = sanitize_key( (string) $first_term->taxonomy );
			}
		}

		if ( $is_term && ( '' === $subtype || ! Taxonomy_Parser::is_translatable_taxonomy( $subtype ) ) ) {
			return array(
				'batch_id'   => '',
				'type'       => 'term',
				'subtype'    => $subtype,
				'total_jobs' => 0,
				'jobs'       => array(),
				'post_ids'   => array(),
				'is_backend' => false,
				'provider'   => $provider,
				'error'      => __( 'The selected taxonomy is not registered or supported for translation in Polylang.', 'translatesense' ),
			);
		}

		$is_chrome_ai = ( 'chrome_ai' === $provider || 'chrome_local_ai' === $provider );
		$is_backend   = ! $is_chrome_ai && ! $is_term;

		if ( $is_term ) {
			$filtered_terms = Taxonomy_Parser::filter_linked_terms( $post_ids, $subtype );
			$ordered_terms  = Taxonomy_Parser::order_terms_parent_first( $filtered_terms, $subtype );
			$post_ids       = array_keys( $ordered_terms );
		} else {
			$post_ids = self::filter_linked_posts( $post_ids );
		}

		$now_utc          = gmdate( 'Y-m-d H:i:s' );
		$created_by       = absint( get_current_user_id() );
		$item_type        = $is_term ? 'taxonomy' : 'post';
		$created_jobs     = array();
		$has_pending_jobs = false;
		$languages        = ! $is_term ? Polylang_Bridge::get_languages() : array();
		$seen_pairs       = array();
		$cutoff           = time() - DAY_IN_SECONDS;
		$cutoff_mysql     = gmdate( 'Y-m-d H:i:s', $cutoff );
		$clean_languages  = array();
		foreach ( $target_languages as $language ) {
			if ( is_string( $language ) || is_numeric( $language ) ) {
				$language = sanitize_key( (string) $language );
				if ( '' !== $language ) {
					$clean_languages[] = $language;
				}
			}
		}
		$target_languages = array_values( array_unique( $clean_languages ) );

		foreach ( $post_ids as $p_id ) {
			$item_id     = (int) $p_id;
			$source_term = $is_term ? get_term( $item_id, $subtype ) : null;
			$source_post = ! $is_term ? get_post( $item_id ) : null;

			if ( $is_term ? ( ! $source_term instanceof \WP_Term ) : ( ! $source_post instanceof \WP_Post ) ) {
				continue;
			}
			$item_subtype = $is_term ? (string) $source_term->taxonomy : (string) $source_post->post_type;

			foreach ( $target_languages as $lang ) {
				$target_lang = sanitize_key( $lang );
				if ( '' === $target_lang ) {
					continue;
				}

				$pair_key = $item_id . ':' . $target_lang;
				if ( isset( $seen_pairs[ $pair_key ] ) ) {
					continue;
				}
				$seen_pairs[ $pair_key ] = true;

				if ( ! $is_term ) {
					// A recent pending job already covers this post and language.
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
					$pending_job_id = $wpdb->get_var(
						$wpdb->prepare(
							"SELECT id FROM {$table} WHERE post_id = %d AND item_type = %s AND target_language = %s AND status = 'pending' AND created_at >= %s AND provider IN ('openai', 'gemini') ORDER BY id DESC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
							$item_id,
							$item_type,
							$target_lang,
							$cutoff_mysql
						)
					);
					if ( $pending_job_id ) {
						continue;
					}
				}

				$error_message     = null;
				$is_trashed_target = false;

				if ( $source_term instanceof \WP_Term ) {
					$term_state          = Taxonomy_Translator::term_has_completed_translation( $item_id, $source_term->taxonomy, $target_lang );
					$existing_target_id  = (int) $term_state['target_term_id'];
					$has_existing_target = $term_state['exists'] && ! $term_state['is_same_lang'] && $existing_target_id > 0;
					$should_skip         = $term_state['is_same_lang'] || ( $term_state['exists'] && ! $term_state['needs_update'] );

					$job_status      = $should_skip ? 'already_exists' : 'processing';
					$progress_status = $term_state['is_same_lang']
						? 'Source term already uses target language'
						: ( $has_existing_target
							? ( $term_state['needs_update'] ? 'Queued to update existing translation' : 'Already exists' )
							: 'Queued' );
					$target_post_id  = $has_existing_target ? $existing_target_id : 0;
				} else {
					$existing_trans_id   = self::get_existing_translation_post_id( $item_id, $target_lang );
					$is_same_lang        = ( $existing_trans_id > 0 && $existing_trans_id === $item_id );
					$has_existing_target = $existing_trans_id > 0 && $existing_trans_id !== $item_id;
					$target_post_id      = $has_existing_target ? $existing_trans_id : 0;
					$target_lang_name    = ! empty( $languages[ $target_lang ]['name'] )
						? sanitize_text_field( (string) $languages[ $target_lang ]['name'] )
						: strtoupper( $target_lang );

					$job_status      = $existing_trans_id ? 'already_exists' : 'pending';
					$progress_status = $is_same_lang
						? 'Source already uses target language'
						: ( $has_existing_target ? 'Already exists' : 'Queued' );

					if ( $has_existing_target ) {
						$existing_post   = get_post( $existing_trans_id );
						$existing_status = ( $existing_post instanceof \WP_Post ) ? (string) $existing_post->post_status : '';

						if ( 'trash' === $existing_status ) {
							$is_trashed_target = true;
							$progress_status   = 'Already Exist in Trash';
							$error_message     = sprintf(
								/* translators: %s: Target language name */
								__( 'This post already has a %s translation in the Trash. Delete the existing translated post first if you want to translate it again.', 'translatesense' ),
								$target_lang_name
							);
						}
					}
				}

				$insert_data = array(
					'batch_id'          => $batch_id,
					'item_type'         => $item_type,
					'post_id'           => $item_id,
					'created_by'        => $created_by,
					'target_language'   => $target_lang,
					'provider'          => $provider,
					'status'            => $job_status,
					'progress_status'   => $progress_status,
					'total_strings'     => 0,
					'completed_strings' => 0,
					'sent_data'         => null,
					'receive_data'      => null,
					'error_message'     => $error_message,
					'target_post_id'    => $target_post_id,
					'created_at'        => $now_utc,
					'updated_at'        => $now_utc,
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				if ( false === $wpdb->insert( $table, $insert_data, array( '%s', '%s', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' ) ) ) {
					continue;
				}

				$job_id = (int) $wpdb->insert_id;
				if ( $job_id <= 0 ) {
					continue;
				}

				if ( 'pending' === $job_status ) {
					$has_pending_jobs = true;
				}

				$insert_data['id']         = $job_id;
				$insert_data['subtype']    = $item_subtype;
				$insert_data['created_at'] = str_replace( ' ', 'T', $now_utc ) . 'Z';
				$insert_data['updated_at'] = str_replace( ' ', 'T', $now_utc ) . 'Z';

				if ( $source_term instanceof \WP_Term ) {
					$target_term_obj                  = $has_existing_target ? get_term( $target_post_id, $source_term->taxonomy ) : null;
					$insert_data['editor_type']       = 'taxonomy';
					$insert_data['post_title']        = ! empty( $source_term->name ) ? $source_term->name : sprintf( '#%d', $item_id );
					$insert_data['target_post_title'] = ( $target_term_obj instanceof \WP_Term ) ? $target_term_obj->name : '';
					$insert_data['view_url']          = $has_existing_target ? self::get_safe_term_link( $target_post_id, $source_term->taxonomy ) : '';
					$insert_data['edit_url']          = $has_existing_target ? (string) get_edit_term_link( $target_post_id, $source_term->taxonomy ) : '';
				} else {
					$raw_source_title                 = get_the_title( $item_id );
					$raw_target_title                 = $has_existing_target ? get_the_title( $target_post_id ) : '';
					$insert_data['editor_type']       = Editor_Integration::get_post_editor_type( $has_existing_target ? $target_post_id : $item_id );
					$insert_data['post_title']        = ! empty( $raw_source_title ) ? $raw_source_title : sprintf( '#%d', $item_id );
					$insert_data['target_post_title'] = ! empty( $raw_target_title ) ? $raw_target_title : '';
					$insert_data['view_url']          = ( $has_existing_target && ! $is_trashed_target ) ? get_permalink( $target_post_id ) : '';
					$insert_data['edit_url']          = ( $has_existing_target && $target_post_id && ! $is_trashed_target ) ? Editor_Integration::get_post_edit_link( $target_post_id ) : '';
				}

				$created_jobs[] = $insert_data;
			}
		}

		// If backend post queue needs WP-Cron, schedule and trigger immediately.
		if ( $is_backend && $has_pending_jobs && self::has_pending_or_running_jobs() ) {
			self::schedule_cron_if_needed();
			self::trigger_async_cron();
		}

		return array(
			'batch_id'   => $batch_id,
			'type'       => $type,
			'subtype'    => $subtype,
			'total_jobs' => count( $created_jobs ),
			'notice'     => empty( $created_jobs ) ? __( 'No new translation jobs were added. Recent pending jobs may already exist, or the selected items could not be queued.', 'translatesense' ) : '',
			'jobs'       => $created_jobs,
			'post_ids'   => $post_ids,
			'is_backend' => $is_backend,
			'provider'   => $provider,
		);
	}

	/**
	 * Resolve a permalink URL for a translated term without WP_Error propagation.
	 *
	 * @param int    $term_id  Term ID.
	 * @param string $taxonomy Taxonomy slug.
	 * @return string
	 */
	public static function get_safe_term_link( int $term_id, string $taxonomy ): string {
		$link = get_term_link( $term_id, $taxonomy );
		return is_wp_error( $link ) ? '' : $link;
	}

	/**
	 * Mark queue posts older than 1 day (24 hours) as failed so they are not translated.
	 *
	 * @return int Number of updated expired jobs.
	 */
	public static function cleanup_expired_jobs(): int {
		global $wpdb;
		$table      = self::get_table_name();
		$cutoff     = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );
		$updated_at = gmdate( 'Y-m-d H:i:s' );
		$error      = __( 'Translation job expired: it remained pending for more than 1 day.', 'translatesense' );
		$label      = __( 'Failed: Job expired (more than 1 day old)', 'translatesense' );

		// Only expire jobs that have not started. A running AI request can take longer
		// than a day on some providers and must not be failed by a polling request.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'failed', progress_status = %s, error_message = %s, updated_at = %s WHERE status = 'pending' AND item_type = 'post' AND created_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$label,
				$error,
				$updated_at,
				$cutoff
			)
		);

		return false === $result ? 0 : (int) $result;
	}

	/**
	 * Check if table has pending or running jobs that require backend processing.
	 */
	public static function has_pending_or_running_jobs(): bool {
		global $wpdb;
		$table = self::get_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$count = (int) $wpdb->get_var(
			"SELECT COUNT(id) FROM {$table} WHERE status IN ('pending', 'running') AND item_type = 'post' AND provider NOT IN ('chrome_ai', 'chrome_local_ai')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		return $count > 0;
	}

	/**
	 * Check if table has active backend background jobs for eligible AI providers (OpenAI, Gemini).
	 */
	public static function has_active_background_jobs(): bool {
		global $wpdb;
		$table = self::get_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$count = (int) $wpdb->get_var(
			"SELECT COUNT(id) FROM {$table} WHERE status IN ('pending', 'running', 'cancelling') AND item_type = 'post' AND provider IN ('openai', 'gemini')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		return $count > 0;
	}

	/**
	 * Get list of active background batches (OpenAI / Gemini) with status.
	 *
	 * @return array
	 */
	public static function get_active_background_batches(): array {
		global $wpdb;
		$table = self::get_table_name();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$batch_ids = $wpdb->get_col(
			"SELECT DISTINCT batch_id FROM {$table} WHERE status IN ('pending', 'running', 'cancelling') AND item_type = 'post' AND provider IN ('openai', 'gemini') ORDER BY id DESC" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		if ( empty( $batch_ids ) ) {
			return array();
		}

		$batches = array();
		foreach ( $batch_ids as $b_id ) {
			$batch_status = self::get_batch_status( (string) $b_id );
			if ( ! empty( $batch_status['items'] ) ) {
				$batches[] = $batch_status;
			}
		}

		return $batches;
	}

	/**
	 * Schedule cron if needed for backend jobs.
	 */
	public static function schedule_cron_if_needed(): void {
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + MINUTE_IN_SECONDS, self::CRON_INTERVAL, self::CRON_HOOK );
		}
	}

	/**
	 * Remove queue cron events only when no backend jobs remain.
	 */
	public static function unschedule_cron_if_idle(): void {
		if ( self::has_pending_or_running_jobs() ) {
			return;
		}

		wp_clear_scheduled_hook( self::CRON_HOOK );
		wp_clear_scheduled_hook( self::IMMEDIATE_CRON_HOOK );
	}

	/**
	 * Schedule an immediate single event and ask WP-Cron to spawn asynchronously.
	 * This is called from the batch-creation request, not from the worker itself.
	 */
	public static function trigger_async_cron(): void {
		if ( ! wp_next_scheduled( self::IMMEDIATE_CRON_HOOK ) ) {
			wp_schedule_single_event( time(), self::IMMEDIATE_CRON_HOOK );
		}

		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
	}

	/**
	 * Main background worker.
	 *
	 * Processes queued jobs within the configured job and time limits.
	 * Pauses before starting another job when PHP memory is nearly exhausted.
	 *
	 * @return void
	 */
	public static function process_cron_tick(): void {
		global $wpdb;

		// MySQL advisory lock serializes workers across concurrent WP-Cron requests.
		$lock_name = 'ts_bulk_' . substr( hash( 'sha256', (string) site_url() ), 0, 32 );
		$lock      = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock_name ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching,

		if ( '1' !== (string) $lock ) {
			return;
		}

		$started_at        = microtime( true );
		$processed_jobs    = 0;
		$max_jobs          = (int) apply_filters( 'translatesense_bulk_worker_max_jobs', 25 );
		$time_budget       = (float) apply_filters( 'translatesense_bulk_worker_time_budget', 50 );
		$paused_for_memory = false;
		$has_more_jobs     = false;

		$max_jobs    = max( 1, min( 100, $max_jobs ) );
		$time_budget = max( 5, min( 55, $time_budget ) );

		try {
			self::cleanup_expired_jobs();

			while ( $processed_jobs < $max_jobs ) {
				// Do not start another job when PHP memory is nearly exhausted.
				if ( self::should_pause_processing() ) {
					$paused_for_memory = true;
					break;
				}

				// Leave enough time for WordPress to finish the request cleanly.
				if ( ( microtime( true ) - $started_at ) >= $time_budget ) {
					break;
				}

				if ( ! self::has_pending_backend_jobs() ) {
					break;
				}

				self::process_next_backend_job();
				++$processed_jobs;
			}

			$has_more_jobs = self::has_pending_backend_jobs();
		} finally {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}

		if ( $has_more_jobs || self::has_pending_or_running_jobs() ) {
			// Keep the one-minute recurring event as a safety net. Under normal
			// conditions the current worker drains the queue without waiting for it.
			self::schedule_cron_if_needed();

			// Continue shortly when the worker reaches its job limit.
			// If memory is high, let the recurring event retry after approximately 60s.
			if ( ! $paused_for_memory && $has_more_jobs && $processed_jobs >= $max_jobs ) {
				self::schedule_worker_continuation();
			}
		} else {
			self::unschedule_cron_if_idle();
		}
	}

	/**
	 * Check for pending backend jobs without running cleanup queries.
	 *
	 * @return bool
	 */
	private static function has_pending_backend_jobs(): bool {
		global $wpdb;
		$table = self::get_table_name();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$job_id = $wpdb->get_var(
			"SELECT id FROM {$table} WHERE status = 'pending' AND item_type = 'post' AND provider NOT IN ('chrome_ai', 'chrome_local_ai') ORDER BY id ASC LIMIT 1" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		return ! empty( $job_id );
	}

	/**
	 * Schedule a short continuation when a healthy worker reaches its job cap.
	 * WP-Cron's own lock may defer spawning until the current cron request exits;
	 * the recurring event remains the reliable fallback.
	 *
	 * @return void
	 */
	private static function schedule_worker_continuation(): void {
		if ( ! wp_next_scheduled( self::IMMEDIATE_CRON_HOOK ) ) {
			wp_schedule_single_event( time() + 5, self::IMMEDIATE_CRON_HOOK );
		}
	}

	/**
	 * Check whether PHP memory usage is approaching its limit.
	 *
	 * @return bool
	 */
	private static function should_pause_processing(): bool {
		$memory_limit = wp_convert_hr_to_bytes( ini_get( 'memory_limit' ) );

		if ( $memory_limit <= 0 ) {
			return false;
		}

		return memory_get_usage() >= ( $memory_limit * 0.80 );
	}

	/**
	 * Process exactly one backend job. The public worker owns the global lock
	 * and decides whether to claim another job in the same execution.
	 */
	private static function process_next_backend_job(): void {
		global $wpdb;
		$table = self::get_table_name();

		// Fail any queue post more than 1 day old so it is not translated
		self::cleanup_expired_jobs();

		// Do not reset stale running jobs solely by age: an AI request may legitimately take longer than 10 minutes.

		// Clean up any stale cancelling jobs older than 10 minutes
		$stale_cancelling_cutoff = gmdate( 'Y-m-d H:i:s', time() - ( 10 * MINUTE_IN_SECONDS ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'skipped', progress_status = 'Skipped by user', updated_at = %s WHERE status = 'cancelling' AND item_type = 'post' AND updated_at < %s AND provider NOT IN ('chrome_ai', 'chrome_local_ai')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				gmdate( 'Y-m-d H:i:s' ),
				$stale_cancelling_cutoff
			)
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$job = $wpdb->get_row(
			"SELECT * FROM {$table} WHERE status = 'pending' AND item_type = 'post' AND provider NOT IN ('chrome_ai', 'chrome_local_ai') ORDER BY id ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			ARRAY_A
		);

		if ( ! $job ) {
			// No more pending jobs, remove cron if everything is completed/failed/skipped
			self::unschedule_cron_if_idle();
			return;
		}

		$job_id                  = (int) $job['id'];
		$post_id                 = (int) $job['post_id'];
		$stored_user_id          = isset( $job['created_by'] ) ? absint( $job['created_by'] ) : 0;
		$target_lang             = $job['target_language'];
		$provider                = $job['provider'];
		$existing_target_post_id = absint( $job['target_post_id'] );
		$is_retranslation        = $existing_target_post_id > 0 && $existing_target_post_id !== $post_id;

		// Double-check: if queue post is more than 1 day old, fail it immediately and do not translate
		$created_ts = ! empty( $job['created_at'] ) ? strtotime( $job['created_at'] . ' UTC' ) : 0;
		if ( $created_ts > 0 && ( time() - $created_ts ) >= DAY_IN_SECONDS ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->update(
				$table,
				array(
					'status'          => 'failed',
					'progress_status' => 'Failed: Job expired (more than 1 day old)',
					'error_message'   => __( 'Translation job expired: queued for more than 1 day.', 'translatesense' ),
					'updated_at'      => gmdate( 'Y-m-d H:i:s' ),
				),
				array( 'id' => $job_id ),
				array( '%s', '%s', '%s', '%s' ),
				array( '%d' )
			);

			if ( ! self::has_pending_or_running_jobs() ) {
				self::unschedule_cron_if_idle();
			}
			return;
		}

		// Atomically claim and mark as running
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$claimed = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'running', progress_status = %s, updated_at = %s WHERE id = %d AND status = 'pending'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$is_retranslation ? 'Preparing existing translation update...' : 'Extracting strings...',
				gmdate( 'Y-m-d H:i:s' ),
				$job_id
			)
		);

		if ( ! $claimed ) {
			// Job was claimed by another thread or already skipped
			if ( ! self::has_pending_or_running_jobs() ) {
				self::unschedule_cron_if_idle();
			}
			return;
		}

		$start_time  = microtime( true );
		$total_str   = 0;
		$total_chars = 0;

		try {
			$source_post = get_post( $post_id );
			if ( ! $source_post ) {
				throw new \Exception( sprintf( 'Post #%d does not exist.', $post_id ) );
			}

			$perm_context = self::validate_cron_job_permissions( $stored_user_id, $post_id, $target_lang, $existing_target_post_id );

			$source_lang = Polylang_Bridge::get_post_language( $post_id );
			$editor_type = Editor_Integration::get_post_editor_type( $post_id );

			$package_options = array();
			if ( Polylang_Bridge::is_custom_fields_sync_enabled() ) {
				$package_options['exclude'] = array( 'custom_field' ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude
			}

			// 1. Extract packages array (contains hash, strings, widget info)
			$packages = Hashing_Db::get_post_package( $post_id, $source_lang, $editor_type, $package_options );

			if ( empty( $packages ) ) {
				$packages = Content_Parser::parse( '', $post_id, $source_lang, $editor_type );
			}

			// Synchronize dynamic custom-field packages and refresh package list
			Custom_Field_Manager::ensure_package_prepared( $post_id, $source_lang, $editor_type );
			$packages = Hashing_Db::get_post_package( $post_id, $source_lang, $editor_type, $package_options );

			if ( ! is_array( $packages ) ) {
				throw new \UnexpectedValueException( 'The translation package data is invalid.' );
			}

			$taxonomy_strings = Taxonomy_Parser::extract_strings(
				$post_id,
				$target_lang,
				$perm_context['user_id'],
				$perm_context['enforce_permissions']
			);
			if ( ! empty( $taxonomy_strings ) ) {
				$packages = array_merge( $packages, $taxonomy_strings );
			}

			$packages = array_values( $packages );
			foreach ( $packages as $package ) {
				if ( ! is_array( $package ) ) {
					throw new \UnexpectedValueException( 'A translation package has an invalid format.' );
				}
			}

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
				$total_chars += function_exists( 'mb_strlen' ) ? mb_strlen( (string) $str_to_count, 'UTF-8' ) : strlen( (string) $str_to_count );
			}

			// Check if cancellation was requested before calling AI
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$pre_ai_status = $wpdb->get_var(
				$wpdb->prepare( "SELECT status FROM {$table} WHERE id = %d", $job_id ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			);

			if ( 'cancelling' === $pre_ai_status || 'skipped' === $pre_ai_status ) {
				// Cancellation requested: skip immediately without calling AI
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table} SET status = 'skipped', progress_status = %s, updated_at = %s WHERE id = %d AND status IN ('cancelling', 'running')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						__( 'Skipped by user', 'translatesense' ),
						gmdate( 'Y-m-d H:i:s' ),
						$job_id
					)
				);

				if ( ! self::has_pending_or_running_jobs() ) {
					self::unschedule_cron_if_idle();
				}
				return;
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
					'updated_at'      => gmdate( 'Y-m-d H:i:s' ),
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
				throw new \RuntimeException( 'Failed to translate strings: ' . $ai_response->get_error_message() );
			}
			if ( ! is_array( $ai_response ) ) {
				throw new \UnexpectedValueException( 'The translation provider returned an invalid response.' );
			}

			// Check if cancellation was requested while AI was processing
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$post_ai_status = $wpdb->get_var(
				$wpdb->prepare( "SELECT status FROM {$table} WHERE id = %d", $job_id ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			);

			if ( 'cancelling' === $post_ai_status || 'skipped' === $post_ai_status ) {
				// Cancellation requested: DO NOT apply AI response to target post and DO NOT save translation
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table} SET status = 'skipped', progress_status = %s, updated_at = %s WHERE id = %d AND status IN ('cancelling', 'running')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						__( 'Skipped by user', 'translatesense' ),
						gmdate( 'Y-m-d H:i:s' ),
						$job_id
					)
				);

				if ( ! self::has_pending_or_running_jobs() ) {
					self::unschedule_cron_if_idle();
				}
				return;
			}

			$translated_content     = array();
			$in_memory_translations = array();

			// 3. Match AI response by index in packages array and set translated value to hash
			foreach ( $strings_to_send as $idx => $orig_str ) {
				if ( ! isset( $ai_response[ $idx ] ) || ! is_array( $ai_response[ $idx ] ) || ! array_key_exists( 'translated', $ai_response[ $idx ] ) || ! is_scalar( $ai_response[ $idx ]['translated'] ) ) {
					throw new \UnexpectedValueException( sprintf( 'The translation provider did not return a valid translation for string index %s.', (string) $idx ) );
				}

				$translated_str = (string) $ai_response[ $idx ]['translated'];

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
					if ( Translate::should_cache_provider( $provider ) && $orig_str !== $translated_str ) {
						$string_hash = md5( (string) $orig_str );
						Hashing_Db::save_translation_result( $string_hash, $target_lang, $translated_str );
					}
				}
			}

			// Final pre-save check: ensure cancellation was not requested immediately before DB write
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$pre_save_status = $wpdb->get_var(
				$wpdb->prepare( "SELECT status FROM {$table} WHERE id = %d", $job_id ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			);

			if ( 'cancelling' === $pre_save_status || 'skipped' === $pre_save_status ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table} SET status = 'skipped', progress_status = %s, updated_at = %s WHERE id = %d AND status IN ('cancelling', 'running')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						__( 'Skipped by user', 'translatesense' ),
						gmdate( 'Y-m-d H:i:s' ),
						$job_id
					)
				);

				if ( ! self::has_pending_or_running_jobs() ) {
					self::unschedule_cron_if_idle();
				}
				return;
			}

			// Revalidate initiating user capabilities right before applying translations.
			$perm_context = self::validate_cron_job_permissions( $stored_user_id, $post_id, $target_lang, $existing_target_post_id );

			// 4. Execute post translation.
			$result = self::execute_post_translation_sync(
				$post_id,
				$target_lang,
				$provider,
				$in_memory_translations,
				array(
					'user_id'             => $perm_context['user_id'],
					'enforce_permissions' => $perm_context['enforce_permissions'],
					'skip_unauthorized'   => false,
				)
			);

			if ( is_wp_error( $result ) ) {
				throw new \RuntimeException( $result->get_error_message() );
			}
			if ( ! is_array( $result ) || empty( $result['target_post_id'] ) ) {
				throw new \UnexpectedValueException( 'The translated post could not be created or updated.' );
			}

			$target_post_id  = isset( $result['target_post_id'] ) ? absint( $result['target_post_id'] ) : 0;
			$sync_warnings   = ! empty( $result['sync_warnings'] ) ? (array) $result['sync_warnings'] : array();
			$completed_label = $is_retranslation
				? __( 'Existing translation updated successfully', 'translatesense' )
				: __( 'Completed successfully', 'translatesense' );

			if ( ! empty( $sync_warnings ) ) {
				$completed_label = __( 'Translation completed with synchronization warnings. Review the target post.', 'translatesense' );
			}

			// If target post contains Gutenberg blocks, mark for block processor check
			if ( $target_post_id > 0 ) {
				$target_post = get_post( $target_post_id );
				if ( $target_post && function_exists( 'has_blocks' ) && has_blocks( $target_post->post_content ) ) {
					Block_Processor::mark_process_pending( $target_post_id );
				}
			}

			// 5. Mark as completed and save translated strings array (only if job was still running)
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$completed = $wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table} SET status = 'completed', progress_status = %s, completed_strings = %d, target_post_id = %d, receive_data = %s, error_message = NULL, updated_at = %s WHERE id = %d AND status = 'running'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$completed_label,
					$total_str,
					$target_post_id,
					wp_json_encode( $translated_content ),
					gmdate( 'Y-m-d H:i:s' ),
					$job_id
				)
			);

			if ( 1 !== (int) $completed ) {
				throw new \RuntimeException( 'The job status changed before completion could be saved.' );
			}

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
			// Check if failure occurred during or after a cancellation request
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$err_status = $wpdb->get_var(
				$wpdb->prepare( "SELECT status FROM {$table} WHERE id = %d", $job_id ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			);

			if ( 'cancelling' === $err_status || 'skipped' === $err_status ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table} SET status = 'skipped', progress_status = %s, updated_at = %s WHERE id = %d AND status IN ('cancelling', 'running')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						__( 'Skipped by user', 'translatesense' ),
						gmdate( 'Y-m-d H:i:s' ),
						$job_id
					)
				);
			} else {
				self::update_job(
					$job_id,
					array(
						'status'          => 'failed',
						'progress_status' => 'Failed: ' . substr( $e->getMessage(), 0, 80 ),
						'error_message'   => $e->getMessage(),
						'updated_at'      => gmdate( 'Y-m-d H:i:s' ),
					)
				);

				$elapsed_ms = isset( $start_time ) ? (int) round( ( microtime( true ) - $start_time ) * 1000 ) : 0;
				Statics::update_translation_statistics(
					array(
						'status'           => 'failed',
						'total_characters' => 0,
						'total_strings'    => 0,
						'provider'         => $provider,
						'time_take'        => $elapsed_ms,
						'request_id'       => 'bulk_cron_job_' . $job_id,
					)
				);
			}
		}

		// The outer worker decides whether to process another job or pause.
	}

	/**
	 * Validate the stored initiating user's current capabilities for a cron job.
	 *
	 * Requires a valid initiating user (`created_by > 0`) who still exists and
	 * currently holds post and taxonomy capabilities via `user_can()`.
	 *
	 * @param int    $user_id                 Stored initiating user ID.
	 * @param int    $post_id                 Source post ID.
	 * @param string $target_lang             Target language slug.
	 * @param int    $existing_target_post_id Existing target post ID if known.
	 * @return array{ user_id: int, enforce_permissions: bool }
	 * @throws \RuntimeException When the initiating user is missing, no longer exists, or lacks required capabilities.
	 */
	private static function validate_cron_job_permissions(
		int $user_id,
		int $post_id,
		string $target_lang,
		int $existing_target_post_id = 0
	): array {
		if ( $user_id <= 0 ) {
			throw new \RuntimeException( esc_html__( 'The translation job has no valid initiating user.', 'translatesense' ) );
		}

		$user = get_userdata( $user_id );
		if ( ! $user instanceof \WP_User || ! $user->exists() ) {
			throw new \RuntimeException( esc_html__( 'The initiating user no longer exists.', 'translatesense' ) );
		}

		$source_post = get_post( $post_id );
		if ( ! $source_post || ! user_can( $user, 'edit_post', $post_id ) ) {
			throw new \RuntimeException( esc_html__( 'The initiating user no longer has permission to edit the source post.', 'translatesense' ) );
		}

		$target_post_id = $existing_target_post_id > 0
			? $existing_target_post_id
			: self::get_existing_translation_post_id( $post_id, $target_lang );

		if ( $target_post_id > 0 && $target_post_id !== $post_id ) {
			if ( ! get_post( $target_post_id ) || ! user_can( $user, 'edit_post', $target_post_id ) ) {
				throw new \RuntimeException( esc_html__( 'The initiating user no longer has permission to update the target translation post.', 'translatesense' ) );
			}
		} else {
			$post_type_obj     = get_post_type_object( $source_post->post_type );
			$create_capability = ( $post_type_obj && ! empty( $post_type_obj->cap->create_posts ) )
				? $post_type_obj->cap->create_posts
				: 'edit_posts';

			if ( ! user_can( $user, $create_capability ) ) {
				throw new \RuntimeException( esc_html__( 'The initiating user no longer has permission to create target translation posts.', 'translatesense' ) );
			}
		}

		$taxonomy_auth = Taxonomy_Translator::check_post_permissions( $post_id, $target_lang, $user_id );
		if ( is_wp_error( $taxonomy_auth ) ) {
			throw new \RuntimeException( esc_html( $taxonomy_auth->get_error_message() ) );
		}

		return array(
			'user_id'             => $user_id,
			'enforce_permissions' => true,
		);
	}

	/**
	 * Synchronously translate a complete post (Title, Content, Elementor/Gutenberg data) and create Polylang linked post.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $in_memory_translations
	 * @param array  $options
	 * @return array|WP_Error
	 */
	public static function execute_post_translation_sync( int $post_id, string $target_lang, string $provider, array $in_memory_translations = array(), array $options = array() ) {
		return Translate::translate_post( $post_id, $target_lang, $provider, $in_memory_translations, $options );
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
		$table = self::get_table_name();

		if ( ! isset( $data['updated_at'] ) ) {
			$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );
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
		self::cleanup_expired_jobs();
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
			// An unscoped status request must not expose recent queue records.
			$rows = array();
		}

		$total_jobs          = count( $rows );
		$completed_jobs      = 0;
		$already_exists_jobs = 0;
		$failed_jobs         = 0;
		$running_jobs        = 0;
		$pending_jobs        = 0;
		$skipped_jobs        = 0;

		$total_strings     = 0;
		$completed_strings = 0;

		$items = array();

		foreach ( $rows as $row ) {
			$post_id      = (int) $row['post_id'];
			$row_type     = ! empty( $row['item_type'] ) ? sanitize_key( (string) $row['item_type'] ) : 'post';
			$is_taxonomy  = ( 'taxonomy' === $row_type );
			$required_cap = $is_taxonomy ? 'edit_term' : 'edit_post';

			if ( $post_id <= 0 || ! is_user_logged_in() || ! current_user_can( $required_cap, $post_id ) ) {
				continue;
			}

			$status = $row['status'];
			if ( 'completed' === $status ) {
				++$completed_jobs;
			} elseif ( 'already_exists' === $status ) {
				++$already_exists_jobs;
			} elseif ( 'failed' === $status ) {
				++$failed_jobs;
			} elseif ( 'running' === $status || 'cancelling' === $status ) {
				++$running_jobs;
			} elseif ( 'skipped' === $status ) {
				++$skipped_jobs;
			} else {
				++$pending_jobs;
			}

			$t_str = (int) $row['total_strings'];
			$c_str = (int) $row['completed_strings'];

			$total_strings     += $t_str;
			$completed_strings += $c_str;

			$target_post_id = (int) $row['target_post_id'];
			if ( $is_taxonomy ) {
				$source_term       = get_term( $post_id );
				$term_taxonomy     = ( $source_term instanceof \WP_Term ) ? (string) $source_term->taxonomy : '';
				$post_title        = ( $source_term instanceof \WP_Term ) ? $source_term->name : sprintf( '#%d', $post_id );
				$target_term       = ( $target_post_id > 0 && '' !== $term_taxonomy ) ? get_term( $target_post_id, $term_taxonomy ) : null;
				$target_post_title = ( $target_term instanceof \WP_Term ) ? $target_term->name : '';
				$editor_type       = 'taxonomy';
				$edit_url          = ( $target_term instanceof \WP_Term ) ? (string) get_edit_term_link( $target_post_id, $term_taxonomy ) : '';
				$view_url          = ( $target_term instanceof \WP_Term && current_user_can( 'edit_term', $target_post_id ) ) ? self::get_safe_term_link( $target_post_id, $term_taxonomy ) : '';

				if ( $target_post_id && ! get_term( $target_post_id, $term_taxonomy ) ) {
					self::update_job( (int) $row['id'], array( 'status' => 'failed' ) );
					$status = 'failed';
				}
			} else {
				$post              = get_post( $post_id );
				$post_title        = $post ? $post->post_title : sprintf( '#%d', $post_id );
				$target_post       = $target_post_id ? get_post( $target_post_id ) : null;
				$target_post_title = $target_post ? $target_post->post_title : '';
				$is_trashed_target = ( $target_post instanceof \WP_Post && 'trash' === $target_post->post_status );
				$editor_type       = $target_post_id ? Editor_Integration::get_post_editor_type( $target_post_id ) : ( $row['editor_type'] ?? 'classic' );
				$edit_url          = ( $target_post_id && ! $is_trashed_target ) ? Editor_Integration::get_post_edit_link( $target_post_id ) : '';
				$view_url          = ( $target_post_id && ! $is_trashed_target && current_user_can( 'edit_post', $target_post_id ) ) ? get_permalink( $target_post_id ) : '';

				if ( $target_post_id && ! get_post( $target_post_id ) ) {
					self::update_job( (int) $row['id'], array( 'status' => 'failed' ) );
					$status = 'failed';
				}
			}

			if ( 'completed' === $status || 'already_exists' === $status || 'skipped' === $status ) {
				$item_progress = 100;
			} elseif ( 'running' === $status || 'processing' === $status || 'cancelling' === $status ) {
				$item_progress = $t_str > 0 ? (int) round( min( 100, max( 0, ( $c_str / $t_str ) * 100 ) ) ) : 0;
			} elseif ( 'failed' === $status ) {
				$item_progress = $t_str > 0 ? (int) round( min( 100, max( 0, ( $c_str / $t_str ) * 100 ) ) ) : 0;
			} else {
				$item_progress = 0;
			}

			$t_chars = 0;
			if ( ! empty( $row['sent_data'] ) ) {
				$sent_arr = json_decode( $row['sent_data'], true );
				if ( is_array( $sent_arr ) ) {
					foreach ( $sent_arr as $item_text ) {
						$t_chars += mb_strlen( (string) $item_text );
					}
				}
			}
			if ( 0 === $t_chars && $t_str > 0 ) {
				$t_chars = $t_str * 45;
			}
			$c_chars = ( 'completed' === $status || 'already_exists' === $status )
				? $t_chars
				: ( $t_str > 0 ? (int) round( ( $c_str / $t_str ) * $t_chars ) : 0 );

			$items[] = array(
				'id'                   => (int) $row['id'],
				'batch_id'             => $row['batch_id'],
				'item_type'            => $row_type,
				'post_id'              => $post_id,
				'post_title'           => $post_title,
				'target_language'      => $row['target_language'],
				'provider'             => $row['provider'],
				'editor_type'          => $editor_type,
				'status'               => $status,
				'progress_status'      => $row['progress_status'],
				'progress_percent'     => $item_progress,
				'total_strings'        => $t_str,
				'completed_strings'    => $c_str,
				'pending_strings'      => max( 0, $t_str - $c_str ),
				'total_characters'     => $t_chars,
				'completed_characters' => $c_chars,
				'target_post_id'       => $target_post_id,
				'target_post_title'    => $target_post_title,
				'edit_url'             => $edit_url,
				'view_url'             => $view_url,
				'error_message'        => $row['error_message'],
				'created_at'           => ! empty( $row['created_at'] ) ? str_replace( ' ', 'T', (string) $row['created_at'] ) . 'Z' : '',
				'updated_at'           => ! empty( $row['updated_at'] ) ? str_replace( ' ', 'T', (string) $row['updated_at'] ) . 'Z' : '',
			);
		}

		$total_jobs = count( $items );

		$pending_strings = max( 0, $total_strings - $completed_strings );

		// Calculate overall batch progress percentage (post-weighted: each post contributes equally)
		$overall_progress = 0;
		if ( $total_jobs > 0 ) {
			$total_progress_sum = 0;
			foreach ( $items as $it ) {
				$st = $it['status'];
				if ( 'completed' === $st || 'already_exists' === $st || 'skipped' === $st ) {
					$total_progress_sum += 100;
				} elseif ( 'running' === $st || 'processing' === $st || 'failed' === $st || 'cancelling' === $st ) {
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
		$done_jobs      = $completed_jobs + $already_exists_jobs + $failed_jobs + $skipped_jobs;
		if ( $total_jobs > 0 && $done_jobs === $total_jobs ) {
			if ( $failed_jobs === $total_jobs ) {
				$overall_status = 'failed';
			} elseif ( $skipped_jobs === $total_jobs ) {
				$overall_status = 'skipped';
			} else {
				$overall_status = 'completed';
			}
		} elseif ( $running_jobs > 0 || $completed_jobs > 0 ) {
			$overall_status = 'running';
		}

		$current_status = 'Queued';
		if ( 'completed' === $overall_status ) {
			if ( $already_exists_jobs > 0 && $completed_jobs > 0 ) {
				/* translators: 1: Number of translated posts, 2: Number of already existing posts */
				$current_status = sprintf( __( 'Completed! %1$d posts translated, %2$d already existed.', 'translatesense' ), $completed_jobs, $already_exists_jobs );
			} elseif ( $already_exists_jobs > 0 && 0 === $completed_jobs && 0 === $failed_jobs ) {
				/* translators: %d: Number of already existing posts */
				$current_status = sprintf( __( 'All %d selected translations already exist.', 'translatesense' ), $already_exists_jobs );
			} elseif ( $failed_jobs > 0 && 0 === $completed_jobs ) {
				/* translators: %d: Number of failed translation jobs */
				$current_status = sprintf( __( 'Completed with %d failed.', 'translatesense' ), $failed_jobs );
			} else {
				/* translators: %d: Number of translated posts */
				$current_status = sprintf( __( 'Completed! %d posts translated successfully.', 'translatesense' ), $completed_jobs );
			}
			if ( $skipped_jobs > 0 ) {
				/* translators: %d: Number of skipped translation jobs */
				$current_status .= sprintf( ' (' . __( '%d skipped', 'translatesense' ) . ')', $skipped_jobs );
			}
		} elseif ( 'skipped' === $overall_status ) {
			$current_status = __( 'Batch translations skipped.', 'translatesense' );
		} elseif ( 'failed' === $overall_status ) {
			$current_status = __( 'Batch translation failed.', 'translatesense' );
		} elseif ( $running_jobs > 0 ) {
			/* translators: 1: Completed jobs count, 2: Total jobs count */
			$current_status = sprintf( __( 'Processing (%1$d/%2$d jobs)...', 'translatesense' ), $completed_jobs + $already_exists_jobs + $skipped_jobs + 1, $total_jobs );
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
			'skipped_jobs'        => $skipped_jobs,
			'total_strings'       => $total_strings,
			'completed_strings'   => $completed_strings,
			'pending_strings'     => $pending_strings,
			'items'               => $items,
		);
	}

	/**
	 * Skip pending and record cancellation for running background translations of a specific post in a batch.
	 *
	 * Restricted strictly to OpenAI and Gemini server-side background translation jobs.
	 *
	 * @param string $batch_id Batch UUID.
	 * @param int    $post_id  Source Post ID.
	 * @return array|WP_Error
	 */
	public static function skip_post_in_batch( string $batch_id, int $post_id ) {
		global $wpdb;
		$table = self::get_table_name();

		if ( empty( $batch_id ) || $post_id <= 0 ) {
			return new WP_Error(
				'invalid_parameters',
				__( 'Invalid batch ID or post ID provided.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		// Verify job records exist for this batch and post
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$jobs = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, item_type, provider, status FROM {$table} WHERE batch_id = %s AND post_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$batch_id,
				$post_id
			),
			ARRAY_A
		);

		if ( empty( $jobs ) ) {
			return new WP_Error(
				'jobs_not_found',
				__( 'No translation jobs found for the specified batch and item.', 'translatesense' ),
				array( 'status' => 404 )
			);
		}

		$is_taxonomy_item = false;
		foreach ( $jobs as $j ) {
			if ( 'taxonomy' === ( $j['item_type'] ?? 'post' ) ) {
				$is_taxonomy_item = true;
				break;
			}
		}

		$required_cap = $is_taxonomy_item ? 'edit_term' : 'edit_post';
		if ( ! is_user_logged_in() || ! current_user_can( $required_cap, $post_id ) ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You are not allowed to manage translation jobs for this item.', 'translatesense' ),
				array( 'status' => 403 )
			);
		}

		// Validate provider: MUST be OpenAI or Gemini server-side background provider
		foreach ( $jobs as $j ) {
			$prov = strtolower( (string) $j['provider'] );
			if ( ! in_array( $prov, array( 'openai', 'gemini' ), true ) ) {
				return new WP_Error(
					'unsupported_provider',
					__( 'Skip functionality is only available for OpenAI and Google Gemini background translations.', 'translatesense' ),
					array( 'status' => 400 )
				);
			}
		}

		// Check if any job is pending or running
		$has_active = false;
		foreach ( $jobs as $j ) {
			if ( in_array( $j['status'], array( 'pending', 'running' ), true ) ) {
				$has_active = true;
				break;
			}
		}

		if ( ! $has_active ) {
			return new WP_Error(
				'no_active_jobs',
				__( 'No pending or running translation jobs remain to skip for this post.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$now = gmdate( 'Y-m-d H:i:s' );

		// 1. Atomically update all pending jobs for this post & batch to skipped
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$skipped_count = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'skipped', progress_status = %s, updated_at = %s WHERE batch_id = %s AND post_id = %d AND status = 'pending' AND provider IN ('openai', 'gemini')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				__( 'Skipped by user', 'translatesense' ),
				$now,
				$batch_id,
				$post_id
			)
		);

		// 2. Atomically record cancellation request for active running job
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$cancelling_count = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'cancelling', progress_status = %s, updated_at = %s WHERE batch_id = %s AND post_id = %d AND status = 'running' AND provider IN ('openai', 'gemini')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				__( 'Cancellation requested...', 'translatesense' ),
				$now,
				$batch_id,
				$post_id
			)
		);

		// If no active jobs left, unschedule cron
		self::unschedule_cron_if_idle();

		// Return updated batch status
		$updated_status = self::get_batch_status( $batch_id );

		return array(
			'success'          => true,
			'message'          => __( 'Translations skipped successfully.', 'translatesense' ),
			'batch_id'         => $batch_id,
			'post_id'          => $post_id,
			'skipped_count'    => $skipped_count,
			'cancelling_count' => $cancelling_count,
			'batch_status'     => $updated_status,
		);
	}
}
