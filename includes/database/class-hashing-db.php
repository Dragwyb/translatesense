<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Hashing_Db {

	/**
	 * Initialize.
	 */
	public static function init() {
		// Automatically clean up package entries and orphan strings when a post is permanently deleted
		add_action( 'before_delete_post', array( __CLASS__, 'delete_post_packages' ), 10, 1 );
	}

	/**
	 * Table name for central strings (Translation Memory).
	 */
	final public static function get_strings_table(): string {
		global $wpdb;
		return esc_sql( $wpdb->prefix . 'translatesense_strings' );
	}

	/**
	 * Table name for translation packages (Context & Mapping).
	 */
	final public static function get_packages_table(): string {
		global $wpdb;
		return esc_sql( $wpdb->prefix . 'translatesense_packages' );
	}

	/**
	 * Table name for translation results cache (Linked to string_hash).
	 */
	final public static function get_translations_table(): string {
		global $wpdb;
		return esc_sql( $wpdb->prefix . 'translatesense_translations' );
	}

	/**
	 * Compute md5 hash for a string or package context.
	 *
	 * @param string|int $widget_id
	 * @param string     $string_value
	 * @return string 32-char md5 hash
	 */
	public static function generate_hash( $widget_id, $string_value ): string {
		return md5( (string) $widget_id . '_' . (string) $string_value );
	}

	/**
	 * Get existing string_id from translatesense_strings, or insert if not exists.
	 *
	 * Uses atomic MySQL ON DUPLICATE KEY UPDATE to minimize queries and prevent race conditions.
	 *
	 * @param string $filter_string Clean/filtered string used for hash computation.
	 * @param string $source_string Original source string (defaults to $filter_string if omitted).
	 * @return int String ID or 0 on failure
	 */
	public static function get_or_create_string_id( string $filter_string, string $source_string = '' ): int {
		global $wpdb;

		if ( '' === $source_string ) {
			$source_string = $filter_string;
		}

		if ( '' === trim( $source_string ) ) {
			return 0;
		}

		$strings_table = self::get_strings_table();
		$string_hash   = md5( $filter_string );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$strings_table} (`string_hash`, `source_string`, `filter_string`, `created_at`) VALUES (%s, %s, %s, NOW()) ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$string_hash,
				$source_string,
				$filter_string
			)
		);
		if ( false === $result ) {
			return 0;
		}

		$string_id = (int) $wpdb->insert_id;
		if ( $string_id <= 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$string_id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT `id` FROM {$strings_table} WHERE `string_hash` = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$string_hash
				)
			);
		}

		return max( 0, $string_id );
	}

	/**
	 * Register/Store a translation package in db if not exists.
	 * Initializes last_used_at with the current database datetime for new records.
	 *
	 * @param int         $post_id
	 * @param string      $target_lang
	 * @param string|null $hash
	 * @param string      $editor_type
	 * @param string      $widget_name
	 * @param string      $widget_key
	 * @param string      $source_string
	 * @param string      $filter_string
	 * @param string      $string_hash Optional string_hash if already resolved
	 * @return int Package ID
	 */
	public static function record_package(
		$post_id,
		$target_lang,
		$hash,
		$editor_type,
		$widget_name,
		$widget_key,
		$source_string,
		$filter_string = '',
		$string_hash = ''
	): int {
		global $wpdb;

		if ( empty( $filter_string ) ) {
			return 0;
		}

		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return 0;
		}

		$packages_table = self::get_packages_table();

		// 1. Resolve or compute string_hash and ensure string is recorded in central strings table
		$string_hash = is_string( $string_hash ) ? trim( $string_hash ) : '';
		if ( empty( $string_hash ) ) {
			$string_hash = md5( (string) $filter_string );
		}

		self::get_or_create_string_id( (string) $filter_string, (string) $source_string );

		if ( empty( $string_hash ) ) {
			return 0;
		}

		// 2. Calculate package hash
		$package_hash = ! empty( $hash ) ? (string) $hash : md5( $string_hash . $widget_name );

		// Check if package already exists
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$packages_table} WHERE package_hash = %s AND post_id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$package_hash,
				$post_id
			)
		);

		if ( $existing_id ) {
			return (int) $existing_id;
		}

		// Initialize last_used_at with current database datetime (NOW()) for newly inserted package
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$packages_table} (`post_id`, `string_hash`, `language`, `package_hash`, `editor_type`, `widget_name`, `widget_key`, `created_at`, `last_used_at`) VALUES (%d, %s, %s, %s, %s, %s, %s, NOW(), NOW())", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id,
				$string_hash,
				sanitize_text_field( (string) $target_lang ),
				sanitize_text_field( $package_hash ),
				sanitize_text_field( (string) $editor_type ),
				sanitize_text_field( (string) $widget_name ),
				sanitize_text_field( (string) $widget_key )
			)
		);

		return (int) ( $wpdb->insert_id ?: 0 );
	}

	/**
	 * Save translated string result into translatesense_translations table.
	 * Initializes last_used_at with current database datetime for new records.
	 * Does not modify last_used_at on duplicate key update.
	 *
	 * @param string $string_hash       32-char md5 string hash
	 * @param string $target_lang       Target language code
	 * @param string $translated_string Translated content
	 * @return bool
	 */
	public static function save_translation_result( string $string_hash, string $target_lang, string $translated_string ): bool {
		global $wpdb;

		$string_hash       = trim( $string_hash );
		$translated_string = trim( $translated_string );
		$target_lang       = sanitize_text_field( trim( $target_lang ) );

		if ( '' === $string_hash || '' === $translated_string || '' === $target_lang ) {
			return false;
		}

		$translations_table = self::get_translations_table();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$translations_table} (`string_hash`, `language`, `translated_string`, `created_at`, `updated_at`, `last_used_at`) VALUES (%s, %s, %s, NOW(), NOW(), NOW()) ON DUPLICATE KEY UPDATE `translated_string` = VALUES(`translated_string`), `updated_at` = NOW()", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$string_hash,
				$target_lang,
				$translated_string
			)
		);

		return false !== $result;
	}

	/**
	 * Check if a translation exists for a package hash or string_id.
	 * Updates last_used_at timestamp on successful retrieval.
	 *
	 * @param int|string $identifier  package_hash (string), string_hash (string), or string_id (int)
	 * @param string     $target_lang
	 * @return string|null Translated string or null if not cached
	 */
	public static function get_cached_translation( $identifier, string $target_lang ): ?string {
		global $wpdb;

		$table_translations = self::get_translations_table();
		$table_packages     = self::get_packages_table();
		$table_strings      = self::get_strings_table();

		if ( is_numeric( $identifier ) && (int) $identifier > 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$row = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT t.id, t.translated_string FROM {$table_translations} t INNER JOIN {$table_strings} s ON t.string_hash = s.string_hash WHERE s.id = %d AND t.language = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					(int) $identifier,
					$target_lang
				),
				ARRAY_A
			);
			if ( ! empty( $row['translated_string'] ) ) {
				if ( ! empty( $row['id'] ) ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
					$wpdb->query(
						$wpdb->prepare(
							"UPDATE {$table_translations} SET last_used_at = NOW() WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
							(int) $row['id']
						)
					);
				}
				return (string) $row['translated_string'];
			}
			return null;
		}

		// Check by string_hash
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id, translated_string FROM {$table_translations} WHERE string_hash = %s AND language = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$identifier,
				$target_lang
			),
			ARRAY_A
		);

		if ( ! empty( $row['translated_string'] ) ) {
			if ( ! empty( $row['id'] ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table_translations} SET last_used_at = NOW() WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						(int) $row['id']
					)
				);
			}
			return (string) $row['translated_string'];
		}

		// Check by package_hash
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT t.id as translation_id, p.id as package_id, t.translated_string FROM {$table_translations} t INNER JOIN {$table_packages} p ON t.string_hash = p.string_hash WHERE p.package_hash = %s AND t.language = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$identifier,
				$target_lang
			),
			ARRAY_A
		);

		if ( ! empty( $row['translated_string'] ) ) {
			if ( ! empty( $row['translation_id'] ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table_translations} SET last_used_at = NOW() WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						(int) $row['translation_id']
					)
				);
			}
			if ( ! empty( $row['package_id'] ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table_packages} SET last_used_at = NOW() WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						(int) $row['package_id']
					)
				);
			}
			return (string) $row['translated_string'];
		}

		return null;
	}

	/**
	 * Fetch a translated string directly by string_hash and language.
	 *
	 * @param string $string_hash 32-char md5 hash of the string
	 * @param string $language    Language code
	 * @return string|null
	 */
	public static function get_translation( string $string_hash, string $language ): ?string {
		return self::get_cached_translation( $string_hash, $language );
	}

	/**
	 * Bulk fetch translations by string hashes and language.
	 *
	 * @param array  $string_hashes Array of string hashes
	 * @param string $language      Language code
	 * @return array Hash => translated_string
	 */
	public static function get_translations_by_hashes( array $string_hashes, string $language ): array {
		return self::get_cached_translations_batch( $string_hashes, $language );
	}

	/**
	 * Batch get cached translations for multiple package hashes or string hashes.
	 * Efficiently bulk-updates last_used_at for all matched translation and package records.
	 *
	 * @param array  $hashes
	 * @param string $target_lang
	 * @return array Hash => translated_string
	 */
	public static function get_cached_translations_batch( array $hashes, string $target_lang ): array {
		global $wpdb;

		if ( empty( $hashes ) ) {
			return array();
		}

		$table_translations = self::get_translations_table();
		$table_packages     = self::get_packages_table();
		$table_strings      = self::get_strings_table();

		$placeholders             = implode( ',', array_fill( 0, count( $hashes ), '%s' ) );
		$cache_map                = array();
		$translation_ids_to_touch = array();
		$package_ids_to_touch     = array();

		// 1. Check via package_hash mapping
		$params = array_merge( $hashes, array( $target_lang ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.package_hash, t.translated_string, t.id as translation_id, p.id as package_id FROM {$table_translations} t INNER JOIN {$table_packages} p ON t.string_hash = p.string_hash WHERE p.package_hash IN ($placeholders) AND t.language = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$params
			),
			ARRAY_A
		);

		if ( ! empty( $rows ) ) {
			foreach ( $rows as $row ) {
				if ( ! empty( $row['translated_string'] ) ) {
					$cache_map[ $row['package_hash'] ] = (string) $row['translated_string'];
					if ( ! empty( $row['translation_id'] ) ) {
						$translation_ids_to_touch[] = (int) $row['translation_id'];
					}
					if ( ! empty( $row['package_id'] ) ) {
						$package_ids_to_touch[] = (int) $row['package_id'];
					}
				}
			}
		}

		// 2. Check remaining hashes via string_hash mapping
		$remaining_hashes = array_diff( $hashes, array_keys( $cache_map ) );
		if ( ! empty( $remaining_hashes ) ) {
			$rem_placeholders = implode( ',', array_fill( 0, count( $remaining_hashes ), '%s' ) );
			$rem_params       = array_merge( array_values( $remaining_hashes ), array( $target_lang ) );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$string_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, string_hash, translated_string FROM {$table_translations} WHERE string_hash IN ($rem_placeholders) AND language = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$rem_params
				),
				ARRAY_A
			);

			if ( ! empty( $string_rows ) ) {
				foreach ( $string_rows as $row ) {
					if ( ! empty( $row['translated_string'] ) ) {
						$cache_map[ $row['string_hash'] ] = (string) $row['translated_string'];
						if ( ! empty( $row['id'] ) ) {
							$translation_ids_to_touch[] = (int) $row['id'];
						}
					}
				}
			}
		}

		// Bulk update last_used_at for all matched translation records efficiently
		if ( ! empty( $translation_ids_to_touch ) ) {
			$translation_ids_to_touch = array_values( array_unique( $translation_ids_to_touch ) );
			$ids_placeholders         = implode( ',', array_fill( 0, count( $translation_ids_to_touch ), '%d' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table_translations} SET last_used_at = NOW() WHERE id IN ($ids_placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
					$translation_ids_to_touch
				)
			);
		}

		// Bulk update last_used_at for all matched package records efficiently
		if ( ! empty( $package_ids_to_touch ) ) {
			$package_ids_to_touch = array_values( array_unique( $package_ids_to_touch ) );
			$pkg_placeholders     = implode( ',', array_fill( 0, count( $package_ids_to_touch ), '%d' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table_packages} SET last_used_at = NOW() WHERE id IN ($pkg_placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
					$package_ids_to_touch
				)
			);
		}

		return $cache_map;
	}

	/**
	 * Get post packages joined with central translatesense_strings.
	 * Updates last_used_at timestamp on successful package retrieval.
	 *
	 * @param int    $post_id
	 * @param string $lang
	 * @param string $editor_type
	 * @return array
	 */
	public static function get_post_package( int $post_id, string $lang, string $editor_type ): array {
		global $wpdb;

		$packages_table = self::get_packages_table();
		$strings_table  = self::get_strings_table();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.package_hash as hash, p.widget_name as name, p.widget_key as `key`, s.source_string as source, s.filter_string as value, p.string_hash FROM {$packages_table} p INNER JOIN {$strings_table} s ON p.string_hash = s.string_hash WHERE p.post_id = %d AND p.language = %s AND p.editor_type = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id,
				$lang,
				$editor_type
			),
			ARRAY_A
		);

		if ( ! empty( $results ) ) {
			// Update last_used_at for all matching retrieved packages efficiently
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$packages_table} SET last_used_at = NOW() WHERE post_id = %d AND language = %s AND editor_type = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$post_id,
					$lang,
					$editor_type
				)
			);

			return $results;
		}

		return array();
	}

	/**
	 * Check if a post has packages recorded in the translatesense_packages table.
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function has_post_packages( int $post_id ): bool {
		global $wpdb;

		if ( $post_id <= 0 ) {
			return false;
		}

		$packages_table = self::get_packages_table();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$exists = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT 1 FROM {$packages_table} WHERE post_id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id
			)
		);

		return ! empty( $exists );
	}

	/**
	 * Clean up orphan records in translatesense_strings and translatesense_translations
	 * that are no longer referenced in translatesense_packages.
	 *
	 * @return int Number of deleted unused strings
	 */
	public static function cleanup_unused_strings(): int {
		global $wpdb;

		$strings_table      = self::get_strings_table();
		$packages_table     = self::get_packages_table();
		$translations_table = self::get_translations_table();

		// 1. Delete orphan strings not referenced in any packages
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$deleted_strings = $wpdb->query(
			"DELETE s FROM {$strings_table} s LEFT JOIN {$packages_table} p ON s.string_hash = p.string_hash WHERE p.string_hash IS NULL" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// 2. Delete orphan cached translations whose string_hash no longer exists
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			"DELETE t FROM {$translations_table} t LEFT JOIN {$strings_table} s ON t.string_hash = s.string_hash WHERE s.string_hash IS NULL" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		return false !== $deleted_strings ? (int) $deleted_strings : 0;
	}

	/**
	 * Delete existing translation package data for a post and clean up unused strings.
	 *
	 * @param int         $post_id                Post ID
	 * @param string|null $lang                   Language code filter (optional)
	 * @param string|null $editor_type            Editor type filter (optional)
	 * @param bool        $cleanup_unused_strings Whether to verify and clean unused strings
	 * @return int Number of deleted package rows
	 */
	public static function delete_post_packages(
		int $post_id,
		?string $lang = null,
		?string $editor_type = null,
		bool $cleanup_unused_strings = true
	): int {
		global $wpdb;
		$packages_table = self::get_packages_table();

		if ( $post_id <= 0 ) {
			return 0;
		}

		$where  = array( 'post_id' => $post_id );
		$format = array( '%d' );

		if ( ! empty( $lang ) ) {
			$where['language'] = $lang;
			$format[]          = '%s';
		}

		if ( ! empty( $editor_type ) ) {
			$where['editor_type'] = $editor_type;
			$format[]             = '%s';
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$deleted       = $wpdb->delete( $packages_table, $where, $format );
		$deleted_count = false !== $deleted ? (int) $deleted : 0;

		// Clean up any strings in translatesense_strings that are no longer used by any package
		if ( $cleanup_unused_strings && $deleted_count > 0 ) {
			self::cleanup_unused_strings();
		}

		return $deleted_count;
	}
}
