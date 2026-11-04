<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Cron;

use TranslateSense\Includes\Database\Hashing_Db;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cron {

	/**
	 * Hook name for cache cleanup.
	 */
	const CLEANUP_HOOK = 'translatesense_cache_cleanup';

	/**
	 * Recurrence interval identifier.
	 */
	const CLEANUP_SCHEDULE = 'every_three_days';

	/**
	 * Initialize cron hooks.
	 */
	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'add_cron_schedules' ) );
		add_action( self::CLEANUP_HOOK, array( __CLASS__, 'run_cache_cleanup' ) );
		add_action( 'init', array( __CLASS__, 'ensure_cleanup_scheduled' ) );
	}

	/**
	 * Register custom 3-day recurrence schedule in WordPress cron.
	 *
	 * @param array $schedules Existing WordPress cron schedules.
	 * @return array
	 */
	public static function add_cron_schedules( array $schedules ): array {
		if ( ! isset( $schedules[ self::CLEANUP_SCHEDULE ] ) ) {
			$day_in_seconds                      = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
			$schedules[ self::CLEANUP_SCHEDULE ] = array(
				'interval' => 3 * $day_in_seconds,
				'display'  => esc_html__( 'Every 3 Days', 'translatesense' ),
			);
		}
		return $schedules;
	}

	/**
	 * Ensure the cache cleanup event is scheduled every 3 days and old schedules are replaced.
	 */
	public static function ensure_cleanup_scheduled() {
		$current_schedule = wp_get_schedule( self::CLEANUP_HOOK );
		if ( false === $current_schedule ) {
			wp_schedule_event( time(), self::CLEANUP_SCHEDULE, self::CLEANUP_HOOK );
		} elseif ( self::CLEANUP_SCHEDULE !== $current_schedule ) {
			wp_clear_scheduled_hook( self::CLEANUP_HOOK );
			wp_schedule_event( time(), self::CLEANUP_SCHEDULE, self::CLEANUP_HOOK );
		}
	}

	/**
	 * Perform the cache cleanup routine based on last_used_at inactivity.
	 *
	 * Translations older than 30 days of inactivity and packages older than 10 days
	 * of inactivity are deleted.
	 */
	public static function run_cache_cleanup() {
		global $wpdb;

		$table_translations = Hashing_Db::get_translations_table();
		$table_packages     = Hashing_Db::get_packages_table();

		$day_in_seconds      = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
		$current_timestamp   = function_exists( 'current_time' ) ? (int) current_time( 'timestamp' ) : time();
		$translations_cutoff = gmdate( 'Y-m-d H:i:s', $current_timestamp - ( 30 * $day_in_seconds ) );
		$packages_cutoff     = gmdate( 'Y-m-d H:i:s', $current_timestamp - ( 10 * $day_in_seconds ) );

		// Clean cached translations not accessed for more than 30 days
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table_translations} WHERE last_used_at IS NOT NULL AND last_used_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$translations_cutoff
			)
		);

		// Clean cached packages not accessed for more than 10 days
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table_packages} WHERE last_used_at IS NOT NULL AND last_used_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$packages_cutoff
			)
		);

		// Clean orphaned strings in translatesense_strings
		Hashing_Db::cleanup_unused_strings();
	}

	/**
	 * Manual purge of all cached strings.
	 */
	public static function purge_all_cache() {
		if ( ( is_admin() || is_user_logged_in() ) && ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		global $wpdb;
		$table_translations = Hashing_Db::get_translations_table();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return $wpdb->query( "TRUNCATE TABLE {$table_translations}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
	}
}
