<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Builders;

use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Content\Parser\Dom_Filter;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Abstract Base Builder class for content parsing and string extraction.
 */
abstract class Base_Builder {

	/**
	 * Get the builder slug identifier (e.g. 'gutenberg', 'elementor', 'classic').
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
			Hashing_Db::record_package( $post_id, $lang, $hash, $builder_slug, $name, $key, $value, $filtered_value );
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
		$trimmed = trim( wp_strip_all_tags( html_entity_decode( $str, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );

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
		$decoded = html_entity_decode( wp_strip_all_tags( $text ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
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
	 * Recursively extract translatable strings from children nodes of a block.
	 *
	 * @param array  $rules            Array of rules for this builder (children nodes rules)
	 * @param array  $childrens      Array of children nodes
	 * @param int    $post_id          Post ID for hashing and recording
	 * @param string $lang             Source language code
	 * @param array  &$extracted       Reference to extracted strings array
	 * @param string $name             Parent/current block/widget name
	 * @param string $path_key         Path to current key to identify the string in context
	 */
	protected function extract_strings_from_node_childrens( array $rules, array $childrens, int $post_id, string $lang, array &$extracted, string $name = '', string $path_key = '' ): void {
		if ( empty( $childrens ) || empty( $rules ) ) {
			return;
		}

		$rule_keys = array_keys( $rules );

		foreach ( $rule_keys as $r_key ) {
			$cur_path = empty( $path_key ) ? $r_key : $path_key . '>' . $r_key;
			if ( isset( $childrens[ $r_key ] ) && is_string( $childrens[ $r_key ] ) && '' !== trim( $childrens[ $r_key ] ) ) {
				$this->record_extracted_string( $post_id, $lang, $name, $cur_path, $childrens[ $r_key ], $extracted );
			}

			$rules_childrens = isset( $rules[ $r_key ]['children'] ) ? $rules[ $r_key ]['children'] : array();

			if ( isset( $childrens[ $r_key ] ) && is_array( $childrens[ $r_key ] ) && ! empty( $rules_childrens ) ) {
				foreach ( $childrens[ $r_key ] as $child ) {
					$this->extract_strings_from_node_childrens( $rules_childrens, $child, $post_id, $lang, $extracted, $name, $cur_path );
				}
			}
		}
	}
}
