<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translate\Builders;

use WP_Post;
use TranslateSense\Includes\Xml_Engine\Xml_Engine;
use TranslateSense\Includes\Translate\Translate;
use DOMDocument;
use DOMXPath;
use DOMNode;
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
	 * In-memory cache for registered block default string attributes.
	 *
	 * Maps block name to an associative array of [ attr_name => default_string_value ].
	 *
	 * @var array<string, array<string, string>>
	 */
	private static array $block_default_attributes_cache = array();

	/**
	 * Get builder slug.
	 */
	public function get_builder_slug(): string {
		return 'gutenberg';
	}

	/**
	 * Retrieve registered default string attributes for a given block type from cache or WP_Block_Type_Registry.
	 *
	 * @param string $block_name Block type name (e.g. 'core/paragraph', 'essential-blocks/call-to-action').
	 * @return array<string, string> Map of attribute name => default string value.
	 */
	public static function get_block_default_attributes( string $block_name ): array {
		if ( isset( self::$block_default_attributes_cache[ $block_name ] ) ) {
			return self::$block_default_attributes_cache[ $block_name ];
		}

		if ( ! class_exists( '\WP_Block_Type_Registry' ) ) {
			self::$block_default_attributes_cache[ $block_name ] = array();
			return array();
		}

		$registry = \WP_Block_Type_Registry::get_instance();
		if ( ! $registry || ! method_exists( $registry, 'get_registered' ) ) {
			self::$block_default_attributes_cache[ $block_name ] = array();
			return array();
		}

		$block_type = $registry->get_registered( $block_name );

		if ( ! $block_type || empty( $block_type->attributes ) || ! is_array( $block_type->attributes ) ) {
			self::$block_default_attributes_cache[ $block_name ] = array();
			return array();
		}

		$defaults = array();

		if ( isset( $block_type->attributes ) && ! empty( $block_type->attributes ) ) {
			$defaults = $block_type->attributes;
		}

		self::$block_default_attributes_cache[ $block_name ] = $defaults;
		return $defaults;
	}

	/**
	 * Clear the block default attributes cache.
	 *
	 * @return void
	 */
	public static function clear_block_default_attributes_cache(): void {
		self::$block_default_attributes_cache = array();
	}

	/**
	 * Process missing default attributes for a Gutenberg block.
	 *
	 * If an attribute with a registered default string is missing from $block['attrs'],
	 * look up its translation in the translation store using the existing block-name and string hash.
	 * If a valid translation exists, set it explicitly in $block['attrs'].
	 *
	 * @param array  $block        Parsed block array (passed by reference).
	 * @param string $block_name   Block type name.
	 * @param string $source_lang  Source language code.
	 * @param string $target_lang  Target language code.
	 * @param int    $post_id      Post ID.
	 * @param array  $custom_opts  Custom options including in_memory_translations.
	 * @return void
	 */
	public static function apply_missing_default_attributes( array &$block_attrs, string $block_name, string $attr_name, $attr_val, array $k_info, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): void {

		if ( empty( $block_name ) ) {
			return;
		}

		if ( ! isset( $block_attrs ) || ! is_array( $block_attrs ) ) {
			return;
		}

		if ( empty( $attr_val ) || ! isset( $attr_val['default'] ) ) {
			return;
		}

		$block_attrs[ $attr_name ] = $attr_val['default'];

		self::translate_attribute_value_recursive(
			$block_attrs[ $attr_name ],
			$k_info,
			$block_name,
			$attr_val,
			$source_lang,
			$target_lang,
			$post_id,
			$custom_opts,
			0
		);
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

			if ( ! isset( $block['attrs'] ) || ! is_array( $block['attrs'] ) ) {
				$block['attrs'] = array();
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
				$defaults_attr = self::get_block_default_attributes( $name );
				// 1. Translate block attributes from XML configured keys
				if ( ! empty( $keys ) ) {
					foreach ( $keys as $k_name => $k_info ) {
						$current_defaults_attr = $defaults_attr[ $k_name ] ?? '';
						if ( isset( $block['attrs'][ $k_name ] ) ) {
							$found_strings[] = $block['attrs'][ $k_name ];
							self::translate_attribute_value_recursive(
								$block['attrs'][ $k_name ],
								$k_info,
								$name,
								$current_defaults_attr,
								$source_lang,
								$target_lang,
								$post_id,
								$custom_opts,
								0
							);
						} elseif ( ! empty( $current_defaults_attr ) ) {
							// 1b. Apply missing default attributes for registered block type
							self::apply_missing_default_attributes( $block['attrs'], $name, $k_name, $current_defaults_attr, $k_info, $source_lang, $target_lang, $post_id, $custom_opts );
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
									'',
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

		// DOMDocument repairs incomplete HTML fragments. Parse a working copy only;
		// never serialize that repaired DOM back into Gutenberg's original fragment.
		$dom              = new DOMDocument( '1.0', 'UTF-8' );
		$previous_setting = libxml_use_internal_errors( true );
		$wrapped          = '<?xml encoding="UTF-8"><body>' . $html . '</body>';
		$loaded           = $dom->loadHTML( $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();
		libxml_use_internal_errors( $previous_setting );

		if ( ! $loaded ) {
			return $html;
		}

		$xpath           = new DOMXPath( $dom );
		$body            = $dom->getElementsByTagName( 'body' )->item( 0 );
		$source_html     = $html;
		$modified        = false;
		$processed_nodes = array();

		if ( ! $body ) {
			return $html;
		}

		foreach ( $xpaths as $xp_entry ) {
			$query = is_array( $xp_entry ) ? ( $xp_entry['value'] ?? $xp_entry['xpath'] ?? '' ) : (string) $xp_entry;
			$query = trim( $query );
			if ( '' === $query ) {
				continue;
			}

			$nodes = @$xpath->query( $query, $body );
			if ( ! $nodes || 0 === $nodes->length ) {
				continue;
			}

			// Snapshot the NodeList before changing the working DOM.
			$nodes_arr = array();
			foreach ( $nodes as $node_item ) {
				$nodes_arr[] = $node_item;
			}

			foreach ( $nodes_arr as $node ) {
				if ( ! ( $node instanceof DOMNode ) ) {
					continue;
				}

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

				$translated_val = isset( $res['translated'] ) && is_string( $res['translated'] )
					? $res['translated']
					: $orig_val;

				if ( $translated_val === $orig_val ) {
					continue;
				}

				// Patch only the matching source value. Do not use saveHTML() output as
				// the return value, because it may contain parser-generated closing tags.
				$patched_html = self::replace_translated_value_in_source( $source_html, $node, $orig_val, $translated_val );
				if ( $patched_html !== $source_html ) {
					$source_html = $patched_html;
					$modified    = true;
				}

				// Keep the working DOM in sync for subsequent XPath expressions, but
				// never serialize this DOM into the Gutenberg fragment.
				self::set_node_content( $node, $translated_val, $dom );
				$xpath = new DOMXPath( $dom );
				$body  = $dom->getElementsByTagName( 'body' )->item( 0 );
			}
		}

		return $modified ? $source_html : $html;
	}

	/**
	 * Replace a translated DOM value in the original source without serializing the
	 * repaired DOM. This preserves incomplete opening/closing tag boundaries in
	 * Gutenberg innerContent fragments.
	 *
	 * @param string  $source_html    Original source fragment (or already patched fragment).
	 * @param DOMNode $node           XPath-selected node from the working DOM.
	 * @param string  $original_value Original value read from the node.
	 * @param string  $translated     Translated value.
	 * @return string
	 */
	private static function replace_translated_value_in_source( string $source_html, DOMNode $node, string $original_value, string $translated ): string {
		if ( $node instanceof DOMAttr ) {
			$attribute_name = preg_quote( $node->name, '/' );
			$replaced       = false;
			$pattern        = "/(\\b" . $attribute_name . "\\s*=\\s*)([\"'])(.*?)\\2/is";

			$result = preg_replace_callback(
				$pattern,
				static function ( $matches ) use ( &$replaced, $original_value, $translated ) {
					if ( $replaced || html_entity_decode( $matches[3], ENT_QUOTES | ENT_HTML5, 'UTF-8' ) !== $original_value ) {
						return $matches[0];
					}

					$replaced = true;
					return $matches[1] . $matches[2] . htmlspecialchars( $translated, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ) . $matches[2];
				},
				$source_html,
				1
			);

			return is_string( $result ) ? $result : $source_html;
		}

		// For element selections, get_node_content() returns inner HTML. If it is
		// plain text, patch only a text segment. For selected text nodes, do the same.
		$is_plain_text = $node instanceof DOMText || ( $node instanceof \DOMElement && false === strpos( $original_value, '<' ) );
		if ( $is_plain_text ) {
			$decoded_original = html_entity_decode( $original_value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			$encoded_new      = htmlspecialchars( $translated, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8' );
			$candidates       = array_unique(
				array_filter(
					array(
						$original_value,
						$decoded_original,
						htmlspecialchars( $decoded_original, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8' ),
						htmlspecialchars( $decoded_original, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ),
						htmlentities( $decoded_original, ENT_NOQUOTES | ENT_HTML5 | ENT_SUBSTITUTE, 'UTF-8' ),
					),
					static fn( $value ) => is_string( $value ) && '' !== $value
				)
			);

			foreach ( $candidates as $candidate ) {
				$replaced = false;
				$result   = preg_replace_callback(
					'/(<[^>]*>|[^<]+)/s',
					static function ( $matches ) use ( &$replaced, $candidate, $encoded_new ) {
						// Never replace text inside an HTML tag or attribute.
						if ( $replaced || ( isset( $matches[1] ) && 0 === strpos( $matches[1], '<' ) ) ) {
							return $matches[0];
						}

						$position = strpos( $matches[0], $candidate );
						if ( false === $position ) {
							return $matches[0];
						}

						$replaced = true;
						return substr( $matches[0], 0, $position ) . $encoded_new . substr( $matches[0], $position + strlen( $candidate ) );
					},
					$source_html
				);

				if ( $replaced && is_string( $result ) ) {
					return $result;
				}
			}

			return $source_html;
		}

		// For selected elements containing nested markup, replace only an exact
		// source substring. If the DOM-normalized value is not present verbatim,
		// leave the source untouched rather than risk damaging the block structure.
		$original_html = trim( $original_value );
		if ( '' !== $original_html && false !== strpos( $source_html, $original_html ) ) {
			$replacement = false !== strpos( $translated, '<' )
				? $translated
				: htmlspecialchars( $translated, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8' );
			return substr_replace( $source_html, $replacement, strpos( $source_html, $original_html ), strlen( $original_html ) );
		}

		return $source_html;
	}

	/**
	 * Get extracted content of a DOMNode (inner HTML for DOMElement, value for DOMAttr or DOMText).
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	public static function get_node_content( DOMNode $node, DOMDocument $dom ): string {
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
	 * Get inner HTML of a DOMNode.
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	public static function get_node_inner_html( DOMNode $node, DOMDocument $dom ): string {
		try {
			if ( ! $node || ! ( $node instanceof DOMNode ) ) {
				return '';
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
	 * Set translated content into a DOMNode (DOMElement, DOMAttr, or DOMText).
	 *
	 * @param DOMNode     $node
	 * @param string      $new_content
	 * @param DOMDocument $dom
	 * @return void
	 */
	public static function set_node_content( DOMNode $node, string $new_content, DOMDocument $dom ): void {
		try {
			if ( ! $node || ! ( $node instanceof DOMNode ) ) {
				return;
			}
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
		} catch ( \Throwable $e ) {
			return;
		}
	}

	/**
	 * Helper: Recursively translate block attribute value with depth protection.
	 *
	 * @param mixed  $val
	 * @param mixed  $schema_info
	 * @param string $block_name
	 * @param string $current_defaults_attr
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 * @param int    $depth
	 */
	private static function translate_attribute_value_recursive( &$val, $schema_info, string $block_name, $current_defaults_attr, string $source_lang, string $target_lang, int $post_id, array $custom_opts, int $depth = 0 ): void {
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
			foreach ( $val as $index => &$item ) {
				self::translate_attribute_value_recursive(
					$item,
					$item_schema,
					$block_name,
					$current_defaults_attr[ $index ] ?? null,
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
				$current_defaults_attr = $defaults_attr[ $child_key ] ?? '';
				if ( isset( $val[ $child_key ] ) ) {
					self::translate_attribute_value_recursive(
						$val[ $child_key ],
						$child_schema,
						$block_name,
						$current_defaults_attr,
						$source_lang,
						$target_lang,
						$post_id,
						$custom_opts,
						$depth + 1
					);
				} elseif ( ! empty( $current_defaults_attr ) ) {
					self::apply_missing_default_attributes(
						$val,
						$block_name,
						$child_key,
						$current_defaults_attr,
						$child_schema,
						$source_lang,
						$target_lang,
						$post_id,
						$custom_opts
					);
				}
			}
		} else {
			foreach ( $val as $k => &$sub_val ) {
				self::translate_attribute_value_recursive(
					$sub_val,
					null,
					$block_name,
					$current_defaults_attr[ $k ] ?? null,
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
