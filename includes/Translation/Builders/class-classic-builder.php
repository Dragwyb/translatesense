<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Builders;

use WP_Post;
use TranslateSense\Includes\Translation\Translate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classic / Standard Post Content Translation Builder.
 */
class Classic_Builder extends Base_Builder {

	/**
	 * Get builder slug.
	 */
	public function get_builder_slug(): string {
		return 'classic';
	}

	/**
	 * Translate classic content string.
	 *
	 * @param WP_Post $source_post
	 * @param string  $source_lang
	 * @param string  $target_lang
	 * @param array   $custom_opts
	 * @return string
	 */
	public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() ): string {
		if ( empty( trim( $source_post->post_content ) ) ) {
			return $source_post->post_content;
		}

		$content_res = Translate::translate_string(
			$source_post->post_content,
			$source_lang,
			$target_lang,
			'post_content',
			$source_post->ID,
			$custom_opts
		);

		return $content_res['translated'] ?? $source_post->post_content;
	}
}
