<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser\Builders;

use TranslateSense\Includes\Xml_Engine\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Elementor Page Builder Parser.
 */
class Elementor_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'elementor';
	}

	/**
	 * Parse Elementor elements tree into translatable strings.
	 *
	 * @param mixed  $content Elementor JSON string, decoded array, or empty (fetches post meta)
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( empty( $rules ) ) {
			$all_rules = Xml_Engine::get_all_rules();
			$rules     = $all_rules['elementor'] ?? array();
		}

		$elements = array();
		if ( is_array( $content ) ) {
			$elements = $content;
		} elseif ( is_string( $content ) && ! empty( $content ) ) {
			$decoded = json_decode( $content, true );
			if ( is_array( $decoded ) ) {
				$elements = $decoded;
			}
		}

		// Fallback to post meta if elements not passed directly
		if ( empty( $elements ) && $post_id > 0 ) {
			$elementor_data = get_post_meta( $post_id, '_elementor_data', true );
			if ( ! empty( $elementor_data ) ) {
				$elements = is_string( $elementor_data ) ? json_decode( $elementor_data, true ) : $elementor_data;
			}
		}

		$extracted = array();
		if ( is_array( $elements ) && ! empty( $elements ) ) {
			$this->extract_elements_recursive( $elements, $rules, $post_id, $lang, $extracted );
		}

		return $extracted;
	}

	/**
	 * Recursively extract strings from Elementor element trees.
	 *
	 * @param array  $elements
	 * @param array  $elementor_rules
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $extracted
	 */
	public function extract_elements_recursive( array $elements, array $elementor_rules, int $post_id, string $lang, array &$extracted ): void {
		foreach ( $elements as $element ) {
			$el_type     = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? ( 'widget' === $el_type ? ( $element['name'] ?? '' ) : '' );

			if ( 'widget' === $el_type && ! empty( $widget_type ) && isset( $elementor_rules[ $widget_type ]['fields'] ) ) {
				$fields   = $elementor_rules[ $widget_type ]['fields'];
				$settings = $element['settings'] ?? array();

				foreach ( $fields as $path => $f_info ) {
					$val = $this->get_nested_val( $settings, $path );
					if ( is_string( $val ) && '' !== trim( $val ) ) {
						$this->record_extracted_string( $post_id, $lang, $widget_type, $path, $val, $extracted );
					}
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$this->extract_elements_recursive( $element['elements'], $elementor_rules, $post_id, $lang, $extracted );
			}
		}
	}
}
