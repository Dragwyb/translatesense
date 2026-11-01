<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Builders;

use DOMDocument;
use DOMXPath;
use DOMNode;
use DOMElement;
use DOMText;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classic Editor & Plain Content Parser.
 *
 * Extracts complete translation units (block elements, translatable attributes,
 * and standalone text paragraphs) using DOMDocument and DOMXPath while preserving
 * inline formatting and respecting Classic Editor paragraph breaks.
 */
class Classic_Builder extends Base_Builder {

	/**
	 * Leaf block tags that typically contain direct translatable text and inline elements.
	 *
	 * @var array<string>
	 */
	public const LEAF_BLOCK_TAGS = array(
		'p',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'figcaption',
		'td',
		'th',
		'dt',
		'dd',
		'caption',
		'address',
		'summary',
		'hr',
	);

	/**
	 * Container block elements that group child elements.
	 *
	 * @var array<string>
	 */
	public const CONTAINER_BLOCK_TAGS = array(
		'div',
		'section',
		'article',
		'aside',
		'header',
		'footer',
		'nav',
		'main',
		'figure',
		'ul',
		'ol',
		'dl',
		'table',
		'thead',
		'tbody',
		'tfoot',
		'tr',
		'details',
		'center',
		'form',
		'fieldset',
		'blockquote',
		'li',
	);

	/**
	 * HTML void / self-closing elements.
	 *
	 * @var array<string>
	 */
	public const VOID_TAGS = array(
		'area',
		'base',
		'br',
		'col',
		'embed',
		'hr',
		'img',
		'input',
		'link',
		'meta',
		'param',
		'source',
		'track',
		'wbr',
	);

	/**
	 * Non-translatable elements whose inner content must be completely excluded from extraction.
	 *
	 * @var array<string>
	 */
	public const EXCLUDED_TAGS = array(
		'script',
		'style',
		'noscript',
		'pre',
		'svg',
		'iframe',
		'object',
		'embed',
		'textarea',
		'select',
		'option',
		'template',
		'canvas',
		'audio',
		'video',
	);

	/**
	 * HTML attributes that contain translatable human-readable text.
	 *
	 * @var array<string>
	 */
	public const TRANSLATABLE_ATTRS = array(
		'alt',
		'title',
		'aria-label',
		'aria-description',
		'placeholder',
	);

	/**
	 * Builder slug identifier.
	 *
	 * @return string
	 */
	public function get_builder_slug(): string {
		return 'classic';
	}

	/**
	 * Parse classic WordPress content into translatable string packages.
	 *
	 * Replaces whole-content extraction with DOM-based translation units.
	 *
	 * @param mixed  $content Raw content string.
	 * @param int    $post_id Post ID if applicable.
	 * @param string $lang    Source language code.
	 * @param array  $rules   Optional specific builder rules.
	 * @return array Array of extracted string items.
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( ! is_string( $content ) || '' === trim( $content ) ) {
			return array();
		}

		$extracted = array();
		$units     = self::extract_units_with_offsets( $content, $rules );

		foreach ( $units as $unit ) {
			$this->record_extracted_string(
				$post_id,
				$lang,
				$unit['name'],
				$unit['key'],
				$unit['value'],
				$extracted
			);
		}

		return $extracted;
	}

	/**
	 * Extract translation units from HTML content and map each to its exact source byte slice.
	 *
	 * Preserves inline elements inside blocks, respects wpautop blank-line paragraph breaks,
	 * excludes non-translatable technical markup, and extracts standalone attributes separately.
	 *
	 * @param string $content Source HTML content.
	 * @param array  $rules   Optional configuration rules.
	 * @return array Array of mapped units with offsets, lengths, names, and values.
	 */
	public static function extract_units_with_offsets( string $content, array $rules = array() ): array {
		if ( '' === trim( $content ) ) {
			return array();
		}

		// Fallback if PHP DOMDocument or DOMXPath extension is unavailable
		if ( ! class_exists( 'DOMDocument' ) || ! class_exists( 'DOMXPath' ) ) {
			return self::extract_fallback( $content );
		}

		$pattern = '~<!--.*?-->|<!\[CDATA\[.*?\]\]>|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>|[^<]+~s';
		if ( ! preg_match_all( $pattern, $content, $matches, PREG_OFFSET_CAPTURE ) ) {
			if ( self::has_translatable_text( $content ) ) {
				return array(
					array(
						'type'   => 'text',
						'name'   => 'classic_text',
						'key'    => 'post_content>text[0]',
						'tag'    => 'text',
						'offset' => 0,
						'length' => strlen( $content ),
						'value'  => $content,
						'source' => $content,
					),
				);
			}
			return array();
		}

		$tokens = $matches[0];
		$units  = array();

		// Merge user-configured rules if provided
		$trans_attrs = self::TRANSLATABLE_ATTRS;
		if ( ! empty( $rules['attributes'] ) && is_array( $rules['attributes'] ) ) {
			$trans_attrs = array_unique( array_merge( $trans_attrs, array_map( 'strtolower', $rules['attributes'] ) ) );
		}

		$excluded_tags = self::EXCLUDED_TAGS;
		if ( ! empty( $rules['exclude'] ) && is_array( $rules['exclude'] ) ) {
			$excluded_tags = array_unique( array_merge( $excluded_tags, array_map( 'strtolower', $rules['exclude'] ) ) );
		}

		// 1. Parse tag boundaries and tree structure from source token stream
		$elements_by_tag = array();
		$stack           = array();
		$auto_close      = array( 'p', 'dt', 'dd', 'tr', 'td', 'th' );

		foreach ( $tokens as $t ) {
			$raw    = $t[0];
			$offset = $t[1];

			if ( '' === $raw || '<' !== $raw[0] || 0 === strpos( $raw, '<!--' ) || 0 === strpos( $raw, '<!' ) ) {
				continue;
			}

			if ( 0 === strpos( $raw, '</' ) ) {
				if ( preg_match( '/^<\/([a-zA-Z0-9:_-]+)/', $raw, $m ) ) {
					$close_tag = strtolower( $m[1] );
					for ( $k = count( $stack ) - 1; $k >= 0; $k-- ) {
						if ( $stack[ $k ]['tag'] === $close_tag ) {
							$idx = $stack[ $k ]['idx'];
							$elements_by_tag[ $close_tag ][ $idx ]['inner_end']    = $offset;
							$elements_by_tag[ $close_tag ][ $idx ]['close_offset'] = $offset + strlen( $raw );
							$elements_by_tag[ $close_tag ][ $idx ]['raw_inner']    = substr(
								$content,
								$elements_by_tag[ $close_tag ][ $idx ]['inner_start'],
								$offset - $elements_by_tag[ $close_tag ][ $idx ]['inner_start']
							);
							array_splice( $stack, $k );
							break;
						}
					}
				}
			} else {
				if ( preg_match( '/^<([a-zA-Z0-9:_-]+)/', $raw, $m ) ) {
					$open_tag = strtolower( $m[1] );
					$is_self  = in_array( $open_tag, self::VOID_TAGS, true ) || preg_match( '/\/\s*>$/', $raw );

					if ( ! $is_self ) {
						if ( in_array( $open_tag, $auto_close, true ) ) {
                            for ( $k = count( $stack ) - 1; $k >= 0; $k-- ) {
								if ( $stack[ $k ]['tag'] === $open_tag ) {
									$idx = $stack[ $k ]['idx'];
									$elements_by_tag[ $open_tag ][ $idx ]['inner_end']    = $offset;
									$elements_by_tag[ $open_tag ][ $idx ]['close_offset'] = $offset;
									$elements_by_tag[ $open_tag ][ $idx ]['raw_inner']    = substr(
										$content,
										$elements_by_tag[ $open_tag ][ $idx ]['inner_start'],
										$offset - $elements_by_tag[ $open_tag ][ $idx ]['inner_start']
									);
									array_splice( $stack, $k );
									break;
								}
							}
						}

						$idx = count( $elements_by_tag[ $open_tag ] ?? array() );
						$elements_by_tag[ $open_tag ][ $idx ] = array(
							'tag_idx'      => $idx,
							'tag'          => $open_tag,
							'open_offset'  => $offset,
							'open_raw'     => $raw,
							'inner_start'  => $offset + strlen( $raw ),
							'inner_end'    => strlen( $content ),
							'close_offset' => strlen( $content ),
							'raw_inner'    => substr( $content, $offset + strlen( $raw ) ),
						);
						$stack[] = array(
							'tag' => $open_tag,
							'idx' => $idx,
						);
					}
				}
			}
		}

		while ( ! empty( $stack ) ) {
			$popped = array_pop( $stack );
			$ptag   = $popped['tag'];
			$pidx   = $popped['idx'];
			$elements_by_tag[ $ptag ][ $pidx ]['raw_inner'] = substr(
				$content,
				$elements_by_tag[ $ptag ][ $pidx ]['inner_start'],
				$elements_by_tag[ $ptag ][ $pidx ]['inner_end'] - $elements_by_tag[ $ptag ][ $pidx ]['inner_start']
			);
		}

		// 2. DOM parsing with safe error handling and UTF-8 encoding
		$dom             = new DOMDocument( '1.0', 'UTF-8' );
		$previous_errors = libxml_use_internal_errors( true );
		try {
			$wrapped = '<?xml encoding="UTF-8"><body>' . $content . '</body>';
			$loaded  = $dom->loadHTML( $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET );
		} finally {
			libxml_clear_errors();
			libxml_use_internal_errors( $previous_errors );
		}

		if ( ! $loaded ) {
			return $units;
		}

		$body = $dom->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			return $units;
		}

		// Tag DOM elements with document-order tag index to map back to source tokens
		$dom_tag_counters = array();
		$xpath            = new DOMXPath( $dom );
		$all_dom_nodes    = $xpath->query( '//*' );
		if ( $all_dom_nodes ) {
			foreach ( $all_dom_nodes as $d_node ) {
				if ( $d_node instanceof DOMElement && 'body' !== strtolower( $d_node->tagName ) ) {
					$dtag                      = strtolower( $d_node->tagName );
					$cidx                      = $dom_tag_counters[ $dtag ] ?? 0;
					$dom_tag_counters[ $dtag ] = $cidx + 1;
					$d_node->setAttribute( 'data-ts-tag-idx', (string) $cidx );
				}
			}
		}

		$dom_units = array();
		self::extract_dom_units( $body, $dom, $dom_units, $rules );

		// 3. Correlate DOM units to exact source slices and record their boundaries
		$tag_occurrence_counters = array();
		$source_pos              = 0;
		$extracted_ranges        = array();

		foreach ( $dom_units as $du ) {
			$tag                             = $du['tag'];
			$count                           = $tag_occurrence_counters[ $tag ] ?? 0;
			$tag_occurrence_counters[ $tag ] = $count + 1;
			$key                             = 'post_content>' . $tag . '[' . $count . ']';

			$tag_idx = isset( $du['node'] ) && $du['node'] instanceof DOMElement && $du['node']->hasAttribute( 'data-ts-tag-idx' )
				? (int) $du['node']->getAttribute( 'data-ts-tag-idx' )
				: null;

			if ( null !== $tag_idx && isset( $elements_by_tag[ $tag ][ $tag_idx ] ) ) {
				$slice     = $elements_by_tag[ $tag ][ $tag_idx ];
				$raw_inner = $slice['raw_inner'];

				// Direct match
				if ( $raw_inner === $du['value'] ) {
					$start              = $slice['inner_start'];
					$len                = strlen( $raw_inner );
					$units[]            = array(
						'type'   => $du['type'],
						'name'   => $du['name'],
						'key'    => $key,
						'tag'    => $tag,
						'offset' => $start,
						'length' => $len,
						'value'  => $du['value'],
						'source' => $raw_inner,
					);
					$extracted_ranges[] = array( $start, $start + $len );
					$source_pos         = $start + $len;
					continue;
				}

				// Locate the unit value inside raw_inner (e.g. text before child blocks)
				$pos_in_inner = strpos( $raw_inner, $du['value'] );
				if ( false !== $pos_in_inner ) {
					$start              = $slice['inner_start'] + $pos_in_inner;
					$len                = strlen( $du['value'] );
					$units[]            = array(
						'type'   => $du['type'],
						'name'   => $du['name'],
						'key'    => $key,
						'tag'    => $tag,
						'offset' => $start,
						'length' => $len,
						'value'  => $du['value'],
						'source' => substr( $content, $start, $len ),
					);
					$extracted_ranges[] = array( $start, $start + $len );
					$source_pos         = $start + $len;
					continue;
				}

				// Trimmed whitespace match
				$leading_ws = 0;
				if ( preg_match( '/^\s+/u', $raw_inner, $ws_match ) ) {
					$leading_ws = strlen( $ws_match[0] );
				}
				$trailing_ws = 0;
				if ( preg_match( '/\s+$/u', $raw_inner, $ws_match ) ) {
					$trailing_ws = strlen( $ws_match[0] );
				}

				$start = $slice['inner_start'] + $leading_ws;
				$len   = strlen( $raw_inner ) - $leading_ws - $trailing_ws;

				if ( $len > 0 ) {
					$units[]            = array(
						'type'   => $du['type'],
						'name'   => $du['name'],
						'key'    => $key,
						'tag'    => $tag,
						'offset' => $start,
						'length' => $len,
						'value'  => $du['value'],
						'source' => substr( $content, $start, $len ),
					);
					$extracted_ranges[] = array( $start, $start + $len );
					$source_pos         = $start + $len;
					continue;
				}
			}

			// Standalone paragraph or text run
			$val = $du['value'];
			$pos = strpos( $content, $val, $source_pos );
			if ( false === $pos ) {
				$found_len = 0;
				$pos       = self::find_decoded_offset( $content, $val, $source_pos, $found_len );
				if ( false !== $pos ) {
					$units[]            = array(
						'type'   => $du['type'],
						'name'   => $du['name'],
						'key'    => $key,
						'tag'    => $tag,
						'offset' => $pos,
						'length' => $found_len,
						'value'  => $du['value'],
						'source' => substr( $content, $pos, $found_len ),
					);
					$extracted_ranges[] = array( $pos, $pos + $found_len );
					$source_pos         = $pos + $found_len;
					continue;
				}
			}

			if ( false !== $pos ) {
				$units[]            = array(
					'type'   => $du['type'],
					'name'   => $du['name'],
					'key'    => $key,
					'tag'    => $tag,
					'offset' => $pos,
					'length' => strlen( $val ),
					'value'  => $du['value'],
					'source' => $val,
				);
				$extracted_ranges[] = array( $pos, $pos + strlen( $val ) );
				$source_pos         = $pos + strlen( $val );
			}
		}

		// 4. Extract translatable HTML attributes ONLY from elements outside extracted block units
		// Elements inside an extracted block are translated as part of that block's context,
		// preventing duplicate packages and overlapping slice corruption.
		$attr_counters = array();
		foreach ( $tokens as $token ) {
			$raw        = $token[0];
			$tag_offset = $token[1];

			if ( '' === $raw || '<' !== $raw[0] || 0 === strpos( $raw, '<!--' ) || 0 === strpos( $raw, '</' ) || 0 === strpos( $raw, '<!' ) ) {
				continue;
			}

			if ( ! preg_match( '/^<([a-zA-Z0-9:_-]+)/', $raw, $m ) ) {
				continue;
			}
			$tag_name = strtolower( $m[1] );
			if ( in_array( $tag_name, $excluded_tags, true ) ) {
				continue;
			}

			$tag_end                = $tag_offset + strlen( $raw );
			$inside_extracted_block = false;
			foreach ( $extracted_ranges as $range ) {
				if ( $tag_offset >= $range[0] && $tag_end <= $range[1] ) {
					$inside_extracted_block = true;
					break;
				}
			}
			if ( $inside_extracted_block ) {
				continue;
			}

			foreach ( $trans_attrs as $attr_name ) {
				$attr_pattern = '~(?<![\\w:-])(' . preg_quote( $attr_name, '~' ) . ')(\\s*=\\s*)(["\'])(.*?)\\3~s';
				if ( preg_match_all( $attr_pattern, $raw, $attr_matches, PREG_OFFSET_CAPTURE ) ) {
					foreach ( $attr_matches[0] as $match_idx => $full_attr_match ) {
						$attr_val_capture = $attr_matches[4][ $match_idx ];
						$val              = $attr_val_capture[0];
						$decoded_val      = html_entity_decode( $val, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

						if ( '' !== trim( $decoded_val ) && self::has_translatable_text( $decoded_val ) ) {
							$quote      = $attr_matches[3][ $match_idx ][0];
							$val_offset = $tag_offset + $attr_val_capture[1];
							$val_length = strlen( $val );

							$counter_key                   = $tag_name . '@' . $attr_name;
							$count                         = $attr_counters[ $counter_key ] ?? 0;
							$attr_counters[ $counter_key ] = $count + 1;

							$units[] = array(
								'type'   => 'attribute',
								'name'   => 'classic_attr_' . strtolower( $attr_name ),
								'key'    => 'post_content>' . $tag_name . '[' . $count . ']@' . $attr_name,
								'tag'    => $tag_name,
								'attr'   => $attr_name,
								'quote'  => $quote,
								'offset' => $val_offset,
								'length' => $val_length,
								'value'  => $decoded_val,
								'source' => $val,
							);
						}
					}
				}
			}
		}

		return $units;
	}

	/**
	 * Check if a string contains readable human text characters outside shortcodes and tags.
	 *
	 * @param string $text
	 * @return bool
	 */
	public static function has_translatable_text( string $text ): bool {
		// Strip shortcodes to avoid extracting pure shortcode blocks
		$clean = preg_replace( '/\[\/?[\w-]+(?:\s+[^\]]*)?\]/s', '', $text );
		// Strip HTML tags
		$clean = strip_tags( (string) $clean );
		// Decode entities
		$clean = html_entity_decode( $clean, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		// Strip non-breaking spaces and invisible characters
		$clean = preg_replace( '/[\s\x{00a0}\x{200b}\x{200e}\x{200f}]+/u', '', $clean );
		return '' !== trim( (string) $clean );
	}

	/**
	 * Check if a tag name represents a recognized block-level element.
	 *
	 * @param string $tag
	 * @param array  $rules
	 * @return bool
	 */
	private static function is_block_tag( string $tag, array $rules = array() ): bool {
		$custom_blocks = ! empty( $rules['blocks'] ) && is_array( $rules['blocks'] )
			? array_map( 'strtolower', $rules['blocks'] )
			: array();

		return in_array( $tag, self::LEAF_BLOCK_TAGS, true )
			|| in_array( $tag, self::CONTAINER_BLOCK_TAGS, true )
			|| in_array( $tag, $custom_blocks, true );
	}

	/**
	 * Check if a DOM node has any child block elements.
	 *
	 * @param DOMNode $node
	 * @param array   $rules
	 * @return bool
	 */
	private static function has_child_blocks( DOMNode $node, array $rules = array() ): bool {
		if ( ! ( $node instanceof DOMElement ) ) {
			return false;
		}
		foreach ( $node->childNodes as $child ) {
			if ( $child instanceof DOMElement ) {
				if ( self::is_block_tag( strtolower( $child->tagName ), $rules ) ) {
					return true;
				}
				if ( self::has_child_blocks( $child, $rules ) ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Get inner HTML of a DOMNode while stripping helper attributes.
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	private static function get_node_inner_html( DOMNode $node, DOMDocument $dom ): string {
		$html = '';
		if ( $node->hasChildNodes() ) {
			foreach ( $node->childNodes as $child ) {
				$html .= $dom->saveHTML( $child );
			}
		}
		$html = preg_replace( '/\s*data-ts-tag-idx="[^"]*"/i', '', $html );
		return trim( (string) $html );
	}

	/**
	 * Recursively extract translation units from DOM nodes.
	 *
	 * Breaks unbracketed inline node sequences across blank lines (double newlines)
	 * so each Classic Editor paragraph is extracted as an independent, contextual unit.
	 *
	 * @param DOMNode     $container
	 * @param DOMDocument $dom
	 * @param array       &$dom_units
	 * @param array       $rules
	 * @param int         $depth
	 */
	private static function extract_dom_units( DOMNode $container, DOMDocument $dom, array &$dom_units, array $rules = array(), int $depth = 0 ): void {
		if ( $depth > 50 ) {
			return;
		}

		$excluded_tags = self::EXCLUDED_TAGS;
		if ( ! empty( $rules['exclude'] ) && is_array( $rules['exclude'] ) ) {
			$excluded_tags = array_unique( array_merge( $excluded_tags, array_map( 'strtolower', $rules['exclude'] ) ) );
		}

		$inline_nodes = array();

		$flush_inline = function() use ( &$inline_nodes, $dom, &$dom_units, $container ) {
			if ( empty( $inline_nodes ) ) {
				return;
			}
			$html = '';
			foreach ( $inline_nodes as $n ) {
				$html .= $dom->saveHTML( $n );
			}
			$inline_nodes = array();
			$html         = preg_replace( '/\s*data-ts-tag-idx="[^"]*"/i', '', $html );

			// Split inline flow by blank lines (double newlines or wpautop breaks)
			$paras = preg_split( '/(\r?\n\s*\r?\n)/u', $html );
			if ( ! $paras ) {
				$paras = array( $html );
			}

			foreach ( $paras as $p_html ) {
				$trimmed = trim( (string) $p_html );
				if ( '' !== $trimmed && self::has_translatable_text( $trimmed ) ) {
					$tag         = ( $container instanceof DOMElement && 'body' !== strtolower( $container->tagName ) )
						? strtolower( $container->tagName )
						: 'text';
					$dom_units[] = array(
						'type'  => 'text',
						'name'  => 'classic_' . $tag,
						'tag'   => $tag,
						'value' => $trimmed,
						'node'  => ( $container instanceof DOMElement && 'body' !== strtolower( $container->tagName ) ) ? $container : null,
					);
				}
			}
		};

		foreach ( $container->childNodes as $child ) {
			if ( $child instanceof DOMElement ) {
				$child_tag = strtolower( $child->tagName );
				if ( in_array( $child_tag, $excluded_tags, true ) ) {
					$flush_inline();
					continue;
				}

				if ( self::is_block_tag( $child_tag, $rules ) ) {
					$flush_inline();

					if ( self::has_child_blocks( $child, $rules ) ) {
						self::extract_dom_units( $child, $dom, $dom_units, $rules, $depth + 1 );
					} else {
						$inner = self::get_node_inner_html( $child, $dom );
						if ( '' !== $inner && self::has_translatable_text( $inner ) ) {
							$dom_units[] = array(
								'type'  => 'block',
								'name'  => 'classic_' . $child_tag,
								'tag'   => $child_tag,
								'value' => $inner,
								'node'  => $child,
							);
						}
					}
				} else {
					$inline_nodes[] = $child;
				}
			} elseif ( $child instanceof DOMText ) {
				$inline_nodes[] = $child;
			}
		}

		$flush_inline();
	}

	/**
	 * Find the offset and byte length of a target value in source HTML when entities or tag formatting differ.
	 *
	 * @param string $source_html
	 * @param string $target_val
	 * @param int    $start_from
	 * @param int    &$found_length
	 * @return int|false
	 */
	private static function find_decoded_offset( string $source_html, string $target_val, int $start_from, &$found_length ) {
		$target_trimmed = trim( $target_val );
		if ( '' === $target_trimmed ) {
			return false;
		}

		$pos = strpos( $source_html, $target_trimmed, $start_from );
		if ( false !== $pos ) {
			$found_length = strlen( $target_trimmed );
			return $pos;
		}

		$sub     = substr( $source_html, $start_from );
		$pattern = '~<!--.*?-->|<!\[CDATA\[.*?\]\]>|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>|[^<]+~s';
		if ( ! preg_match_all( $pattern, $sub, $matches, PREG_OFFSET_CAPTURE ) ) {
			return false;
		}

		$tokens = $matches[0];
		preg_match_all( $pattern, $target_trimmed, $t_m );
		$target_tokens = $t_m[0];
		$t_count       = count( $target_tokens );

		if ( 0 === $t_count || $t_count > count( $tokens ) ) {
			return false;
		}

		for ( $i = 0; $i <= count( $tokens ) - $t_count; $i++ ) {
			$match = true;
			for ( $j = 0; $j < $t_count; $j++ ) {
				$s_tok = $tokens[ $i + $j ][0];
				$t_tok = $target_tokens[ $j ];
				if ( '' !== $s_tok && '<' === $s_tok[0] ) {
					$s_tag_norm = preg_replace( '~\s*/\s*>$~', '>', strtolower( $s_tok ) );
					$t_tag_norm = preg_replace( '~\s*/\s*>$~', '>', strtolower( $t_tok ) );
					if ( $s_tag_norm !== $t_tag_norm ) {
						$match = false;
						break;
					}
				} else {
					$s_dec = trim( html_entity_decode( $s_tok, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
					$t_dec = trim( html_entity_decode( $t_tok, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
					if ( $s_dec !== $t_dec ) {
						$match = false;
						break;
					}
				}
			}

			if ( $match ) {
				$first_tok    = $tokens[ $i ];
				$last_tok     = $tokens[ $i + $t_count - 1 ];
				$start        = $start_from + $first_tok[1];
				$found_length = ( $last_tok[1] + strlen( $last_tok[0] ) ) - $first_tok[1];
				return $start;
			}
		}

		return false;
	}

	/**
	 * Safe regex-based fallback extractor when PHP DOMDocument extension is unavailable.
	 *
	 * Extracts individual block elements without returning the entire document as one string.
	 *
	 * @param string $content
	 * @return array
	 */
	private static function extract_fallback( string $content ): array {
		$units   = array();
		$pattern = '/<(p|h[1-6]|li|blockquote|td|th)(?:\s+[^>]*)?>(.*?)<\/\1>/is';

		if ( preg_match_all( $pattern, $content, $matches, PREG_OFFSET_CAPTURE ) ) {
			$tag_counts = array();
			foreach ( $matches[0] as $i => $full_match ) {
				$tag   = strtolower( $matches[1][ $i ][0] );
				$inner = $matches[2][ $i ][0];
				if ( self::has_translatable_text( $inner ) ) {
					$count              = $tag_counts[ $tag ] ?? 0;
					$tag_counts[ $tag ] = $count + 1;

					$inner_offset = $full_match[1] + strpos( $full_match[0], $inner );
					$units[]      = array(
						'type'   => 'block',
						'name'   => 'classic_' . $tag,
						'key'    => 'post_content>' . $tag . '[' . $count . ']',
						'tag'    => $tag,
						'offset' => $inner_offset,
						'length' => strlen( $inner ),
						'value'  => trim( $inner ),
						'source' => $inner,
					);
				}
			}
		}

		return $units;
	}
}
