<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cron {

	/**
	 * Initialize cron hooks.
	 */
	public static function init() {
		add_action( 'translatesense_cache_cleanup', array( __CLASS__, 'run_cache_cleanup' ) );
	}

	/**
	 * Perform the 5-day cache cleanup routine (Step 4.3).
	 */
	public static function run_cache_cleanup() {
		global $wpdb;

		$table_translations = Hashing_Db::get_translations_table();
		$table_packages     = Hashing_Db::get_packages_table();

		// Clean cached strings after 5 days
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			"DELETE FROM {$table_translations} WHERE updated_at < DATE_SUB(NOW(), INTERVAL 5 DAY)" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// Also clean expired packages older than 30 days
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			"DELETE FROM {$table_packages} WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// Clean orphaned strings in translatesense_strings
		Hashing_Db::cleanup_unused_strings();
	}

	/**
	 * Manual purge of all cached strings.
	 */
	public static function purge_all_cache() {
		global $wpdb;
		$table_translations = Hashing_Db::get_translations_table();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return $wpdb->query( "TRUNCATE TABLE {$table_translations}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
	}
}
