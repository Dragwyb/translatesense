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
				$keys = $rules[ $name ]['keys'] ?? array();
				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $block['attrs'][ $k_name ] ) && is_string( $block['attrs'][ $k_name ] ) && '' !== trim( $block['attrs'][ $k_name ] ) ) {
						$res                       = Translate::translate_string(
							$block['attrs'][ $k_name ],
							$source_lang,
							$target_lang,
							$name,
							$post_id,
							$custom_opts
						);
						$block['attrs'][ $k_name ] = $res['translated'];
					}
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::translate_blocks_tree( $block['innerBlocks'], $rules, $source_lang, $target_lang, $post_id, $custom_opts );
			}
		}
	}
}
