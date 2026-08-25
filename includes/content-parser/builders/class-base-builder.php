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
	 * @return array Formatted item
	 */
	protected function record_extracted_string( int $post_id, string $lang, string $name, string $key, string $value, array &$extracted, string $builder = '' ): array {
		$builder_slug = ! empty( $builder ) ? $builder : $this->get_builder_slug();
		$hash         = Hashing_Db::generate_hash( $name, $value );

		if ( $post_id > 0 && ! empty( $lang ) ) {
			Hashing_Db::record_package( $post_id, $lang, $hash, $value, $builder_slug, $name, $key );
		}

		$item = array(
			'hash'    => $hash,
			'name'    => $name,
			'key'     => $key,
			'source'  => $value,
			'value'   => $value,
			'builder' => $builder_slug,
		);

		$extracted[] = $item;
		return $item;
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
