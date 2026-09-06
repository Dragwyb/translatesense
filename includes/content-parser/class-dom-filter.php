<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser;

use DOMDocument;
use DOMNode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Dom_Filter
 * 
 * Filters and extracts translatable text/DOM content from HTML nodes with in-memory caching,
 * and reconstructs/replaces translated text back into the original HTML structure.
 */
class Dom_Filter {

	/**
	 * In-memory cache for extracted and reconstructed DOM strings.
	 *
	 * @var array<string, mixed>
	 */
	private static $cache = array();

	/**
	 * Clear in-memory cache.
	 */
	public static function clear_cache(): void {
		self::$cache = array();
	}

	/**
	 * Check if a string contains meaningful text content (excluding HTML tags and whitespace).
	 *
	 * @param string $text
	 * @return bool
	 */
	public static function has_text_content( string $text ): bool {
		$decoded = html_entity_decode( wp_strip_all_tags( $text ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$clean   = preg_replace( '/[\s\x{00a0}\x{200b}\x{200e}\x{200f}]+/u', '', $decoded );

		return '' !== (string) $clean;
	}

	/**
	 * Decode HTML entities and clean control characters.
	 *
	 * @param string $string
	 * @return string
	 */
	public static function decode_html_string( string $string ): string {
		$decoded = html_entity_decode( $string, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return preg_replace( '/[\x{00a0}\x{200b}\x{200e}\x{200f}]+/u', ' ', $decoded );
	}

	/**
	 * Filter HTML content using DOMDocument to unwrap single-child non-text wrapper nodes.
	 * Returns false if the content or its elements do not contain any text content.
	 *
	 * @param string $value
	 * @return string|false
	 */
	public static function filter_dom_content( string $value ) {
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

		// If no HTML tags present, return decoded clean text directly
		if ( false === strpos( $decoded, '<' ) ) {
			self::$cache[ $cache_key ] = $decoded;
			return $decoded;
		}

		$dom = new DOMDocument();
		libxml_use_internal_errors( true );
		$html   = '<?xml encoding="UTF-8"><body>' . $decoded . '</body>';
		$loaded = $dom->loadHTML( $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		if ( ! $loaded ) {
			$res = self::has_text_content( $decoded ) ? $decoded : false;
			self::$cache[ $cache_key ] = $res;
			return $res;
		}

		$body = $dom->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			$res = self::has_text_content( $decoded ) ? $decoded : false;
			self::$cache[ $cache_key ] = $res;
			return $res;
		}

		// Check if the entire HTML has any text content
		if ( ! self::has_text_content( $body->textContent ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		$current = $body;
		while ( true ) {
			$children = array();
			if ( $current->hasChildNodes() ) {
				foreach ( $current->childNodes as $child ) {
					// Ignore empty whitespace-only text nodes between HTML tags
					if ( XML_TEXT_NODE === $child->nodeType && ! self::has_text_content( $child->nodeValue ) ) {
						continue;
					}
					// Ignore comments
					if ( XML_COMMENT_NODE === $child->nodeType ) {
						continue;
					}
					$children[] = $child;
				}
			}

			$count = count( $children );
			if ( 1 === $count ) {
				$only_child = $children[0];
				if ( XML_TEXT_NODE === $only_child->nodeType ) {
					// Text node found -> stop traversing
					break;
				} elseif ( XML_ELEMENT_NODE === $only_child->nodeType ) {
					// Single wrapper HTML element -> traverse inside
					$current = $only_child;
					continue;
				} else {
					break;
				}
			} else {
				// Children count is 0 or multiple
				break;
			}
		}

		// Check if the selected node or elements have text content inside
		if ( ! self::has_text_content( $current->textContent ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		$result = self::get_inner_html( $current, $dom );
		if ( '' === $result || ! self::has_text_content( $result ) ) {
			self::$cache[ $cache_key ] = false;
			return false;
		}

		self::$cache[ $cache_key ] = $result;
		return $result;
	}

	/**
	 * Replace the filtered substring in original HTML string with translated content.
	 *
	 * @param string $original_string
	 * @param string $translated_filtered_string
	 * @return string
	 */
	public static function replace_filtered_content( string $original_string, string $translated_filtered_string ): string {
		if ( '' === trim( $original_string ) ) {
			return $translated_filtered_string;
		}

		$cache_key = 'replace_' . md5( $original_string . '::' . $translated_filtered_string );
		if ( array_key_exists( $cache_key, self::$cache ) ) {
			return self::$cache[ $cache_key ];
		}

		$filtered = self::filter_dom_content( $original_string );

		// If no filtering took place, or filtered matches the entire string, return translated directly
		if ( false === $filtered || $filtered === $original_string || false === strpos( $original_string, '<' ) ) {
			self::$cache[ $cache_key ] = $translated_filtered_string;
			return $translated_filtered_string;
		}

		// If the filtered string exists verbatim inside the original string, replace it
		if ( false !== strpos( $original_string, $filtered ) ) {
			$replaced = self::str_replace_first( $filtered, $translated_filtered_string, $original_string );
			self::$cache[ $cache_key ] = $replaced;
			return $replaced;
		}

		// Fallback check: decoded comparison
		$decoded_original = self::decode_html_string( $original_string );
		if ( false !== strpos( $decoded_original, $filtered ) ) {
			$replaced = self::str_replace_first( $filtered, $translated_filtered_string, $decoded_original );
			self::$cache[ $cache_key ] = $replaced;
			return $replaced;
		}

		self::$cache[ $cache_key ] = $translated_filtered_string;
		return $translated_filtered_string;
	}

	/**
	 * Get the inner HTML content of a DOMNode without the outer element wrapper tag.
	 *
	 * @param DOMNode     $node
	 * @param DOMDocument $dom
	 * @return string
	 */
	public static function get_inner_html( DOMNode $node, DOMDocument $dom ): string {
		$inner_html = '';
		if ( $node->hasChildNodes() ) {
			foreach ( $node->childNodes as $child ) {
				$inner_html .= $dom->saveHTML( $child );
			}
		}
		return trim( $inner_html );
	}

	/**
	 * Replace only the first occurrence of a search string.
	 *
	 * @param string $search
	 * @param string $replace
	 * @param string $subject
	 * @return string
	 */
	public static function str_replace_first( string $search, string $replace, string $subject ): string {
		$pos = strpos( $subject, $search );
		if ( false !== $pos ) {
			return substr_replace( $subject, $replace, $pos, strlen( $search ) );
		}
		return $subject;
	}
}
