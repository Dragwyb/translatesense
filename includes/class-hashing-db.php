<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

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
	public static function get_strings_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_strings';
	}

	/**
	 * Table name for translation packages (Context & Mapping).
	 */
	public static function get_packages_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_packages';
	}

	/**
	 * Table name for translation results cache (Linked to string_id).
	 */
	public static function get_translations_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_translations';
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
	 * @param string $source_string
	 * @return int String ID or 0 on failure
	 */
	public static function get_or_create_string_id( string $source_string ): int {
		global $wpdb;

		if ( '' === trim( $source_string ) ) {
			return 0;
		}

		$strings_table = self::get_strings_table();
		$string_hash   = md5( $source_string );

		$sql = $wpdb->prepare(
			"INSERT INTO {$strings_table} (`string_hash`, `source_string`, `created_at`)
			 VALUES (%s, %s, NOW())
			 ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`)",
			$string_hash,
			$source_string
		);

		$result = $wpdb->query( $sql );
		if ( false === $result ) {
			return 0;
		}

		$string_id = (int) $wpdb->insert_id;
		if ( $string_id <= 0 ) {
			$string_id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT `id` FROM {$strings_table} WHERE `string_hash` = %s LIMIT 1",
					$string_hash
				)
			);
		}

		return max( 0, $string_id );
	}

	/**
	 * Register/Store a translation package in db if not exists.
	 *
	 * @param int         $post_id
	 * @param string      $target_lang
	 * @param string|null $hash
	 * @param string      $source_string
	 * @param string      $editor_type
	 * @param string      $widget_name
	 * @param string      $widget_key
	 * @param string      $filter_string
	 * @param int         $string_id Optional string_id if already resolved
	 * @return int Package ID
	 */
	public static function record_package(
		$post_id,
		$target_lang,
		$hash,
		$source_string,
		$editor_type,
		$widget_name,
		$widget_key,
		$filter_string = '',
		$string_id = 0
	): int {
		global $wpdb;

		if ( empty( $filter_string ) ) {
			return;
		}

		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return 0;
		}

		$packages_table = self::get_packages_table();

		// 1. Resolve or create string_id in translatesense_strings
		$string_id = (int) $string_id;
		if ( $string_id <= 0 && '' !== trim( (string) $filter_string ) ) {
			$string_id = self::get_or_create_string_id( (string) $filter_string );
		}

		if ( $string_id <= 0 ) {
			return 0;
		}

		// 2. Calculate package hash
		$package_hash = ! empty( $hash ) ? (string) $hash : md5( $post_id . $string_id . $widget_name . $widget_key );

		// Check if package already exists
		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$packages_table} WHERE package_hash = %s LIMIT 1",
				$package_hash
			)
		);

		if ( $existing_id ) {
			return (int) $existing_id;
		}

		// 3. Insert package using INSERT IGNORE
		$filter_str = ! empty( $filter_string ) ? $filter_string : (string) $source_string;

		$wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$packages_table} 
				 (`post_id`, `string_id`, `language`, `package_hash`, `filter_string`, `editor_type`, `widget_name`, `widget_key`, `created_at`)
				 VALUES (%d, %d, %s, %s, %s, %s, %s, %s, NOW())",
				$post_id,
				$string_id,
				sanitize_text_field( (string) $target_lang ),
				sanitize_text_field( $package_hash ),
				$filter_str,
				sanitize_text_field( (string) $editor_type ),
				sanitize_text_field( (string) $widget_name ),
				sanitize_text_field( (string) $widget_key )
			)
		);

		return (int) ( $wpdb->insert_id ?: 0 );
	}

	/**
	 * Save translated string result into translatesense_translations table.
	 *
	 * @param int|string $identifier        string_id (int), package_hash (string), or string_hash (string)
	 * @param string     $target_lang       Target language code
	 * @param string     $translated_string Translated content
	 * @param string     $source_string     Optional original string to resolve string_id
	 * @return bool
	 */
	public static function save_translation_result( $identifier, string $target_lang, string $translated_string, string $source_string = '' ): bool {
		global $wpdb;

		if ( '' === trim( $translated_string ) || empty( $target_lang ) ) {
			return false;
		}

		$translations_table = self::get_translations_table();
		$string_id          = 0;

		// 1. Resolve string_id
		if ( is_numeric( $identifier ) && (int) $identifier > 0 ) {
			$string_id = (int) $identifier;
		} elseif ( ! empty( $source_string ) ) {
			$string_id = self::get_or_create_string_id( $source_string );
		} elseif ( is_string( $identifier ) && '' !== trim( $identifier ) ) {
			$strings_table  = self::get_strings_table();
			$packages_table = self::get_packages_table();

			// Check if identifier is string_hash in translatesense_strings
			$string_id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$strings_table} WHERE string_hash = %s LIMIT 1",
					$identifier
				)
			);

			// If not found, check if identifier is package_hash in translatesense_packages
			if ( $string_id <= 0 ) {
				$string_id = (int) $wpdb->get_var(
					$wpdb->prepare(
						"SELECT string_id FROM {$packages_table} WHERE package_hash = %s LIMIT 1",
						$identifier
					)
				);
			}
		}

		if ( $string_id <= 0 ) {
			return false;
		}

		// 2. Insert or update translation linked to string_id and language
		$sql = $wpdb->prepare(
			"INSERT INTO {$translations_table} (`string_id`, `language`, `translated_string`, `created_at`, `updated_at`)
			 VALUES (%d, %s, %s, NOW(), NOW())
			 ON DUPLICATE KEY UPDATE 
			 `translated_string` = VALUES(`translated_string`),
			 `updated_at` = NOW()",
			$string_id,
			sanitize_text_field( $target_lang ),
			$translated_string
		);

		$result = $wpdb->query( $sql );
		return false !== $result;
	}

	/**
	 * Check if a translation exists for a package hash or string_id.
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
			$row = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT translated_string FROM {$table_translations} WHERE string_id = %d AND language = %s LIMIT 1",
					(int) $identifier,
					$target_lang
				),
				ARRAY_A
			);
			return ! empty( $row['translated_string'] ) ? (string) $row['translated_string'] : null;
		}

		// Check by package_hash
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT t.translated_string 
				 FROM {$table_translations} t
				 INNER JOIN {$table_packages} p ON t.string_id = p.string_id
				 WHERE p.package_hash = %s AND t.language = %s
				 LIMIT 1",
				$identifier,
				$target_lang
			),
			ARRAY_A
		);

		if ( ! empty( $row['translated_string'] ) ) {
			return (string) $row['translated_string'];
		}

		// Check by string_hash
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT t.translated_string 
				 FROM {$table_translations} t
				 INNER JOIN {$table_strings} s ON t.string_id = s.id
				 WHERE s.string_hash = %s AND t.language = %s
				 LIMIT 1",
				$identifier,
				$target_lang
			),
			ARRAY_A
		);

		if ( ! empty( $row['translated_string'] ) ) {
			return (string) $row['translated_string'];
		}

		return null;
	}

	/**
	 * Batch get cached translations for multiple package hashes or string hashes.
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

		$placeholders = implode( ',', array_fill( 0, count( $hashes ), '%s' ) );
		$cache_map    = array();

		// 1. Check via package_hash mapping
		$params = array_merge( $hashes, array( $target_lang ) );
		$rows   = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.package_hash, t.translated_string 
				 FROM {$table_translations} t
				 INNER JOIN {$table_packages} p ON t.string_id = p.string_id
				 WHERE p.package_hash IN ($placeholders) AND t.language = %s",
				$params
			),
			ARRAY_A
		);

		if ( ! empty( $rows ) ) {
			foreach ( $rows as $row ) {
				if ( ! empty( $row['translated_string'] ) ) {
					$cache_map[ $row['package_hash'] ] = (string) $row['translated_string'];
				}
			}
		}

		// 2. Check remaining hashes via string_hash mapping
		$remaining_hashes = array_diff( $hashes, array_keys( $cache_map ) );
		if ( ! empty( $remaining_hashes ) ) {
			$rem_placeholders = implode( ',', array_fill( 0, count( $remaining_hashes ), '%s' ) );
			$rem_params       = array_merge( array_values( $remaining_hashes ), array( $target_lang ) );

			$string_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT s.string_hash, t.translated_string 
					 FROM {$table_translations} t
					 INNER JOIN {$table_strings} s ON t.string_id = s.id
					 WHERE s.string_hash IN ($rem_placeholders) AND t.language = %s",
					$rem_params
				),
				ARRAY_A
			);

			if ( ! empty( $string_rows ) ) {
				foreach ( $string_rows as $row ) {
					if ( ! empty( $row['translated_string'] ) ) {
						$cache_map[ $row['string_hash'] ] = (string) $row['translated_string'];
					}
				}
			}
		}

		return $cache_map;
	}

	/**
	 * Get post packages joined with central translatesense_strings.
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

		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT 
					p.package_hash as hash, 
					p.widget_name as name, 
					p.widget_key as `key`, 
					s.source_string as source, 
					p.filter_string as value,
					p.string_id
				 FROM {$packages_table} p
				 INNER JOIN {$strings_table} s ON p.string_id = s.id
				 WHERE p.post_id = %d AND p.language = %s AND p.editor_type = %s",
				$post_id,
				$lang,
				$editor_type
			),
			ARRAY_A
		);

		return ! empty( $results ) ? $results : array();
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
		$deleted_strings = $wpdb->query(
			"DELETE s FROM {$strings_table} s
			 LEFT JOIN {$packages_table} p ON s.id = p.string_id
			 WHERE p.string_id IS NULL"
		);

		// 2. Delete orphan cached translations whose string_id no longer exists
		$wpdb->query(
			"DELETE t FROM {$translations_table} t
			 LEFT JOIN {$strings_table} s ON t.string_id = s.id
			 WHERE s.id IS NULL"
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

		$deleted       = $wpdb->delete( $packages_table, $where, $format );
		$deleted_count = false !== $deleted ? (int) $deleted : 0;

		// Clean up any strings in translatesense_strings that are no longer used by any package
		if ( $cleanup_unused_strings && $deleted_count > 0 ) {
			self::cleanup_unused_strings();
		}

		return $deleted_count;
	}
}
