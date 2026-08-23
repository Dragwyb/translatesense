<?php
/**
 * 5-Day Cleanup Cron System (Step 4.3)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TranslateSense_Cron {

	/**
	 * Initialize cron hooks.
	 */
	public static function init() {
		add_action( 'translatesense_cache_cleanup', array( __CLASS__, 'run_cache_cleanup' ) );
		add_action( 'dragwyb_trans_cache_cleanup', array( __CLASS__, 'run_cache_cleanup' ) );
	}

	/**
	 * Perform the 5-day cache cleanup routine (Step 4.3).
	 */
	public static function run_cache_cleanup() {
		global $wpdb;

		$table_translations = TranslateSense_Hashing_Db::get_translations_table();
		$table_packages     = TranslateSense_Hashing_Db::get_packages_table();

		// Clean cached strings after 5 days
		$wpdb->query(
			"UPDATE {$table_translations} 
			 SET translated_strings = '{}', languages = '[]' 
			 WHERE updated_at < DATE_SUB(NOW(), INTERVAL 5 DAY)"
		);

		// Also clean expired packages older than 30 days
		$wpdb->query(
			"DELETE FROM {$table_packages} 
			 WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
		);
	}

	/**
	 * Manual purge of all cached strings.
	 */
	public static function purge_all_cache() {
		global $wpdb;
		$table_translations = TranslateSense_Hashing_Db::get_translations_table();
		return $wpdb->query( "UPDATE {$table_translations} SET translated_strings = '{}', languages = '[]'" );
	}
}
