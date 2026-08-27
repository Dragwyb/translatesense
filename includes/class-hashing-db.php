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
		// Automatically clean up package entries when a post is permanently deleted
		add_action( 'before_delete_post', array( __CLASS__, 'delete_post_packages' ), 10, 1 );
	}

	/**
	 * Table name for translation packages.
	 */
	public static function get_packages_table() {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_packages';
	}

	/**
	 * Table name for translation results cache.
	 */
	public static function get_translations_table() {
		global $wpdb;
		return $wpdb->prefix . 'translatesense_translations';
	}

	/**
	 * Compute md5 hash for a widget/block string (Step 3.2).
	 *
	 * @param string $widget_id
	 * @param string $string_value
	 * @return string 32-char md5 hash
	 */
	public static function generate_hash( $widget_id, $string_value ) {
		return md5( (string) $widget_id . '_' . (string) $string_value );
	}

	/**
	 * Check if a package exists and get existing cached result for a language (Step 3.3).
	 *
	 * @param string $hash
	 * @param string $target_lang
	 * @return string|null Translated string or null if not cached
	 */
	public static function get_cached_translation( $hash, $target_lang ) {
		global $wpdb;
		$table = self::get_translations_table();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT translated_string FROM {$table} WHERE package_hash = %s AND language=%s LIMIT 1",
				$hash,
				$target_lang
			),
			ARRAY_A
		);

		if ( ! empty( $row['translated_string'] ) ) {
			return $row['translated_string'];
		}

		return null;
	}

	/**
	 * Batch get cached translations for multiple hashes.
	 *
	 * @param array  $hashes
	 * @param string $target_lang
	 * @return array Hash => translated_string
	 */
	public static function get_cached_translations_batch( $hashes, $target_lang ) {
		global $wpdb;
		if ( empty( $hashes ) ) {
			return array();
		}

		$table        = self::get_translations_table();
		$placeholders = implode( ',', array_fill( 0, count( $hashes ), '%s' ) );

		$query = $wpdb->prepare(
			"SELECT package_hash, translated_strings FROM {$table} 
			 WHERE package_hash IN ($placeholders) AND translated_strings != ''",
			$hashes
		);

		$rows      = $wpdb->get_results( $query, ARRAY_A );
		$cache_map = array();

		if ( ! empty( $rows ) ) {
			foreach ( $rows as $row ) {
				if ( empty( $row['translated_strings'] ) ) {
					continue;
				}
				$strings = json_decode( $row['translated_strings'], true );
				if ( is_array( $strings ) && isset( $strings[ $target_lang ] ) && '' !== $strings[ $target_lang ] ) {
					$cache_map[ $row['package_hash'] ] = $strings[ $target_lang ];
				}
			}
		}

		return $cache_map;
	}

	/**
	 * Register/Store a translation package in db if not exists.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $hash
	 * @param string $source_string
	 * @param string $editor_type
	 * @param string $widget_name
	 * @param string $widget_key
	 * @param string $filter_string
	 * @return int Package ID
	 */
	public static function record_package( $post_id, $target_lang, $hash, $source_string, $editor_type, $widget_name, $widget_key, $filter_string = '' ) {
		global $wpdb;
		$packages_table = self::get_packages_table();

		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$packages_table} WHERE package_hash = %s AND post_id = %d LIMIT 1",
				$hash,
				$post_id
			)
		);

		if ( $existing_id ) {
			return (int) $existing_id;
		}

		$wpdb->insert(
			$packages_table,
			array(
				'post_id'       => (int) $post_id,
				'language'      => sanitize_text_field( $target_lang ),
				'package_hash'  => sanitize_text_field( $hash ),
				'source_string' => $source_string,
				'filter_string' => $filter_string ? $filter_string : $source_string,
				'widget_name'   => $widget_name,
				'widget_key'    => $widget_key,
				'editor_type'   => $editor_type,
				'created_at'    => current_time( 'mysql' ),
			),
			array( '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
		);

		return (int) $wpdb->insert_id;
	}

	/**
	 * Delete existing translation package data for a post (and optionally language and editor type).
	 *
	 * @param int         $post_id     Post ID
	 * @param string|null $lang        Language code filter (optional)
	 * @param string|null $editor_type Editor type filter (optional)
	 * @return int Number of deleted package rows
	 */
	public static function delete_post_packages( int $post_id, ?string $lang = null, ?string $editor_type = null ): int {
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

		$deleted = $wpdb->delete( $packages_table, $where, $format );
		return false !== $deleted ? (int) $deleted : 0;
	}

	/**
	 * Get post packages result from package table.
	 *
	 * @param init   $post_id
	 * @param string $lang
	 */
	public static function get_post_package( int $post_id, string $lang, string $editor_type ) {
		global $wpdb;

		$packages_table = self::get_packages_table();
		$results        = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT package_hash as hash, widget_name as name, widget_key as `key`, source_string as source, filter_string as value from {$packages_table} WHERE post_id = %d AND language=%s AND editor_type=%s",
				$post_id,
				$lang,
				$editor_type
			),
			ARRAY_A
		);

		return $results;
	}

	/**
	 * Save translated string result into translations cache table.
	 * Stores languages array and translated_strings map with updated_at timestamp.
	 *
	 * @param string $hash
	 * @param string $target_lang
	 * @param string $translated_string
	 * @return bool
	 */
	public static function save_translation_result( $hash, $target_lang, $translated_string ) {
		global $wpdb;
		$table = self::get_translations_table();

		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id, language, translated_string FROM {$table} WHERE package_hash = %s AND language = %s LIMIT 1",
				$hash,
				$translated_string
			),
			ARRAY_A
		);

		if ( $existing ) {
			$languages = json_decode( $existing['languages'], true );
			if ( ! is_array( $languages ) ) {
				$languages = array();
			}
			if ( ! in_array( $target_lang, $languages, true ) ) {
				$languages[] = $target_lang;
			}

			$strings = json_decode( $existing['translated_strings'], true );
			if ( ! is_array( $strings ) ) {
				$strings = array();
			}
			$strings[ $target_lang ] = $translated_string;

			return (bool) $wpdb->update(
				$table,
				array(
					'languages'          => wp_json_encode( array_values( $languages ) ),
					'translated_strings' => wp_json_encode( $strings ),
					'updated_at'         => current_time( 'mysql' ),
				),
				array( 'id' => (int) $existing['id'] ),
				array( '%s', '%s', '%s' ),
				array( '%d' )
			);
		}

		$languages = array( $target_lang );
		$strings   = array( $target_lang => $translated_string );

		return (bool) $wpdb->insert(
			$table,
			array(
				'package_hash'       => sanitize_text_field( $hash ),
				'languages'          => wp_json_encode( $languages ),
				'translated_strings' => wp_json_encode( $strings ),
				'created_at'         => current_time( 'mysql' ),
				'updated_at'         => current_time( 'mysql' ),
			),
			array( '%s', '%s', '%s', '%s', '%s' )
		);
	}
}
