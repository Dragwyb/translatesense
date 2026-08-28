<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_REST_Server;
use WP_REST_Request;
use WP_Error;
use TranslateSense\Includes\Content_Parser\Content_Parser;
use TranslateSense\Includes\Xml_Engine\Xml_Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rest_Api {

	const NAMESPACE = 'translatesense/v1';

	/**
	 * Initialize REST routes.
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Register routes.
	 */
	public static function register_routes() {
		// 1. Scan and get widgets support status (Step 1.4 #1 & #2)
		register_rest_route(
			self::NAMESPACE,
			'/widgets',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_widgets_status' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permissions' ),
			)
		);

		// 2. Read XML configuration (supports ?builder=gutenberg/elementor/divi/classic)
		register_rest_route(
			self::NAMESPACE,
			'/xml-config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_xml_config' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permissions' ),
			)
		);

		// 3. Save XML configuration (supports builder parameter)
		register_rest_route(
			self::NAMESPACE,
			'/xml-config',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'save_xml_config' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permissions' ),
			)
		);

		// 3.1 Live XML Config Generation from Editor State (finding 'Translate This Content')
		register_rest_route(
			self::NAMESPACE,
			'/generate-config',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'generate_config_from_content' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 3.2 Open or create drafting mapping sandbox post
		register_rest_route(
			self::NAMESPACE,
			'/open-mapping-sandbox',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'open_mapping_sandbox' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 3.3 Gutenberg Block Config endpoint (reads translatesense_all_xml option)
		register_rest_route(
			self::NAMESPACE,
			'/gutenberg-config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_gutenberg_config' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 3.4 Specific Editor XML Config endpoint (accepts editor excluding all)
		register_rest_route(
			self::NAMESPACE,
			'/editor-xml-config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_editor_xml_config' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 3.5 Page Content Retrieval endpoint (accesses content, metafield, title, _elementor_data)
		register_rest_route(
			self::NAMESPACE,
			'/get-page-content',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_page_content' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 4. Get Plugin Settings & Languages
		register_rest_route(
			self::NAMESPACE,
			'/settings',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_settings' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permissions' ),
			)
		);

		// 5. Update Plugin Settings
		register_rest_route(
			self::NAMESPACE,
			'/settings',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'update_settings' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permissions' ),
			)
		);

		// 6. Extract strings from content/post against XML rules
		register_rest_route(
			self::NAMESPACE,
			'/extract-strings',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'extract_strings' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 7. Translate batch of strings (Step 3 & Step 4)
		register_rest_route(
			self::NAMESPACE,
			'/translate-batch',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'translate_batch' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 8. Translate single post (used by Bulk Translate & Editor)
		register_rest_route(
			self::NAMESPACE,
			'/translate-post',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'translate_post' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);
	}

	/**
	 * Check admin capability.
	 */
	public static function check_admin_permissions() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Check edit posts capability.
	 */
	public static function check_edit_permissions() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Get widgets status endpoint.
	 */
	public static function get_widgets_status( WP_REST_Request $request ) {
		$rules    = Xml_Engine::get_all_rules();
		$response = array(
			'gutenberg' => self::get_gutenberg_widgets_list( $rules['gutenberg'] ),
			'elementor' => self::get_elementor_widgets_list( $rules['elementor'] ),
			'divi'      => self::get_divi_widgets_list( $rules['divi'] ),
			'classic'   => self::get_classic_widgets_list( $rules['custom_fields'] ),
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Scan registered Gutenberg blocks and match with rules.
	 */
	/**
	 * Scan registered Gutenberg blocks and match with rules.
	 */
	private static function get_gutenberg_widgets_list( $rules ) {
		$standard_blocks = array(
			'core/paragraph'  => array(
				'title'    => 'Paragraph',
				'category' => 'core',
			),
			'core/heading'    => array(
				'title'    => 'Heading',
				'category' => 'core',
			),
			'core/button'     => array(
				'title'    => 'Button',
				'category' => 'core',
			),
			'core/list-item'  => array(
				'title'    => 'List Item',
				'category' => 'core',
			),
			'core/quote'      => array(
				'title'    => 'Quote',
				'category' => 'core',
			),
			'core/pullquote'  => array(
				'title'    => 'Pullquote',
				'category' => 'core',
			),
			'core/cover'      => array(
				'title'    => 'Cover',
				'category' => 'core',
			),
			'core/image'      => array(
				'title'    => 'Image',
				'category' => 'core',
			),
			'core/media-text' => array(
				'title'    => 'Media & Text',
				'category' => 'core',
			),
			'core/columns'    => array(
				'title'    => 'Columns',
				'category' => 'core',
			),
			'core/group'      => array(
				'title'    => 'Group',
				'category' => 'core',
			),
			'core/table'      => array(
				'title'    => 'Table',
				'category' => 'core',
			),
			'core/code'       => array(
				'title'    => 'Code',
				'category' => 'core',
			),
		);

		// Merge all blocks present in rules (from core-config.xml or custom)
		foreach ( $rules as $block_name => $block_data ) {
			if ( ! isset( $standard_blocks[ $block_name ] ) ) {
				$parts                          = explode( '/', $block_name );
				$cat                            = count( $parts ) > 1 ? $parts[0] : 'custom';
				$title                          = ucwords( str_replace( array( '-', '_' ), ' ', count( $parts ) > 1 ? $parts[1] : $block_name ) );
				$standard_blocks[ $block_name ] = array(
					'title'    => $title,
					'category' => $cat,
				);
			}
		}

		// Merge registered server blocks if WP_Block_Type_Registry is available
		if ( class_exists( '\WP_Block_Type_Registry' ) ) {
			$registered = \WP_Block_Type_Registry::get_instance()->get_all_registered();
			foreach ( $registered as $name => $type ) {
				if ( ! isset( $standard_blocks[ $name ] ) ) {
					$standard_blocks[ $name ] = array(
						'title'    => $type->title ? $type->title : $name,
						'category' => $type->category ? $type->category : 'widgets',
					);
				}
			}
		}

		$result = array();
		foreach ( $standard_blocks as $name => $info ) {
			$is_supported = isset( $rules[ $name ] );
			$source       = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$keys         = $is_supported ? $rules[ $name ]['keys'] : array();

			$result[] = array(
				'id'          => $name,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported',
				'source'      => $source,
				'field_count' => count( $keys ),
				'fields'      => $keys,
				'xml_snippet' => Xml_Engine::get_widget_xml_snippet( 'gutenberg', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan registered Elementor widgets and match with rules.
	 */
	private static function get_elementor_widgets_list( $rules ) {
		$standard_widgets = array(
			'heading'        => array(
				'title'    => 'Heading',
				'category' => 'basic',
			),
			'text-editor'    => array(
				'title'    => 'Text Editor',
				'category' => 'basic',
			),
			'button'         => array(
				'title'    => 'Button',
				'category' => 'basic',
			),
			'icon-box'       => array(
				'title'    => 'Icon Box',
				'category' => 'general',
			),
			'image-box'      => array(
				'title'    => 'Image Box',
				'category' => 'general',
			),
			'call-to-action' => array(
				'title'    => 'Call to Action',
				'category' => 'general',
			),
			'testimonial'    => array(
				'title'    => 'Testimonial',
				'category' => 'general',
			),
			'alert'          => array(
				'title'    => 'Alert Box',
				'category' => 'general',
			),
			'counter'        => array(
				'title'    => 'Counter',
				'category' => 'general',
			),
			'progress'       => array(
				'title'    => 'Progress Bar',
				'category' => 'general',
			),
			'tabs'           => array(
				'title'    => 'Tabs',
				'category' => 'general',
			),
			'accordion'      => array(
				'title'    => 'Accordion',
				'category' => 'general',
			),
			'toggle'         => array(
				'title'    => 'Toggle',
				'category' => 'general',
			),
		);

		// Merge any widgets present in rules
		foreach ( $rules as $widget_name => $widget_data ) {
			if ( ! isset( $standard_widgets[ $widget_name ] ) ) {
				$standard_widgets[ $widget_name ] = array(
					'title'    => ucwords( str_replace( array( '-', '_' ), ' ', $widget_name ) ),
					'category' => 'general',
				);
			}
		}

		// If Elementor is active and loaded
		if ( did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' ) ) {
			$widgets_mgr = \Elementor\Plugin::instance()->widgets_manager;
			if ( $widgets_mgr ) {
				$elementor_registered = $widgets_mgr->get_widget_types();
				foreach ( $elementor_registered as $name => $widget_obj ) {
					if ( ! isset( $standard_widgets[ $name ] ) ) {
						$standard_widgets[ $name ] = array(
							'title'    => $widget_obj->get_title(),
							'category' => method_exists( $widget_obj, 'get_categories' ) ? implode( ', ', $widget_obj->get_categories() ) : 'general',
						);
					}
				}
			}
		}

		$result = array();
		foreach ( $standard_widgets as $name => $info ) {
			$is_supported = isset( $rules[ $name ] );
			$source       = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$fields       = $is_supported ? $rules[ $name ]['fields'] : array();

			$result[] = array(
				'id'          => $name,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported',
				'source'      => $source,
				'field_count' => count( $fields ),
				'fields'      => $fields,
				'xml_snippet' => Xml_Engine::get_widget_xml_snippet( 'elementor', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan Divi modules and match with rules.
	 */
	private static function get_divi_widgets_list( $rules ) {
		$standard_modules = array(
			'et_pb_text'   => array(
				'title'    => 'Divi Text',
				'category' => 'content',
			),
			'et_pb_header' => array(
				'title'    => 'Divi Fullwidth Header',
				'category' => 'header',
			),
			'et_pb_blurb'  => array(
				'title'    => 'Divi Blurb',
				'category' => 'content',
			),
			'et_pb_cta'    => array(
				'title'    => 'Divi Call To Action',
				'category' => 'content',
			),
			'et_pb_button' => array(
				'title'    => 'Divi Button',
				'category' => 'content',
			),
		);

		// Merge any modules present in rules
		foreach ( $rules as $module_name => $module_data ) {
			if ( ! isset( $standard_modules[ $module_name ] ) ) {
				$standard_modules[ $module_name ] = array(
					'title'    => ucwords( str_replace( array( 'et_pb_', '-', '_' ), ' ', $module_name ) ),
					'category' => 'content',
				);
			}
		}

		$result = array();
		foreach ( $standard_modules as $name => $info ) {
			$is_supported = isset( $rules[ $name ] );
			$source       = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$fields       = $is_supported ? $rules[ $name ]['fields'] : array();

			$result[] = array(
				'id'          => $name,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported',
				'source'      => $source,
				'field_count' => count( $fields ),
				'fields'      => $fields,
				'xml_snippet' => Xml_Engine::get_widget_xml_snippet( 'divi', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan Classic & Custom fields list.
	 */
	private static function get_classic_widgets_list( $rules ) {
		$fields = array(
			'post_title'            => array(
				'title'    => 'Post Title',
				'category' => 'standard',
			),
			'post_content'          => array(
				'title'    => 'Post Body (Classic Editor)',
				'category' => 'standard',
			),
			'post_excerpt'          => array(
				'title'    => 'Post Excerpt',
				'category' => 'standard',
			),
			'_yoast_wpseo_title'    => array(
				'title'    => 'Yoast SEO Title',
				'category' => 'seo',
			),
			'_yoast_wpseo_metadesc' => array(
				'title'    => 'Yoast Meta Description',
				'category' => 'seo',
			),
			'rank_math_title'       => array(
				'title'    => 'Rank Math Title',
				'category' => 'seo',
			),
			'rank_math_description' => array(
				'title'    => 'Rank Math Description',
				'category' => 'seo',
			),
		);

		// Merge any custom fields present in rules
		foreach ( $rules as $field_name => $field_data ) {
			if ( ! isset( $fields[ $field_name ] ) ) {
				$fields[ $field_name ] = array(
					'title'    => ucwords( str_replace( array( '-', '_' ), ' ', $field_name ) ),
					'category' => 'custom',
				);
			}
		}

		$all_engine_rules = Xml_Engine::get_all_rules( 'all' );
		$no_translate_cfs = $all_engine_rules['custom_fields_no_translate'] ?? array();

		$result = array();
		foreach ( $fields as $key => $info ) {
			$is_no_translate = isset( $no_translate_cfs[ $key ] );
			$is_supported    = ! $is_no_translate && ( isset( $rules[ $key ] ) || in_array( $key, array( 'post_title', 'post_content', 'post_excerpt' ), true ) );
			$field_count     = $is_supported ? 1 : 0;
			$field_data      = $is_supported ? array(
				$key => array(
					'name' => $key,
					'type' => 'text',
				),
			) : array();

			$result[] = array(
				'id'          => $key,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? 'supported' : 'unsupported',
				'source'      => isset( $rules[ $key ] ) ? ( $rules[ $key ]['source'] ?? 'core' ) : 'core',
				'field_count' => $field_count,
				'fields'      => $field_data,
				'xml_snippet' => Xml_Engine::get_widget_xml_snippet( 'classic', $key ),
			);
		}

		return $result;
	}

	/**
	 * Get XML configuration strings (supports builder filter).
	 */
	public static function get_xml_config( WP_REST_Request $request ) {
		$builder = $request->get_param( 'builder' ) ? sanitize_key( $request->get_param( 'builder' ) ) : 'all';
		if ( 'core' === $builder ) {
			$builder = 'all';
		}

		$is_all = ( 'all' === $builder );

		$response = array(
			'builder'       => $builder,
			'custom_xml'    => Xml_Engine::get_config( $builder ),
			'gutenberg_xml' => Xml_Engine::get_config( 'gutenberg' ),
			'elementor_xml' => Xml_Engine::get_config( 'elementor' ),
			'divi_xml'      => Xml_Engine::get_config( 'divi' ),
			'classic_xml'   => Xml_Engine::get_config( 'classic' ),
			'rules'         => Xml_Engine::get_all_rules( $builder ),
			'all_rules'     => Xml_Engine::get_all_rules( 'all' ),
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Save custom XML configuration (supports builder and widget_id parameters).
	 */
	public static function save_xml_config( WP_REST_Request $request ) {
		$params  = $request->get_json_params();
		$builder = isset( $params['builder'] ) ? sanitize_key( $params['builder'] ) : 'all';
		if ( 'core' === $builder ) {
			$builder = 'all';
		}
		$custom_xml = $params['custom_xml'] ?? '';
		$widget_id  = isset( $params['widget_id'] ) ? sanitize_text_field( $params['widget_id'] ) : '';

		if ( ! empty( $widget_id ) ) {
			$saved = Xml_Engine::save_widget_xml_snippet( $builder, $widget_id, $custom_xml );
		} else {
			$saved = Xml_Engine::save_config( $builder, $custom_xml );
		}

		if ( is_wp_error( $saved ) ) {
			return new WP_Error( 'xml_save_failed', $saved->get_error_message(), array( 'status' => 400 ) );
		}

		return rest_ensure_response(
			array(
				'success'    => true,
				'builder'    => $builder,
				'widget_id'  => $widget_id,
				'message'    => sprintf( __( '%s XML configuration saved successfully.', 'translatesense' ), ucfirst( $builder ) ),
				'custom_xml' => Xml_Engine::get_config( $builder ),
				'rules'      => Xml_Engine::get_all_rules( $builder, true ),
				'all_rules'  => Xml_Engine::get_all_rules( 'all', true ),
			)
		);
	}

	/**
	 * Generate XML config from in-memory editor content containing "Translate This Content".
	 */
	public static function generate_config_from_content( WP_REST_Request $request ) {
		$params   = $request->get_json_params();
		$builder  = isset( $params['builder'] ) ? sanitize_key( $params['builder'] ) : 'gutenberg';
		$blocks   = $params['blocks'] ?? array();
		$elements = $params['elements'] ?? array();

		$detection = null;
		if ( 'gutenberg' === $builder && ! empty( $blocks ) ) {
			$detection = Detector::detect_from_gutenberg_blocks( $blocks );
		} elseif ( 'elementor' === $builder && ! empty( $elements ) ) {
			$detection = Detector::detect_from_elementor_data( $elements );
		}

		if ( ! $detection || empty( $detection['xml_snippet'] ) ) {
			return new WP_Error(
				'no_dummy_found',
				__( "No placeholder text 'Translate This Content' was found. Please add this text into the block/widget fields you wish to map.", 'translatesense' ),
				array( 'status' => 404 )
			);
		}

		return rest_ensure_response(
			array(
				'success'     => true,
				'builder'     => $builder,
				'xml_snippet' => $detection['xml_snippet'],
				'found_items' => $detection['found_items'],
				'message'     => __( 'XML configuration rule generated successfully!', 'translatesense' ),
			)
		);
	}

	/**
	 * Open or create a drafting mapping sandbox post for the selected builder.
	 */
	public static function open_mapping_sandbox( WP_REST_Request $request ) {
		$params  = $request->get_json_params();
		$builder = isset( $params['builder'] ) ? sanitize_key( $params['builder'] ) : 'gutenberg';

		$sandbox_id = Detector::get_or_create_config_post( $builder );
		$edit_url   = get_edit_post_link( $sandbox_id, 'raw' );

		// If Elementor builder requested
		if ( 'elementor' === $builder && class_exists( '\Elementor\Plugin' ) ) {
			update_post_meta( $sandbox_id, '_elementor_edit_mode', 'builder' );
			$edit_url = add_query_arg(
				array(
					'post'   => $sandbox_id,
					'action' => 'elementor',
				),
				admin_url( 'post.php' )
			);
		}

		return rest_ensure_response(
			array(
				'success'    => true,
				'post_id'    => $sandbox_id,
				'builder'    => $builder,
				'editor_url' => $edit_url,
			)
		);
	}

	/**
	 * Get Gutenberg block configuration rules parsed from database option table.
	 */
	public static function get_gutenberg_config( WP_REST_Request $request ) {
		$gutenberg_rules = Xml_Engine::get_all_rules( 'gutenberg' );

		return rest_ensure_response(
			array(
				'success'     => true,
				'block_rules' => $gutenberg_rules,
				'block_names' => array_keys( $gutenberg_rules ),
			)
		);
	}

	/**
	 * Get specific editor XML configuration and parsed rules.
	 * Accepts editor parameter (gutenberg, elementor, divi, classic) and excludes 'all'.
	 */
	public static function get_editor_xml_config( WP_REST_Request $request ) {
		$editor = sanitize_key( (string) ( $request->get_param( 'editor' ) ?: $request->get_param( 'builder' ) ?: '' ) );

		if ( empty( $editor ) || 'all' === $editor || ! in_array( $editor, Xml_Engine::BUILDERS, true ) ) {
			return new WP_Error(
				'invalid_editor',
				__( 'Invalid or missing editor parameter. Please specify a specific editor (gutenberg, elementor, divi, classic).', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$rules = Xml_Engine::get_all_rules( $editor );
		$xml   = Xml_Engine::get_config( $editor );

		return rest_ensure_response(
			array(
				'success'      => true,
				'editor'       => $editor,
				'editor_xml'   => $xml,
				'rules'        => $rules,
				'block_rules'  => ( 'gutenberg' === $editor ) ? $rules : array(),
				'widget_rules' => ( 'elementor' === $editor ) ? $rules : array(),
				'module_rules' => ( 'divi' === $editor ) ? $rules : array(),
				'field_rules'  => ( 'classic' === $editor ) ? $rules : array(),
			)
		);
	}

	/**
	 * Get comprehensive page content for translation, frontend hash generation, and replacement.
	 * Accesses content, title, excerpt, slug, meta fields, and _elementor_data post meta.
	 */
	public static function get_page_content( WP_REST_Request $request ) {
		$params = $request->get_params();

		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post_id',
				__( 'A valid post_id parameter is required.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$post        = get_post( $post_id );
		$editor_type = Editor_Integration::get_post_editor_type( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'post_not_found',
				__( 'Post not found.', 'translatesense' ),
				array( 'status' => 404 )
			);
		}

		if ( 'elementor' === $editor_type ) {
			// 1. Elementor Data
			$elementor_data = array();
			if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->documents ) ) {
				$elementor_doc = \Elementor\Plugin::$instance->documents->get( $post_id );
				if ( $elementor_doc && method_exists( $elementor_doc, 'get_elements_data' ) ) {
					$elementor_data     = $elementor_doc->get_elements_data();
					$post->post_content = $elementor_data;
				} else {
					$post->post_content = '';
				}
			}
		}

		// 2. All Custom Meta Fields
		$all_meta_raw = get_post_meta( $post_id );
		$meta_fields  = array();
		if ( is_array( $all_meta_raw ) ) {
			foreach ( $all_meta_raw as $k => $v ) {
				$val = ( is_array( $v ) && 1 === count( $v ) ) ? $v[0] : $v;
				if ( is_serialized( $val ) ) {
					$val = maybe_unserialize( $val );
				}
				$meta_fields[ $k ] = $val;
			}
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'title'   => $post->post_title,
				'content' => $post->post_content,
				'excerpt' => $post->post_excerpt,
				'slug'    => $post->post_name,
			)
		);
	}

	/**
	 * Get Settings endpoint.
	 */
	public static function get_settings( WP_REST_Request $request ) {
		global $wpdb;
		$settings = get_option( 'translatesense_settings', array() );
		if ( empty( $settings['enabled_providers'] ) ) {
			$settings['enabled_providers'] = array( 'chrome_ai', 'openai', 'gemini' );
		}
		if ( empty( $settings['provider'] ) ) {
			$settings['provider'] = 'openai';
		}
		$languages       = Polylang_Bridge::get_languages();
		$polylang_active = Polylang_Bridge::is_polylang_active();

		// Stats
		$table_translations = Hashing_Db::get_translations_table();
		$packages_count     = (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$wpdb->prefix}translatesense_packages" );
		$results_count      = (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$table_translations} WHERE translated_strings != '' AND translated_strings != '{}' AND translated_strings != '[]'" );

		return rest_ensure_response(
			array(
				'settings'        => $settings,
				'languages'       => $languages,
				'polylang_active' => $polylang_active,
				'active_builders' => Admin_Menu::get_active_builders(),
				'stats'           => array(
					'total_packages' => $packages_count,
					'cached_results' => $results_count,
				),
			)
		);
	}

	/**
	 * Update Settings endpoint.
	 */
	public static function update_settings( WP_REST_Request $request ) {
		$params = $request->get_json_params();

		$current = get_option( 'translatesense_settings', array() );
		$updated = wp_parse_args( $params, $current );

		update_option( 'translatesense_settings', $updated );

		return rest_ensure_response(
			array(
				'success'  => true,
				'message'  => __( 'Settings updated successfully.', 'translatesense' ),
				'settings' => $updated,
			)
		);
	}

	/**
	 * Extract translatable strings from post content / Elementor data / builders.
	 */
	public static function extract_strings( WP_REST_Request $request ) {
		$params  = $request->get_json_params();
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;

		if ( ! $post_id ) {
			return rest_ensure_response(
				array(
					'success' => false,
					'message' => __( 'Post ID is required.', 'translatesense' ),
				)
			);
		}

		$target_lang        = $params['target_lang'] ?? 'es';
		$target_editor_type = $params['builder'] ?? 'core';
		$source_editor_type = Editor_Integration::get_post_editor_type( $post_id );

		if ( $target_editor_type !== $source_editor_type ) {
			return rest_ensure_response(
				array(
					'success' => false,
					'message' => sprintf( __( 'Source editor type (%1$s) must be same as Current Post editor type (%2$s).', 'translatesense' ), $source_editor_type, $target_editor_type ),
				)
			);
		}

		$source_language = Polylang_Bridge::get_post_language( $post_id );
		$package_strings = Hashing_Db::get_post_package( $post_id, $source_language, $source_editor_type );

		if ( empty( $package_strings ) ) {
			$package_strings = Content_Parser::parse( '', $post_id, $source_language, $source_editor_type );
		}

		return rest_ensure_response( array( 'strings' => $package_strings ) );
	}

	/**
	 * Parse content (blocks or Elementor JSON or plain text) into translatable strings array.
	 * Maintained as backward-compatible delegation to Content_Parser::parse.
	 */
	public static function parse_content_for_strings( $content, $post_id = 0, $lang = '', $builder = '' ) {
		return Content_Parser::parse( $content, $post_id, $lang, $builder );
	}

	/**
	 * Translate a batch of strings endpoint.
	 */
	public static function translate_batch( WP_REST_Request $request ) {
		$params      = $request->get_json_params();
		$strings     = $params['strings'] ?? array();
		$source_lang = $params['source_lang'] ?? 'en';
		$target_lang = $params['target_lang'] ?? 'es';
		$post_id     = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$provider    = $params['provider'] ?? null;

		$custom_opts = array();
		if ( $provider ) {
			$custom_opts['provider'] = $provider;
		}

		$results = Translator::translate_batch(
			$strings,
			$source_lang,
			$target_lang,
			array(),
			$post_id,
			$custom_opts
		);

		return rest_ensure_response( array( 'results' => $results ) );
	}

	/**
	 * Translate complete post endpoint (Step 4.1 & 4.2).
	 */
	public static function translate_post( WP_REST_Request $request ) {
		$params      = $request->get_json_params();
		$post_id     = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$target_lang = $params['target_lang'] ?? '';
		$provider    = $params['provider'] ?? null;

		if ( ! $post_id || ! $target_lang ) {
			return new WP_Error( 'invalid_params', __( 'Post ID and Target Language are required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$source_post = get_post( $post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Post not found.', 'translatesense' ), array( 'status' => 404 ) );
		}

		$source_lang = Polylang_Bridge::get_post_language( $post_id );
		$custom_opts = $provider ? array( 'provider' => $provider ) : array();

		// 1. Translate Title
		$title_res        = Translator::translate_string(
			$source_post->post_title,
			$source_lang,
			$target_lang,
			'post_title',
			$post_id,
			$custom_opts
		);
		$translated_title = $title_res['translated'];

		// 2. Check if Elementor
		$is_elementor       = ( 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ) );
		$new_elementor_data = null;
		$translated_content = $source_post->post_content;

		if ( $is_elementor ) {
			$elementor_data_raw = get_post_meta( $post_id, '_elementor_data', true );
			$elements           = is_string( $elementor_data_raw ) ? json_decode( $elementor_data_raw, true ) : $elementor_data_raw;
			if ( is_array( $elements ) ) {
				$rules = Xml_Engine::get_all_rules();
				self::translate_elementor_elements_tree( $elements, $rules['elementor'], $source_lang, $target_lang, $post_id, $custom_opts );
				$new_elementor_data = $elements;
			}
		} elseif ( function_exists( 'has_blocks' ) && has_blocks( $source_post->post_content ) ) {
			// Gutenberg Blocks
			$blocks = parse_blocks( $source_post->post_content );
			$rules  = Xml_Engine::get_all_rules();
			self::translate_gutenberg_blocks_tree( $blocks, $rules['gutenberg'], $source_lang, $target_lang, $post_id, $custom_opts );
			$translated_content = serialize_blocks( $blocks );
		} else {
			// Classic post content
			$content_res        = Translator::translate_string(
				$source_post->post_content,
				$source_lang,
				$target_lang,
				'post_content',
				$post_id,
				$custom_opts
			);
			$translated_content = $content_res['translated'];
		}

		// 3. Create or update Polylang translated post
		$created_post_id = Polylang_Bridge::create_or_update_translated_post(
			$post_id,
			$target_lang,
			$translated_title,
			$translated_content,
			$new_elementor_data
		);

		if ( is_wp_error( $created_post_id ) ) {
			return $created_post_id;
		}

		return rest_ensure_response(
			array(
				'success'          => true,
				'source_post_id'   => $post_id,
				'target_post_id'   => $created_post_id,
				'target_language'  => $target_lang,
				'translated_title' => $translated_title,
				'edit_url'         => get_edit_post_link( $created_post_id, 'raw' ),
			)
		);
	}

	/**
	 * Translate Gutenberg blocks tree.
	 */
	private static function translate_gutenberg_blocks_tree( &$blocks, $rules, $source_lang, $target_lang, $post_id, $custom_opts ) {
		foreach ( $blocks as &$block ) {
			$name = $block['blockName'];
			if ( empty( $name ) ) {
				continue;
			}

			if ( isset( $rules[ $name ] ) ) {
				$keys = $rules[ $name ]['keys'];
				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $block['attrs'][ $k_name ] ) && is_string( $block['attrs'][ $k_name ] ) && '' !== trim( $block['attrs'][ $k_name ] ) ) {
						$res                       = Translator::translate_string(
							$block['attrs'][ $k_name ],
							$source_lang,
							$target_lang,
							$name,
							$post_id,
							$custom_opts
						);
						$block['attrs'][ $k_name ] = $res['translated'];
					}
				}
			}

			// Translate paragraph text if present
			if ( 'core/paragraph' === $name && ! empty( $block['innerHTML'] ) ) {
				$plain = strip_tags( $block['innerHTML'] );
				if ( ! empty( trim( $plain ) ) ) {
					$res                = Translator::translate_string(
						$plain,
						$source_lang,
						$target_lang,
						'core/paragraph',
						$post_id,
						$custom_opts
					);
					$block['innerHTML'] = '<p>' . esc_html( $res['translated'] ) . '</p>';
					if ( isset( $block['innerContent'][0] ) ) {
						$block['innerContent'][0] = $block['innerHTML'];
					}
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::translate_gutenberg_blocks_tree( $block['innerBlocks'], $rules, $source_lang, $target_lang, $post_id, $custom_opts );
			}
		}
	}

	/**
	 * Translate Elementor elements tree.
	 */
	private static function translate_elementor_elements_tree( &$elements, $rules, $source_lang, $target_lang, $post_id, $custom_opts ) {
		foreach ( $elements as &$element ) {
			$el_type     = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? '';

			if ( 'widget' === $el_type && ! empty( $widget_type ) && isset( $rules[ $widget_type ] ) ) {
				$fields = $rules[ $widget_type ]['fields'];
				foreach ( $fields as $path => $f_info ) {
					self::translate_nested_elementor_setting( $element['settings'], $path, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts );
				}
			}

			if ( ! empty( $element['elements'] ) ) {
				self::translate_elementor_elements_tree( $element['elements'], $rules, $source_lang, $target_lang, $post_id, $custom_opts );
			}
		}
	}

	/**
	 * Helper to translate and set nested setting in Elementor widget.
	 */
	private static function translate_nested_elementor_setting( &$settings, $path, $widget_type, $source_lang, $target_lang, $post_id, $custom_opts ) {
		$keys = explode( '>', $path );
		$ref  = &$settings;

		foreach ( $keys as $k ) {
			if ( ! isset( $ref[ $k ] ) ) {
				return;
			}
			$ref = &$ref[ $k ];
		}

		if ( is_string( $ref ) && '' !== trim( $ref ) ) {
			$res = Translator::translate_string(
				$ref,
				$source_lang,
				$target_lang,
				$widget_type,
				$post_id,
				$custom_opts
			);
			$ref = $res['translated'];
		}
	}
}
