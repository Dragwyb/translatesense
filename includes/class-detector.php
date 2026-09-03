<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use TranslateSense\Includes\Xml_Engine\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Detector {

	/**
	 * Target placeholder dummy text to detect.
	 */
	public static $dummy_text = 'Translate This Content';

	/**
	 * Custom Post Type for Config Sandbox.
	 */
	const POST_TYPE = 'ts_config_post';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		// Register internal config post type
		add_action( 'init', array( __CLASS__, 'register_post_type' ) );

		// Hook Gutenberg / Classic Post Saves (Step 2.1)
		add_action( 'save_post', array( __CLASS__, 'handle_save_post' ), 20, 2 );

		// Hook Elementor Document Saves (Step 2.1)
		add_action( 'elementor/document/before_save', array( __CLASS__, 'handle_elementor_save' ), 20, 2 );
	}

	/**
	 * Register the custom post type for configuration mapping sandboxes.
	 * Excluded from search, archives, menus, and admin menu list.
	 */
	public static function register_post_type() {
		$args = array(
			'labels'              => array(
				'name'          => __( 'TranslateSense Config Posts', 'translatesense' ),
				'singular_name' => __( 'TranslateSense Config Post', 'translatesense' ),
			),
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => false,
			'show_in_nav_menus'   => false,
			'show_in_admin_bar'   => false,
			'exclude_from_search' => true,
			'has_archive'         => false,
			'query_var'           => false,
			'rewrite'             => false,
			'show_in_rest'        => true,
			'supports'            => array( 'title', 'editor', 'custom-fields', 'elementor' ),
		);

		register_post_type( self::POST_TYPE, $args );

		if ( did_action( 'elementor/loaded' ) || class_exists( '\Elementor\Plugin' ) ) {
			add_post_type_support( self::POST_TYPE, 'elementor' );
		}
	}

	/**
	 * Check if Config Mapping Mode is active for a given post.
	 */
	public static function is_translatesense_config_post( int $post_id = 0 ) {
		if ( $post_id ) {
			$post_type = get_post_type( $post_id );

			if ( self::POST_TYPE !== $post_type ) {
				return false;
			}

			$config_builder = get_post_meta( $post_id, '_translatesense_config_post', true );

			if ( ! empty( $config_builder ) ) {
				$config_post_id = self::get_config_post_id( $config_builder );

				if ( $config_post_id && $config_post_id === $post_id ) {
					return true;
				}
			}
		}
		return false;
	}

	final public static function get_config_post_id( string $builder ) {
		$builder_ids = get_option( 'translatesense_config_posts', array() );
		if ( ! empty( $builder_ids[ $builder ] ) ) {
			$post = get_post( (int) $builder_ids[ $builder ] );

			if ( $post && self::POST_TYPE === $post->post_type && 'trash' !== $post->post_status ) {

				return (int) $post->ID;
			}
		}

		return 0;
	}

	/**
	 * Get or create a config sandbox post ID for the specified builder.
	 *
	 * @param string $builder Builder identifier ('gutenberg', 'elementor', 'classic')
	 * @return int Post ID of the config sandbox post
	 */
	public static function get_or_create_config_post( string $builder = 'gutenberg' ): int {
		$builder = sanitize_key( $builder );

		// Check cached option first
		$builder_ids = get_option( 'translatesense_config_posts', array() );
		if ( ! empty( $builder_ids[ $builder ] ) ) {
			$post = get_post( (int) $builder_ids[ $builder ] );
			if ( $post && self::POST_TYPE === $post->post_type && 'trash' !== $post->post_status ) {
				return (int) $post->ID;
			}
		}

		// Find existing draft sandbox post via query
		$existing_sandbox = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'draft',
				'meta_key'       => '_translatesense_config_post',
				'meta_value'     => $builder,
				'posts_per_page' => 1,
			)
		);

		if ( ! empty( $existing_sandbox ) ) {
			$sandbox_id = (int) $existing_sandbox[0]->ID;
		} else {
			$sandbox_id = (int) wp_insert_post(
				array(
					'post_title'   => sprintf( 'TranslateSense Config Sandbox (%s)', ucfirst( $builder ) ),
					'post_type'    => self::POST_TYPE,
					'post_status'  => 'draft',
					'post_content' => '<!-- wp:paragraph --><p>Translate This Content</p><!-- /wp:paragraph -->',
				)
			);

			update_post_meta( $sandbox_id, '_translatesense_config_post', $builder );

			$builder_ids[ $builder ] = $sandbox_id;
			update_option( 'translatesense_config_posts', $builder_ids );
		}

		return (int) $sandbox_id;
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

		if ( ! self::is_translatesense_config_post( $post_id ) ) {
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
			$no_translate  = isset( $gutenberg_rules[ $block_name ]['no_translate'] ) ? array_keys( $gutenberg_rules[ $block_name ]['no_translate'] ) : array();
			$ignore_keys   = array_merge( $existing_keys, $no_translate );

			$new_fields = array();

			// Scan attributes
			foreach ( $attrs as $attr_key => $attr_val ) {
				if ( is_string( $attr_val ) && ! empty( trim( $attr_val ) ) ) {
					// If attribute is not yet in XML config or contains dummy text
					if ( ! in_array( $attr_key, $ignore_keys, true ) || false !== stripos( $attr_val, self::$dummy_text ) ) {
						if ( ! in_array( $attr_key, $no_translate, true ) ) {
							$new_fields[ $attr_key ] = array(
								'type'        => ( strlen( $attr_val ) > 60 ) ? 'text' : 'title',
								'editor_type' => ( strlen( $attr_val ) > 60 || false !== strpos( $attr_val, '<' ) ) ? 'VISUAL' : 'LINE',
							);
						}
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
	public static function handle_elementor_save( $document, $data ) {
		$post_id = $document->get_id();
		if ( ! self::is_translatesense_config_post( $post_id ) ) {
			return $data;
		}

		$elements = $data['elements'] ?? array();
		if ( ! empty( $elements ) ) {
			self::scan_elementor_elements( $elements );
		}

		return $data;
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
				$no_translate    = isset( $elementor_rules[ $widget_type ]['no_translate'] ) ? array_keys( $elementor_rules[ $widget_type ]['no_translate'] ) : array();
				$ignore_fields   = array_merge( $existing_fields, $no_translate );

				$new_fields = array();
				self::find_elementor_text_settings( $settings, '', $ignore_fields, $new_fields );

				if ( ! empty( $new_fields ) ) {
					Xml_Engine::append_custom_rule(
						'elementor',
						$widget_type,
						$new_fields
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
