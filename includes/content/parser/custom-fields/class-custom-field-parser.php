<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Custom_Fields;

use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\Content\Parser\Dom_Filter;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Discovers custom fields (both ACF and standard post meta), computes change hashes, and extracts strings.
 */
class Custom_Field_Parser {

	const MAX_DEPTH        = 10;
	const MAX_STRING_LIMIT = 500;

	/**
	 * Get all custom fields for a post (ACF fields and user XML custom meta).
	 */
	public static function get_post_fields( int $post_id, string $editor_type = 'all' ): array {
		if ( $post_id <= 0 ) {
			return array();
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return array();
		}

		$fields = array();

		// 1. Discover ACF fields if ACF is active
		if ( Acf::is_active() ) {
			$fields = Acf::get_fields( $post_id );
		}

		// 2. Discover standard custom meta fields configured in user XML rules
		$user_rules = Xml_Engine::get_user_custom_field_rules( $editor_type );
		if ( ! empty( $user_rules ) ) {
			$post_meta = get_post_meta( $post_id );
			if ( is_array( $post_meta ) ) {
				foreach ( $post_meta as $meta_key => $values ) {
					$meta_key = (string) $meta_key;

					// Skip internal ACF reference keys and already discovered ACF fields
					if ( isset( $fields[ $meta_key ] ) || ( isset( $meta_key[0] ) && '_' === $meta_key[0] && ! isset( $user_rules[ $meta_key ] ) ) ) {
						continue;
					}

					// Check if this post meta matches any explicit user XML rule (exact or wildcard)
					$matched = false;
					if ( isset( $user_rules[ $meta_key ] ) ) {
						$matched = true;
					} else {
						foreach ( array_keys( $user_rules ) as $pattern ) {
							if ( false !== strpos( (string) $pattern, '*' ) && Custom_Field_Rule_Resolver::is_wildcard_match( (string) $pattern, $meta_key ) ) {
								$matched = true;
								break;
							}
						}
					}

					if ( $matched ) {
						$fields[ $meta_key ] = array(
							'meta_key'    => $meta_key,
							'field_key'   => '',
							'field_type'  => 'text',
							'parent_key'  => '',
							'field_def'   => array(),
							'source_type' => 'custom_field',
						);
					}
				}
			}
		}

		return $fields;
	}

	/**
	 * Get deterministic schema hash for fields.
	 */
	public static function get_schema_hash( array $fields ): string {
		$summary = array();
		foreach ( $fields as $key => $info ) {
			$summary[ $key ] = (string) ( $info['field_type'] ?? '' ) . ':' . (string) ( $info['field_key'] ?? '' );
		}
		ksort( $summary );
		return md5( (string) wp_json_encode( $summary ) );
	}

	/**
	 * Get deterministic hash of source values for change detection.
	 */
	public static function get_values_hash( int $post_id, array $fields ): string {
		if ( $post_id <= 0 || empty( $fields ) ) {
			return '';
		}

		$values_map = array();
		foreach ( array_keys( $fields ) as $meta_key ) {
			$raw_val = get_post_meta( $post_id, (string) $meta_key, true );
			if ( is_string( $raw_val ) ) {
				$raw_val = str_replace( "\r\n", "\n", $raw_val );
			}
			$values_map[ $meta_key ] = $raw_val;
		}
		ksort( $values_map );
		return md5( (string) wp_json_encode( $values_map ) );
	}

	/**
	 * Check if a value contains only numbers.
	 *
	 * @param mixed $value
	 * @return bool
	 */
	public static function is_only_numbers( $value ): bool {
		if ( is_numeric( $value ) ) {
			return true;
		}

		if ( ! is_string( $value ) ) {
			return false;
		}

		$plain = trim( function_exists( 'wp_strip_all_tags' ) ? wp_strip_all_tags( $value ) : strip_tags( $value ) );

		return '' !== $plain && is_numeric( $plain );
	}

	/**
	 * Extract eligible translatable strings from custom fields.
	 */
	public static function extract_strings(
		int $post_id,
		array $fields,
		array $resolved_rules,
		int $max_depth = self::MAX_DEPTH
	): array {
		if ( $post_id <= 0 || empty( $fields ) ) {
			return array();
		}

		$strings = array();

		foreach ( $fields as $meta_key => $field_info ) {
			if ( count( $strings ) >= self::MAX_STRING_LIMIT ) {
				break;
			}

			$rule = $resolved_rules[ $meta_key ] ?? null;
			if ( ! $rule || Custom_Field_Rule_Resolver::ACTION_TRANSLATE !== $rule['action'] ) {
				continue;
			}

			$source_type = $field_info['source_type'] ?? ( ! empty( $field_info['field_key'] ) ? 'acf' : 'custom_field' );

			if ( 'acf' === $source_type ) {
				Acf::extract_field_strings(
					$post_id,
					$meta_key,
					$meta_key,
					(string) ( $field_info['field_type'] ?? 'text' ),
					(string) ( $field_info['field_key'] ?? '' ),
					$field_info['field_def'] ?? array(),
					$resolved_rules,
					$strings,
					0,
					$max_depth
				);
			} else {
				// Standard custom field string extraction
				$raw_val = get_post_meta( $post_id, $meta_key, true );
				if ( is_string( $raw_val ) && '' !== trim( $raw_val ) ) {
					$clean_val = trim( $raw_val );

					// Skip values that contain only numbers
					if ( self::is_only_numbers( $clean_val ) ) {
						continue;
					}

					if ( class_exists( Dom_Filter::class ) ) {
						$filtered = Dom_Filter::filter_dom_content( $clean_val );
						if ( false !== $filtered && '' !== trim( (string) $filtered ) ) {
							$clean_val = trim( (string) $filtered );
						}
					}

					if ( self::is_only_numbers( $clean_val ) ) {
						continue;
					}

					$strings[] = array(
						'meta_key'    => $meta_key,
						'path'        => $meta_key,
						'value'       => $clean_val,
						'raw_value'   => $raw_val,
						'field_type'  => 'custom_field',
						'field_key'   => '',
						'source_type' => 'custom_field',
					);
				}
			}
		}

		return $strings;
	}
}
