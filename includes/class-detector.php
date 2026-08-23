<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Detector {

	/**
	 * Target placeholder dummy text to detect.
	 */
	public static $dummy_text = 'Translate This Content';

	/**
	 * Secondary alternative dummy markers.
	 */
	private static $alt_dummy_markers = array(
		'translate this content',
		'translate_me_dummy_text',
		'translatethiscontent',
	);

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		// Hook Gutenberg / Classic Post Saves (Step 2.1)
		add_action( 'save_post', array( __CLASS__, 'handle_save_post' ), 20, 2 );

		// Hook Elementor Document Saves (Step 2.1)
		add_action( 'elementor/document/save/data', array( __CLASS__, 'handle_elementor_save' ), 20, 2 );
		add_action( 'elementor/editor/after_save', array( __CLASS__, 'handle_elementor_after_save' ), 20, 2 );
	}

	/**
	 * Check if Config Mapping Mode is active (Step 2.2).
	 */
	public static function is_mapping_mode_active( $post_id = 0 ) {
		$settings    = get_option( 'translatesense_settings', array() );
		$global_mode = ! empty( $settings['mapping_mode'] );

		if ( $post_id ) {
			$post_mode = get_post_meta( $post_id, '_translatesense_mapping_mode', true );
			if ( '1' === $post_mode || 'yes' === $post_mode ) {
				return true;
			}
		}

		return $global_mode;
	}

	/**
	 * Handle standard WP post save (Gutenberg / Classic).
	 */
	public static function handle_save_post( $post_id, $post ) {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( wp_is_post_revision( $post_id ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		if ( ! self::is_mapping_mode_active( $post_id ) ) {
			return;
		}

		// Parse Gutenberg content
		$content = $post->post_content;
		if ( function_exists( 'has_blocks' ) && has_blocks( $content ) ) {
			$blocks = parse_blocks( $content );
			self::scan_blocks_for_mapping( $blocks );
		}
	}

	/**
	 * Recursively scan Gutenberg blocks for unmapped text or dummy markers.
	 */
	public static function scan_blocks_for_mapping( $blocks ) {
		$rules           = Xml_Engine::get_all_rules();
		$gutenberg_rules = $rules['gutenberg'];

		foreach ( $blocks as $block ) {
			$block_name = $block['blockName'];
			if ( empty( $block_name ) ) {
				continue;
			}

			$attrs         = $block['attrs'] ?? array();
			$existing_keys = isset( $gutenberg_rules[ $block_name ] ) ? array_keys( $gutenberg_rules[ $block_name ]['keys'] ) : array();

			$new_fields = array();

			// Scan attributes
			foreach ( $attrs as $attr_key => $attr_val ) {
				if ( is_string( $attr_val ) && ! empty( trim( $attr_val ) ) ) {
					// If attribute is not yet in XML config or contains dummy text
					if ( ! in_array( $attr_key, $existing_keys, true ) || false !== stripos( $attr_val, self::$dummy_text ) ) {
						$new_fields[ $attr_key ] = array(
							'type'        => ( strlen( $attr_val ) > 60 ) ? 'text' : 'title',
							'editor_type' => ( strlen( $attr_val ) > 60 || false !== strpos( $attr_val, '<' ) ) ? 'VISUAL' : 'LINE',
						);
					}
				}
			}

			// If new fields found, register into custom XML
			if ( ! empty( $new_fields ) ) {
				Xml_Engine::append_custom_rule( 'gutenberg', $block_name, $new_fields );
			}

			// Recurse inner blocks
			if ( ! empty( $block['innerBlocks'] ) ) {
				self::scan_blocks_for_mapping( $block['innerBlocks'] );
			}
		}
	}

	/**
	 * Handle Elementor document save data.
	 */
	public static function handle_elementor_save( $data, $document ) {
		$post_id = $document->get_main_id();
		if ( ! self::is_mapping_mode_active( $post_id ) ) {
			return $data;
		}

		$elements = $data['elements'] ?? array();
		if ( ! empty( $elements ) ) {
			self::scan_elementor_elements( $elements );
		}

		return $data;
	}

	/**
	 * Handle Elementor editor after save action.
	 */
	public static function handle_elementor_after_save( $post_id, $editor_data ) {
		if ( ! self::is_mapping_mode_active( $post_id ) ) {
			return;
		}

		if ( is_array( $editor_data ) ) {
			self::scan_elementor_elements( $editor_data );
		}
	}

	/**
	 * Recursively scan Elementor elements tree for unmapped settings.
	 */
	public static function scan_elementor_elements( $elements ) {
		$rules           = Xml_Engine::get_all_rules();
		$elementor_rules = $rules['elementor'];

		foreach ( $elements as $element ) {
			$el_type     = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? ( 'widget' === $el_type ? ( $element['name'] ?? '' ) : '' );

			if ( 'widget' === $el_type && ! empty( $widget_type ) ) {
				$settings        = $element['settings'] ?? array();
				$existing_fields = isset( $elementor_rules[ $widget_type ] ) ? array_keys( $elementor_rules[ $widget_type ]['fields'] ) : array();

				$new_fields = array();
				self::find_elementor_text_settings( $settings, '', $existing_fields, $new_fields );

				if ( ! empty( $new_fields ) ) {
					Xml_Engine::append_custom_rule(
						'elementor',
						$widget_type,
						$new_fields,
						array( 'widgetType' => $widget_type )
					);
				}
			}

			// Recurse inner elements
			if ( ! empty( $element['elements'] ) ) {
				self::scan_elementor_elements( $element['elements'] );
			}
		}
	}

	/**
	 * Detect unmapped fields / dummy text from Gutenberg blocks in memory and generate XML snippet.
	 */
	public static function detect_from_gutenberg_blocks( $blocks ) {
		$found_items = array();

		$scan_recursive = function ( $block_list ) use ( &$scan_recursive, &$found_items ) {
			foreach ( $block_list as $block ) {
				$block_name = $block['blockName'] ?? '';
				if ( empty( $block_name ) ) {
					continue;
				}

				$attrs = $block['attrs'] ?? array();
				foreach ( $attrs as $attr_key => $attr_val ) {
					if ( is_string( $attr_val ) && ! empty( trim( $attr_val ) ) ) {
						$is_dummy = ( false !== stripos( $attr_val, self::$dummy_text ) );
						if ( $is_dummy || false !== stripos( $attr_val, 'translate this content' ) ) {
							if ( ! isset( $found_items[ $block_name ] ) ) {
								$found_items[ $block_name ] = array();
							}
							$found_items[ $block_name ][ $attr_key ] = array(
								'type'        => ( strlen( $attr_val ) > 60 ) ? 'text' : 'title',
								'editor_type' => ( strlen( $attr_val ) > 60 || false !== strpos( $attr_val, '<' ) ) ? 'VISUAL' : 'LINE',
							);
						}
					}
				}

				if ( ! empty( $block['innerBlocks'] ) ) {
					$scan_recursive( $block['innerBlocks'] );
				}
			}
		};

		$scan_recursive( $blocks );

		if ( empty( $found_items ) ) {
			return null;
		}

		$generated_xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n";
		foreach ( $found_items as $b_name => $fields ) {
			$generated_xml .= '        <gutenberg-block name="' . esc_attr( $b_name ) . "\">\n";
			foreach ( $fields as $f_key => $f_info ) {
				$generated_xml .= '            <key name="' . esc_attr( $f_key ) . '" type="' . esc_attr( $f_info['type'] ) . '" editor_type="' . esc_attr( $f_info['editor_type'] ) . "\" />\n";
			}
			$generated_xml .= "        </gutenberg-block>\n";
		}
		$generated_xml .= "    </gutenberg-blocks>\n</wpml-config>";

		return array(
			'builder'     => 'gutenberg',
			'found_items' => $found_items,
			'xml_snippet' => $generated_xml,
		);
	}

	/**
	 * Detect unmapped fields / dummy text from Elementor data in memory and generate XML snippet.
	 */
	public static function detect_from_elementor_data( $elements ) {
		$found_items = array();

		$scan_recursive = function ( $element_list ) use ( &$scan_recursive, &$found_items ) {
			foreach ( $element_list as $element ) {
				$el_type     = $element['elType'] ?? '';
				$widget_type = $element['widgetType'] ?? ( 'widget' === $el_type ? ( $element['name'] ?? '' ) : '' );

				if ( 'widget' === $el_type && ! empty( $widget_type ) ) {
					$settings   = $element['settings'] ?? array();
					$new_fields = array();
					self::find_elementor_text_settings( $settings, '', array(), $new_fields );

					if ( ! empty( $new_fields ) ) {
						if ( ! isset( $found_items[ $widget_type ] ) ) {
							$found_items[ $widget_type ] = array();
						}
						$found_items[ $widget_type ] = array_merge( $found_items[ $widget_type ], $new_fields );
					}
				}

				if ( ! empty( $element['elements'] ) ) {
					$scan_recursive( $element['elements'] );
				}
			}
		};

		$scan_recursive( $elements );

		if ( empty( $found_items ) ) {
			return null;
		}

		$generated_xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <elementor-widgets>\n";
		foreach ( $found_items as $w_name => $fields ) {
			$generated_xml .= '        <widget name="' . esc_attr( $w_name ) . "\">\n";
			$generated_xml .= "            <conditions>\n                <condition key=\"widgetType\">" . esc_html( $w_name ) . "</condition>\n            </conditions>\n";
			$generated_xml .= "            <fields>\n";
			foreach ( $fields as $f_path => $f_info ) {
				$generated_xml .= '                <field type="' . esc_attr( $f_info['type'] ) . '" editor_type="' . esc_attr( $f_info['editor_type'] ) . '">' . esc_html( $f_path ) . "</field>\n";
			}
			$generated_xml .= "            </fields>\n";
			$generated_xml .= "        </widget>\n";
		}
		$generated_xml .= "    </elementor-widgets>\n</wpml-config>";

		return array(
			'builder'     => 'elementor',
			'found_items' => $found_items,
			'xml_snippet' => $generated_xml,
		);
	}

	/**
	 * Helper to recursively identify translatable text settings in Elementor widget.
	 */
	private static function find_elementor_text_settings( $settings, $prefix, $existing_fields, &$new_fields ) {
		$ignored_keys = array( '_id', '_element_id', 'css_classes', 'custom_css', '_animation', 'color', 'background', 'margin', 'padding', 'typography' );

		foreach ( $settings as $key => $val ) {
			if ( in_array( $key, $ignored_keys, true ) ) {
				continue;
			}

			$path = $prefix ? ( $prefix . '>' . $key ) : $key;

			if ( is_string( $val ) && ! empty( trim( $val ) ) ) {
				$is_text  = ! preg_match( '/^#[0-9a-f]{3,8}$/i', $val ) && ! filter_var( $val, FILTER_VALIDATE_URL );
				$is_dummy = ( false !== stripos( $val, self::$dummy_text ) ) || ( false !== stripos( $val, 'translate this content' ) ) || ( false !== stripos( $val, 'translate_me_dummy_text' ) );

				if ( ( $is_dummy || ( $is_text && ! in_array( $path, $existing_fields, true ) ) ) ) {
					$new_fields[ $path ] = array(
						'type'        => ( strlen( $val ) > 50 ) ? 'description' : 'title',
						'editor_type' => ( strlen( $val ) > 50 || false !== strpos( $val, '<' ) ) ? 'VISUAL' : 'LINE',
					);
				}
			} elseif ( is_array( $val ) && ! empty( $val ) && count( $val ) < 20 ) {
				self::find_elementor_text_settings( $val, $path, $existing_fields, $new_fields );
			}
		}
	}
}
