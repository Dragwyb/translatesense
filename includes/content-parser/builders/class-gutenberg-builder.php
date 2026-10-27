<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Xml_Engine\Xml_Engine;
use DOMDocument;
use DOMXPath;
use DOMNode;
use DOMElement;
use DOMAttr;
use DOMText;
use TranslateSense\Includes\Translate\Builders\Gutenberg_Builder as Translate_Gutenberg_Builder;

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

			$name = $block['blockName'] ?? $block['name'] ?? '';
			if ( empty( $name ) ) {
				if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
					$this->extract_blocks_recursive( $block['innerBlocks'], $gutenberg_rules, $post_id, $lang, $extracted, $depth + 1 );
				}
				continue;
			}

			$no_translate = $gutenberg_rules[ $name ]['no_translate'] ?? array();
			$keys         = $gutenberg_rules[ $name ]['keys'] ?? array();
			$xpaths       = array();
			if ( ! empty( $gutenberg_rules[ $name ]['xpaths'] ) && is_array( $gutenberg_rules[ $name ]['xpaths'] ) ) {
				$xpaths = $gutenberg_rules[ $name ]['xpaths'];
			} elseif ( ! empty( $gutenberg_rules[ $name ]['xpath'] ) ) {
				$xpaths = array( array( 'value' => (string) $gutenberg_rules[ $name ]['xpath'] ) );
			}

			$found_strings = array();

			// 1. Match XML configured keys for block attributes
			if ( ! empty( $keys ) ) {
				$block_attrs = ( isset( $block['attrs'] ) && is_array( $block['attrs'] ) ) ? $block['attrs'] : array();

				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $no_translate[ $k_name ] ) ) {
						continue;
					}

					if ( isset( $block_attrs[ $k_name ] ) ) {
						$this->extract_attribute_strings_recursive(
							$block_attrs[ $k_name ],
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
			}

			// 2. Process innerContent: use XPath if configured and DOM classes exist; otherwise use fallback
			if ( isset( $block['innerContent'] ) && is_array( $block['innerContent'] ) && ! empty( $block['innerContent'] ) ) {
				if ( ! empty( $xpaths ) ) {
					if ( class_exists( 'DOMDocument' ) && class_exists( 'DOMXPath' ) ) {
						foreach ( $block['innerContent'] as $inner_content ) {
							if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
								$this->extract_xpath_strings_from_html(
									$inner_content,
									$xpaths,
									$post_id,
									$lang,
									$name,
									$extracted,
									$no_translate
								);
							}
						}
					}
				} elseif ( empty( $found_strings ) && empty( $no_translate ) && ! empty( $keys ) ) {
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
	 * Extract translatable strings from an HTML chunk of innerContent using DOMDocument and XPath expressions.
	 *
	 * @param string $html
	 * @param array  $xpaths
	 * @param int    $post_id
	 * @param string $lang
	 * @param string $block_name
	 * @param array  &$extracted
	 * @param array  $no_translate
	 */
	public function extract_xpath_strings_from_html( string $html, array $xpaths, int $post_id, string $lang, string $block_name, array &$extracted, array $no_translate = array() ): void {
		if ( ! class_exists( 'DOMDocument' ) || ! class_exists( 'DOMXPath' ) || '' === trim( $html ) || empty( $xpaths ) ) {
			return;
		}

		$dom = new DOMDocument();
		libxml_use_internal_errors( true );
		$wrapped = '<?xml encoding="UTF-8"><body>' . $html . '</body>';
		$loaded  = $dom->loadHTML( $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		if ( ! $loaded ) {
			return;
		}

		$xpath           = new DOMXPath( $dom );
		$body            = $dom->getElementsByTagName( 'body' )->item( 0 );
		$processed_nodes = array();

		foreach ( $xpaths as $xp_entry ) {
			$query = is_array( $xp_entry ) ? ( $xp_entry['value'] ?? $xp_entry['xpath'] ?? '' ) : (string) $xp_entry;
			$query = trim( $query );
			if ( '' === $query || isset( $no_translate[ $query ] ) ) {
				continue;
			}

			$nodes = $body ? @$xpath->query( $query, $body ) : @$xpath->query( $query );
			if ( ! $nodes || 0 === $nodes->length ) {
				continue;
			}

			$label = is_array( $xp_entry ) && ! empty( $xp_entry['label'] ) ? (string) $xp_entry['label'] : $query;

			foreach ( $nodes as $node ) {
				try {
					if ( ! $node || ! ( $node instanceof DOMNode ) ) {
						continue;
					}
					$node_id = spl_object_hash( $node );
					if ( isset( $processed_nodes[ $node_id ] ) ) {
						continue;
					}
					$processed_nodes[ $node_id ] = true;

					$node_val = $this->get_node_extracted_value( $node, $dom );
					if ( '' !== trim( $node_val ) ) {
						$this->record_extracted_string( $post_id, $lang, $block_name, $label, $node_val, $extracted );
					}
				} catch ( \Throwable $e ) {
					continue;
				}
			}
		}
	}

	/**
	 * Get translatable string value from a DOMNode.
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	public function get_node_extracted_value( DOMNode $node, DOMDocument $dom ): string {
		try {
			if ( ! $node || ! ( $node instanceof DOMNode ) ) {
				return '';
			}
			if ( $node instanceof DOMAttr ) {
				return (string) $node->value;
			}
			if ( $node instanceof DOMText ) {
				return (string) $node->nodeValue;
			}

			$inner_html = '';
			if ( $node->hasChildNodes() ) {
				foreach ( $node->childNodes as $child ) {
					$inner_html .= $dom->saveHTML( $child );
				}
			}
			return trim( $inner_html );
		} catch ( \Throwable $e ) {
			return '';
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
