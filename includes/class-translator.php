<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use TranslateSense\Includes\Translate\Translate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Backward compatibility wrapper for TranslateSense\Includes\Translate\Translate.
 */
class Translator {

	public static function translate_post( int $post_id, string $target_lang, string $provider = '', array $in_memory_translations = array() ) {
		return Translate::translate_post( $post_id, $target_lang, $provider, $in_memory_translations );
	}

	public static function translate_string( $source_string, $source_lang, $target_lang, $widget_id = 'generic', $post_id = 0, $custom_options = array() ) {
		return Translate::translate_string( $source_string, $source_lang, $target_lang, $widget_id, $post_id, $custom_options );
	}

	public static function translate_batch( $strings_array, $source_lang, $target_lang, $widget_ids = array(), $post_id = 0, $custom_options = array() ) {
		return Translate::translate_batch( $strings_array, $source_lang, $target_lang, $widget_ids, $post_id, $custom_options );
	}

	public static function should_cache_provider( $provider ) {
		return Translate::should_cache_provider( $provider );
	}

	public static function is_email_or_url( string $str ): bool {
		return Translate::is_email_or_url( $str );
	}
}
