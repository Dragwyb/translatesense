<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Core;

use TranslateSense\Includes\XML\Xml_Engine;

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
		add_filter( 'option_elementor_cpt_support', array( __CLASS__, 'filter_elementor_cpt_support' ) );
		add_action( 'template_redirect', array( __CLASS__, 'protect_frontend_access' ) );
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
			'publicly_queryable'  => true,
			'show_ui'             => true,
			'show_in_menu'        => false,
			'show_in_nav_menus'   => false,
			'show_in_admin_bar'   => false,
			'exclude_from_search' => true,
			'has_archive'         => false,
			'query_var'           => true,
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
	 * Ensure Elementor recognizes the config post type as supported.
	 */
	public static function filter_elementor_cpt_support( $cpt ) {
		if ( ! is_array( $cpt ) ) {
			$cpt = array( 'post', 'page' );
		}
		if ( ! in_array( self::POST_TYPE, $cpt, true ) ) {
			$cpt[] = self::POST_TYPE;
		}
		return $cpt;
	}

	/**
	 * Restrict frontend access of config post type to editors/admins only.
	 */
	public static function protect_frontend_access() {
		if ( is_singular( self::POST_TYPE ) && ! current_user_can( 'edit_posts' ) ) {
			wp_safe_redirect( home_url() );
			exit;
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

				if ( 'elementor' === $builder && 'publish' !== $post->post_status ) {
					wp_update_post( array( 'ID' => $post->ID, 'post_status' => 'publish' ) );
				}
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
				if ( 'elementor' === $builder && 'publish' !== $post->post_status ) {
					wp_update_post( array( 'ID' => $post->ID, 'post_status' => 'publish' ) );
				}
				return (int) $post->ID;
			}
		}

		// Find existing draft sandbox post via query
		$existing_sandbox = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => array( 'draft', 'publish' ),
				'meta_key'       => '_translatesense_config_post', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'meta_value'     => $builder, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'posts_per_page' => 1,
			)
		);

		if ( ! empty( $existing_sandbox ) ) {
			$sandbox_id = (int) $existing_sandbox[0]->ID;
			if ( 'elementor' === $builder && 'publish' !== $existing_sandbox[0]->post_status ) {
				wp_update_post( array( 'ID' => $sandbox_id, 'post_status' => 'publish' ) );
			}
		} else {
			$sandbox_id = (int) wp_insert_post(
				array(
					'post_title'   => sprintf( 'TranslateSense Config Sandbox (%s)', ucfirst( $builder ) ),
					'post_type'    => self::POST_TYPE,
					'post_status'  => ( 'elementor' === $builder ) ? 'publish' : 'draft',
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
	 *
	 * @param array $blocks
	 * @param int   $depth
	 */
	public static function scan_blocks_for_mapping( $blocks, $depth = 0 ) {
		if ( ! is_array( $blocks ) || empty( $blocks ) || $depth > 25 ) {
			return;
		}

		$rules           = Xml_Engine::get_all_rules();
		$gutenberg_rules = $rules['gutenberg'];

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$block_name = $block['blockName'] ?? '';
			if ( empty( $block_name ) ) {
				if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
					self::scan_blocks_for_mapping( $block['innerBlocks'], $depth + 1 );
				}
				continue;
			}

			$attrs        = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();
			$no_translate = isset( $gutenberg_rules[ $block_name ]['no_translate'] ) ? array_keys( $gutenberg_rules[ $block_name ]['no_translate'] ) : array();

			// Scan attributes recursively supporting nested array items (with key="*") and objects
			$new_fields = self::extract_translatable_gutenberg_attrs( $attrs, true, $no_translate );

			// If new fields found, register into custom XML
			if ( ! empty( $new_fields ) ) {
				Xml_Engine::append_custom_rule( 'gutenberg', $block_name, $new_fields );
			}

			// Recurse inner blocks with depth limit
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				self::scan_blocks_for_mapping( $block['innerBlocks'], $depth + 1 );
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
		if ( ! empty( $elements ) && is_array( $elements ) ) {
			self::scan_elementor_elements( $elements );
		}

		return $data;
	}

	/**
	 * Recursively scan Elementor elements tree for unmapped settings with depth protection.
	 *
	 * @param array $elements
	 * @param int   $depth
	 */
	public static function scan_elementor_elements( $elements, $depth = 0 ) {
		if ( ! is_array( $elements ) || empty( $elements ) || $depth > 25 ) {
			return;
		}

		$rules           = Xml_Engine::get_all_rules();
		$elementor_rules = $rules['elementor'];

		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$el_type     = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? ( 'widget' === $el_type ? ( $element['name'] ?? '' ) : '' );

			if ( 'widget' === $el_type && ! empty( $widget_type ) ) {
				$settings        = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
				$existing_fields = isset( $elementor_rules[ $widget_type ] ) ? array_keys( $elementor_rules[ $widget_type ]['fields'] ) : array();
				$no_translate    = isset( $elementor_rules[ $widget_type ]['no_translate'] ) ? array_keys( $elementor_rules[ $widget_type ]['no_translate'] ) : array();
				$ignore_fields   = array_merge( $existing_fields, $no_translate );

				$new_fields = array();
				self::find_elementor_text_settings( $settings, '', $ignore_fields, $new_fields, 0 );

				if ( ! empty( $new_fields ) ) {
					Xml_Engine::append_custom_rule(
						'elementor',
						$widget_type,
						$new_fields,
						array( 'widgetType' => $widget_type )
					);
				}
			}

			// Recurse inner elements with depth limit
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::scan_elementor_elements( $element['elements'], $depth + 1 );
			}
		}
	}

	/**
	 * Detect unmapped fields / dummy text from Gutenberg blocks in memory and generate XML snippet.
	 * Enforces depth and node limits to prevent resource exhaustion.
	 *
	 * @param mixed $blocks
	 * @return array|null
	 */
	public static function detect_from_gutenberg_blocks( $blocks ) {
		if ( ! is_array( $blocks ) || empty( $blocks ) ) {
			return null;
		}

		$found_items   = array();
		$scanned_nodes = 0;
		$max_depth     = 25;
		$max_nodes     = 2000;

		$scan_recursive = function ( $block_list, $depth = 0 ) use ( &$scan_recursive, &$found_items, &$scanned_nodes, $max_depth, $max_nodes ) {
			if ( ! is_array( $block_list ) || $depth > $max_depth || $scanned_nodes >= $max_nodes ) {
				return;
			}

			foreach ( $block_list as $block ) {
				if ( ! is_array( $block ) || $scanned_nodes >= $max_nodes ) {
					break;
				}
				++$scanned_nodes;

				$block_name = $block['blockName'] ?? '';
				if ( empty( $block_name ) ) {
					if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
						$scan_recursive( $block['innerBlocks'], $depth + 1 );
					}
					continue;
				}

				$attrs = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();
				$extracted = self::extract_translatable_gutenberg_attrs( $attrs, false );
				if ( ! empty( $extracted ) ) {
					if ( ! isset( $found_items[ $block_name ] ) ) {
						$found_items[ $block_name ] = array();
					}
					$found_items[ $block_name ] = array_merge( $found_items[ $block_name ], $extracted );
				}

				if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
					$scan_recursive( $block['innerBlocks'], $depth + 1 );
				}
			}
		};

		$scan_recursive( $blocks, 0 );

		if ( empty( $found_items ) ) {
			return null;
		}

		$generated_xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n";
		foreach ( $found_items as $b_name => $fields ) {
			$generated_xml .= '        <gutenberg-block type="' . esc_attr( $b_name ) . "\">\n";
			$generated_xml .= self::format_gutenberg_keys_xml( $fields, '            ' );
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
	 * Recursively extract translatable field hierarchy from Gutenberg block attributes.
	 *
	 * - If attribute value is a string with text / dummy marker: returns leaf key.
	 * - If attribute value is a sequential array (list of items): wraps unique item keys in key="*".
	 * - If attribute value is an associative array (object): saves direct nested keys inside key.
	 *
	 * @param array $attrs
	 * @param bool  $require_dummy
	 * @param array $no_translate
	 * @param int   $depth
	 * @return array
	 */
	public static function extract_translatable_gutenberg_attrs( array $attrs, bool $require_dummy = false, array $no_translate = array(), int $depth = 0 ): array {
		if ( empty( $attrs ) || $depth > 10 ) {
			return array();
		}

		$fields = array();

		foreach ( $attrs as $key => $val ) {
			$str_key = (string) $key;
			if ( in_array( $str_key, $no_translate, true ) ) {
				continue;
			}

			// 1. Direct string attribute
			if ( is_string( $val ) && '' !== trim( $val ) ) {
				$is_dummy = ( false !== stripos( $val, self::$dummy_text ) )
					|| ( false !== stripos( $val, 'translate this content' ) )
					|| ( false !== stripos( $val, 'translate_me_dummy_text' ) );
				$is_text  = ! preg_match( '/^#[0-9a-f]{3,8}$/i', $val ) && ! filter_var( $val, FILTER_VALIDATE_URL );

				if ( $is_dummy || ( ! $require_dummy && $is_text ) ) {
					$fields[ $str_key ] = array(
						'type'        => ( strlen( $val ) > 60 ) ? 'text' : 'title',
						'editor_type' => ( strlen( $val ) > 60 || false !== strpos( $val, '<' ) ) ? 'VISUAL' : 'LINE',
					);
				}
			}
			// 2. Array value (sequential list of items OR associative object)
			elseif ( is_array( $val ) && ! empty( $val ) ) {
				$is_sequential = ( array_keys( $val ) === range( 0, count( $val ) - 1 ) );

				if ( $is_sequential ) {
					// Sequential list of items: collect unique item keys across all items and wrap in key="*"
					$item_fields = array();
					foreach ( $val as $item ) {
						if ( is_array( $item ) ) {
							$extracted_item = self::extract_translatable_gutenberg_attrs( $item, $require_dummy, array(), $depth + 1 );
							foreach ( $extracted_item as $item_k => $item_info ) {
								if ( ! isset( $item_fields[ $item_k ] ) ) {
									$item_fields[ $item_k ] = $item_info;
								} elseif ( ! empty( $item_info['children'] ) ) {
									$item_fields[ $item_k ]['children'] = array_merge(
										$item_fields[ $item_k ]['children'] ?? array(),
										$item_info['children']
									);
								}
							}
						} elseif ( is_string( $item ) && '' !== trim( $item ) ) {
							$is_dummy = ( false !== stripos( $item, self::$dummy_text ) );
							if ( $is_dummy || ! $require_dummy ) {
								$item_fields['*'] = array(
									'type'        => 'text',
									'editor_type' => 'LINE',
								);
							}
						}
					}

					if ( ! empty( $item_fields ) ) {
						$fields[ $str_key ] = array(
							'type'     => 'array',
							'children' => array(
								'*' => array(
									'type'     => 'array',
									'children' => $item_fields,
								),
							),
						);
					}
				} else {
					// Associative array (direct object): save direct nested keys inside key
					$nested_fields = self::extract_translatable_gutenberg_attrs( $val, $require_dummy, array(), $depth + 1 );
					if ( ! empty( $nested_fields ) ) {
						$fields[ $str_key ] = array(
							'type'     => 'object',
							'children' => $nested_fields,
						);
					}
				}
			}
		}

		return $fields;
	}

	/**
	 * Helper: Format hierarchical keys into clean Gutenberg XML indentation.
	 *
	 * @param array  $fields
	 * @param string $indent
	 * @return string
	 */
	public static function format_gutenberg_keys_xml( array $fields, string $indent = '            ' ): string {
		$xml = '';
		foreach ( $fields as $f_key => $f_info ) {
			$has_children = ! empty( $f_info['children'] ) && is_array( $f_info['children'] );
			if ( $has_children ) {
				$xml .= $indent . '<key name="' . esc_attr( (string) $f_key ) . "\">\n";
				$xml .= self::format_gutenberg_keys_xml( $f_info['children'], $indent . '    ' );
				$xml .= $indent . "</key>\n";
			} else {
				$type        = ! empty( $f_info['type'] ) ? ' type="' . esc_attr( $f_info['type'] ) . '"' : '';
				$editor_type = ! empty( $f_info['editor_type'] ) ? ' editor_type="' . esc_attr( $f_info['editor_type'] ) . '"' : '';
				$xml        .= $indent . '<key name="' . esc_attr( (string) $f_key ) . '"' . $type . $editor_type . " />\n";
			}
		}
		return $xml;
	}

	/**
	 * Detect unmapped fields / dummy text from Elementor data in memory and generate XML snippet.
	 * Enforces depth and node limits to prevent resource exhaustion.
	 *
	 * @param mixed $elements
	 * @return array|null
	 */
	public static function detect_from_elementor_data( $elements ) {
		if ( ! is_array( $elements ) || empty( $elements ) ) {
			return null;
		}

		$found_items   = array();
		$scanned_nodes = 0;
		$max_depth     = 25;
		$max_nodes     = 2000;

		$scan_recursive = function ( $element_list, $depth = 0 ) use ( &$scan_recursive, &$found_items, &$scanned_nodes, $max_depth, $max_nodes ) {
			if ( ! is_array( $element_list ) || $depth > $max_depth || $scanned_nodes >= $max_nodes ) {
				return;
			}

			foreach ( $element_list as $element ) {
				if ( ! is_array( $element ) || $scanned_nodes >= $max_nodes ) {
					break;
				}
				++$scanned_nodes;

				$el_type     = $element['elType'] ?? '';
				$widget_type = $element['widgetType'] ?? ( 'widget' === $el_type ? ( $element['name'] ?? '' ) : '' );

				if ( 'widget' === $el_type && ! empty( $widget_type ) ) {
					$settings   = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
					$new_fields = array();
					self::find_elementor_text_settings( $settings, '', array(), $new_fields, 0 );

					if ( ! empty( $new_fields ) ) {
						if ( ! isset( $found_items[ $widget_type ] ) ) {
							$found_items[ $widget_type ] = array();
						}
						$found_items[ $widget_type ] = array_merge( $found_items[ $widget_type ], $new_fields );
					}
				}

				if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
					$scan_recursive( $element['elements'], $depth + 1 );
				}
			}
		};

		$scan_recursive( $elements, 0 );

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
	 *
	 * @param array  $settings
	 * @param string $prefix
	 * @param array  $existing_fields
	 * @param array  $new_fields
	 * @param int    $depth
	 */
	private static function find_elementor_text_settings( $settings, $prefix, $existing_fields, &$new_fields, $depth = 0 ) {
		if ( ! is_array( $settings ) || empty( $settings ) || $depth > 15 ) {
			return;
		}

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
				self::find_elementor_text_settings( $val, $path, $existing_fields, $new_fields, $depth + 1 );
			}
		}
	}
}
