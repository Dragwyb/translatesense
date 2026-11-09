<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Custom_Fields;

use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\Content\Parser\Dom_Filter;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles ACF field discovery and string extraction.
 */
class Acf {

	/**
	 * Check if ACF is active.
	 */
	public static function is_active(): bool {
		return function_exists( 'acf_get_field' ) || function_exists( 'get_field_objects' );
	}

	/**
	 * Get ACF fields for a post.
	 */
	public static function get_fields( int $post_id ): array {
		if ( $post_id <= 0 || ! self::is_active() ) {
			return array();
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return array();
		}

		$post_meta = get_post_meta( $post_id );
		if ( ! is_array( $post_meta ) ) {
			return array();
		}

		$fields = array();

		// Find fields from post meta reference keys (_meta_key => field_key)
		foreach ( $post_meta as $meta_key => $values ) {
			if ( ! is_string( $meta_key ) || '' === $meta_key || '_' !== $meta_key[0] || 1 === strlen( $meta_key ) ) {
				continue;
			}

			$field_name = substr( $meta_key, 1 );
			if ( 0 === strpos( $field_name, '_' ) || 'acf_fc_layout' === $field_name ) {
				continue;
			}

			$field_key = isset( $values[0] ) && is_string( $values[0] ) ? trim( $values[0] ) : '';
			if ( 0 !== strpos( $field_key, 'field_' ) ) {
				continue;
			}

			$field_def = function_exists( 'acf_get_field' ) ? acf_get_field( $field_key ) : array();
			if ( ! is_array( $field_def ) || empty( $field_def['type'] ) ) {
				$field_def = array(
					'key'  => $field_key,
					'name' => $field_name,
					'type' => 'text',
				);
			}

			$fields[ $field_name ] = array(
				'meta_key'    => $field_name, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'field_key'   => $field_key,
				'field_type'  => (string) ( $field_def['type'] ?? 'text' ),
				'parent_key'  => (string) ( $field_def['parent'] ?? '' ),
				'field_def'   => $field_def,
				'source_type' => 'acf',
			);
		}

		// Also check field groups assigned by location rules
		if ( function_exists( 'acf_get_field_groups' ) && function_exists( 'acf_get_fields' ) ) {
			$groups = acf_get_field_groups( array( 'post_id' => $post_id ) );
			if ( is_array( $groups ) ) {
				foreach ( $groups as $group ) {
					$group_fields = acf_get_fields( $group );
					if ( is_array( $group_fields ) ) {
						foreach ( $group_fields as $f ) {
							if ( ! is_array( $f ) || empty( $f['name'] ) || empty( $f['key'] ) ) {
								continue;
							}
							$f_name = (string) $f['name'];
							if ( ! isset( $fields[ $f_name ] ) ) {
								$fields[ $f_name ] = array(
									'meta_key'    => $f_name, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
									'field_key'   => (string) $f['key'],
									'field_type'  => (string) ( $f['type'] ?? 'text' ),
									'parent_key'  => (string) ( $f['parent'] ?? '' ),
									'field_def'   => $f,
									'source_type' => 'acf',
								);
							}
						}
					}
				}
			}
		}

		return $fields;
	}

	/**
	 * Extract translatable strings from an ACF field or container.
	 */
	public static function extract_field_strings(
		int $post_id,
		string $root_meta_key,
		string $current_path,
		string $field_type,
		string $field_key,
		array $field_def,
		array $resolved_rules,
		array &$strings,
		int $depth,
		int $max_depth
	): void {
		if ( $depth > $max_depth || count( $strings ) >= 500 ) {
			return;
		}

		switch ( $field_type ) {
			case 'text':
			case 'textarea':
			case 'wysiwyg':
			case 'select':
			case 'checkbox':
			case 'radio':
			case 'button_group':
				$raw_val = get_post_meta( $post_id, $current_path, true );
				if ( is_string( $raw_val ) && '' !== trim( $raw_val ) ) {
					$clean_val = trim( $raw_val );

					// Skip values that contain only numbers
					if ( Custom_Field_Parser::is_only_numbers( $clean_val ) ) {
						break;
					}

					if ( class_exists( Dom_Filter::class ) ) {
						$filtered = Dom_Filter::filter_dom_content( $clean_val );
						if ( false !== $filtered && '' !== trim( (string) $filtered ) ) {
							$clean_val = trim( (string) $filtered );
						}
					}

					if ( Custom_Field_Parser::is_only_numbers( $clean_val ) ) {
						break;
					}

					$strings[] = array(
						'meta_key'    => $root_meta_key, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
						'path'        => $current_path,
						'value'       => $clean_val,
						'raw_value'   => $raw_val,
						'field_type'  => $field_type,
						'field_key'   => $field_key,
						'source_type' => 'acf',
					);
				}
				break;

			case 'link':
				$raw_val = get_post_meta( $post_id, $current_path, true );
				if ( is_string( $raw_val ) && is_serialized( $raw_val ) ) {
					$raw_val = maybe_unserialize( $raw_val );
				}
				if ( is_array( $raw_val ) && ! empty( $raw_val['title'] ) && is_string( $raw_val['title'] ) && '' !== trim( $raw_val['title'] ) ) {
					if ( ! Custom_Field_Parser::is_only_numbers( $raw_val['title'] ) ) {
						$strings[] = array(
							'meta_key'    => $root_meta_key, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
							'path'        => $current_path . '[title]',
							'value'       => trim( $raw_val['title'] ),
							'raw_value'   => $raw_val['title'],
							'field_type'  => 'link_title',
							'field_key'   => $field_key,
							'source_type' => 'acf',
						);
					}
				}
				break;

			case 'repeater':
				$sub_fields = $field_def['sub_fields'] ?? array();
				$row_count  = (int) get_post_meta( $post_id, $current_path, true );
				for ( $i = 0; $i < $row_count; $i++ ) {
					self::extract_subfields( $post_id, $root_meta_key, "{$current_path}_{$i}", $sub_fields, $resolved_rules, $strings, $depth, $max_depth );
				}
				break;

			case 'flexible_content':
				$layouts       = $field_def['layouts'] ?? array();
				$layout_lookup = array();
				foreach ( $layouts as $layout ) {
					if ( ! empty( $layout['name'] ) ) {
						$layout_lookup[ $layout['name'] ] = $layout['sub_fields'] ?? array();
					}
				}

				$layout_order = get_post_meta( $post_id, $current_path, true );
				if ( is_string( $layout_order ) && is_serialized( $layout_order ) ) {
					$layout_order = maybe_unserialize( $layout_order );
				}

				if ( is_array( $layout_order ) ) {
					foreach ( $layout_order as $i => $layout_name ) {
						$sub_fields = $layout_lookup[ $layout_name ] ?? array();
						self::extract_subfields( $post_id, $root_meta_key, "{$current_path}_{$i}", $sub_fields, $resolved_rules, $strings, $depth, $max_depth );
					}
				}
				break;

			case 'group':
				$sub_fields = $field_def['sub_fields'] ?? array();
				if ( is_array( $sub_fields ) ) {
					self::extract_subfields( $post_id, $root_meta_key, $current_path, $sub_fields, $resolved_rules, $strings, $depth, $max_depth );
				}
				break;

			default:
				break;
		}
	}

	/**
	 * Extract translatable strings from ACF subfields.
	 */
	private static function extract_subfields(
		int $post_id,
		string $root_meta_key,
		string $prefix,
		array $sub_fields,
		array $resolved_rules,
		array &$strings,
		int $depth,
		int $max_depth
	): void {
		if ( empty( $sub_fields ) || ! is_array( $sub_fields ) ) {
			return;
		}

		foreach ( $sub_fields as $sub ) {
			if ( empty( $sub['name'] ) ) {
				continue;
			}

			$sub_name = (string) $sub['name'];
			$sub_path = "{$prefix}_{$sub_name}";
			$sub_type = (string) ( $sub['type'] ?? 'text' );
			$sub_key  = (string) ( $sub['key'] ?? '' );

			$sub_rule = Custom_Field_Rule_Resolver::resolve_field_rule(
				$sub_path,
				$resolved_rules,
				array(),
				$sub_type
			);

			if ( Custom_Field_Rule_Resolver::ACTION_TRANSLATE === $sub_rule['action'] ) {
				self::extract_field_strings(
					$post_id,
					$root_meta_key,
					$sub_path,
					$sub_type,
					$sub_key,
					$sub,
					$resolved_rules,
					$strings,
					$depth + 1,
					$max_depth
				);
			}
		}
	}
}
