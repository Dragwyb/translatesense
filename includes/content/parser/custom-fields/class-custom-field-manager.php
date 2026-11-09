<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Custom_Fields;

use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Manages package preparation and synchronization for custom fields and ACF fields.
 */
class Custom_Field_Manager {

	const HASH_META_KEY = '_translatesense_cf_hashes';
	const LOCK_TIMEOUT  = 5;

	/**
	 * Prepare dynamic custom-field packages for a source post if needed.
	 */
	public static function ensure_package_prepared( int $post_id, string $source_lang, string $editor_type ): void {
		if ( $post_id <= 0 || empty( $source_lang ) ) {
			return;
		}

		$editor_type = sanitize_key( $editor_type );
		if ( 'core' === $editor_type ) {
			$editor_type = 'gutenberg';
		}

		// If Polylang custom fields synchronization is enabled, do not translate custom fields
		if ( Polylang_Bridge::is_custom_fields_sync_enabled() ) {
			if ( self::has_package_rows( $post_id, $editor_type ) ) {
				self::purge_package_rows( $post_id, $editor_type );
			}
			return;
		}

		// Only proceed if ACF is active or user has configured custom-field rules in XML
		$user_rules = Xml_Engine::get_user_custom_field_rules( $editor_type );
		if ( ! Acf::is_active() && empty( $user_rules ) ) {
			return;
		}

		$has_lock = self::get_lock( $post_id );

		try {
			self::synchronize_packages( $post_id, $source_lang, $editor_type );
		} finally {
			if ( $has_lock ) {
				self::release_lock( $post_id );
			}
		}
	}

	/**
	 * Synchronize custom-field translatable strings into packages when hashes change.
	 */
	public static function synchronize_packages( int $post_id, string $source_lang, string $editor_type ): void {
		$fields = Custom_Field_Parser::get_post_fields( $post_id, $editor_type );
		if ( empty( $fields ) ) {
			self::purge_package_rows( $post_id, $editor_type );
			delete_post_meta( $post_id, self::HASH_META_KEY );
			return;
		}

		// Check change hashes: schema, values, and user XML configuration
		$current_schema_hash = Custom_Field_Parser::get_schema_hash( $fields );
		$current_val_hash    = Custom_Field_Parser::get_values_hash( $post_id, $fields );
		$current_user_xml    = Xml_Engine::get_user_custom_field_config_hash( $editor_type );

		$stored = get_post_meta( $post_id, self::HASH_META_KEY, true );

		$is_fresh = is_array( $stored )
			&& ( $stored['schema_hash'] ?? '' ) === $current_schema_hash
			&& ( $stored['val_hash'] ?? '' ) === $current_val_hash
			&& ( $stored['user_xml'] ?? '' ) === $current_user_xml;

		if ( $is_fresh && self::has_package_rows( $post_id, $editor_type ) ) {
			return;
		}

		// Resolve rules and extract translatable strings
		$user_rules     = Xml_Engine::get_user_custom_field_rules( $editor_type );
		$resolved_rules = Custom_Field_Rule_Resolver::resolve_all_rules( $fields, $user_rules );
		$strings        = Custom_Field_Parser::extract_strings( $post_id, $fields, $resolved_rules );

		// Record translatable strings into packages table
		$active_package_hashes = array();

		foreach ( $strings as $item ) {
			$path         = (string) $item['path'];
			$filtered_val = (string) $item['value'];
			$raw_val      = (string) $item['raw_value'];
			$source_type  = (string) ( $item['source_type'] ?? 'custom_field' );

			// Don't save empty strings or values containing only numbers in packages
			if ( '' === trim( $filtered_val ) || Custom_Field_Parser::is_only_numbers( $filtered_val ) ) {
				continue;
			}

			$string_hash  = md5( $filtered_val );
			$package_hash = Hashing_Db::generate_hash( 'custom_field_' . $path, $filtered_val );
			$widget_name  = ( 'acf' === $source_type ) ? 'custom_field>acf' : 'custom_field';

			$active_package_hashes[] = $package_hash;

			Hashing_Db::record_package(
				$post_id,
				$source_lang,
				$package_hash,
				$editor_type,
				$widget_name,
				$path,
				$raw_val,
				$filtered_val,
				$string_hash
			);
		}

		// Clean up outdated package rows and update hashes
		self::purge_stale_package_rows( $post_id, $editor_type, $active_package_hashes );

		$hashes = array(
			'schema_hash' => $current_schema_hash,
			'val_hash'    => $current_val_hash,
			'user_xml'    => $current_user_xml,
			'updated_at'  => time(),
		);

		update_post_meta( $post_id, self::HASH_META_KEY, $hashes );
	}

	/**
	 * Check if any custom-field package rows exist for this post.
	 */
	public static function has_package_rows( int $post_id, string $editor_type ): bool {
		global $wpdb;
		$table = Hashing_Db::get_packages_table();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$found = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT 1 FROM {$table} WHERE post_id = %d AND editor_type = %s AND widget_name IN ('custom_field','custom_field>acf') LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id,
				$editor_type
			)
		);

		return ! empty( $found );
	}

	/**
	 * Purge all custom-field package rows for a specific post.
	 */
	public static function purge_package_rows( int $post_id, string $editor_type ): void {
		global $wpdb;
		$table = Hashing_Db::get_packages_table();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE post_id = %d AND editor_type = %s AND widget_name IN ('custom_field','custom_field>acf')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id,
				$editor_type
			)
		);
	}

	/**
	 * Purge stale package records not in the active hash list.
	 */
	public static function purge_stale_package_rows( int $post_id, string $editor_type, array $active_package_hashes ): void {
		global $wpdb;
		$table = Hashing_Db::get_packages_table();

		if ( empty( $active_package_hashes ) ) {
			self::purge_package_rows( $post_id, $editor_type );
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $active_package_hashes ), '%s' ) );
		$params       = array_merge( array( $post_id, $editor_type ), $active_package_hashes );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE post_id = %d AND editor_type = %s AND widget_name IN ('custom_field','custom_field>acf') AND package_hash NOT IN ($placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$params
			)
		);
	}

	/**
	 * Get cross-request database named lock.
	 */
	private static function get_lock( int $post_id ): bool {
		global $wpdb;
		$lock_name = 'ts_prep_' . $post_id;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$res = $wpdb->get_var(
			$wpdb->prepare( 'SELECT GET_LOCK(%s, %d)', $lock_name, self::LOCK_TIMEOUT )
		);

		return ( 1 === (int) $res );
	}

	/**
	 * Release cross-request database named lock.
	 */
	private static function release_lock( int $post_id ): void {
		global $wpdb;
		$lock_name = 'ts_prep_' . $post_id;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->get_var(
			$wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name )
		);
	}
}
