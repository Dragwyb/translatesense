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
	public function extract_blocks_recursive( array $blocks, array $gutenberg_rules, int $post_id, string $lang, array &$extracted, int $depth = 0 ): void {
		if ( empty( $blocks ) || $depth > 100 ) {
			return;
		}

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$name = $block['blockName'] ?? '';
			if ( empty( $name ) ) {
				if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
					$this->extract_blocks_recursive( $block['innerBlocks'], $gutenberg_rules, $post_id, $lang, $extracted, $depth + 1 );
				}
				continue;
			}

			$no_translate = $gutenberg_rules[ $name ]['no_translate'] ?? array();

			// Match XML configured keys for the block
			if ( isset( $gutenberg_rules[ $name ]['keys'] ) && ! empty( $gutenberg_rules[ $name ]['keys'] ) ) {

				$keys = $gutenberg_rules[ $name ]['keys'];

				$found_strings = array();

				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $no_translate[ $k_name ] ) ) {
						continue;
					}

					if ( isset( $block['attrs'][ $k_name ] ) ) {
						$this->extract_attribute_strings_recursive(
							$block['attrs'][ $k_name ],
							$k_info,
							$post_id,
							$lang,
							$extracted,
							$found_strings,
							$name,
							$k_name,
							$no_translate
						);
					}
				}

				if ( empty( $found_strings ) && empty( $no_translate ) && isset( $block['innerContent'] ) && ! empty( $block['innerContent'] ) && is_array( $block['innerContent'] ) ) {
					foreach ( $block['innerContent'] as $inner_content ) {
						if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
							$this->record_extracted_string( $post_id, $lang, $name, 'innerContent', $inner_content, $extracted );
						}
					}
				}
			}

			// Recurse inner blocks
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$this->extract_blocks_recursive( $block['innerBlocks'], $gutenberg_rules, $post_id, $lang, $extracted, $depth + 1 );
			}
		}
	}

	/**
	 * Recursively extract translatable strings from a block attribute.
	 * Supports:
	 * - Direct string values.
	 * - Sequential arrays of items with key="*" (repeater arrays like accordionLists).
	 * - Associative arrays (direct nested objects).
	 *
	 * @param mixed  $data          Attribute value (string, sequential array, or associative array)
	 * @param array  $schema        Key schema from XML rules
	 * @param int    $post_id       Post ID
	 * @param string $lang          Language code
	 * @param array  &$extracted    Extracted strings list reference
	 * @param array  &$found_strings List of raw strings found in this block
	 * @param string $block_name    Gutenberg block name
	 * @param string $path_key      Path identifier (e.g. 'accordionLists>title')
	 * @param array  $no_translate  Paths/keys excluded from translation
	 * @param int    $depth         Recursion depth
	 */
	public function extract_attribute_strings_recursive( $data, array $schema, int $post_id, string $lang, array &$extracted, array &$found_strings, string $block_name, string $path_key = '', array $no_translate = array(), int $depth = 0 ): void {
		if ( empty( $data ) || $depth > 20 ) {
			return;
		}

		if ( isset( $no_translate[ $path_key ] ) ) {
			return;
		}

		// 1. Direct string value
		if ( is_string( $data ) ) {
			if ( '' !== trim( $data ) ) {
				$found_strings[] = $data;
				$this->record_extracted_string( $post_id, $lang, $block_name, $path_key, $data, $extracted );
			}
			return;
		}

		if ( ! is_array( $data ) ) {
			return;
		}

		$children_schema = $schema['children'] ?? $schema;
		$has_wildcard    = ! empty( $children_schema ) && isset( $children_schema['*'] );
		$item_schema     = $has_wildcard ? ( $children_schema['*']['children'] ?? $children_schema['*'] ) : $children_schema;

		// 2. Sequential list of items (e.g. accordionLists = [ { title: '...' }, ... ])
		$is_sequential = ( array_keys( $data ) === range( 0, count( $data ) - 1 ) );

		if ( $is_sequential ) {
			foreach ( $data as $index => $item ) {
				if ( is_string( $item ) ) {
					if ( '' !== trim( $item ) ) {
						$found_strings[] = $item;
						$this->record_extracted_string( $post_id, $lang, $block_name, $path_key, $item, $extracted );
					}
				} elseif ( is_array( $item ) && ! empty( $item_schema ) && is_array( $item_schema ) ) {
					foreach ( $item_schema as $child_key => $child_schema ) {
						if ( isset( $item[ $child_key ] ) ) {
							$child_path = empty( $path_key ) ? $child_key : ( $path_key . '>' . $child_key );
							$this->extract_attribute_strings_recursive(
								$item[ $child_key ],
								$child_schema,
								$post_id,
								$lang,
								$extracted,
								$found_strings,
								$block_name,
								$child_path,
								$no_translate,
								$depth + 1
							);
						}
					}
				}
			}
			return;
		}

		// 3. Associative array (direct object with key-value pairs)
		$effective_children = $has_wildcard ? ( $children_schema['*']['children'] ?? $children_schema ) : $children_schema;

		if ( ! empty( $effective_children ) && is_array( $effective_children ) ) {
			foreach ( $effective_children as $child_key => $child_schema ) {
				if ( isset( $data[ $child_key ] ) ) {
					$child_path = empty( $path_key ) ? $child_key : ( $path_key . '>' . $child_key );
					$this->extract_attribute_strings_recursive(
						$data[ $child_key ],
						$child_schema,
						$post_id,
						$lang,
						$extracted,
						$found_strings,
						$block_name,
						$child_path,
						$no_translate,
						$depth + 1
					);
				}
			}
		}
	}
}
