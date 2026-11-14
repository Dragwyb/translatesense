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
	 * Source post ID.
	 *
	 * @var int
	 */
	private static int $source_post_id = 0;

	/**
	 * Source language.
	 *
	 * @var string
	 */
	private static string $source_lang = '';

	/**
	 * Target language.
	 *
	 * @var string
	 */
	private static string $target_lang = '';

	/**
	 * Translated Elementor element tree.
	 *
	 * @var array
	 */
	private static array $translated_content = array();

	/**
	 * Get builder slug.
	 */
	public function get_builder_slug(): string {
		return 'elementor';
	}

	/**
	 * Translate Elementor content structure.
	 *
	 * @param WP_Post $source_post Source post.
	 * @param string  $source_lang Source language.
	 * @param string  $target_lang Target language.
	 * @param array   $custom_opts Translation options.
	 * @return mixed
	 */
	public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() ) {
		// Reset state first so an invalid/empty source cannot reuse a previous translation.
		self::$source_post_id     = $source_post->ID;
		self::$source_lang        = $source_lang;
		self::$target_lang        = $target_lang;
		self::$translated_content = array();

		$elementor_data_raw = get_post_meta( $source_post->ID, '_elementor_data', true );
		$elements           = is_string( $elementor_data_raw ) ? json_decode( $elementor_data_raw, true ) : $elementor_data_raw;

		if ( ! is_array( $elements ) || empty( $elements ) ) {
			return $source_post->post_content;
		}

		// Always load the latest Elementor XML rules, including fields discovered
		// and persisted by the content parser.
		$rules = Xml_Engine::get_all_rules( 'elementor' );
		if ( ! is_array( $rules ) ) {
			$rules = array();
		}

		self::translate_elements_tree( $elements, $rules, $source_lang, $target_lang, $custom_opts );
		self::$translated_content = $elements;

		// Elementor content is stored in _elementor_data, not post_content.
		return '';
	}

	/**
	 * Recursively translate Elementor element nodes using XML rules only.
	 *
	 * The XML configuration is the single source of truth. The content parser
	 * may add discovered widget fields to that configuration; this builder
	 * consumes those fields on the next translation without maintaining a
	 * second hardcoded list of widget names or setting keys.
	 *
	 * @param array  $elements Elementor element nodes, passed by reference.
	 * @param array  $rules XML rules indexed by widget name.
	 * @param string $source_lang Source language.
	 * @param string $target_lang Target language.
	 * @param array  $custom_opts Translation options.
	 * @param int    $depth Recursion depth.
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

			if ( 'widget' === $el_type && is_string( $widget_type ) && '' !== $widget_type && isset( $element['settings'] ) && is_array( $element['settings'] ) ) {
				$fields = array();

				if ( isset( $rules[ $widget_type ]['fields'] ) && is_array( $rules[ $widget_type ]['fields'] ) ) {
					$fields = $rules[ $widget_type ]['fields'];
				}

				foreach ( $fields as $path => $field_info ) {
					$path = is_string( $path ) ? trim( $path ) : '';
					if ( '' === $path ) {
						continue;
					}

					// XML field type 'link' identifies URLs and must not be sent
					// through text translation. Other field types are translatable.
					$field_type = '';
					if ( is_array( $field_info ) && isset( $field_info['type'] ) ) {
						$field_type = strtolower( (string) $field_info['type'] );
					} elseif ( is_string( $field_info ) ) {
						$field_type = strtolower( $field_info );
					}

					if ( 'link' === $field_type ) {
						continue;
					}

					self::translate_nested_setting( $element['settings'], $path, (string) $widget_type, $source_lang, $target_lang, $custom_opts );
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::translate_elements_tree( $element['elements'], $rules, $source_lang, $target_lang, $custom_opts, $depth + 1 );
			}
		}
		unset( $element );
	}

	/**
	 * Translate a setting identified by a delimited path.
	 *
	 * @param array  $settings Widget settings, passed by reference.
	 * @param string $path Setting path.
	 * @param string $widget_type Widget name.
	 * @param string $source_lang Source language.
	 * @param string $target_lang Target language.
	 * @param array  $custom_opts Translation options.
	 */
	public static function translate_nested_setting( array &$settings, string $path, string $widget_type, string $source_lang, string $target_lang, array $custom_opts ): void {
		$delimiter = false !== strpos( $path, '>' ) ? '>' : ( false !== strpos( $path, '.' ) ? '.' : '' );
		$segments  = '' === $delimiter ? array( $path ) : explode( $delimiter, $path );

		self::translate_path_recursive( $settings, $segments, 0, $widget_type, $source_lang, $target_lang, $custom_opts, 0 );
	}

	/**
	 * Recursively navigate a setting path, including repeater collections.
	 *
	 * @param mixed  $data Data node, passed by reference.
	 * @param array  $segments Path segments.
	 * @param int    $index Current segment index.
	 * @param string $widget_type Widget name.
	 * @param string $source_lang Source language.
	 * @param string $target_lang Target language.
	 * @param array  $custom_opts Translation options.
	 * @param int    $depth Recursion depth.
	 */
	public static function translate_path_recursive( &$data, array $segments, int $index, string $widget_type, string $source_lang, string $target_lang, array $custom_opts, int $depth = 0 ): void {
		if ( ! is_array( $data ) || ! isset( $segments[ $index ] ) || $depth > 30 ) {
			return;
		}

		$current_key = (string) $segments[ $index ];
		$is_last     = ( $index === count( $segments ) - 1 );

		// A path may point into each item of a repeater collection.
		if ( self::is_sequential_array( $data ) ) {
			foreach ( $data as &$item ) {
				self::translate_path_recursive( $item, $segments, $index, $widget_type, $source_lang, $target_lang, $custom_opts, $depth + 1 );
			}
			unset( $item );
			return;
		}

		if ( ! array_key_exists( $current_key, $data ) ) {
			return;
		}

		if ( $is_last ) {
			if ( is_string( $data[ $current_key ] ) && '' !== trim( $data[ $current_key ] ) ) {
				self::translate_value( $data[ $current_key ], $source_lang, $target_lang, $widget_type, $custom_opts );
			}
			return;
		}

		if ( is_array( $data[ $current_key ] ) ) {
			self::translate_path_recursive( $data[ $current_key ], $segments, $index + 1, $widget_type, $source_lang, $target_lang, $custom_opts, $depth + 1 );
		}
	}

	/**
	 * Translate one string while preserving the original if the translation fails.
	 *
	 * @param string $value Source value, passed by reference.
	 * @param string $source_lang Source language.
	 * @param string $target_lang Target language.
	 * @param string $widget_type Widget name.
	 * @param array  $custom_opts Translation options.
	 */
	private static function translate_value( string &$value, string $source_lang, string $target_lang, string $widget_type, array $custom_opts ): void {
		try {
			$result = Translate::translate_string( $value, $source_lang, $target_lang, $widget_type, $custom_opts );
			if ( is_array( $result ) && isset( $result['translated'] ) && is_string( $result['translated'] ) && '' !== trim( $result['translated'] ) ) {
				$value = $result['translated'];
			}
		} catch ( \Throwable $exception ) {
			// Keep the original value when an individual string translation fails.
		}
	}

	/**
	 * Check whether an array is a zero-based sequential list.
	 *
	 * @param array $value Array to inspect.
	 * @return bool
	 */
	private static function is_sequential_array( array $value ): bool {
		if ( empty( $value ) ) {
			return false;
		}

		return array_keys( $value ) === range( 0, count( $value ) - 1 );
	}

	/**
	 * Save translated Elementor data after the translated post is created.
	 *
	 * @param int $target_post_id Translated post ID.
	 */
	public function after_save_post( int $target_post_id ): void {
		if ( $target_post_id <= 0 || empty( self::$translated_content ) || ! is_array( self::$translated_content ) ) {
			return;
		}

		$elementor_json = wp_json_encode( self::$translated_content );
		if ( ! is_string( $elementor_json ) ) {
			return;
		}

		// Keep this translated JSON as the fallback if link/media translation fails.
		$translated_elementor_json = $elementor_json;

		try {
			$translator       = new Internal_Link_Translator();
			$translated_batch = $translator->translate_batch(
				array(
					'elementor_data' => $translated_elementor_json,
				),
				self::$target_lang
			);

			if ( is_array( $translated_batch ) && isset( $translated_batch['elementor_data'] ) && ! empty( $translated_batch['elementor_data'] ) ) {
				$candidate      = $translated_batch['elementor_data'];
				$candidate_json = is_array( $candidate ) ? wp_json_encode( $candidate ) : $candidate;

				if ( is_string( $candidate_json ) ) {
					$decoded_candidate = json_decode( $candidate_json, true );
					if ( JSON_ERROR_NONE === json_last_error() && is_array( $decoded_candidate ) ) {
						$elementor_json = $candidate_json;
					}
				}
			}
		} catch ( \Throwable $exception ) {
			// Do not restore source content. Keep the successfully translated JSON.
			$elementor_json = $translated_elementor_json;
		}

		$elements = json_decode( $elementor_json, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $elements ) ) {
			return;
		}

		// Save translated Elementor data. wp_slash() is required for JSON post meta.
		update_post_meta( $target_post_id, '_elementor_data', wp_slash( $elementor_json ) );

		if ( class_exists( Elementor_Plugin::class ) ) {
			try {
				$plugin = Elementor_Plugin::$instance;
				if ( isset( $plugin->documents, $plugin->files_manager ) ) {
					$document = $plugin->documents->get( $target_post_id );
					if ( $document ) {
						$document->save(
							array(
								'elements' => $elements,
							)
						);
						$plugin->files_manager->clear_cache();
					}
				}
			} catch ( \Throwable $exception ) {
				// The translated _elementor_data meta has already been saved.
			}
		}
	}
}
