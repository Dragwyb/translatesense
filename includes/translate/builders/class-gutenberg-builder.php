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
				// 1. Translate block attributes from XML configured keys
				if ( ! empty( $keys ) ) {
					foreach ( $keys as $k_name => $k_info ) {
						if ( isset( $block['attrs'][ $k_name ] ) ) {
							self::translate_attribute_value_recursive(
								$block['attrs'][ $k_name ],
								$k_info,
								$name,
								$found_strings,
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
							// sort by content_lenght
							$temp_strings = array_column( $found_strings, 'original' );
							usort( $temp_strings, static fn( $a, $b ) => strlen( $b ) <=> strlen( $a ) );
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

									$pattern = '~' . implode(
										'|',
										array_map( 'preg_quote', $temp_strings, array_fill( 0, count( $temp_strings ), '~' ) )
									) . '~';

									preg_match_all( $pattern, $inner_content, $matches );

									$matched_sources = array_unique( $matches[0] );

									$depth = 0;
									if ( $matched_sources && ! empty( $matched_sources ) ) {
										foreach ( $matched_sources as $matched_source ) {
											++$depth;
											if ( ! is_string( $matched_source ) || '' === trim( $matched_source ) ) {
												continue;
											}

											$inner_content_modified = true;
											$inner_content          = str_replace( $matched_source, $found_strings[ md5( $matched_source ) ]['translated'], $inner_content );
											if ( $depth > 20 ) {
												break;
											}
										}
									}

									if ( $inner_content_modified && empty( $block['innerBlocks'] ) ) {
										$block['innerHTML'] = implode( '', $block['innerContent'] );
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
									$found_strings,
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
					} elseif ( isset( $block['innerContent'] ) && ! empty( $block['innerContent'] ) && ! empty( $found_strings ) ) {
						// sort by content_lenght
						$temp_strings = array_column( $found_strings, 'original' );
						usort( $temp_strings, static fn( $a, $b ) => strlen( $b ) <=> strlen( $a ) );
						$inner_content_modified = false;

						foreach ( $block['innerContent'] as &$inner_content ) {
							if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
								$pattern = '~' . implode(
									'|',
									array_map( 'preg_quote', $temp_strings, array_fill( 0, count( $temp_strings ), '~' ) )
								) . '~';

								preg_match_all( $pattern, $inner_content, $matches );

								$matched_sources = array_unique( $matches[0] );

								if ( $matched_sources && ! empty( $matched_sources ) ) {
									foreach ( $matched_sources as $matched_source ) {
										$inner_content_modified = true;
										$inner_content          = str_replace( $matched_source, $found_strings[ md5( $matched_source ) ]['translated'], $inner_content );
									}
								}
							}

							if ( $inner_content_modified && empty( $block['innerBlocks'] ) ) {
								$block['innerHTML'] = implode( '', $block['innerContent'] );
							}
						}

						unset( $inner_content );
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
	 * @param array  $found_strings
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 * @param int    $depth
	 */
	private static function translate_attribute_value_recursive( &$val, $schema_info, string $block_name, &$found_strings, string $source_lang, string $target_lang, int $post_id, array $custom_opts, int $depth = 0 ): void {
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
				if ( $val !== $res['translated'] ) {
					$found_strings[ md5( $val ) ] = array(
						'original'   => $val,
						'translated' => $res['translated'],
					);
					$val                          = $res['translated'];
				}
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
					$found_strings,
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
						$found_strings,
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
					$found_strings,
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
