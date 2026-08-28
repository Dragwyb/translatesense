<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Xml_Engine\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Divi Builder Parser.
 */
class Divi_Builder extends Base_Builder {

	/**
	 * Container blocks and structural modules to skip.
	 *
	 * @var array<string>
	 */
	protected static $skipped_modules = array(
		'divi/root',
		'divi/row',
		'divi/section',
		'divi/column',
		'et_pb_root',
		'et_pb_section',
		'et_pb_row',
		'et_pb_row_inner',
		'et_pb_column',
		'et_pb_column_inner',
	);

	/**
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'divi';
	}

	/**
	 * Parse Divi shortcode content or parsed block data into translatable strings.
	 *
	 * @param mixed  $content Divi post content string or block array
	 * @param int    $post_id Target post ID
	 * @param string $lang    Source language code
	 * @param array  $rules   Divi builder XML configuration rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( empty( $rules ) ) {
			$all_engine_rules = Xml_Engine::get_all_rules();
			$rules            = $all_engine_rules['divi'] ?? array();
		}

		$extracted = array();

		// 1. Handle array payload (Divi parsed data)
		if ( is_array( $content ) ) {
			$this->extract_divi_json_tree( $content, $rules, $post_id, $lang, $extracted );
			return $extracted;
		}

		// 2. Handle string content (JSON or standard Divi shortcodes)
		if ( is_string( $content ) && ! empty( $content ) ) {
			$decoded_json = json_decode( $content, true );
			if ( is_array( $decoded_json ) ) {
				$this->extract_divi_json_tree( $decoded_json, $rules, $post_id, $lang, $extracted );
				return $extracted;
			}

			// Parse standard Divi shortcodes
			$this->extract_divi_shortcodes_recursive( $content, $rules, $post_id, $lang, $extracted );
			return $extracted;
		}

		// 3. Fallback to post content from database if content is empty
		if ( empty( $content ) && $post_id > 0 ) {
			$post_obj = get_post( $post_id );
			if ( $post_obj && ! empty( $post_obj->post_content ) ) {
				$this->extract_divi_shortcodes_recursive( $post_obj->post_content, $rules, $post_id, $lang, $extracted );
			}
		}

		return $extracted;
	}

	/**
	 * Parse Divi parsed data matching storeDiviParsedData JS logic.
	 *
	 * @param array  $divi_parsed_data Blocks data array
	 * @param array  $divi_rules       Active Divi rules reference
	 * @param int    $post_id          Post ID
	 * @param string $lang             Language code
	 * @param array  $extracted        Extracted strings accumulator
	 */
	public function extract_divi_json_tree( array $divi_parsed_data, array &$divi_rules, int $post_id, string $lang, array &$extracted ): void {
		foreach ( $divi_parsed_data as $id => $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$block_name = $block['name'] ?? '';
			if ( empty( $block_name ) || in_array( $block_name, self::$skipped_modules, true ) ) {
				continue;
			}

			if ( empty( $block['props']['attrs'] ) || ! is_array( $block['props']['attrs'] ) ) {
				continue;
			}

			$attrs = $block['props']['attrs'];

			$configured_fields = $divi_rules[ $block_name ]['fields'] ?? array();
			$no_translate      = $divi_rules[ $block_name ]['no_translate'] ?? array();
			$mapped_rule_paths = array();

			// Pre-register ghost / noTranslate paths
			foreach ( $no_translate as $blocked_key => $is_blocked ) {
				$mapped_rule_paths[ (string) $blocked_key ] = true;
			}

			// 1. Process pre-existing XML configured rules
			if ( ! empty( $configured_fields ) ) {
				foreach ( $configured_fields as $field_path => $f_info ) {
					$field_str = (string) $field_path;
					if ( isset( $no_translate[ $field_str ] ) ) {
						continue;
					}

					$val = $this->get_nested_val( $attrs, $field_str );
					if ( is_string( $val ) && '' !== trim( $val ) ) {
						$this->record_extracted_string( $post_id, $lang, $block_name, $field_str, $val, $extracted );
					}
					$mapped_rule_paths[ $field_str ] = true;
				}
			}

			// 2. Run childAttributes logic to discover and extract unmapped strings
			$new_rules = array();
			$this->child_attributes( $attrs, array( (string) $id ), $block_name, $mapped_rule_paths, $post_id, $lang, $extracted, $new_rules );

			// 3. Persist discovered rules to XML if any new keys found
			if ( ! empty( $new_rules ) ) {
				Xml_Engine::append_custom_rule( 'divi', $block_name, $new_rules );

				if ( ! isset( $divi_rules[ $block_name ] ) ) {
					$divi_rules[ $block_name ] = array(
						'name'   => $block_name,
						'source' => 'custom',
						'fields' => array(),
					);
				}

				foreach ( $new_rules as $rule_path => $schema_info ) {
					$divi_rules[ $block_name ]['fields'][ $rule_path ] = array(
						'field'       => $rule_path,
						'type'        => $schema_info['type'] ?? 'content',
						'editor_type' => $schema_info['editor_type'] ?? 'VISUAL',
					);
				}
			}
		}
	}

	/**
	 * Traverse block attributes recursively matching childAttributes JS logic.
	 *
	 * @param array  $attrs             Block attributes array
	 * @param array  $ids               Path accumulator
	 * @param string $module_name       Module / block identifier
	 * @param array  $mapped_rule_paths Mapped XML paths
	 * @param int    $post_id           Post ID
	 * @param string $lang              Language code
	 * @param array  $extracted         Extracted output accumulator
	 * @param array  $new_rules         Discovered XML rule fields accumulator
	 */
	protected function child_attributes( array $attrs, array $ids, string $module_name, array $mapped_rule_paths, int $post_id, string $lang, array &$extracted, array &$new_rules ): void {
		foreach ( $attrs as $key => $val ) {
			$current_ids = array_merge( $ids, array( (string) $key ) );

			// Check key === "innerContent" with desktop.value (string)
			if ( 'innerContent' === $key && is_array( $val ) && isset( $val['desktop']['value'] ) && is_string( $val['desktop']['value'] ) && '' !== trim( $val['desktop']['value'] ) ) {
				$path_ids  = array_merge( $current_ids, array( 'desktop', 'value' ) );
				$rule_path = implode( '>', array_slice( $path_ids, 1 ) );
				$text_val  = $val['desktop']['value'];

				if ( ! isset( $mapped_rule_paths[ $rule_path ] ) && ! isset( $mapped_rule_paths['content'] ) ) {
					$this->record_extracted_string( $post_id, $lang, $module_name, $rule_path, $text_val, $extracted );
					$new_rules[ $rule_path ] = array(
						'type'        => 'content',
						'editor_type' => 'VISUAL',
					);
				}
			} elseif ( 'innerContent' === $key && is_array( $val ) && isset( $val['desktop']['value']['text'] ) && is_string( $val['desktop']['value']['text'] ) && '' !== trim( $val['desktop']['value']['text'] ) ) {
				// Check key === "innerContent" with desktop.value.text (string)
				$path_ids  = array_merge( $current_ids, array( 'desktop', 'value', 'text' ) );
				$rule_path = implode( '>', array_slice( $path_ids, 1 ) );
				$text_val  = $val['desktop']['value']['text'];

				if ( ! isset( $mapped_rule_paths[ $rule_path ] ) && ! isset( $mapped_rule_paths['content'] ) ) {
					$this->record_extracted_string( $post_id, $lang, $module_name, $rule_path, $text_val, $extracted );
					$new_rules[ $rule_path ] = array(
						'type'        => 'content',
						'editor_type' => 'VISUAL',
					);
				}
			} elseif ( is_array( $val ) && ! empty( $val ) ) {
				// Recurse nested objects
				$this->child_attributes( $val, $current_ids, $module_name, $mapped_rule_paths, $post_id, $lang, $extracted, $new_rules );
			}
		}
	}

	/**
	 * Recursively extract strings from Divi Builder shortcode content.
	 *
	 * @param string $content    Shortcode content string
	 * @param array  $divi_rules Active Divi rules reference
	 * @param int    $post_id    Post ID
	 * @param string $lang       Language code
	 * @param array  $extracted  Extracted string accumulator
	 */
	public function extract_divi_shortcodes_recursive( string $content, array &$divi_rules, int $post_id, string $lang, array &$extracted ): void {
		if ( preg_match_all( '/\[(et_pb_[a-z0-9_]+)([^\]]*)\](?:(.*?)\[\/\1\])?/s', $content, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$module_name = $match[1];
				$raw_attrs   = $match[2];
				$inner_body  = $match[3] ?? '';

				if ( in_array( $module_name, self::$skipped_modules, true ) ) {
					if ( ! empty( $inner_body ) && false !== strpos( $inner_body, '[et_pb_' ) ) {
						$this->extract_divi_shortcodes_recursive( $inner_body, $divi_rules, $post_id, $lang, $extracted );
					}
					continue;
				}

				$configured_fields = $divi_rules[ $module_name ]['fields'] ?? array();
				$no_translate      = $divi_rules[ $module_name ]['no_translate'] ?? array();
				$mapped_rule_paths = array();

				// Pre-register ghost / no_translate fields
				foreach ( $no_translate as $blocked_key => $is_blocked ) {
					$mapped_rule_paths[ (string) $blocked_key ] = true;
				}

				// Parse shortcode attributes
				$attrs = array();
				if ( function_exists( 'shortcode_parse_atts' ) ) {
					$parsed_atts = shortcode_parse_atts( $raw_attrs );
					if ( is_array( $parsed_atts ) ) {
						$attrs = $parsed_atts;
					}
				}

				// 1. Process pre-existing XML configured rules
				if ( ! empty( $configured_fields ) ) {
					foreach ( $configured_fields as $field_key => $f_info ) {
						$field_key_str = (string) $field_key;

						if ( isset( $no_translate[ $field_key_str ] ) ) {
							continue;
						}

						if ( 'content' === $field_key_str ) {
							if ( ! empty( $inner_body ) && false === strpos( $inner_body, '[et_pb_' ) ) {
								$clean_body = trim( $inner_body );
								if ( ! empty( $clean_body ) ) {
									$this->record_extracted_string( $post_id, $lang, $module_name, 'content', $clean_body, $extracted );
								}
							}
						} elseif ( isset( $attrs[ $field_key_str ] ) && is_string( $attrs[ $field_key_str ] ) && '' !== trim( $attrs[ $field_key_str ] ) ) {
							$val = $attrs[ $field_key_str ];
							$this->record_extracted_string( $post_id, $lang, $module_name, $field_key_str, $val, $extracted );
						}

						$mapped_rule_paths[ $field_key_str ] = true;
					}
				}

				// 2. If module or content not in existing XML rules, discover and save
				if ( ! isset( $mapped_rule_paths['content'] ) && ! empty( $inner_body ) && false === strpos( $inner_body, '[et_pb_' ) ) {
					$clean_body = trim( $inner_body );
					if ( ! empty( $clean_body ) ) {
						$this->record_extracted_string( $post_id, $lang, $module_name, 'content', $clean_body, $extracted );

						$new_rules = array(
							'content' => array(
								'type'        => 'content',
								'editor_type' => 'VISUAL',
							),
						);
						Xml_Engine::append_custom_rule( 'divi', $module_name, $new_rules );

						if ( ! isset( $divi_rules[ $module_name ] ) ) {
							$divi_rules[ $module_name ] = array(
								'name'   => $module_name,
								'source' => 'custom',
								'fields' => array(),
							);
						}
						$divi_rules[ $module_name ]['fields']['content'] = array(
							'field'       => 'content',
							'type'        => 'content',
							'editor_type' => 'VISUAL',
						);
					}
				}

				// Recurse inner modules if body contains nested shortcodes
				if ( ! empty( $inner_body ) && false !== strpos( $inner_body, '[et_pb_' ) ) {
					$this->extract_divi_shortcodes_recursive( $inner_body, $divi_rules, $post_id, $lang, $extracted );
				}
			}
		}
	}
}
