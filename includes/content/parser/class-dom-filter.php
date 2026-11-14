<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser;

use DOMDocument;
use DOMNode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Filters and extracts translatable text/DOM content from HTML nodes.
 *
 * Uses in-memory caching and restores original self-closing syntax for
 * HTML void elements after DOM serialization.
 */
class Dom_Filter {

	/**
	 * In-memory cache.
	 *
	 * @var array<string, mixed>
	 */
	private static $cache = array();

	/**
	 * @var array<string, string>
	 */
	private static $attr_placeholders_cache = array();

	/**
	 * HTML void elements.
	 *
	 * @var string
	 */
	private const VOID_ELEMENTS_PATTERN = 'area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr';

	/**
	 * Clear in-memory cache.
	 */
	public static function clear_cache(): void {
		self::$cache = array();
	}

	/**
	 * Check whether a string contains meaningful text.
	 *
	 * @param string $text Input text.
	 * @return bool
	 */
	public static function has_text_content( string $text ): bool {
		$decoded = html_entity_decode(
			wp_strip_all_tags( $text ),
			ENT_QUOTES | ENT_HTML5,
			'UTF-8'
		);

		$clean = preg_replace(
			'/[\s\x{00a0}\x{200b}\x{200e}\x{200f}]+/u',
			'',
			$decoded
		);

		return '' !== (string) $clean;
	}

	/**
	 * Decode HTML entities and clean selected invisible characters.
	 *
	 * @param string $string Input string.
	 * @return string
	 */
	public static function decode_html_string( string $string ): string {

		if ( ! isset( $string ) || empty( $string ) ) {
			return $string;
		}

		$decoded = html_entity_decode(
			$string,
			ENT_QUOTES | ENT_HTML5,
			'UTF-8'
		);

		return preg_replace(
			'/[\x{00a0}\x{200b}\x{200e}\x{200f}]+/u',
			' ',
			$decoded
		);
	}

	/**
	 * Mark originally self-closing HTML void elements before DOM parsing.
	 *
	 * A temporary attribute identifies the corresponding element after
	 * serialization, avoiding reliance on the original byte positions.
	 *
	 * @param string $html Original HTML.
	 * @return array{html: string, attribute: string, suffixes: array<int, string>}
	 */
	private static function mark_self_closing_tags( string $html ): array {
		$attribute = 'data-ts-sc-' . substr( md5( $html ), 0, 12 );
		$suffixes  = array();
		$index     = 0;

		$pattern = '~<(' . self::VOID_ELEMENTS_PATTERN . ')\b(?:"[^"]*"|\'[^\']*\'|[^\'">])*>~i';

		$marked_html = preg_replace_callback(
			$pattern,
			static function ( $matches ) use ( &$suffixes, &$index, $attribute ) {
				$tag = $matches[0];

				// Only mark elements that originally had a closing slash.
				if ( ! preg_match( '~(\s*)/(\s*)>$~', $tag, $slash_match ) ) {
					return $tag;
				}

				// Preserve whitespace on both sides of the slash.
				$suffix = $slash_match[1] . '/' . $slash_match[2];

				// Remove the original slash and trailing whitespace.
				$remove_length = strlen( $slash_match[0] );
				$tag_prefix    = substr( $tag, 0, -$remove_length );

				// Use a unique per-element marker.
				$id              = $index++;
				$suffixes[ $id ] = $suffix;

				return $tag_prefix
					. ' '
					. $attribute
					. '-'
					. $id
					. '="'
					. $id
					. '">';
			},
			$html
		);

		return array(
			'html'      => null === $marked_html ? $html : $marked_html,
			'attribute' => $attribute,
			'suffixes'  => $suffixes,
		);
	}

	/**
	 * Restore original self-closing syntax and remove temporary markers.
	 *
	 * @param string             $html      DOM-generated HTML.
	 * @param string             $attribute Temporary marker prefix.
	 * @param array<int, string> $suffixes  Original slash syntax by marker ID.
	 * @return string
	 */
	private static function restore_self_closing_tags(
		string $html,
		string $attribute,
		array $suffixes
	): string {
		if ( empty( $suffixes ) || false === strpos( $html, $attribute ) ) {
			return $html;
		}

		$attribute_pattern = preg_quote( $attribute, '~' );

		$pattern = '~<([a-zA-Z][a-zA-Z0-9:-]*)\b((?:"[^"]*"|\'[^\']*\'|[^\'">])*)>~s';

		$result = preg_replace_callback(
			$pattern,
			static function ( $matches ) use ( $attribute_pattern, $suffixes ) {
				$tag_name   = $matches[1];
				$attributes = $matches[2];

				if (
					! preg_match(
						'~(?:^|\s)' . $attribute_pattern . '-(\d+)="(\d+)"~',
						$attributes,
						$marker
					)
				) {
					return $matches[0];
				}

				$id = (int) $marker[1];

				if (
					! array_key_exists( $id, $suffixes )
					|| $id !== (int) $marker[2]
				) {
					return $matches[0];
				}

				// Remove the temporary marker attribute.
				$clean_attributes = preg_replace(
					'~\s+' . $attribute_pattern . '-' . $id . '="' . $id . '"~',
					'',
					$attributes,
					1
				);

				if ( null === $clean_attributes ) {
					return $matches[0];
				}

				// Remove any slash the serializer may already have emitted.
				$clean_attributes = preg_replace(
					'~/\s*$~',
					'',
					$clean_attributes
				);

				if ( null === $clean_attributes ) {
					return $matches[0];
				}

				return '<'
					. $tag_name
					. $clean_attributes
					. $suffixes[ $id ]
					. '>';
			},
			$html
		);

		return null === $result ? $html : $result;
	}

	/**
	 * Replace translatable attributes with placeholders.
	 *
	 * @param string $content Content.
	 * @return string
	 */
	private static function set_attr_placeholder( $content ) {
		if ( empty( $content ) || ! is_string( $content ) ) {
			return $content;
		}

		// Characters that may require attribute value preservation.
		$special_chars = array(
			':',
			'/',
			'%',
			'&',
			'=',
			'+',
			'#',
			'?',
			'@',
			';',
			',',
			'[',
			']',
			'{',
			'}',
			'\\',
		);

		$special_chars_pattern = preg_quote(
			implode( '', $special_chars ),
			'~'
		);

		$pattern = '~([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(["\'])((?:(?!\2).)*?['
			. $special_chars_pattern
			. '](?:(?!\2).)*)\2~s';

		if ( ! preg_match_all( $pattern, $content, $matches, PREG_SET_ORDER ) ) {
			return $content;
		}

		foreach ( $matches as $match ) {
			$attribute_name                                = $match[1];
			$attribute_value                               = substr( $match[0], strpos( $match[0], $match[2] ) + 1, -1 );
			$placeholder                                   = '__ts_ph__' . count( self::$attr_placeholders_cache ) . '__ts_ph__';
			self::$attr_placeholders_cache[ $placeholder ] = $attribute_value;
			$content                                       = str_replace( $match[0], $attribute_name . '="' . $placeholder . '"', $content );
		}

		return $content;
	}

	/**
	 * Replace placeholders with original attributes.
	 *
	 * @param string $content Content.
	 * @return string
	 */
	private static function replace_attr_placeholders( $content ) {
		if ( empty( $content ) || ! is_string( $content ) || empty( self::$attr_placeholders_cache ) ) {
			return $content;
		}

		foreach ( self::$attr_placeholders_cache as $placeholder => $attribute_value ) {
			$content = str_replace( $placeholder, $attribute_value, $content );
		}

		self::$attr_placeholders_cache = array();
		return $content;
	}

	/**
	 * Filter HTML content, unwrapping single-child wrapper elements.
	 *
	 * @param string $value HTML or text content.
	 * @return string|false
	 */
	public static function filter_dom_content( string $value ) {
		self::$attr_placeholders_cache = array();

		if ( '' === trim( $value ) ) {
			return false;
		}

		$cache_key = 'filter_' . md5( $value );

		if ( array_key_exists( $cache_key, self::$cache ) ) {
			return self::$cache[ $cache_key ];
		}

		$decoded = self::decode_html_string( $value );

		if ( ! self::has_text_content( $decoded ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		// Return plain text without creating a DOM.
		if ( false === strpos( $decoded, '<' ) || ! class_exists( 'DOMDocument' ) ) {
			$result = self::has_text_content( $decoded ) ? $decoded : false;

			self::$cache[ $cache_key ] = $result;

			return $result;
		}

		// Mark original self-closing tags before parsing.
		$marked = self::mark_self_closing_tags(
			self::set_attr_placeholder( $decoded )
		);

		$dom = new DOMDocument( '1.0', 'UTF-8' );

		$previous_errors = libxml_use_internal_errors( true );

		try {
			$html = '<?xml encoding="UTF-8"><body>'
				. $marked['html']
				. '</body>';

			$loaded = $dom->loadHTML(
				$html,
				LIBXML_HTML_NOIMPLIED
					| LIBXML_HTML_NODEFDTD
					| LIBXML_NONET
			);
		} finally {
			libxml_clear_errors();
			libxml_use_internal_errors( $previous_errors );
		}

		if ( ! $loaded ) {
			$result = self::has_text_content( $decoded ) ? self::replace_attr_placeholders( $decoded ) : false;

			self::$cache[ $cache_key ] = $result;

			return $result;
		}

		$body = $dom->getElementsByTagName( 'body' )->item( 0 );

		if ( ! $body ) {
			$result = self::has_text_content( $decoded ) ? self::replace_attr_placeholders( $decoded ) : false;

			self::$cache[ $cache_key ] = $result;

			return $result;
		}

		if ( ! self::has_text_content( $body->textContent ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		$current = $body;

		while ( true ) {
			$children = array();

			if ( $current->hasChildNodes() ) {
				foreach ( $current->childNodes as $child ) {
					// Ignore whitespace-only text nodes.
					if (
						XML_TEXT_NODE === $child->nodeType
						&& ! self::has_text_content( $child->nodeValue ?? '' )
					) {
						continue;
					}

					// Ignore comments.
					if ( XML_COMMENT_NODE === $child->nodeType ) {
						continue;
					}

					$children[] = $child;
				}
			}

			$count = count( $children );

			if ( 1 !== $count ) {
				break;
			}

			$only_child = $children[0];

			if ( XML_TEXT_NODE === $only_child->nodeType ) {
				break;
			}

			if ( XML_ELEMENT_NODE === $only_child->nodeType ) {
				$current = $only_child;
				continue;
			}

			break;
		}

		if ( ! self::has_text_content( $current->textContent ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		$result = self::get_inner_html( $current, $dom );

		// Restore only the elements marked before DOM parsing.
		$result = self::restore_self_closing_tags(
			self::replace_attr_placeholders( $result ),
			$marked['attribute'],
			$marked['suffixes']
		);

		if ( '' === $result || ! self::has_text_content( $result ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		self::$cache[ $cache_key ] = $result;

		return $result;
	}

	/**
	 * Replace the filtered substring in the original HTML.
	 *
	 * @param string $original_string Original HTML.
	 * @param string $translated_filtered_string Translated filtered HTML.
	 * @return string
	 */
	public static function replace_filtered_content(
		string $original_string,
		string $translated_filtered_string
	): string {
		if ( '' === trim( $original_string ) ) {
			return $translated_filtered_string;
		}

		$cache_key = 'replace_' . md5(
			$original_string . '::' . $translated_filtered_string
		);

		if ( array_key_exists( $cache_key, self::$cache ) ) {
			return self::$cache[ $cache_key ];
		}

		$filtered = self::filter_dom_content( $original_string );

		if (
			false === $filtered
			|| $filtered === $original_string
			|| false === strpos( $original_string, '<' )
		) {
			self::$cache[ $cache_key ] = $translated_filtered_string;
			return $translated_filtered_string;
		}

		// Prefer replacing the exact filtered fragment in the original HTML.
		if ( false !== strpos( $original_string, $filtered ) ) {
			$replaced = self::str_replace_first(
				$filtered,
				$translated_filtered_string,
				$original_string
			);

			self::$cache[ $cache_key ] = $replaced;

			return $replaced;
		}

		// Fallback: compare decoded content.
		$decoded_original = self::decode_html_string( $original_string );

		if ( false !== strpos( $decoded_original, $filtered ) ) {
			$replaced = self::str_replace_first(
				$filtered,
				$translated_filtered_string,
				$decoded_original
			);

			self::$cache[ $cache_key ] = $replaced;

			return $replaced;
		}

		self::$cache[ $cache_key ] = $translated_filtered_string;

		return $translated_filtered_string;
	}

	/**
	 * Get inner HTML without the outer element wrapper.
	 *
	 * @param DOMNode     $node DOM node.
	 * @param DOMDocument $dom  Owning document.
	 * @return string
	 */
	public static function get_inner_html( DOMNode $node, DOMDocument $dom ): string {
		try {
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
	 * Replace only the first occurrence of a string.
	 *
	 * @param string $search  Search string.
	 * @param string $replace Replacement string.
	 * @param string $subject Original string.
	 * @return string
	 */
	public static function str_replace_first(
		string $search,
		string $replace,
		string $subject
	): string {
		$pos = strpos( $subject, $search );

		if ( false !== $pos ) {
			return substr_replace(
				$subject,
				$replace,
				$pos,
				strlen( $search )
			);
		}

		return $subject;
	}
}
