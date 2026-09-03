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
 * Elementor Page Builder Translation.
 */
class Elementor_Builder extends Base_Builder {

	/**
	 * Get builder slug.
	 */
	public function get_builder_slug(): string {
		return 'elementor';
	}

	/**
	 * Translate Elementor content structure.
	 * Returns array of translated elements or source content.
	 *
	 * @param WP_Post $source_post
	 * @param string  $source_lang
	 * @param string  $target_lang
	 * @param array   $custom_opts
	 * @return mixed
	 */
	public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() ) {
		$elementor_data_raw = get_post_meta( $source_post->ID, '_elementor_data', true );
		$elements           = is_string( $elementor_data_raw ) ? json_decode( $elementor_data_raw, true ) : $elementor_data_raw;

		if ( ! is_array( $elements ) ) {
			return $source_post->post_content;
		}

		$rules = Xml_Engine::get_all_rules( 'elementor' );
		self::translate_elements_tree( $elements, $rules, $source_lang, $target_lang, $source_post->ID, $custom_opts );

		return $elements;
	}

	/**
	 * Recursively translate Elementor elements tree.
	 *
	 * @param array  $elements
	 * @param array  $rules
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 */
	public static function translate_elements_tree( array &$elements, array $rules, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): void {
		foreach ( $elements as &$element ) {
			$el_type     = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? '';

			if ( 'widget' === $el_type && ! empty( $widget_type ) && isset( $rules[ $widget_type ] ) ) {
				$fields = $rules[ $widget_type ]['attributes'] ?? array();
				foreach ( $fields as $path => $f_info ) {
					self::translate_nested_setting( $element['settings'], (string) $path, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts );
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::translate_elements_tree( $element['elements'], $rules, $source_lang, $target_lang, $post_id, $custom_opts );
			}
		}
	}

	/**
	 * Helper to translate and set nested setting in Elementor widget.
	 *
	 * @param array  $settings
	 * @param string $path
	 * @param string $widget_type
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 */
	public static function translate_nested_setting( array &$settings, string $path, string $widget_type, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): void {
		$delimiter = false !== strpos( $path, '>' ) ? '>' : ( false !== strpos( $path, '.' ) ? '.' : '' );
		$segments  = empty( $delimiter ) ? array( $path ) : explode( $delimiter, $path );

		self::translate_path_recursive( $settings, $segments, 0, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts );
	}

	/**
	 * Recursively navigate settings path (handling associative keys, repeaters, and inner arrays) and translate target string values.
	 *
	 * @param mixed  $data
	 * @param array  $segments
	 * @param int    $index
	 * @param string $widget_type
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 */
	public static function translate_path_recursive( &$data, array $segments, int $index, string $widget_type, string $source_lang, string $target_lang, int $post_id, array $custom_opts ): void {
		if ( ! is_array( $data ) || ! isset( $segments[ $index ] ) ) {
			return;
		}

		$current_key = $segments[ $index ];
		$is_last     = ( $index === count( $segments ) - 1 );

		// Case 1: Sequential list / repeater items collection ([ 0 => [...], 1 => [...] ])
		if ( array_keys( $data ) === range( 0, count( $data ) - 1 ) ) {
			foreach ( $data as &$item ) {
				self::translate_path_recursive( $item, $segments, $index, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts );
			}
			unset( $item );
			return;
		}

		// Case 2: Associative key exists
		if ( array_key_exists( $current_key, $data ) ) {
			if ( $is_last ) {
				if ( is_string( $data[ $current_key ] ) && '' !== trim( $data[ $current_key ] ) ) {
					$res                  = Translate::translate_string(
						$data[ $current_key ],
						$source_lang,
						$target_lang,
						$widget_type,
						$post_id,
						$custom_opts
					);
					$data[ $current_key ] = $res['translated'];
				}
			} elseif ( is_array( $data[ $current_key ] ) ) {
					// Check if $data[$current_key] is a repeater collection
				if ( array_keys( $data[ $current_key ] ) === range( 0, count( $data[ $current_key ] ) - 1 ) ) {
					foreach ( $data[ $current_key ] as &$sub_item ) {
						self::translate_path_recursive( $sub_item, $segments, $index + 1, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts );
					}
					unset( $sub_item );
				} else {
					self::translate_path_recursive( $data[ $current_key ], $segments, $index + 1, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts );
				}
			}
		}
	}

	/**
	 * Lifecycle method called after translated post is saved/inserted.
	 * Updates Elementor mode, serialized _elementor_data, and template meta based on translated content.
	 *
	 * @param int    $source_post_id
	 * @param int    $target_post_id
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param mixed  $translated_content
	 */
	public function after_save_post( int $source_post_id, int $target_post_id, string $source_lang, string $target_lang, $translated_content ): void {
		if ( ! empty( $translated_content ) ) {
			update_post_meta( $target_post_id, '_elementor_edit_mode', 'builder' );
			update_post_meta( $target_post_id, '_elementor_data', wp_slash( is_string( $translated_content ) ? $translated_content : wp_json_encode( $translated_content ) ) );

			$template_type = get_post_meta( $source_post_id, '_elementor_template_type', true );
			if ( $template_type ) {
				update_post_meta( $target_post_id, '_elementor_template_type', $template_type );
			}

			$page_settings = get_post_meta( $source_post_id, '_elementor_page_settings', true );
			if ( $page_settings ) {
				update_post_meta( $target_post_id, '_elementor_page_settings', $page_settings );
			}
		}
	}
}
