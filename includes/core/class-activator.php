<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Core;

use TranslateSense\Includes\XML\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Activator {

	const DB_VERSION        = '1.0.0';
	const DB_VERSION_OPTION = 'translatesense_db_version';

	/**
	 * Register database upgrade hooks.
	 *
	 * Call this method from the main plugin bootstrap.
	 *
	 * @return void
	 */
	public static function register_hooks(): void {
		add_action( 'admin_init', array( self::class, 'maybe_upgrade_db' ) );
	}

	/**
	 * Run activation tasks.
	 *
	 * @return void
	 */
	public static function activate(): void {
		self::maybe_upgrade_db( true );
		self::set_default_options();
		self::save_config_to_db();
		self::schedule_cleanup_cron();

		set_transient( 'translatesense_activation_redirect', true, 600 );
	}

	/**
	 * Run backward-compatible schema upgrades.
	 *
	 * @return void
	 */
	public static function maybe_upgrade_db( $force = false ): void {
		$installed_version = (string) get_option( self::DB_VERSION_OPTION, '0' );

		if ( version_compare( $installed_version, self::DB_VERSION, '>=' ) ) {

			if ( true === $force ) {
				self::create_tables();
			}

			return;
		}

		global $wpdb;

		$table_bulk = $wpdb->prefix . 'translatesense_queue';

		// Create missing tables and update existing table structures.
		if ( ! self::create_tables() ) {
			return;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$columns = $wpdb->get_col( "SHOW COLUMNS FROM `{$table_bulk}`", 0 );
		// phpcs:enable

		if (
			! is_array( $columns ) ||
			! in_array( 'created_by', $columns, true ) ||
			! in_array( 'item_type', $columns, true )
		) {
			return;
		}

		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Create custom database tables for translation packages and cached results.
	 *
	 * dbDelta adds missing columns to existing tables.
	 *
	 * @return bool
	 */
	public static function create_tables(): bool {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();

		// 1. Central Strings Table (Translation Memory).
		$table_strings = $wpdb->prefix . 'translatesense_strings';

		$sql_strings = "CREATE TABLE {$table_strings} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			string_hash varchar(32) NOT NULL,
			source_string longtext NOT NULL,
			filter_string longtext NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY string_hash_unique (string_hash)
		) {$charset_collate};";

		// 2. Custom translation packages table (Context & Mapping).
		$table_packages = $wpdb->prefix . 'translatesense_packages';

		$sql_packages = "CREATE TABLE {$table_packages} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			post_id bigint(20) unsigned NOT NULL,
			string_hash varchar(32) NOT NULL,
			language varchar(10) NOT NULL,
			package_hash varchar(32) NOT NULL,
			editor_type varchar(50) NOT NULL,
			widget_name varchar(100) NOT NULL,
			widget_key varchar(100) NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			last_used_at datetime DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY post_package_unique (post_id, package_hash),
			KEY string_index (string_hash),
			KEY last_used_index (last_used_at)
		) {$charset_collate};";

		// 3. Custom translations table.
		$table_translations = $wpdb->prefix . 'translatesense_translations';

		$sql_translations = "CREATE TABLE {$table_translations} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			string_hash varchar(32) NOT NULL,
			language varchar(10) NOT NULL,
			translated_string longtext NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			last_used_at datetime DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY string_lang_unique (string_hash, language),
			KEY string_index (string_hash),
			KEY language_index (language),
			KEY last_used_index (last_used_at)
		) {$charset_collate};";

		// 4. Custom bulk translations workflow queue table.
		$table_bulk = $wpdb->prefix . 'translatesense_queue';

		$sql_bulk = "CREATE TABLE {$table_bulk} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			batch_id varchar(64) NOT NULL,
			item_type varchar(20) NOT NULL DEFAULT 'post',
			post_id bigint(20) unsigned NOT NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
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

		// dbDelta must be called individually for each table.
		dbDelta( $sql_strings );
		dbDelta( $sql_packages );
		dbDelta( $sql_translations );
		dbDelta( $sql_bulk );

		// Verify that all required tables exist.
		$tables = array(
			$table_strings,
			$table_packages,
			$table_translations,
			$table_bulk,
		);

		foreach ( $tables as $table ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$exists = $wpdb->get_var(
				$wpdb->prepare(
					'SHOW TABLES LIKE %s',
					$wpdb->esc_like( $table )
				)
			);

			if ( $exists !== $table ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Initialize default plugin options.
	 *
	 * @return void
	 */
	public static function set_default_options(): void {
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

		if ( false === get_option( 'translatesense_settings' ) ) {
			update_option( 'translatesense_settings', $defaults );
		}

		if ( false === get_option( 'translatesense_install_date' ) ) {
			update_option( 'translatesense_install_date', gmdate( 'Y-m-d H:i:s' ), false );
			update_option( 'translatesense_install_version', TRANSLATESENSE_VERSION );
		}

		update_option( 'translatesense_activation_date', gmdate( 'Y-m-d H:i:s' ), false );
		update_option( 'translatesense_activation_version', TRANSLATESENSE_VERSION );
	}

	/**
	 * Save default configuration into database option table on activation.
	 *
	 * @return void
	 */
	public static function save_config_to_db(): void {
		$path = Xml_Engine::get_master_xml_path();

		if ( file_exists( $path ) ) {
			$all_xml = file_get_contents( $path );

			if ( false !== $all_xml && '' !== $all_xml ) {
				update_option( 'translatesense_all_xml', $all_xml );
			}
		}
	}

	/**
	 * Schedule 3-day cache cleanup cron.
	 *
	 * @return void
	 */
	public static function schedule_cleanup_cron(): void {
		$hook     = 'translatesense_cache_cleanup';
		$schedule = 'every_three_days';

		$current_schedule = wp_get_schedule( $hook );

		if ( false === $current_schedule ) {
			wp_schedule_event( time(), $schedule, $hook );
		} elseif ( $current_schedule !== $schedule ) {
			wp_clear_scheduled_hook( $hook );
			wp_schedule_event( time(), $schedule, $hook );
		}
	}
}
