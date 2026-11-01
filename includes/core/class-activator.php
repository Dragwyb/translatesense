<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Core;

use TranslateSense\Includes\XML\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Activator {

	/**
	 * Run activation tasks.
	 */
	public static function activate() {
		self::create_tables();
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

		// 1. Central Strings Table (Translation Memory)
		$table_strings = $wpdb->prefix . 'translatesense_strings';
		$sql_strings   = "CREATE TABLE {$table_strings} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            string_hash varchar(32) NOT NULL,
            source_string longtext NOT NULL,
            filter_string longtext NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY string_hash_unique (string_hash)
        ) {$charset_collate};";

		// 2. Custom translation packages table (Context & Mapping)
		$table_packages = $wpdb->prefix . 'translatesense_packages';
		$sql_packages   = "CREATE TABLE {$table_packages} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            post_id bigint(20) unsigned NOT NULL,
            string_hash varchar(32) NOT NULL,
            language varchar(10) NOT NULL,
            package_hash varchar(32) NOT NULL,
            editor_type varchar(50) NOT NULL,
            widget_name varchar(100) NOT NULL,
            widget_key varchar(100) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY post_package_unique (post_id, package_hash),
            KEY string_index (string_hash)
        ) {$charset_collate};";

		// 3. Custom translations table (Linked directly to strings)
		$table_translations = $wpdb->prefix . 'translatesense_translations';
		$sql_translations   = "CREATE TABLE {$table_translations} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            string_hash varchar(32) NOT NULL,
            language varchar(10) NOT NULL,
            translated_string longtext NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY string_lang_unique (string_hash, language),
            KEY string_index (string_hash),
            KEY language_index (language)
        ) {$charset_collate};";

		// 4. Custom bulk translations workflow queue table
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
            sent_data longtext DEFAULT NULL,
            receive_data longtext DEFAULT NULL,
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

		// dbDelta must be called individually for each table string
		dbDelta( $sql_strings );
		dbDelta( $sql_packages );
		dbDelta( $sql_translations );
		dbDelta( $sql_bulk );
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
			'gemini_model'        => 'gemini-3.5-flash-lite',
			'auto_translate_save' => false,
			'batch_size'          => 25,
			'response_timeout'    => 30,
			'max_tokens'          => 4096,
			'temperature'         => 0.2,
			'custom_prompt'       => '',
			'slug_translation'    => 'slug_translate',
			'post_status'         => 'draft',
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
