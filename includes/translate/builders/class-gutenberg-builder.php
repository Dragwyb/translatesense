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

									if ( ! empty( $temp_strings ) ) {
										$pattern = '~' . implode(
											'|',
											array_map( 'preg_quote', $temp_strings, array_fill( 0, count( $temp_strings ), '~' ) )
										) . '~';

										preg_match_all( $pattern, $inner_content, $matches );
										$matched_sources = array_unique( $matches[0] );
										$matched_count   = 0;

										foreach ( $matched_sources as $matched_source ) {
											++$matched_count;
											if ( ! is_string( $matched_source ) || '' === trim( $matched_source ) ) {
												continue;
											}

											$lookup_key = md5( $matched_source );
											if ( ! isset( $found_strings[ $lookup_key ]['translated'] ) ) {
												$lookup_key = md5( html_entity_decode( $matched_source, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
											}
											if ( ! isset( $found_strings[ $lookup_key ]['translated'] ) ) {
												continue;
											}

											$inner_content          = str_replace( $matched_source, $found_strings[ $lookup_key ]['translated'], $inner_content );
											$inner_content_modified = true;
											if ( $matched_count > 20 ) {
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
										$lookup_key = md5( $matched_source );
										if ( ! isset( $found_strings[ $lookup_key ]['translated'] ) ) {
											$lookup_key = md5( html_entity_decode( $matched_source, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
										}
										if ( ! isset( $found_strings[ $lookup_key ]['translated'] ) ) {
											continue;
										}
										$inner_content          = str_replace( $matched_source, $found_strings[ $lookup_key ]['translated'], $inner_content );
										$inner_content_modified = true;
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
			} else {
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

				$outer_html   = $dom->saveHTML( $node );
				$patched_html = '';

				if ( false !== strpos( $source_html, $outer_html ) ) {
					$translated_node = str_replace( $orig_val, $translated_val, $outer_html );
					$source_html     = str_replace( $outer_html, $translated_node, $source_html );
					$modified        = true;
					continue;
				} else {
					// Patch only the matching source value. Do not use saveHTML() output as
					// the return value, because it may contain parser-generated closing tags.
					$patched_html = self::replace_translated_value_in_source( $source_html, $node, $orig_val, $translated_val, $dom );
				}

				if ( $patched_html === $source_html || '' === $patched_html ) {
					// Do not let the working DOM diverge from source HTML when a
					// safe source match could not be established.
					continue;
				}

				$source_html = $patched_html;
				$modified    = true;

				// Keep the working DOM in sync for subsequent XPath expressions, but
				// never serialize this DOM into the Gutenberg fragment.
				self::set_node_content(
					$node,
					$translated_val,
					$dom,
					$node instanceof \DOMElement && false !== strpos( $orig_val, '<' )
				);
				$xpath = new DOMXPath( $dom );
				$body  = $dom->getElementsByTagName( 'body' )->item( 0 );
			}
		}

		return $modified ? $source_html : $html;
	}

	private static function set_inner_html(
		DOMElement $node,
		string $html
	): bool {
		$dom = $node->ownerDocument;

		if ( ! $dom ) {
			return false;
		}

		// Parse HTML in a temporary document.
		$temp_dom = new DOMDocument( '1.0', 'UTF-8' );

		$previous = libxml_use_internal_errors( true );

		$loaded = $temp_dom->loadHTML(
			'<?xml encoding="UTF-8"><div id="ts-fragment-root">' .
			$html .
			'</div>',
			LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
		);

		libxml_clear_errors();
		libxml_use_internal_errors( $previous );

		if ( ! $loaded ) {
			return false;
		}

		$root = $temp_dom->getElementById( 'ts-fragment-root' );

		if ( ! $root ) {
			return false;
		}

		// Import all parsed child nodes before changing the target.
		$new_nodes = array();

		foreach ( $root->childNodes as $child ) {
			$new_nodes[] = $dom->importNode( $child, true );
		}

		// Remove existing children.
		while ( $node->firstChild ) {
			$node->removeChild( $node->firstChild );
		}

		// Append new HTML nodes.
		foreach ( $new_nodes as $child ) {
			$node->appendChild( $child );
		}

		return true;
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
	private static function replace_translated_value_in_source(
		string $source_html,
		DOMNode $node,
		string $original_value,
		string $translated,
		DOMDocument $dom
	): string {
		$decode = static function ( string $value ): string {
			return html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		};

		$escape_text = static function ( string $value ): string {
			return htmlspecialchars( $value, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8' );
		};

		/*
		 * Replace an attribute only on the corresponding source element.
		 * Matching the owner element avoids replacing the same attribute on an
		 * unrelated element elsewhere in the fragment.
		 */
		if ( $node instanceof DOMAttr ) {
			$owner = $node->ownerElement;
			if ( ! $owner ) {
				return $source_html;
			}

			$element_ordinal = self::get_element_ordinal( $owner, $dom );
			if ( null === $element_ordinal ) {
				return $source_html;
			}

			// Use a conventional quoted-attribute-safe tag tokenizer.
			$tag_pattern = '~<!--.*?-->|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>~s';
			preg_match_all( $tag_pattern, $source_html, $tag_matches, PREG_OFFSET_CAPTURE );

			$tag_index = -1;
			foreach ( $tag_matches[0] as $tag_match ) {
				$tag = $tag_match[0];
				if ( 0 === strpos( $tag, '<!--' ) || ! preg_match( '/^<([a-zA-Z][a-zA-Z0-9:_-]*)\\b/s', $tag, $name_match ) ) {
					continue;
				}
				if ( 0 !== strcasecmp( $name_match[1], $owner->tagName ) ) {
					continue;
				}
				++$tag_index;
				if ( $tag_index !== $element_ordinal ) {
					continue;
				}

				$tag_text      = $tag;
				$attr_pattern  = '~(?<![\\w:-])(' . preg_quote( $node->name, '~' ) . ")(\\s*=\\s*)([\"\'])(.*?)\\3~s";
				$attr_replaced = false;
				$updated_tag   = preg_replace_callback(
					$attr_pattern,
					static function ( $matches ) use ( $original_value, $translated, $decode, &$attr_replaced ) {
						if ( $attr_replaced || $decode( $matches[4] ) !== $original_value ) {
							return $matches[0];
						}
						$attr_replaced = true;
						return $matches[1] . $matches[2] . $matches[3] . htmlspecialchars( $translated, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ) . $matches[3];
					},
					$tag_text,
					1
				);

				if ( ! $attr_replaced || ! is_string( $updated_tag ) ) {
					return $source_html;
				}

				return substr_replace( $source_html, $updated_tag, $tag_match[1], strlen( $tag_text ) );
			}

			return $source_html;
		}

		/*
		 * Plain text. Map the DOM text node to the corresponding source text
		 * token by document order. This handles entities such as pi&#241;a without
		 * requiring the raw source token to equal the decoded DOM value.
		 */
		$text_node = null;
		if ( $node instanceof DOMText ) {
			$text_node = $node;
		} elseif ( $node instanceof \DOMElement && false === strpos( $original_value, '<' ) && $node->childNodes->length === 1 && $node->firstChild instanceof DOMText ) {
			$text_node = $node->firstChild;
		}

		if ( $text_node instanceof DOMText ) {
			$target_text  = (string) $text_node->nodeValue;
			$text_ordinal = self::get_text_node_ordinal( $text_node, $dom );

			$token_pattern = '~<!--.*?-->|<!\\[CDATA\\[.*?\\]\\]>|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>|[^<]+~s';
			preg_match_all( $token_pattern, $source_html, $tokens, PREG_OFFSET_CAPTURE );
			$text_tokens = array();
			foreach ( $tokens[0] as $token ) {
				if ( '' !== $token[0] && '<' !== $token[0][0] ) {
					$text_tokens[] = array(
						'text'   => $token[0],
						'offset' => $token[1],
					);
				}
			}

			$selected = null;
			if ( null !== $text_ordinal && isset( $text_tokens[ $text_ordinal ] ) && $decode( $text_tokens[ $text_ordinal ]['text'] ) === $target_text ) {
				$selected = $text_tokens[ $text_ordinal ];
			} else {
				// Conservative fallback: accept only a unique decoded text match.
				$candidates = array();
				foreach ( $text_tokens as $token ) {
					if ( $decode( $token['text'] ) === $target_text ) {
						$candidates[] = $token;
					}
				}
				if ( 1 === count( $candidates ) ) {
					$selected = $candidates[0];
				}
			}

			if ( null === $selected ) {
				return $source_html;
			}

			// Preserve whitespace surrounding the selected text node.
			$prefix = '';
			$suffix = '';
			if ( preg_match( '/^\\s*/u', $target_text, $leading ) ) {
				$prefix = $leading[0];
			}
			if ( preg_match( '/\\s*$/u', $target_text, $trailing ) ) {
				$suffix = $trailing[0];
			}
			$trimmed_target = trim( $target_text );
			if ( '' === $trimmed_target ) {
				return $source_html;
			}

			$replacement = $prefix . $escape_text( $translated ) . $suffix;
			return substr_replace( $source_html, $replacement, $selected['offset'], strlen( $selected['text'] ) );
		}

		/*
		 * Selected elements containing nested markup.
		 * Match source tokens against DOM-generated tokens, comparing text
		 * after entity decoding while preserving raw source offsets.
		 */
		$original_html = trim( $original_value );

		if ( '' === $original_html ) {
			return $source_html;
		}

		$tokenize = static function ( string $html ): array {
			$pattern = '~<!--.*?-->|<!\[CDATA\[.*?\]\]>|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>|[^<]+~s';

			preg_match_all( $pattern, $html, $matches, PREG_OFFSET_CAPTURE );

			$result = array();

			foreach ( $matches[0] as $match ) {
				$raw = $match[0];

				$result[] = array(
					'raw'    => $raw,
					'offset' => $match[1],
					'is_tag' => '' !== $raw && '<' === $raw[0],
				);
			}

			return $result;
		};

		$original_tokens = $tokenize( $original_html );
		$source_tokens   = $tokenize( $source_html );

		if ( empty( $original_tokens ) || count( $original_tokens ) > count( $source_tokens ) ) {
			return $source_html;
		}

		$matches     = array();
		$token_count = count( $original_tokens );

		for ( $i = 0; $i <= count( $source_tokens ) - $token_count; $i++ ) {
			$matched = true;

			for ( $j = 0; $j < $token_count; $j++ ) {
				$original_token = $original_tokens[ $j ];
				$source_token   = $source_tokens[ $i + $j ];

				// A tag must match the original markup exactly.
				if ( $original_token['is_tag'] !== $source_token['is_tag'] ) {
					$matched = false;
					break;
				}

				if ( $original_token['is_tag'] ) {
					if ( $original_token['raw'] !== $source_token['raw'] ) {
						$matched = false;
						break;
					}
				} else {
					// Compare decoded text, but retain raw source offsets.
					if (
						html_entity_decode( $original_token['raw'], ENT_QUOTES | ENT_HTML5, 'UTF-8' )
						!== html_entity_decode( $source_token['raw'], ENT_QUOTES | ENT_HTML5, 'UTF-8' )
					) {
						$matched = false;
						break;
					}
				}
			}

			if ( $matched ) {
				$matches[] = $i;
			}
		}

		// Never guess when the fragment occurs more than once.
		if ( 1 !== count( $matches ) ) {
			return $source_html;
		}

		$start_index = $matches[0];
		$end_index   = $start_index + $token_count - 1;

		$start_offset = $source_tokens[ $start_index ]['offset'];

		$last_token = $source_tokens[ $end_index ];
		$end_offset = $last_token['offset'] + strlen( $last_token['raw'] );

		$replacement = false !== strpos( $translated, '<' )
			? $translated
			: $escape_text( $translated );

		return substr_replace(
			$source_html,
			$replacement,
			$start_offset,
			$end_offset - $start_offset
		);
	}

	/**
	 * Get an element's zero-based ordinal among elements with the same tag name
	 * in the parsed body. This helps map an attribute back to its source tag.
	 *
	 * @param \DOMElement $target Target element.
	 * @param DOMDocument $dom    Working DOM document.
	 * @return int|null
	 */
	private static function get_element_ordinal( \DOMElement $target, DOMDocument $dom ): ?int {
		$body = $dom->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			return null;
		}

		$ordinal = 0;
		$found   = false;
		$walk    = static function ( DOMNode $current ) use ( &$walk, $target, &$ordinal, &$found ): void {
			if ( $found ) {
				return;
			}
			if ( $current instanceof \DOMElement && 0 === strcasecmp( $current->tagName, $target->tagName ) ) {
				if ( $current === $target ) {
					$found = true;
					return;
				}
				++$ordinal;
			}
			foreach ( $current->childNodes as $child ) {
				$walk( $child );
				if ( $found ) {
					return;
				}
			}
		};
		$walk( $body );

		return $found ? $ordinal : null;
	}

	/**
	 * Get a text node's zero-based ordinal among text nodes under the body.
	 *
	 * @param DOMText     $target Target text node.
	 * @param DOMDocument $dom    Working DOM document.
	 * @return int|null
	 */
	private static function get_text_node_ordinal( DOMText $target, DOMDocument $dom ): ?int {
		$body = $dom->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			return null;
		}

		$ordinal = 0;
		$found   = false;
		$walk    = static function ( DOMNode $current ) use ( &$walk, $target, &$ordinal, &$found ): void {
			if ( $found ) {
				return;
			}
			if ( $current instanceof DOMText ) {
				if ( $current === $target ) {
					$found = true;
					return;
				}
				++$ordinal;
			}
			foreach ( $current->childNodes as $child ) {
				$walk( $child );
				if ( $found ) {
					return;
				}
			}
		};
		$walk( $body );

		return $found ? $ordinal : null;
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
	public static function set_node_content( DOMNode $node, string $new_content, DOMDocument $dom, bool $allow_html = true ): void {
		try {
			if ( ! $node || ! ( $node instanceof DOMNode ) ) {
				return;
			}
			if ( $node instanceof DOMAttr ) {
				$node->value = $new_content;
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
				if ( $allow_html && false !== strpos( $new_content, '<' ) && class_exists( 'DOMDocument' ) ) {
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
