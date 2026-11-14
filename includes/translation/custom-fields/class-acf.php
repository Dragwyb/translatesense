<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Custom_Fields;

use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Parser;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Translation\Translate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles ACF-specific target metadata application, structure reconstruction, and ID mapping.
 */
class Acf {

	/**
	 * Apply value and reference key for a single ACF field or container.
	 */
	public static function apply_field_value(
		int $source_post_id,
		int $target_post_id,
		string $root_meta_key,
		string $current_path,
		string $field_type,
		string $field_key,
		array $field_def,
		string $action,
		string $source_lang,
		string $target_lang,
		bool $is_existing,
		array $resolved_rules,
		array $custom_opts
	): void {
		switch ( $field_type ) {
			case 'text':
			case 'textarea':
			case 'wysiwyg':
				$raw_val = get_post_meta( $source_post_id, $current_path, true );
				if ( Custom_Field_Rule_Resolver::ACTION_TRANSLATE === $action ) {
					if ( is_string( $raw_val ) && '' !== trim( $raw_val ) ) {
						// If value contains only numbers, save as-is without translation
						if ( Custom_Field_Parser::is_only_numbers( $raw_val ) ) {
							update_post_meta( $target_post_id, $current_path, $raw_val );
						} else {
							$res        = Translate::translate_string( $raw_val, $source_lang, $target_lang, 'custom_field_' . $current_path, $custom_opts );
							$translated = ! empty( $res['translated'] ) ? (string) $res['translated'] : $raw_val;

							update_post_meta( $target_post_id, $current_path, $translated );
						}
					} else {
						update_post_meta( $target_post_id, $current_path, $raw_val );
					}
				} else {
					update_post_meta( $target_post_id, $current_path, $raw_val );
				}
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;

			case 'link':
				$source_val = get_post_meta( $source_post_id, $current_path, true );
				if ( is_string( $source_val ) && is_serialized( $source_val ) ) {
					$source_val = self::safe_unserialize_meta( $source_val );
				}

				if ( is_array( $source_val ) ) {
					$link_target = $source_val;
					if ( Custom_Field_Rule_Resolver::ACTION_TRANSLATE === $action && ! empty( $source_val['title'] ) && is_string( $source_val['title'] ) ) {
						$res        = Translate::translate_string( (string) $source_val['title'], $source_lang, $target_lang, 'custom_field_' . $current_path, $custom_opts );
						$translated = ! empty( $res['translated'] ) ? (string) $res['translated'] : (string) $source_val['title'];

						$link_target['title'] = $translated;
					}
					update_post_meta( $target_post_id, $current_path, $link_target );
				} else {
					update_post_meta( $target_post_id, $current_path, $source_val );
				}
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;

			case 'repeater':
				$sub_fields = $field_def['sub_fields'] ?? array();
				$row_count  = (int) get_post_meta( $source_post_id, $current_path, true );

				update_post_meta( $target_post_id, $current_path, $row_count );
				self::write_reference_key( $target_post_id, $current_path, $field_key );

				if ( $row_count > 0 && ! empty( $sub_fields ) ) {
					for ( $i = 0; $i < $row_count; $i++ ) {
						self::apply_subfields( $source_post_id, $target_post_id, $root_meta_key, "{$current_path}_{$i}", $sub_fields, $source_lang, $target_lang, $is_existing, $resolved_rules, $custom_opts );
					}
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

				$layout_order = get_post_meta( $source_post_id, $current_path, true );
				if ( is_string( $layout_order ) && is_serialized( $layout_order ) ) {
					$layout_order = self::safe_unserialize_meta( $layout_order );
				}

				update_post_meta( $target_post_id, $current_path, $layout_order );
				self::write_reference_key( $target_post_id, $current_path, $field_key );

				if ( is_array( $layout_order ) ) {
					foreach ( $layout_order as $i => $layout_name ) {
						$sub_fields = $layout_lookup[ $layout_name ] ?? array();
						self::apply_subfields( $source_post_id, $target_post_id, $root_meta_key, "{$current_path}_{$i}", $sub_fields, $source_lang, $target_lang, $is_existing, $resolved_rules, $custom_opts );
					}
				}
				break;

			case 'group':
				$sub_fields = $field_def['sub_fields'] ?? array();
				self::write_reference_key( $target_post_id, $current_path, $field_key );

				if ( is_array( $sub_fields ) ) {
					self::apply_subfields( $source_post_id, $target_post_id, $root_meta_key, $current_path, $sub_fields, $source_lang, $target_lang, $is_existing, $resolved_rules, $custom_opts );
				}
				break;

			case 'image':
			case 'file':
				$raw_id = get_post_meta( $source_post_id, $current_path, true );
				if ( is_numeric( $raw_id ) && (int) $raw_id > 0 ) {
					update_post_meta( $target_post_id, $current_path, self::map_attachment_id( (int) $raw_id, $target_lang ) );
				} else {
					update_post_meta( $target_post_id, $current_path, $raw_id );
				}
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;

			case 'gallery':
				$raw_gallery = get_post_meta( $source_post_id, $current_path, true );
				if ( is_string( $raw_gallery ) && is_serialized( $raw_gallery ) ) {
					$raw_gallery = self::safe_unserialize_meta( $raw_gallery );
				}
				if ( is_array( $raw_gallery ) ) {
					$mapped = array();
					foreach ( $raw_gallery as $item_id ) {
						$mapped[] = is_numeric( $item_id ) ? self::map_attachment_id( (int) $item_id, $target_lang ) : $item_id;
					}
					update_post_meta( $target_post_id, $current_path, $mapped );
				} else {
					update_post_meta( $target_post_id, $current_path, $raw_gallery );
				}
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;

			case 'relationship':
			case 'post_object':
			case 'page_link':
				$raw_rel = get_post_meta( $source_post_id, $current_path, true );
				if ( is_string( $raw_rel ) && is_serialized( $raw_rel ) ) {
					$raw_rel = self::safe_unserialize_meta( $raw_rel );
				}
				if ( is_array( $raw_rel ) ) {
					$mapped = array();
					foreach ( $raw_rel as $p_id ) {
						$mapped[] = is_numeric( $p_id ) ? self::map_post_id( (int) $p_id, $target_lang ) : $p_id;
					}
					update_post_meta( $target_post_id, $current_path, $mapped );
				} elseif ( is_numeric( $raw_rel ) && (int) $raw_rel > 0 ) {
					update_post_meta( $target_post_id, $current_path, self::map_post_id( (int) $raw_rel, $target_lang ) );
				} else {
					update_post_meta( $target_post_id, $current_path, $raw_rel );
				}
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;

			case 'taxonomy':
				$raw_terms = get_post_meta( $source_post_id, $current_path, true );
				if ( is_string( $raw_terms ) && is_serialized( $raw_terms ) ) {
					$raw_terms = self::safe_unserialize_meta( $raw_terms );
				}
				if ( is_array( $raw_terms ) ) {
					$mapped = array();
					foreach ( $raw_terms as $t_id ) {
						$mapped[] = is_numeric( $t_id ) ? self::map_term_id( (int) $t_id, $target_lang ) : $t_id;
					}
					update_post_meta( $target_post_id, $current_path, $mapped );
				} elseif ( is_numeric( $raw_terms ) && (int) $raw_terms > 0 ) {
					update_post_meta( $target_post_id, $current_path, self::map_term_id( (int) $raw_terms, $target_lang ) );
				} else {
					update_post_meta( $target_post_id, $current_path, $raw_terms );
				}
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;

			default:
				$raw_val = get_post_meta( $source_post_id, $current_path, true );
				update_post_meta( $target_post_id, $current_path, $raw_val );
				self::write_reference_key( $target_post_id, $current_path, $field_key );
				break;
		}
	}

	/**
	 * Apply translation and copy rules to a collection of ACF subfields.
	 */
	public static function apply_subfields(
		int $source_post_id,
		int $target_post_id,
		string $root_meta_key,
		string $prefix,
		array $sub_fields,
		string $source_lang,
		string $target_lang,
		bool $is_existing,
		array $resolved_rules,
		array $custom_opts
	): void {
		if ( empty( $sub_fields ) || ! is_array( $sub_fields ) ) {
			return;
		}

		foreach ( $sub_fields as $sub ) {
			if ( empty( $sub['name'] ) ) {
				continue;
			}

			$sub_name   = (string) $sub['name'];
			$sub_path   = "{$prefix}_{$sub_name}";
			$sub_type   = (string) ( $sub['type'] ?? 'text' );
			$sub_key    = (string) ( $sub['key'] ?? '' );
			$sub_rule   = Custom_Field_Rule_Resolver::resolve_field_rule( $sub_path, $resolved_rules, array(), $sub_type );
			$sub_action = $sub_rule['action'];

			if ( Custom_Field_Rule_Resolver::ACTION_IGNORE === $sub_action ) {
				continue;
			}

			if ( Custom_Field_Rule_Resolver::ACTION_COPY_ONCE === $sub_action && $is_existing && metadata_exists( 'post', $target_post_id, $sub_path ) ) {
				continue;
			}

			self::apply_field_value(
				$source_post_id,
				$target_post_id,
				$root_meta_key,
				$sub_path,
				$sub_type,
				$sub_key,
				$sub,
				$sub_action,
				$source_lang,
				$target_lang,
				$is_existing,
				$resolved_rules,
				$custom_opts
			);
		}
	}

	/**
	 * Write ACF reference key (_meta_key => field_key) to target post.
	 */
	public static function write_reference_key( int $target_post_id, string $meta_key, string $field_key ): void {
		if ( '' !== $field_key && 0 === strpos( $field_key, 'field_' ) ) {
			update_post_meta( $target_post_id, '_' . $meta_key, $field_key );
		}
	}

	/**
	 * Map attachment ID to translated attachment in target language.
	 */
	public static function map_attachment_id( int $attachment_id, string $target_lang ): int {
		if ( $attachment_id > 0 && function_exists( 'pll_get_post' ) ) {
			$trans = pll_get_post( $attachment_id, $target_lang );
			if ( is_numeric( $trans ) && (int) $trans > 0 ) {
				return (int) $trans;
			}
		}

		return $attachment_id;
	}

	/**
	 * Map post ID to translated post in target language.
	 */
	public static function map_post_id( int $post_id, string $target_lang ): int {
		if ( $post_id > 0 && class_exists( Polylang_Bridge::class ) ) {
			$trans = Polylang_Bridge::get_existing_translation_post_id( $post_id, $target_lang );
			if ( $trans > 0 && $trans !== $post_id ) {
				return $trans;
			}
		}

		return $post_id;
	}

	/**
	 * Map term ID to translated term in target language.
	 */
	public static function map_term_id( int $term_id, string $target_lang ): int {
		if ( $term_id > 0 && function_exists( 'pll_get_term' ) ) {
			$trans = pll_get_term( $term_id, $target_lang );
			if ( is_numeric( $trans ) && (int) $trans > 0 ) {
				return (int) $trans;
			}
		}

		return $term_id;
	}

	/**
	 * Unserialize metadata values safely without instantiating PHP objects.
	 *
	 * @param mixed $value Serialized metadata value.
	 * @return mixed
	 */
	private static function safe_unserialize_meta( $value ) {
		if ( ! is_string( $value ) || ! is_serialized( $value ) ) {
			return $value;
		}

		$trimmed = trim( $value );

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize -- Required to safely decode serialized metadata without instantiating PHP objects.
		$unserialized = @unserialize(
			$trimmed,
			array(
				'allowed_classes' => false,
			)
		);

		if ( false !== $unserialized || 'b:0;' === $trimmed ) {
			return $unserialized;
		}

		return $value;
	}
}
