<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translate\Builders;

use WP_Post;
use TranslateSense\Includes\Xml_Engine\Xml_Engine;
use TranslateSense\Includes\Translate\Translate;
use DOMDocument;
use DOMXPath;
use DOMNode;
use DOMElement;
use DOMAttr;
use DOMText;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gutenberg Blocks Translation Builder.
 */
class Gutenberg_Builder extends Base_Builder {

	/**
	 * Get builder slug.
	 */
	public function get_builder_slug(): string {
		return 'gutenberg';
	}

	/**
	 * Translate Gutenberg blocks tree.
	 *
	 * @param WP_Post $source_post
	 * @param string  $source_lang
	 * @param string  $target_lang
	 * @param array   $custom_opts
	 * @return string
	 */
	public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() ): string {
		if ( ! function_exists( 'has_blocks' ) || ! has_blocks( $source_post->post_content ) ) {
			return $source_post->post_content;
		}

		$blocks = parse_blocks( $source_post->post_content );
		$rules  = Xml_Engine::get_all_rules( 'gutenberg' );

		self::translate_blocks_tree( $blocks, $rules, $source_lang, $target_lang, $source_post->ID, $custom_opts );

		return serialize_blocks( $blocks );
	}

	/**
	 * Recursively translate Gutenberg blocks tree.
	 *
	 * @param array  $blocks
	 * @param array  $rules
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 */
	public static function translate_blocks_tree( array &$blocks, array $rules, string $source_lang, string $target_lang, int $post_id, array $custom_opts, int $depth = 0 ): void {
		if ( empty( $blocks ) || $depth > 100 ) {
			return;
		}

		foreach ( $blocks as &$block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$name = $block['blockName'] ?? '';
			if ( empty( $name ) ) {
				if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
					self::translate_blocks_tree( $block['innerBlocks'], $rules, $source_lang, $target_lang, $post_id, $custom_opts, $depth + 1 );
				}
				continue;
			}

			if ( isset( $rules[ $name ] ) ) {
				$keys   = $rules[ $name ]['keys'] ?? array();
				$xpaths = array();
				if ( ! empty( $rules[ $name ]['xpaths'] ) && is_array( $rules[ $name ]['xpaths'] ) ) {
					$xpaths = $rules[ $name ]['xpaths'];
				} elseif ( ! empty( $rules[ $name ]['xpath'] ) ) {
					$xpaths = array( array( 'value' => (string) $rules[ $name ]['xpath'] ) );
				}

				$found_strings = array();

				// 1. Translate block attributes from XML configured keys
				if ( ! empty( $keys ) && isset( $block['attrs'] ) && is_array( $block['attrs'] ) ) {
					foreach ( $keys as $k_name => $k_info ) {
						if ( isset( $block['attrs'][ $k_name ] ) ) {
							$found_strings[] = $block['attrs'][ $k_name ];
							self::translate_attribute_value_recursive(
								$block['attrs'][ $k_name ],
								$k_info,
								$name,
								$source_lang,
								$target_lang,
								$post_id,
								$custom_opts,
								0
							);
						}
					}
				}

				// 2. Translate block innerContent (using XPath when configured, otherwise fallback)
				if ( isset( $block['innerContent'] ) && is_array( $block['innerContent'] ) && ! empty( $block['innerContent'] ) ) {
					if ( ! empty( $xpaths ) ) {
						if ( class_exists( 'DOMDocument' ) && class_exists( 'DOMXPath' ) ) {
							$inner_content_modified = false;

							foreach ( $block['innerContent'] as &$inner_content ) {
								if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
									$translated_html = self::translate_inner_content_with_xpath(
										$inner_content,
										$xpaths,
										$name,
										$source_lang,
										$target_lang,
										$post_id,
										$custom_opts
									);

									if ( $translated_html !== $inner_content ) {
										$inner_content          = $translated_html;
										$inner_content_modified = true;
									}
								}
							}
							unset( $inner_content );

							if ( $inner_content_modified && empty( $block['innerBlocks'] ) ) {
								$block['innerHTML'] = implode( '', $block['innerContent'] );
							}
						}
					} elseif ( empty( $found_strings ) ) {
						$inner_content_modified = false;

						foreach ( $block['innerContent'] as &$inner_content ) {
							if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
								$orig = $inner_content;
								self::translate_attribute_value_recursive(
									$inner_content,
									array(),
									$name,
									$source_lang,
									$target_lang,
									$post_id,
									$custom_opts,
									0
								);
								if ( $orig !== $inner_content ) {
									$inner_content_modified = true;
								}
							}
						}
						unset( $inner_content );

						if ( $inner_content_modified && empty( $block['innerBlocks'] ) ) {
							$block['innerHTML'] = implode( '', $block['innerContent'] );
						}
					}
				}
			}

			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				self::translate_blocks_tree( $block['innerBlocks'], $rules, $source_lang, $target_lang, $post_id, $custom_opts, $depth + 1 );
			}
		}
	}

	/**
	 * Translate an HTML chunk of innerContent using DOMDocument and XPath expressions.
	 *
	 * @param string $html
	 * @param array  $xpaths
	 * @param string $block_name
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 * @return string
	 */
	public static function translate_inner_content_with_xpath( string $html, array $xpaths, string $block_name, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): string {
		if ( ! class_exists( 'DOMDocument' ) || ! class_exists( 'DOMXPath' ) || '' === trim( $html ) || empty( $xpaths ) ) {
			return $html;
		}

		$dom = new DOMDocument();
		libxml_use_internal_errors( true );
		$wrapped = '<?xml encoding="UTF-8"><body>' . $html . '</body>';
		$loaded  = $dom->loadHTML( $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		if ( ! $loaded ) {
			return $html;
		}

		$xpath           = new DOMXPath( $dom );
		$body            = $dom->getElementsByTagName( 'body' )->item( 0 );
		$modified        = false;
		$processed_nodes = array();

		foreach ( $xpaths as $xp_entry ) {
			$query = is_array( $xp_entry ) ? ( $xp_entry['value'] ?? $xp_entry['xpath'] ?? '' ) : (string) $xp_entry;
			$query = trim( $query );
			if ( '' === $query ) {
				continue;
			}

			$nodes = $body ? @$xpath->query( $query, $body ) : @$xpath->query( $query );
			if ( ! $nodes || 0 === $nodes->length ) {
				continue;
			}

			foreach ( $nodes as $node ) {
				$node_id = spl_object_hash( $node );
				if ( isset( $processed_nodes[ $node_id ] ) ) {
					continue;
				}
				$processed_nodes[ $node_id ] = true;

				$orig_val = self::get_node_content( $node, $dom );
				if ( '' === trim( $orig_val ) ) {
					continue;
				}

				$res = Translate::translate_string(
					$orig_val,
					$source_lang,
					$target_lang,
					$block_name,
					$post_id,
					$custom_opts
				);

				$translated_val = $res['translated'] ?? $orig_val;
				if ( $translated_val !== $orig_val ) {
					self::set_node_content( $node, $translated_val, $dom );
					$modified = true;
				}
			}
		}

		if ( ! $modified || ! $body ) {
			return $html;
		}

		return self::get_node_inner_html( $body, $dom );
	}

	/**
	 * Get extracted content of a DOMNode (inner HTML for DOMElement, value for DOMAttr or DOMText).
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	public static function get_node_content( DOMNode $node, DOMDocument $dom ): string {
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
	}

	/**
	 * Get inner HTML of a DOMNode.
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	public static function get_node_inner_html( DOMNode $node, DOMDocument $dom ): string {
		$inner_html = '';
		if ( $node->hasChildNodes() ) {
			foreach ( $node->childNodes as $child ) {
				$inner_html .= $dom->saveHTML( $child );
			}
		}
		return trim( $inner_html );
	}

	/**
	 * Set translated content into a DOMNode (DOMElement, DOMAttr, or DOMText).
	 *
	 * @param DOMNode     $node
	 * @param string       $new_content
	 * @param DOMDocument $dom
	 * @return void
	 */
	public static function set_node_content( DOMNode $node, string $new_content, DOMDocument $dom ): void {
		if ( $node instanceof DOMAttr ) {
			$node->value = htmlspecialchars( $new_content, ENT_COMPAT, 'UTF-8' );
			return;
		}

		if ( $node instanceof DOMText ) {
			$node->nodeValue = $new_content;
			return;
		}

		while ( $node->hasChildNodes() ) {
			$node->removeChild( $node->firstChild );
		}

		if ( '' !== $new_content ) {
			if ( false !== strpos( $new_content, '<' ) && class_exists( 'DOMDocument' ) ) {
				$frag_doc = new DOMDocument();
				libxml_use_internal_errors( true );
				$frag_doc->loadHTML( '<?xml encoding="UTF-8"><body>' . $new_content . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
				libxml_clear_errors();
				$frag_body = $frag_doc->getElementsByTagName( 'body' )->item( 0 );
				if ( $frag_body && $frag_body->hasChildNodes() ) {
					foreach ( $frag_body->childNodes as $child ) {
						$node->appendChild( $dom->importNode( $child, true ) );
					}
					return;
				}
			}

			// Plain text node
			$node->appendChild( $dom->createTextNode( $new_content ) );
		}
	}

	/**
	 * Helper: Recursively translate block attribute value with depth protection.
	 *
	 * @param mixed  $val
	 * @param mixed  $schema_info
	 * @param string $block_name
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 * @param int    $depth
	 */
	private static function translate_attribute_value_recursive( &$val, $schema_info, string $block_name, string $source_lang, string $target_lang, int $post_id, array $custom_opts, int $depth = 0 ): void {
		if ( $depth > 20 ) {
			return;
		}

		if ( is_string( $val ) ) {
			if ( '' !== trim( $val ) ) {
				$res = Translate::translate_string(
					$val,
					$source_lang,
					$target_lang,
					$block_name,
					$post_id,
					$custom_opts
				);
				$val = $res['translated'];
			}
			return;
		}

		if ( ! is_array( $val ) || empty( $val ) ) {
			return;
		}

		$children_schema = is_array( $schema_info ) ? ( $schema_info['children'] ?? null ) : null;
		$has_wildcard    = ! empty( $children_schema ) && isset( $children_schema['*'] );
		$item_schema     = $has_wildcard ? ( $children_schema['*']['children'] ?? $children_schema['*'] ) : ( $children_schema ?? $schema_info );

		// 1. Sequential list of items (e.g. repeaters like accordionLists = [ { title: '...' }, ... ])
		if ( array_keys( $val ) === range( 0, count( $val ) - 1 ) ) {
			foreach ( $val as &$item ) {
				self::translate_attribute_value_recursive(
					$item,
					$item_schema,
					$block_name,
					$source_lang,
					$target_lang,
					$post_id,
					$custom_opts,
					$depth + 1
				);
			}
			unset( $item );
			return;
		}

		// 2. Associative dictionary (e.g. object item = { title: '...' } or settings = { title: '...' })
		$effective_children = $has_wildcard ? ( $children_schema['*']['children'] ?? $children_schema ) : $children_schema;

		if ( ! empty( $effective_children ) && is_array( $effective_children ) ) {
			foreach ( $effective_children as $child_key => $child_schema ) {
				if ( isset( $val[ $child_key ] ) ) {
					self::translate_attribute_value_recursive(
						$val[ $child_key ],
						$child_schema,
						$block_name,
						$source_lang,
						$target_lang,
						$post_id,
						$custom_opts,
						$depth + 1
					);
				}
			}
		} else {
			foreach ( $val as $k => &$sub_val ) {
				self::translate_attribute_value_recursive(
					$sub_val,
					null,
					$block_name,
					$source_lang,
					$target_lang,
					$post_id,
					$custom_opts,
					$depth + 1
				);
			}
			unset( $sub_val );
		}
	}
}
