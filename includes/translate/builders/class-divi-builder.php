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
 * Divi Builder Translation.
 */
class Divi_Builder extends Base_Builder {

	/**
	 * Get builder slug.
	 */
	public function get_builder_slug(): string {
		return 'divi';
	}

	/**
	 * Translate Divi content structure.
	 *
	 * @param WP_Post $source_post
	 * @param string  $source_lang
	 * @param string  $target_lang
	 * @param array   $custom_opts
	 * @return string
	 */
	public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() ): string {
		$content = $source_post->post_content;
		if ( empty( $content ) || false === strpos( $content, '[et_pb_' ) ) {
			return $content;
		}

		$rules = Xml_Engine::get_all_rules( 'divi' );

		// Parse and translate Divi shortcode attributes and inner contents
		$translated_content = preg_replace_callback(
			'/\[(et_pb_[a-zA-Z0-9_-]+)([^\]]*)\](.*?)\[\/\1\]/s',
			function ( $matches ) use ( $rules, $source_lang, $target_lang, $source_post, $custom_opts ) {
				$tag        = $matches[1];
				$attr_str   = $matches[2];
				$inner_body = $matches[3];

				if ( isset( $rules[ $tag ] ) ) {
					$fields = $rules[ $tag ]['fields'] ?? array();

					// Translate mapped attributes
					foreach ( $fields as $f_name => $f_info ) {
						if ( preg_match( '/\b' . preg_quote( $f_name, '/' ) . '="([^"]*)"/', $attr_str, $attr_m ) ) {
							if ( '' !== trim( $attr_m[1] ) ) {
								$res      = Translate::translate_string( $attr_m[1], $source_lang, $target_lang, $tag, $source_post->ID, $custom_opts );
								$attr_str = str_replace( $attr_m[0], $f_name . '="' . esc_attr( $res['translated'] ) . '"', $attr_str );
							}
						}
					}

					// Translate inner body if contains content
					if ( '' !== trim( strip_tags( $inner_body ) ) && false === strpos( $inner_body, '[et_pb_' ) ) {
						$res        = Translate::translate_string( $inner_body, $source_lang, $target_lang, $tag, $source_post->ID, $custom_opts );
						$inner_body = $res['translated'];
					}
				}

				return '[' . $tag . $attr_str . ']' . $inner_body . '[/' . $tag . ']';
			},
			$content
		);

		return $translated_content ? $translated_content : $content;
	}
}
