<?php
/**
 * Statics utilities.
 *
 * @package TranslateSense
 */

declare(strict_types=1);

namespace TranslateSense\Includes\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Statics class.
 */
class Statics {

	/**
	 * Option key for storing translation statistics.
	 *
	 * @var string
	 */
	const OPTION_TRANSLATION_STATISTICS = 'translatesense_statics';

	/**
	 * Get default translation statistics structure.
	 *
	 * @return array
	 */
	public static function get_default_translation_statistics(): array {
		return array(
			'total_translations'      => 0,
			'successful_translations' => 0,
			'failed_translations'     => 0,
			'total_characters'        => 0,
			'total_strings'           => 0,
			'time_take'               => 0,
			'providers'               => array(),
			'last_updated'            => '',
		);
	}

	/**
	 * Get current translation statistics.
	 *
	 * @return array
	 */
	public static function get_translation_statistics(): array {
		$stats = get_option( self::OPTION_TRANSLATION_STATISTICS, array() );

		if ( ! is_array( $stats ) || empty( $stats ) ) {
			return self::get_default_translation_statistics();
		}

		$defaults = self::get_default_translation_statistics();
		$stats    = wp_parse_args( $stats, $defaults );

		if ( ! isset( $stats['providers'] ) || ! is_array( $stats['providers'] ) ) {
			$stats['providers'] = array();
		}

		return $stats;
	}

	/**
	 * Update translation statistics with a new translation operation result.
	 *
	 * @param array $data {
	 *     Translation statistics payload.
	 *
	 *     @type string     $status           Operation status ('success', 'failed', etc.).
	 *     @type int        $total_characters Number of characters translated.
	 *     @type int        $total_strings    Number of strings translated.
	 *     @type string     $provider         AI provider key/slug.
	 *     @type int|float  $time_take        Execution time taken in milliseconds.
	 *     @type string     $request_id       Optional unique request identifier for duplicate prevention.
	 * }
	 * @return array Updated translation statistics.
	 */
	public static function update_translation_statistics( $data ): array {
		if ( ! is_array( $data ) || empty( $data ) ) {
			return self::get_translation_statistics();
		}

		// In-memory duplicate request prevention mechanism.
		static $processed_requests = array();
		if ( ! empty( $data['request_id'] ) ) {
			$req_id = (string) $data['request_id'];
			if ( isset( $processed_requests[ $req_id ] ) ) {
				return self::get_translation_statistics();
			}
			$processed_requests[ $req_id ] = true;
		}

		global $wpdb;
		$lock_name     = $wpdb->prefix . 'translatesense_statics_lock';
		$lock_acquired = false;

		if ( isset( $wpdb ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$lock_acquired = ( 1 === (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 2)', $lock_name ) ) );
			if ( $lock_acquired ) {
				wp_cache_delete( self::OPTION_TRANSLATION_STATISTICS, 'options' );
			}
		}

		try {
			$stats = self::get_translation_statistics();

			// Parse status.
			$raw_status = ! empty( $data['status'] ) ? sanitize_key( (string) $data['status'] ) : 'success';
			$is_success = in_array( $raw_status, array( 'success', 'completed', 'ok' ), true );

			// Parse total characters.
			$characters = 0;
			if ( isset( $data['total_characters'] ) ) {
				$characters = absint( $data['total_characters'] );
			} elseif ( isset( $data['characters'] ) ) {
				$characters = absint( $data['characters'] );
			}

			// Parse total strings.
			$strings = 0;
			if ( isset( $data['total_strings'] ) ) {
				$strings = absint( $data['total_strings'] );
			} elseif ( isset( $data['strings'] ) ) {
				$strings = absint( $data['strings'] );
			}

			// Parse provider.
			$provider = ! empty( $data['provider'] ) ? sanitize_key( (string) $data['provider'] ) : 'unknown';

			// Parse time taken (kept in milliseconds).
			$time_taken = 0;
			if ( isset( $data['time_take'] ) ) {
				$time_taken = max( 0, (float) $data['time_take'] );
			}

			$time_taken = (int) round( $time_taken );

			// Update global statistics. Only successful translations contribute to character/string counts.
			$stats['total_translations'] += 1;
			if ( $is_success ) {
				$stats['successful_translations'] += 1;
				$stats['total_characters']        += $characters;
				$stats['total_strings']           += $strings;
			} else {
				$stats['failed_translations'] += 1;
			}
			$stats['time_take']   += $time_taken;
			$stats['last_updated'] = current_time( 'mysql' );

			// Update per-provider statistics breakdown.
			if ( ! isset( $stats['providers'][ $provider ] ) || ! is_array( $stats['providers'][ $provider ] ) ) {
				$stats['providers'][ $provider ] = array(
					'total_translations'      => 0,
					'successful_translations' => 0,
					'failed_translations'     => 0,
					'total_characters'        => 0,
					'total_strings'           => 0,
					'time_take'               => 0,
					'last_used'               => '',
				);
			}

			$p_stats                        = &$stats['providers'][ $provider ];
			$p_stats['total_translations'] += 1;
			if ( $is_success ) {
				$p_stats['successful_translations'] += 1;
				$p_stats['total_characters']        += $characters;
				$p_stats['total_strings']           += $strings;
			} else {
				$p_stats['failed_translations'] += 1;
			}
			$p_stats['time_take'] += $time_taken;
			$p_stats['last_used']  = current_time( 'mysql' );

			update_option( self::OPTION_TRANSLATION_STATISTICS, $stats, false );

			return $stats;
		} finally {
			if ( $lock_acquired && isset( $wpdb ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->query( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
			}
		}
	}
}
