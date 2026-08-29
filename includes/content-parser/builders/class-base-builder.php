<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Hashing_Db;
use TranslateSense\Includes\Content_Parser\Dom_Filter;

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

		// Skip email addresses, URLs, and file path references
		if ( $this->is_email_or_url( (string) $filtered_value ) || $this->is_email_or_url( $value ) ) {
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
	 * Check if a string is an email address, URL, or URL-related value.
	 *
	 * @param string $str
	 * @return bool
	 */
	public function is_email_or_url( string $str ): bool {
		$trimmed = trim( strip_tags( html_entity_decode( $str, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );

		if ( '' === $trimmed ) {
			return false;
		}

		// 1. Email validation or mailto: links
		if ( filter_var( $trimmed, FILTER_VALIDATE_EMAIL ) ) {
			return true;
		}
		if ( 0 === stripos( $trimmed, 'mailto:' ) ) {
			return true;
		}
		if ( preg_match( '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $trimmed ) ) {
			return true;
		}

		// 2. Direct URL validation
		if ( filter_var( $trimmed, FILTER_VALIDATE_URL ) ) {
			return true;
		}

		// 3. Common URL protocols & schemas (http, https, ftp, //, www, tel, sms, javascript, etc.)
		if ( preg_match( '/^(https?:\/\/|ftp:\/\/|\/\/|www\.)/i', $trimmed ) ) {
			return true;
		}
		if ( preg_match( '/^(tel:|sms:|javascript:|callto:|whatsapp:)/i', $trimmed ) ) {
			return true;
		}

		// 4. Common media / asset file URLs or paths
		if ( preg_match( '/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i', $trimmed ) ) {
			return true;
		}

		// 5. Domain-like strings (e.g. domain.com/path)
		if ( preg_match( '/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]*$/i', $trimmed ) ) {
			return true;
		}

		return false;
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
	 * @param string $value
	 * @return string|false
	 */
	protected function filter_dom_content( string $value ) {
		return Dom_Filter::filter_dom_content( $value );
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
