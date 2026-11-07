<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Custom_Fields;

use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Parser;
use TranslateSense\Includes\Content\Parser\Dom_Filter;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Applies custom field (standard meta and ACF) translations, copy rules, and target metadata.
 */
class Custom_Field_Translator {

	/**
	 * Apply custom-field rules and translations to target post.
	 */
	public static function apply_target_metadata(
		int $source_post_id,
		int $target_post_id,
		string $source_lang,
		string $target_lang,
		bool $is_existing = false,
		array $custom_opts = array()
	): array {
		if ( $source_post_id <= 0 || $target_post_id <= 0 || empty( $target_lang ) ) {
			return array();
		}

		// If Polylang custom fields synchronization is enabled, skip translating custom fields
		if ( Polylang_Bridge::is_custom_fields_sync_enabled() ) {
			return array();
		}

		$fields = Custom_Field_Parser::get_post_fields( $source_post_id );
		if ( empty( $fields ) ) {
			return array();
		}

		$user_rules     = Xml_Engine::get_user_custom_field_rules();
		$resolved_rules = Custom_Field_Rule_Resolver::resolve_all_rules( $fields, $user_rules );
		$applied        = array();

		foreach ( $fields as $meta_key => $field_info ) {
			$rule   = $resolved_rules[ $meta_key ] ?? null;
			$action = $rule['action'] ?? Custom_Field_Rule_Resolver::ACTION_COPY;

			// Action: Ignore
			if ( Custom_Field_Rule_Resolver::ACTION_IGNORE === $action ) {
				$applied[ $meta_key ] = 'ignore';
				continue;
			}

			// Action: Copy-Once on existing target post
			if ( Custom_Field_Rule_Resolver::ACTION_COPY_ONCE === $action && $is_existing && metadata_exists( 'post', $target_post_id, $meta_key ) ) {
				$applied[ $meta_key ] = 'copy-once-skipped';
				continue;
			}

			$source_type = $field_info['source_type'] ?? ( ! empty( $field_info['field_key'] ) ? 'acf' : 'custom_field' );

			if ( 'acf' === $source_type ) {
				Acf::apply_field_value(
					$source_post_id,
					$target_post_id,
					$meta_key,
					$meta_key,
					(string) ( $field_info['field_type'] ?? 'text' ),
					(string) ( $field_info['field_key'] ?? '' ),
					$field_info['field_def'] ?? array(),
					$action,
					$source_lang,
					$target_lang,
					$is_existing,
					$resolved_rules,
					$custom_opts
				);
			} else {
				// Standard custom field application
				$raw_val = get_post_meta( $source_post_id, $meta_key, true );
				if ( Custom_Field_Rule_Resolver::ACTION_TRANSLATE === $action ) {
					if ( is_string( $raw_val ) && '' !== trim( $raw_val ) ) {
						// If value contains only numbers, save as-is without translation
						if ( Custom_Field_Parser::is_only_numbers( $raw_val ) ) {
							update_post_meta( $target_post_id, $meta_key, $raw_val );
						} else {
							$translated = self::resolve_translated_string( $raw_val, $meta_key, $target_lang, $custom_opts );
							update_post_meta( $target_post_id, $meta_key, $translated );
						}
					} else {
						update_post_meta( $target_post_id, $meta_key, $raw_val );
					}
				} else {
					update_post_meta( $target_post_id, $meta_key, $raw_val );
				}
			}

			$applied[ $meta_key ] = $action;
		}

		return $applied;
	}

	/**
	 * Resolve translated string value from in-memory options or translation memory.
	 */
	public static function resolve_translated_string(
		string $source_str,
		string $path,
		string $target_lang,
		array $custom_opts,
		string $prefix = 'custom_field_'
	): string {
		$clean_val    = trim( $source_str );
		$filtered_val = $clean_val;
		if ( class_exists( Dom_Filter::class ) ) {
			$filtered = Dom_Filter::filter_dom_content( $clean_val );
			if ( false !== $filtered && '' !== trim( (string) $filtered ) ) {
				$filtered_val = trim( (string) $filtered );
			}
		}

		$string_hash  = md5( $filtered_val );
		$package_hash = Hashing_Db::generate_hash( $prefix . $path, $filtered_val );

		// Check in-memory translations (Chrome AI / custom translation payload)
		if ( ! empty( $custom_opts['in_memory_translations'] ) && is_array( $custom_opts['in_memory_translations'] ) ) {
			if ( isset( $custom_opts['in_memory_translations'][ $package_hash ] ) && '' !== trim( (string) $custom_opts['in_memory_translations'][ $package_hash ] ) ) {
				$trans = (string) $custom_opts['in_memory_translations'][ $package_hash ];
				return class_exists( Dom_Filter::class ) ? Dom_Filter::replace_filtered_content( $source_str, $trans ) : $trans;
			}
			if ( isset( $custom_opts['in_memory_translations'][ $string_hash ] ) && '' !== trim( (string) $custom_opts['in_memory_translations'][ $string_hash ] ) ) {
				$trans = (string) $custom_opts['in_memory_translations'][ $string_hash ];
				return class_exists( Dom_Filter::class ) ? Dom_Filter::replace_filtered_content( $source_str, $trans ) : $trans;
			}
		}

		// Check cached translation memory
		if ( class_exists( Hashing_Db::class ) && method_exists( Hashing_Db::class, 'get_cached_translation' ) ) {
			$cached = Hashing_Db::get_cached_translation( $package_hash, $target_lang );
			if ( ! empty( $cached ) ) {
				return class_exists( Dom_Filter::class ) ? Dom_Filter::replace_filtered_content( $source_str, $cached ) : $cached;
			}

			$cached = Hashing_Db::get_cached_translation( $string_hash, $target_lang );
			if ( ! empty( $cached ) ) {
				return class_exists( Dom_Filter::class ) ? Dom_Filter::replace_filtered_content( $source_str, $cached ) : $cached;
			}
		}

		return $source_str;
	}
}
