<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Xml_Engine\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gutenberg Block Editor Parser.
 */
class Gutenberg_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'gutenberg';
	}

	/**
	 * Parse Gutenberg blocks or block content into translatable strings.
	 *
	 * @param mixed  $content String content or array of parsed blocks
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( empty( $rules ) ) {
			$all_rules = Xml_Engine::get_all_rules();
			$rules     = $all_rules['gutenberg'] ?? array();
		}

		$blocks = array();
		if ( is_array( $content ) ) {
			$blocks = $content;
		} elseif ( is_string( $content ) && ! empty( $content ) ) {
			if ( function_exists( 'has_blocks' ) && has_blocks( $content ) ) {
				$blocks = parse_blocks( $content );
			} elseif ( function_exists( 'parse_blocks' ) ) {
				$blocks = parse_blocks( $content );
			}
		}

		$extracted = array();
		if ( ! empty( $blocks ) ) {
			$this->extract_blocks_recursive( $blocks, $rules, $post_id, $lang, $extracted );
		}

		return $extracted;
	}

	/**
	 * Recursively extract strings from Gutenberg blocks array.
	 *
	 * @param array  $blocks
	 * @param array  $gutenberg_rules
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $extracted
	 */
	public function extract_blocks_recursive( array $blocks, array $gutenberg_rules, int $post_id, string $lang, array &$extracted ): void {
		foreach ( $blocks as $block ) {
			$name = $block['blockName'] ?? '';
			if ( empty( $name ) ) {
				continue;
			}

			$no_translate = $gutenberg_rules[ $name ]['no_translate'] ?? array();
			$keys         = $gutenberg_rules[ $name ]['attributes'] ?? array();

			// Match XML configured keys/attributes for the block
			if ( ! empty( $keys ) ) {
				$found_strings = array();
				$attrs         = $block['attrs'] ?? array();

				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $no_translate[ $k_name ] ) || ! isset( $attrs[ $k_name ] ) ) {
						continue;
					}

					$this->extract_attribute_value_recursive(
						$attrs[ $k_name ],
						$k_info,
						(string) $k_name,
						$name,
						$post_id,
						$lang,
						$extracted,
						$found_strings
					);
				}

				if ( empty( $found_strings ) && empty( $no_translate ) && isset( $block['innerContent'] ) && ! empty( $block['innerContent'] ) ) {
					foreach ( $block['innerContent'] as $inner_content ) {
						if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
							$this->record_extracted_string( $post_id, $lang, $name, 'innerContent', $inner_content, $extracted );
						}
					}
				}
			}

			// Recurse inner blocks
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$this->extract_blocks_recursive( $block['innerBlocks'], $gutenberg_rules, $post_id, $lang, $extracted );
			}
		}
	}

	/**
	 * Helper: Recursively extract translatable strings from block attribute values.
	 *
	 * @param mixed  $val
	 * @param mixed  $schema_info
	 * @param string $path
	 * @param string $block_name
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $extracted
	 * @param array  $found_strings
	 */
	private function extract_attribute_value_recursive( $val, $schema_info, string $path, string $block_name, int $post_id, string $lang, array &$extracted, array &$found_strings ): void {
		if ( is_string( $val ) ) {
			if ( '' !== trim( $val ) ) {
				$found_strings[] = $val;
				$this->record_extracted_string( $post_id, $lang, $block_name, $path, $val, $extracted );
			}
			return;
		}

		if ( ! is_array( $val ) || empty( $val ) ) {
			return;
		}

		$children_schema = is_array( $schema_info ) ? ( $schema_info['children'] ?? null ) : null;

		// Case 1: Sequential list / array of items (e.g. table rows or list items)
		if ( array_keys( $val ) === range( 0, count( $val ) - 1 ) ) {
			foreach ( $val as $idx => $item ) {
				$sub_path = $path . '[' . $idx . ']';
				$this->extract_attribute_value_recursive(
					$item,
					$children_schema ?? $schema_info,
					$sub_path,
					$block_name,
					$post_id,
					$lang,
					$extracted,
					$found_strings
				);
			}
			return;
		}

		// Case 2: Associative object / dictionary
		if ( ! empty( $children_schema ) && is_array( $children_schema ) ) {
			foreach ( $children_schema as $child_key => $child_schema ) {
				if ( isset( $val[ $child_key ] ) ) {
					$sub_path = $path . '>' . $child_key;
					$this->extract_attribute_value_recursive(
						$val[ $child_key ],
						$child_schema,
						$sub_path,
						$block_name,
						$post_id,
						$lang,
						$extracted,
						$found_strings
					);
				}
			}
		} else {
			foreach ( $val as $k => $sub_val ) {
				$sub_path = $path . '>' . $k;
				$this->extract_attribute_value_recursive(
					$sub_val,
					null,
					$sub_path,
					$block_name,
					$post_id,
					$lang,
					$extracted,
					$found_strings
				);
			}
		}
	}
}
