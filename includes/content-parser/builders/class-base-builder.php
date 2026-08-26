<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Hashing_Db;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Abstract Base Builder class for content parsing and string extraction.
 */
abstract class Base_Builder {

	/**
	 * Get the builder slug identifier (e.g. 'gutenberg', 'elementor', 'divi', 'classic').
	 *
	 * @return string
	 */
	abstract public function get_builder_slug(): string;

	/**
	 * Parse content and extract translatable strings.
	 *
	 * @param mixed  $content Raw content (string, array of blocks, JSON, etc.)
	 * @param int    $post_id Post ID if applicable
	 * @param string $lang    Source language code
	 * @param array  $rules   Optional specific builder XML rules
	 * @return array Array of extracted string items with hash, name, key, source, and value
	 */
	abstract public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array;

	/**
	 * Helper method to record an extracted string in the database and append it to the result set.
	 *
	 * @param int    $post_id   Post ID
	 * @param string $lang      Language code
	 * @param string $name      Context / component name (e.g. block name, widget type, module name)
	 * @param string $key       Key / attribute path (e.g. 'title', 'settings>text', 'innerHTML')
	 * @param string $value     String value to record
	 * @param array  $extracted Extracted strings reference array
	 * @param string $builder   Optional builder slug override
	 * @return array Formatted item, or empty array if skipped
	 */
	protected function record_extracted_string( int $post_id, string $lang, string $name, string $key, string $value, array &$extracted, string $builder = '' ): array {
		$filtered_value = $this->filter_dom_content( $value );

		if ( false === $filtered_value || ! $this->has_text_content( (string) $filtered_value ) ) {
			return array();
		}

		$builder_slug = ! empty( $builder ) ? $builder : $this->get_builder_slug();
		$hash         = Hashing_Db::generate_hash( $name, $filtered_value );

		if ( $post_id > 0 && ! empty( $lang ) ) {
			Hashing_Db::record_package( $post_id, $lang, $hash, $value, $builder_slug, $name, $key, $filtered_value );
		}

		$item = array(
			'hash'    => $hash,
			'name'    => $name,
			'key'     => $key,
			'source'  => $value,
			'value'   => $filtered_value,
			'builder' => $builder_slug,
		);

		$extracted[] = $item;
		return $item;
	}

	/**
	 * Decode unicode escape sequences (e.g. \u003C, \u003E) and backslash-escaped characters into readable HTML.
	 *
	 * @param string $str
	 * @return string
	 */
	protected function decode_html_string( string $str ): string {
		if ( '' === trim( $str ) ) {
			return $str;
		}

		// Unescape unicode escape sequences like \u003c, \u003e, \u0022, etc.
		if ( false !== strpos( $str, '\u' ) || false !== strpos( $str, '\U' ) ) {
			$str = preg_replace_callback(
				'/\\\\u([0-9a-fA-F]{4})/i',
				function ( $match ) {
					return mb_convert_encoding( pack( 'H*', $match[1] ), 'UTF-8', 'UCS-2BE' );
				},
				$str
			);
		}

		// Unescape standard backslash-escaped characters like \" or \'
		$str = stripslashes( $str );

		return $str;
	}

	/**
	 * Check if a string contains actual readable text characters (not just tags, whitespace, or empty entities).
	 *
	 * @param string $text
	 * @return bool
	 */
	protected function has_text_content( string $text ): bool {
		$text = $this->decode_html_string( $text );
		if ( '' === trim( $text ) ) {
			return false;
		}

		// Decode HTML entities (including &nbsp;, &#160;, etc.)
		$decoded = html_entity_decode( strip_tags( $text ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		// Strip all whitespace including unicode non-breaking spaces and zero-width spaces
		$clean = preg_replace( '/[\s\x{00a0}\x{200b}\x{200e}\x{200f}]+/u', '', $decoded );

		return '' !== $clean;
	}

	/**
	 * Filter HTML content using DOMDocument to unwrap single-child non-text wrapper nodes.
	 *
	 * Traverses down when a node has only 1 child and that child is an HTML element node (not text node).
	 * Stops when a text node is found or when children count is greater than 1.
	 * Returns false if the content or its elements do not contain any text content.
	 *
	 * @param string $value
	 * @return string|false
	 */
	protected function filter_dom_content( string $value ) {
		$value = $this->decode_html_string( $value );

		if ( ! $this->has_text_content( $value ) ) {
			return false;
		}

		if ( false === strpos( $value, '<' ) ) {
			return $value;
		}

		$dom = new \DOMDocument();
		libxml_use_internal_errors( true );
		$html   = '<?xml encoding="UTF-8"><body>' . $value . '</body>';
		$loaded = $dom->loadHTML( $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		if ( ! $loaded ) {
			return $this->has_text_content( $value ) ? $value : false;
		}

		$body = $dom->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			return $this->has_text_content( $value ) ? $value : false;
		}

		// Check if the entire HTML has any text content
		if ( ! $this->has_text_content( $body->textContent ) ) {
			return false;
		}

		$current = $body;
		while ( true ) {
			$children = array();
			if ( $current->hasChildNodes() ) {
				foreach ( $current->childNodes as $child ) {
					// Ignore empty whitespace-only text nodes between HTML tags
					if ( XML_TEXT_NODE === $child->nodeType && ! $this->has_text_content( $child->nodeValue ) ) {
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
					// Text node found
					break;
				} elseif ( XML_ELEMENT_NODE === $only_child->nodeType ) {
					// HTML node found instead of text node -> traverse into this child
					$current = $only_child;
					continue;
				} else {
					break;
				}
			} else {
				// Children count is 0 or greater than 1
				break;
			}
		}

		// Check if the selected node or elements have text content inside
		if ( ! $this->has_text_content( $current->textContent ) ) {
			return false;
		}

		$result = $this->get_inner_html( $current, $dom );
		if ( '' === $result || ! $this->has_text_content( $result ) ) {
			return false;
		}

		return $result;
	}

	/**
	 * Get the inner HTML content of a DOMNode without the outer element wrapper tag.
	 *
	 * @param \DOMNode     $node
	 * @param \DOMDocument $dom
	 * @return string
	 */
	protected function get_inner_html( \DOMNode $node, \DOMDocument $dom ): string {
		$inner_html = '';
		if ( $node->hasChildNodes() ) {
			foreach ( $node->childNodes as $child ) {
				$inner_html .= $dom->saveHTML( $child );
			}
		}
		return trim( $inner_html );
	}

	/**
	 * Helper for nested keys with `>` or `.` delimiter.
	 *
	 * @param array  $arr
	 * @param string $path
	 * @return mixed
	 */
	protected function get_nested_val( array $arr, string $path ) {
		$delimiter = false !== strpos( $path, '>' ) ? '>' : ( false !== strpos( $path, '.' ) ? '.' : '' );
		if ( empty( $delimiter ) ) {
			return $arr[ $path ] ?? null;
		}

		$keys = explode( $delimiter, $path );
		$cur  = $arr;
		foreach ( $keys as $k ) {
			if ( is_array( $cur ) && isset( $cur[ $k ] ) ) {
				$cur = $cur[ $k ];
			} else {
				return null;
			}
		}
		return $cur;
	}
}
