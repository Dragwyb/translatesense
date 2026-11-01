<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * High-level Translation Manager.
 */
class Translation_Manager {

	/**
	 * Translate a post.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $in_memory_translations
	 * @param array  $options
	 * @return array|\WP_Error
	 */
	public static function translate_post( int $post_id, string $target_lang, string $provider = '', array $in_memory_translations = array(), array $options = array() ) {
		return Translate::translate_post( $post_id, $target_lang, $provider, $in_memory_translations, $options );
	}

	/**
	 * Translate a single string.
	 *
	 * @param string $source_string
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param string $widget_id
	 * @param int    $post_id
	 * @param array  $custom_options
	 * @return array
	 */
	public static function translate_string( $source_string, $source_lang, $target_lang, $widget_id = 'generic', $post_id = 0, $custom_options = array() ): array {
		return Translate::translate_string( $source_string, $source_lang, $target_lang, $widget_id, $post_id, $custom_options );
	}
}
