<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use TranslateSense\Includes\Xml_Engine\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Activator {

	/**
	 * Run activation tasks.
	 */
	public static function activate() {
		self::create_tables();
		self::create_uploads_directory();
		self::set_default_options();
		self::save_config_to_db();
		self::schedule_cleanup_cron();
	}

	/**
	 * Create custom DB tables for translation packages and cached results.
	 */
	public static function create_tables() {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();

		// Custom translation packages table (Step 3)
		$table_packages = $wpdb->prefix . 'translatesense_packages';
		$sql_packages   = "CREATE TABLE {$table_packages} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			post_id bigint(20) unsigned NOT NULL,
			language varchar(10) NOT NULL,
			package_hash varchar(32) NOT NULL,
			source_string text NOT NULL,
			filter_string text NOT NULL,
			editor_type text NOT NULL,
			widget_name text NOT NULL,
			widget_key	text NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY hash_index (package_hash),
			KEY post_index (post_id)
		) {$charset_collate};";

		// Custom translations table storing languages array and translated_strings map
		$table_translations = $wpdb->prefix . 'translatesense_translations';
		$sql_translations   = "CREATE TABLE {$table_translations} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			package_hash varchar(32) NOT NULL,
			language varchar(20) NOT NULL,
			translated_string longtext NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE INDEX hash_lang_unique (package_hash, language),
			INDEX package_hash_index (package_hash),
			INDEX language_index (language)
		) {$charset_collate};";

		// Custom bulk translations workflow queue table
		$table_bulk = $wpdb->prefix . 'translatesense_bulk_translations';
		$sql_bulk   = "CREATE TABLE {$table_bulk} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			batch_id varchar(64) NOT NULL,
			post_id bigint(20) unsigned NOT NULL,
			target_language varchar(20) NOT NULL,
			provider varchar(50) NOT NULL DEFAULT 'openai',
			status varchar(30) NOT NULL DEFAULT 'pending',
			progress_status varchar(100) DEFAULT '',
			total_strings int(11) NOT NULL DEFAULT 0,
			completed_strings int(11) NOT NULL DEFAULT 0,
			sent_ai_request_data longtext DEFAULT NULL,
			received_ai_request_data longtext DEFAULT NULL,
			error_message text DEFAULT NULL,
			target_post_id bigint(20) unsigned DEFAULT 0,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY batch_index (batch_id),
			KEY post_index (post_id),
			KEY status_index (status),
			KEY target_lang_index (target_language)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql_packages );
		dbDelta( $sql_translations );
		dbDelta( $sql_bulk );
	}

	/**
	 * Ensure custom config directory exists.
	 */
	public static function create_uploads_directory() {
		$upload_dir = wp_upload_dir();
		$custom_dir = trailingslashit( $upload_dir['basedir'] ) . 'translatesense-configs';

		if ( ! file_exists( $custom_dir ) ) {
			wp_mkdir_p( $custom_dir );
			file_put_contents( $custom_dir . '/index.html', '' );
		}
	}

	/**
	 * Initialize default plugin options.
	 */
	public static function set_default_options() {
		$defaults = array(
			'provider'            => 'openai',
			'enabled_providers'   => array( 'chrome_ai', 'openai', 'gemini' ),
			'openai_api_key'      => '',
			'openai_model'        => 'gpt-4o-mini',
			'gemini_api_key'      => '',
			'gemini_model'        => 'gemini-1.5-flash',
			'auto_translate_save' => false,
			'batch_size'          => 5,
		);

		if ( ! get_option( 'translatesense_settings' ) ) {
			update_option( 'translatesense_settings', $defaults );
		}
	}

	/**
	 * Save default configuration into database option table on activation.
	 */
	public static function save_config_to_db() {
		$path = Xml_Engine::get_master_xml_path();
		if ( file_exists( $path ) ) {
			$all_xml = file_get_contents( $path );
			if ( ! empty( $all_xml ) ) {
				update_option( 'translatesense_all_xml', $all_xml );
			}
		}
	}

	/**
	 * Schedule daily cache cleanup cron (Step 4.3).
	 */
	public static function schedule_cleanup_cron() {
		if ( ! wp_next_scheduled( 'translatesense_cache_cleanup' ) ) {
			wp_schedule_event( time(), 'daily', 'translatesense_cache_cleanup' );
		}
	}
}
