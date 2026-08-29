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
	 * Style and layout attributes excluded from translation processing.
	 *
	 * @var array<string>
	 */
	protected static $style_attributes_blocklist = array(
		'content_width',
		'title_size',
		'font_size',
		'margin',
		'padding',
		'background',
		'border',
		'color',
		'text_align',
		'font_weight',
		'font_family',
		'line_height',
		'letter_spacing',
		'text_transform',
		'border_radius',
		'box_shadow',
		'opacity',
		'width',
		'height',
		'display',
		'position',
		'z_index',
		'visibility',
		'align',
		'max_width',
		'content_typography_typography',
		'flex_justify_content',
		'title_color',
		'description_color',
		'email_content',
	);

	/**
	 * Partial key tokens indicating candidate translatable content.
	 *
	 * @var array<string>
	 */
	protected static $translatable_key_tokens = array(
		'title',
		'description',
		'editor',
		'text',
		'content',
		'label',
	);

	/**
	 * Exact attribute names indicating candidate translatable content.
	 *
	 * @var array<string>
	 */
	protected static $translatable_exact_keys = array(
		'caption',
		'heading',
		'sub_heading',
		'testimonial_content',
		'testimonial_job',
		'testimonial_name',
		'name',
	);

	/**
	 * Supported atomic control property keys.
	 *
	 * @var array<string>
	 */
	protected static $atomic_content_keys = array(
		'placeholder',
		'paragraph',
	);

	/**
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'elementor';
	}

	/**
	 * Parse Elementor element structure into translatable strings.
	 *
	 * @param mixed  $content Elementor JSON string, decoded array, or empty (fetches post meta)
	 * @param int    $post_id Target post ID
	 * @param string $lang    Source language
	 * @param array  $rules   Elementor builder XML configuration rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		if ( empty( $rules ) ) {
			$all_engine_rules = Xml_Engine::get_all_rules();
			$rules            = $all_engine_rules['elementor'] ?? array();
		}

		$element_tree = array();
		if ( is_array( $content ) ) {
			$element_tree = $content;
		} elseif ( is_string( $content ) && ! empty( $content ) ) {
			$decoded_payload = json_decode( $content, true );
			if ( is_array( $decoded_payload ) ) {
				$element_tree = $decoded_payload;
			}
		}

		// Fallback to database post meta if elements not supplied in content
		if ( empty( $element_tree ) && $post_id > 0 ) {
			$raw_meta = get_post_meta( $post_id, '_elementor_data', true );
			if ( ! empty( $raw_meta ) ) {
				$element_tree = is_string( $raw_meta ) ? json_decode( $raw_meta, true ) : $raw_meta;
			}
		}

		$extracted = array();
		if ( is_array( $element_tree ) && ! empty( $element_tree ) ) {
			$this->extract_elements_recursive( $element_tree, $rules, $post_id, $lang, $extracted );
		}

		return $extracted;
	}

	/**
	 * Recursively extract translatable strings from Elementor element trees.
	 *
	 * @param array  $elements        Elementor element nodes
	 * @param array  $elementor_rules Active elementor rules reference
	 * @param int    $post_id         Post ID
	 * @param string $lang            Language code
	 * @param array  $extracted       Extracted string packages reference
	 */
	public function extract_elements_recursive( array $elements, array &$elementor_rules, int $post_id, string $lang, array &$extracted ): void {
		foreach ( $elements as $element_node ) {
			$node_type   = $element_node['elType'] ?? '';
			$widget_name = $element_node['widgetType'] ?? ( 'widget' === $node_type ? ( $element_node['name'] ?? '' ) : '' );

			if ( 'widget' === $node_type && ! empty( $widget_name ) ) {
				$widget_settings     = $element_node['settings'] ?? array();
				$configured_fields   = $elementor_rules[ $widget_name ]['fields'] ?? array();
				$no_translate_fields = $elementor_rules[ $widget_name ]['no_translate'] ?? array();
				$mapped_rule_paths   = array();

				// Pre-register all noTranslate ghost fields to prevent extraction and discovery
				foreach ( $no_translate_fields as $blocked_path => $is_blocked ) {
					$mapped_rule_paths[ (string) $blocked_path ] = true;
				}

				// 1. Extract strings according to pre-existing XML rules (skipping noTranslate)
				if ( ! empty( $configured_fields ) && is_array( $widget_settings ) ) {
					foreach ( $configured_fields as $field_path => $field_spec ) {
						if ( isset( $no_translate_fields[ (string) $field_path ] ) ) {
							continue;
						}
						$resolved_values = $this->resolve_field_path_values( $widget_settings, (string) $field_path );
						foreach ( $resolved_values as $string_val ) {
							if ( is_string( $string_val ) && '' !== trim( $string_val ) ) {
								$this->record_extracted_string( $post_id, $lang, $widget_name, (string) $field_path, $string_val, $extracted );
							}
						}
						$mapped_rule_paths[ (string) $field_path ] = true;
					}
				}

				// 2. Discover unmapped candidate text attributes using TranslateSense detection logic
				if ( is_array( $widget_settings ) && ! empty( $widget_settings ) ) {
					$discovered_rules = array();
					$this->discover_unmapped_widget_strings(
						$widget_settings,
						$widget_name,
						$mapped_rule_paths,
						$post_id,
						$lang,
						$extracted,
						$discovered_rules
					);

					// Persist newly discovered rules to custom XML and refresh in-memory cache
					if ( ! empty( $discovered_rules ) ) {
						Xml_Engine::append_custom_rule(
							'elementor',
							$widget_name,
							$discovered_rules,
							array( 'widgetType' => $widget_name )
						);

						foreach ( $discovered_rules as $new_path => $schema_info ) {
							$elementor_rules[ $widget_name ]['fields'][ $new_path ] = array(
								'path'        => $new_path,
								'type'        => $schema_info['type'] ?? 'title',
								'editor_type' => $schema_info['editor_type'] ?? 'LINE',
							);
						}
					}
				}
			}

			// Traverse nested containers/elements
			if ( ! empty( $element_node['elements'] ) && is_array( $element_node['elements'] ) ) {
				$this->extract_elements_recursive( $element_node['elements'], $elementor_rules, $post_id, $lang, $extracted );
			}
		}
	}

	/**
	 * Inspect widget settings to extract unmapped translatable strings and register new XML definitions.
	 *
	 * @param array  $settings          Widget control settings
	 * @param string $widget_name       Widget identifier
	 * @param array  $mapped_rule_paths Mapped XML paths to skip
	 * @param int    $post_id           Post ID
	 * @param string $lang              Language code
	 * @param array  $extracted         Extracted output accumulator
	 * @param array  $discovered_rules  Discovered XML rule fields accumulator
	 */
	protected function discover_unmapped_widget_strings( array $settings, string $widget_name, array $mapped_rule_paths, int $post_id, string $lang, array &$extracted, array &$discovered_rules ): void {
		foreach ( $settings as $attr_name => $attr_payload ) {
			$attr_key = (string) $attr_name;

			// Skip CSS / layout formatting controls
			if ( $this->is_style_attribute( $attr_key ) ) {
				continue;
			}

			// Skip if already covered by an existing XML rule
			if ( isset( $mapped_rule_paths[ $attr_key ] ) ) {
				continue;
			}

			// Case A: Standard scalar string attribute
			if ( is_string( $attr_payload ) ) {
				if ( $this->is_translatable_attribute_key( $attr_key ) && '' !== trim( $attr_payload ) ) {
					$this->record_extracted_string( $post_id, $lang, $widget_name, $attr_key, $attr_payload, $extracted );
					$discovered_rules[ $attr_key ] = $this->infer_field_xml_schema( $attr_key, $attr_payload );
				}
				continue;
			}

			// Case B: Elementor Atomic control payload ($$type schema)
			if ( is_array( $attr_payload ) && isset( $attr_payload['$$type'] ) ) {
				$atomic_items = $this->resolve_atomic_control_strings( $attr_payload, $attr_key, $attr_key );
				foreach ( $atomic_items as $sub_path => $atomic_text ) {
					if ( ! isset( $mapped_rule_paths[ $sub_path ] ) ) {
						$this->record_extracted_string( $post_id, $lang, $widget_name, $sub_path, $atomic_text, $extracted );
						$discovered_rules[ $sub_path ] = $this->infer_field_xml_schema( $sub_path, $atomic_text );
					}
				}
				continue;
			}

			// Case C: Repeater item collection
			if ( is_array( $attr_payload ) && ! empty( $attr_payload ) && array_keys( $attr_payload ) === range( 0, count( $attr_payload ) - 1 ) ) {
				foreach ( $attr_payload as $repeater_row ) {
					if ( ! is_array( $repeater_row ) ) {
						continue;
					}

					foreach ( $repeater_row as $row_prop => $row_val ) {
						$row_key = (string) $row_prop;

						if ( $this->is_style_attribute( $row_key ) ) {
							continue;
						}

						$composite_path = $attr_key . '>' . $row_key;
						if ( isset( $mapped_rule_paths[ $composite_path ] ) ) {
							continue;
						}

						if ( is_string( $row_val ) ) {
							if ( $this->is_translatable_attribute_key( $row_key ) && '' !== trim( $row_val ) ) {
								$this->record_extracted_string( $post_id, $lang, $widget_name, $composite_path, $row_val, $extracted );
								$discovered_rules[ $composite_path ] = $this->infer_field_xml_schema( $composite_path, $row_val );
							}
						} elseif ( is_array( $row_val ) && isset( $row_val['$$type'] ) ) {
							$row_atomic_items = $this->resolve_atomic_control_strings( $row_val, $row_key, $composite_path );
							foreach ( $row_atomic_items as $sub_path => $atomic_text ) {
								if ( ! isset( $mapped_rule_paths[ $sub_path ] ) ) {
									$this->record_extracted_string( $post_id, $lang, $widget_name, $sub_path, $atomic_text, $extracted );
									$discovered_rules[ $sub_path ] = $this->infer_field_xml_schema( $sub_path, $atomic_text );
								}
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Retrieve all string values matching a delimited or repeater path specification.
	 *
	 * @param array  $settings   Widget settings array
	 * @param string $field_path Target path (e.g. 'title', 'link>url', 'tabs>tab_title')
	 * @return array<string>
	 */
	protected function resolve_field_path_values( array $settings, string $field_path ): array {
		$delimiter = false !== strpos( $field_path, '>' ) ? '>' : ( false !== strpos( $field_path, '.' ) ? '.' : '' );
		if ( empty( $delimiter ) ) {
			if ( isset( $settings[ $field_path ] ) && is_string( $settings[ $field_path ] ) ) {
				return array( $settings[ $field_path ] );
			}
			return array();
		}

		$path_segments  = explode( $delimiter, $field_path );
		$active_cursors = array( $settings );

		foreach ( $path_segments as $segment ) {
			$next_cursors = array();
			foreach ( $active_cursors as $cursor ) {
				if ( ! is_array( $cursor ) ) {
					continue;
				}

				if ( isset( $cursor[ $segment ] ) ) {
					$entry = $cursor[ $segment ];
					if ( is_array( $entry ) && array_keys( $entry ) === range( 0, count( $entry ) - 1 ) ) {
						// Indexed list / repeater items
						foreach ( $entry as $item_node ) {
							if ( is_array( $item_node ) ) {
								$next_cursors[] = $item_node;
							}
						}
					} else {
						$next_cursors[] = $entry;
					}
				}
			}
			$active_cursors = $next_cursors;
		}

		$resolved_strings = array();
		foreach ( $active_cursors as $leaf_val ) {
			if ( is_string( $leaf_val ) && '' !== trim( $leaf_val ) ) {
				$resolved_strings[] = $leaf_val;
			}
		}

		return $resolved_strings;
	}

	/**
	 * Extract text from Elementor atomic structure objects ($$type: 'html-v3' or 'string').
	 *
	 * @param mixed  $control_payload Elementor control payload
	 * @param string $attribute_key   Key name
	 * @param string $path_prefix     Path prefix
	 * @return array<string, string> Map of path => string content
	 */
	protected function resolve_atomic_control_strings( $control_payload, string $attribute_key, string $path_prefix ): array {
		if ( ! is_array( $control_payload ) || empty( $control_payload['$$type'] ) ) {
			return array();
		}

		if ( ! $this->is_translatable_attribute_key( $attribute_key ) && ! in_array( strtolower( $attribute_key ), self::$atomic_content_keys, true ) ) {
			return array();
		}

		$resolved_map = array();
		$type_tag     = $control_payload['$$type'];

		if ( 'html-v3' === $type_tag ) {
			if ( isset( $control_payload['value']['content'] ) && is_array( $control_payload['value']['content'] ) ) {
				$inner_content = $control_payload['value']['content'];
				if ( isset( $inner_content['$$type'] ) && 'string' === $inner_content['$$type'] && isset( $inner_content['value'] ) && is_string( $inner_content['value'] ) && '' !== trim( $inner_content['value'] ) ) {
					$resolved_map[ $path_prefix . '>value>content>value' ] = $inner_content['value'];
				}
			}
		} elseif ( 'string' === $type_tag ) {
			if ( isset( $control_payload['value'] ) && is_string( $control_payload['value'] ) && '' !== trim( $control_payload['value'] ) ) {
				$resolved_map[ $path_prefix . '>value' ] = $control_payload['value'];
			}
		}

		return $resolved_map;
	}

	/**
	 * Infer XML field type and editor type from path semantics and content characteristics.
	 *
	 * @param string $field_path Path name
	 * @param string $sample_val Sample string value
	 * @return array{type: string, editor_type: string}
	 */
	protected function infer_field_xml_schema( string $field_path, string $sample_val ): array {
		$is_visual_content = ( strlen( $sample_val ) > 50 || false !== strpos( $sample_val, '<' ) );
		$type_label        = 'title';

		$normalized_path = strtolower( $field_path );
		if ( false !== strpos( $normalized_path, 'editor' ) || false !== strpos( $normalized_path, 'content' ) || false !== strpos( $normalized_path, 'description' ) ) {
			$type_label = 'editor';
		} elseif ( false !== strpos( $normalized_path, 'title' ) || false !== strpos( $normalized_path, 'heading' ) ) {
			$type_label = 'title';
		} elseif ( false !== strpos( $normalized_path, 'label' ) ) {
			$type_label = 'label';
		} elseif ( false !== strpos( $normalized_path, 'text' ) ) {
			$type_label = 'text';
		}

		return array(
			'type'        => $type_label,
			'editor_type' => $is_visual_content ? 'VISUAL' : 'LINE',
		);
	}

	/**
	 * Verify if an attribute represents a CSS or styling parameter.
	 *
	 * @param string $attribute_key
	 * @return bool
	 */
	protected function is_style_attribute( string $attribute_key ): bool {
		$normalized = strtolower( $attribute_key );
		foreach ( self::$style_attributes_blocklist as $style_prop ) {
			if ( false !== strpos( $normalized, $style_prop ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Verify if an attribute name matches translatable text patterns.
	 *
	 * @param string $attribute_key
	 * @return bool
	 */
	protected function is_translatable_attribute_key( string $attribute_key ): bool {
		$normalized = strtolower( $attribute_key );

		foreach ( self::$translatable_key_tokens as $token ) {
			if ( false !== strpos( $normalized, $token ) ) {
				return true;
			}
		}

		foreach ( self::$translatable_exact_keys as $exact_key ) {
			if ( $normalized === strtolower( $exact_key ) ) {
				return true;
			}
		}

		return false;
	}
}
