<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Builders;

use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\Translation\InternalLinks\Internal_Link_Translator;
use Elementor\Plugin as Elementor_Plugin;

use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Elementor Page Builder Translation.
 */
class Elementor_Builder extends Base_Builder {

	/**
	 * Source post id.
	 *
	 * @var int $source_post_id
	 */
	private static int $source_post_id;

	/**
	 * Source language.
	 *
	 * @var string $source_lang
	 */
	private static string $source_lang;

	/**
	 * Target language.
	 *
	 * @var string $target_lang
	 */
	private static string $target_lang;

	/**
	 * Translated content.
	 *
	 * @var array $translated_content
	 */
	private static array $translated_content;

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
		self::translate_elements_tree( $elements, $rules, $source_lang, $target_lang, $custom_opts );

		self::$source_post_id     = $source_post->ID;
		self::$source_lang        = $source_lang;
		self::$target_lang        = $target_lang;
		self::$translated_content = $elements;

		return '';
	}

	/**
	 * Recursively translate Elementor elements tree.
	 *
	 * @param array  $elements
	 * @param array  $rules
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param array  $custom_opts
	 */
	public static function translate_elements_tree( array &$elements, array $rules, string $source_lang, string $target_lang, array $custom_opts, int $depth = 0 ): void {
		if ( empty( $elements ) || $depth > 100 ) {
			return;
		}

		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$el_type     = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? '';

			if ( 'widget' === $el_type && ! empty( $widget_type ) && isset( $rules[ $widget_type ] ) ) {
				$fields = $rules[ $widget_type ]['fields'] ?? array();
				if ( is_array( $fields ) && isset( $element['settings'] ) && is_array( $element['settings'] ) ) {
					foreach ( $fields as $path => $f_info ) {
						if ( is_array( $f_info ) && isset( $f_info['type'] ) && 'link' === strtolower( (string) $f_info['type'] ) ) {
							continue;
						}
						self::translate_nested_setting( $element['settings'], (string) $path, $widget_type, $source_lang, $target_lang, $custom_opts );
					}
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::translate_elements_tree( $element['elements'], $rules, $source_lang, $target_lang, $custom_opts, $depth + 1 );
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
	 * @param array  $custom_opts
	 */
	public static function translate_nested_setting( array &$settings, string $path, string $widget_type, string $source_lang, string $target_lang, array $custom_opts ): void {
		$delimiter = false !== strpos( $path, '>' ) ? '>' : ( false !== strpos( $path, '.' ) ? '.' : '' );
		$segments  = empty( $delimiter ) ? array( $path ) : explode( $delimiter, $path );

		self::translate_path_recursive( $settings, $segments, 0, $widget_type, $source_lang, $target_lang, $custom_opts, 0 );
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
	 * @param array  $custom_opts
	 * @param int    $depth
	 */
	public static function translate_path_recursive( &$data, array $segments, int $index, string $widget_type, string $source_lang, string $target_lang, array $custom_opts, int $depth = 0 ): void {
		if ( ! is_array( $data ) || ! isset( $segments[ $index ] ) || $depth > 20 ) {
			return;
		}

		$current_key = $segments[ $index ];
		$is_last     = ( $index === count( $segments ) - 1 );

		// Case 1: Sequential list / repeater items collection ([ 0 => [...], 1 => [...] ])
		if ( array_keys( $data ) === range( 0, count( $data ) - 1 ) ) {
			foreach ( $data as &$item ) {
				self::translate_path_recursive( $item, $segments, $index, $widget_type, $source_lang, $target_lang, $custom_opts, $depth + 1 );
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
						$custom_opts
					);
					$data[ $current_key ] = $res['translated'];
				}
			} elseif ( is_array( $data[ $current_key ] ) ) {
				// Check if $data[$current_key] is a repeater collection
				if ( array_keys( $data[ $current_key ] ) === range( 0, count( $data[ $current_key ] ) - 1 ) ) {
					foreach ( $data[ $current_key ] as &$sub_item ) {
						self::translate_path_recursive( $sub_item, $segments, $index + 1, $widget_type, $source_lang, $target_lang, $custom_opts, $depth + 1 );
					}
					unset( $sub_item );
				} else {
					self::translate_path_recursive( $data[ $current_key ], $segments, $index + 1, $widget_type, $source_lang, $target_lang, $custom_opts, $depth + 1 );
				}
			}
		}
	}

	/**
	 * Lifecycle method called after translated post is saved/inserted.
	 * Updates Elementor mode, serialized _elementor_data, and template meta based on translated content.
	 *
	 * @param int $target_post_id - translated post id.
	 */
	public function after_save_post( int $target_post_id ): void {
		if ( empty( self::$translated_content ) || ! is_array( self::$translated_content ) ) {
			return;
		}

		// Keep original content as fallback.
		$elementor_json = wp_json_encode( self::$translated_content );

		if ( ! is_string( $elementor_json ) ) {
			return;
		}

		try {
			// Batch translate internal links and media references across Elementor structures.
			$translator    = new Internal_Link_Translator();
			$content_batch = array(
				'elementor_data' => $elementor_json,
			);

			$translated_batch = $translator->translate_batch( $content_batch, self::$target_lang );

			if ( ! empty( $translated_batch['elementor_data'] ) ) {
				$translated_content = $translated_batch['elementor_data'];

				$candidate_json = is_array( $translated_content )
				? wp_json_encode( $translated_content )
				: $translated_content;

				// Use translated content only when it contains valid JSON.
				if ( is_string( $candidate_json ) ) {
					$decoded_content = json_decode( $candidate_json, true );

					if ( JSON_ERROR_NONE === json_last_error() && is_array( $decoded_content ) ) {
						$elementor_json = $candidate_json;
					}
				}
			}
		} catch ( \Throwable $exception ) {
			$elementor_json = get_post_meta( self::$source_post_id, '_elementor_data', true );
			// Continue with original Elementor content.
		}

		$elements = json_decode( $elementor_json, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $elements ) ) {
			return;
		}

		// Save Elementor data.
		update_post_meta( $target_post_id, '_elementor_data', wp_slash( $elementor_json ) );

		if ( class_exists( Elementor_Plugin::class ) ) {
			try {
				$plugin   = Elementor_Plugin::$instance;
				$document = $plugin->documents->get( $target_post_id );

				if ( $document ) {
					$document->save(
						array(
							'elements' => $elements,
						)
					);

					$plugin->files_manager->clear_cache();
				}
			} catch ( \Throwable $exception ) {
				// Elementor post meta is already saved as a fallback.
			}
		}
	}
}
