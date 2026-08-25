<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gutenberg Block Editor Parser.
 */
class Gutenberg_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'gutenberg';
	}

	/**
	 * Parse Gutenberg blocks or block content into translatable strings.
	 *
	 * @param mixed  $content String content or array of parsed blocks
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( empty( $rules ) ) {
			$all_rules = Xml_Engine::get_all_rules();
			$rules     = $all_rules['gutenberg'] ?? array();
		}

		$blocks = array();
		if ( is_array( $content ) ) {
			$blocks = $content;
		} elseif ( is_string( $content ) && ! empty( $content ) ) {
			if ( function_exists( 'has_blocks' ) && has_blocks( $content ) ) {
				$blocks = parse_blocks( $content );
			} elseif ( function_exists( 'parse_blocks' ) ) {
				$blocks = parse_blocks( $content );
			}
		}

		$extracted = array();
		if ( ! empty( $blocks ) ) {
			$this->extract_blocks_recursive( $blocks, $rules, $post_id, $lang, $extracted );
		}

		return $extracted;
	}

	/**
	 * Recursively extract strings from Gutenberg blocks array.
	 *
	 * @param array  $blocks
	 * @param array  $gutenberg_rules
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $extracted
	 */
	public function extract_blocks_recursive( array $blocks, array $gutenberg_rules, int $post_id, string $lang, array &$extracted ): void {
		foreach ( $blocks as $block ) {
			$name = $block['blockName'] ?? '';
			if ( empty( $name ) ) {
				continue;
			}

			// Match XML configured keys for the block
			if ( isset( $gutenberg_rules[ $name ]['keys'] ) ) {
				$keys = $gutenberg_rules[ $name ]['keys'];
				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $block['attrs'][ $k_name ] ) && is_string( $block['attrs'][ $k_name ] ) && '' !== trim( $block['attrs'][ $k_name ] ) ) {
						$val = $block['attrs'][ $k_name ];
						$this->record_extracted_string( $post_id, $lang, $name, $k_name, $val, $extracted );
					}
				}
			}

			// Also extract innerHTML for core/paragraph or other blocks if not already in attrs
			if ( 'core/paragraph' === $name && ! empty( $block['innerHTML'] ) ) {
				$clean = trim( strip_tags( $block['innerHTML'] ) );
				if ( ! empty( $clean ) ) {
					$this->record_extracted_string( $post_id, $lang, 'core/paragraph', 'innerHTML', $clean, $extracted );
				}
			}

			// Recurse inner blocks
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$this->extract_blocks_recursive( $block['innerBlocks'], $gutenberg_rules, $post_id, $lang, $extracted );
			}
		}
	}
}
