<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translate\Builders;

use WP_Post;
use TranslateSense\Includes\Xml_Engine\Xml_Engine;
use TranslateSense\Includes\Translate\Translate;

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
	public static function translate_blocks_tree( array &$blocks, array $rules, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): void {
		foreach ( $blocks as &$block ) {
			$name = $block['blockName'] ?? '';
			if ( empty( $name ) ) {
				continue;
			}

			if ( isset( $rules[ $name ] ) ) {
				$keys = $rules[ $name ]['attributes'] ?? array();
				if ( ! empty( $keys ) ) {
					$found_strings = array();

					if ( isset( $block['attrs'] ) && is_array( $block['attrs'] ) ) {
						foreach ( $keys as $k_name => $k_info ) {
							if ( isset( $block['attrs'][ $k_name ] ) ) {
								$found_strings[] = $block['attrs'][ $k_name ];
								self::translate_attribute_value_recursive(
									$block['attrs'][ $k_name ],
									$k_info,
									$name,
									$source_lang,
									$target_lang,
									$post_id,
									$custom_opts
								);
							}
						}
					}

					if ( empty( $found_strings ) && empty( $no_translate ) && isset( $block['innerContent'] ) && ! empty( $block['innerContent'] ) ) {
						foreach ( $block['innerContent'] as &$inner_content ) {
							if ( is_string( $inner_content ) && '' !== trim( $inner_content ) ) {
								self::translate_attribute_value_recursive(
									$inner_content,
									array(),
									$name,
									$source_lang,
									$target_lang,
									$post_id,
									$custom_opts
								);
							}
						}
					}
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::translate_blocks_tree( $block['innerBlocks'], $rules, $source_lang, $target_lang, $post_id, $custom_opts );
			}
		}
	}

	/**
	 * Helper: Recursively translate block attribute value.
	 *
	 * @param mixed  $val
	 * @param mixed  $schema_info
	 * @param string $block_name
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 */
	private static function translate_attribute_value_recursive( &$val, $schema_info, string $block_name, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): void {
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
				$val = $res['translated'];
			}
			return;
		}

		if ( ! is_array( $val ) || empty( $val ) ) {
			return;
		}

		$children_schema = is_array( $schema_info ) ? ( $schema_info['children'] ?? null ) : null;

		// Sequential list of items
		if ( array_keys( $val ) === range( 0, count( $val ) - 1 ) ) {
			foreach ( $val as &$item ) {
				self::translate_attribute_value_recursive(
					$item,
					$children_schema ?? $schema_info,
					$block_name,
					$source_lang,
					$target_lang,
					$post_id,
					$custom_opts
				);
			}
			unset( $item );
			return;
		}

		// Associative dictionary
		if ( ! empty( $children_schema ) && is_array( $children_schema ) ) {
			foreach ( $children_schema as $child_key => $child_schema ) {
				if ( isset( $val[ $child_key ] ) ) {
					self::translate_attribute_value_recursive(
						$val[ $child_key ],
						$child_schema,
						$block_name,
						$source_lang,
						$target_lang,
						$post_id,
						$custom_opts
					);
				}
			}
		} else {
			foreach ( $val as $k => &$sub_val ) {
				self::translate_attribute_value_recursive(
					$sub_val,
					null,
					$block_name,
					$source_lang,
					$target_lang,
					$post_id,
					$custom_opts
				);
			}
			unset( $sub_val );
		}
	}
}
