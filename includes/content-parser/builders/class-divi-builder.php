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
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'divi';
	}

	/**
	 * Parse Divi shortcode content into translatable strings.
	 *
	 * @param mixed  $content Divi post content string
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( empty( $rules ) ) {
			$all_rules = Xml_Engine::get_all_rules();
			$rules     = $all_rules['divi'] ?? array();
		}

		$extracted = array();
		if ( is_string( $content ) && ! empty( $content ) ) {
			$this->extract_divi_strings_recursive( $content, $rules, $post_id, $lang, $extracted );
		}

		return $extracted;
	}

	/**
	 * Recursively extract strings from Divi Builder shortcode content.
	 *
	 * @param string $content
	 * @param array  $divi_rules
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $extracted
	 */
	public function extract_divi_strings_recursive( string $content, array $divi_rules, int $post_id, string $lang, array &$extracted ): void {
		// Pattern for matching Divi module shortcodes
		if ( preg_match_all( '/\[(et_pb_[a-z0-9_]+)([^\]]*)\](?:(.*?)\[\/\1\])?/s', $content, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$module_name = $match[1];
				$raw_attrs   = $match[2];
				$inner_body  = $match[3] ?? '';

				// Parse shortcode attributes
				if ( function_exists( 'shortcode_parse_atts' ) ) {
					$attrs = shortcode_parse_atts( $raw_attrs );
					if ( is_array( $attrs ) && isset( $divi_rules[ $module_name ]['fields'] ) ) {
						foreach ( $divi_rules[ $module_name ]['fields'] as $field_key => $f_info ) {
							if ( isset( $attrs[ $field_key ] ) && is_string( $attrs[ $field_key ] ) && '' !== trim( $attrs[ $field_key ] ) ) {
								$val = $attrs[ $field_key ];
								$this->record_extracted_string( $post_id, $lang, $module_name, $field_key, $val, $extracted );
							}
						}
					}
				}

				// Check inner body text for content modules
				if ( ! empty( $inner_body ) && false === strpos( $inner_body, '[et_pb_' ) ) {
					$clean_body = trim( $inner_body );
					if ( ! empty( $clean_body ) ) {
						$this->record_extracted_string( $post_id, $lang, $module_name, 'content', $clean_body, $extracted );
					}
				} elseif ( ! empty( $inner_body ) ) {
					// Recurse inner modules
					$this->extract_divi_strings_recursive( $inner_body, $divi_rules, $post_id, $lang, $extracted );
				}
			}
		}
	}
}
