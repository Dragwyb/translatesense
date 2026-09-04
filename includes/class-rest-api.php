<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_REST_Server;
use WP_REST_Request;
use WP_Error;
use TranslateSense\Includes\Content_Parser\Content_Parser;
use TranslateSense\Includes\Xml_Engine\Xml_Engine;
use TranslateSense\Includes\Translate\Translate;

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

		// 2. Read XML configuration (supports ?builder=gutenberg/elementor/classic)
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

		// 9. Bulk translation batch start endpoint
		register_rest_route(
			self::NAMESPACE,
			'/bulk-start',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_start' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 10. Bulk translation batch status polling endpoint
		register_rest_route(
			self::NAMESPACE,
			'/bulk-status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'bulk_status' ),
				'permission_callback' => array( __CLASS__, 'check_edit_permissions' ),
			)
		);

		// 11. Bulk translation update job endpoint (used by Chrome Local AI frontend)
		register_rest_route(
			self::NAMESPACE,
			'/bulk-update-job',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_update_job' ),
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
		$standard_blocks = array();

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
			$is_supported       = isset( $rules[ $name ] );
			$source             = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$keys               = $is_supported ? ( $rules[ $name ]['attributes'] ?? array() ) : array();
			$no_translate       = $is_supported ? ( $rules[ $name ]['no_translate'] ?? array() ) : array();
			$field_count        = count( $keys );
			$no_translate_count = count( $no_translate );
			$status             = ( $field_count > 0 || $no_translate_count > 0 ) ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported';

			$result[] = array(
				'id'                 => $name,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => $status,
				'source'             => $source,
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $keys,
				'xml_snippet'        => Xml_Engine::get_widget_xml_snippet( 'gutenberg', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan registered Elementor widgets and match with rules.
	 */
	private static function get_elementor_widgets_list( $rules ) {
		$standard_widgets = array();

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
			$is_supported       = isset( $rules[ $name ] );
			$source             = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$fields             = $is_supported ? ( $rules[ $name ]['attributes'] ?? array() ) : array();
			$no_translate       = $is_supported ? ( $rules[ $name ]['no_translate'] ?? array() ) : array();
			$field_count        = count( $fields );
			$no_translate_count = count( $no_translate );
			$status             = ( $field_count > 0 || $no_translate_count > 0 ) ? ( 'supported' ) : 'unsupported';

			$result[] = array(
				'id'                 => $name,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => $status,
				'source'             => $source,
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $fields,
				'xml_snippet'        => Xml_Engine::get_widget_xml_snippet( 'elementor', $name ),
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
			$is_no_translate    = isset( $no_translate_cfs[ $key ] );
			$is_supported       = ! $is_no_translate && ( isset( $rules[ $key ] ) || in_array( $key, array( 'post_title', 'post_content', 'post_excerpt' ), true ) );
			$field_count        = $is_supported ? 1 : 0;
			$no_translate_count = $is_no_translate ? 1 : 0;
			$field_data         = $is_supported ? array(
				$key => array(
					'name' => $key,
					'type' => 'text',
				),
			) : array();

			$result[] = array(
				'id'                 => $key,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => ( $is_supported || $is_no_translate ) ? 'supported' : 'unsupported',
				'source'             => isset( $rules[ $key ] ) ? ( $rules[ $key ]['source'] ?? 'core' ) : 'core',
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $field_data,
				'xml_snippet'        => Xml_Engine::get_widget_xml_snippet( 'classic', $key ),
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
				/* translators: %s: Page builder name (e.g. Gutenberg, Elementor) */
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
	 * Accepts editor parameter (gutenberg, elementor, classic) and excludes 'all'.
	 */
	public static function get_editor_xml_config( WP_REST_Request $request ) {
		$editor = sanitize_key( (string) ( $request->get_param( 'editor' ) ?: $request->get_param( 'builder' ) ?: '' ) );

		if ( empty( $editor ) || 'all' === $editor || ! in_array( $editor, Xml_Engine::BUILDERS, true ) ) {
			return new WP_Error(
				'invalid_editor',
				__( 'Invalid or missing editor parameter. Please specify a specific editor (gutenberg, elementor, classic).', 'translatesense' ),
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
		$defaults = array(
			'provider'          => '',
			'openai_api_key'    => '',
			'openai_model'      => 'gpt-4o-mini',
			'gemini_api_key'    => '',
			'gemini_model'      => 'gemini-1.5-flash',
			'enabled_providers' => array( 'chrome_ai', 'openai', 'gemini' ),
			'batch_size'        => 25,
			'response_timeout'  => 30,
			'max_tokens'        => 4096,
			'temperature'       => 0.2,
			'custom_prompt'     => '',
			'default_prompt'    => \TranslateSense\Includes\Translate\Translate::DEFAULT_PROMPT,
		);
		$settings = wp_parse_args( $settings, $defaults );
		if ( empty( $settings['default_prompt'] ) ) {
			$settings['default_prompt'] = \TranslateSense\Includes\Translate\Translate::DEFAULT_PROMPT;
		}

		$languages       = Polylang_Bridge::get_languages();
		$polylang_active = Polylang_Bridge::is_polylang_active();

		// Stats
		$table_translations = Hashing_Db::get_translations_table();
		$packages_count     = (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$wpdb->prefix}translatesense_packages" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$results_count      = (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$table_translations} WHERE translated_string != ''" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

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

		$source_editor_type = Editor_Integration::get_post_editor_type( $post_id );
		$target_editor_type = ! empty( $params['builder'] ) ? sanitize_key( $params['builder'] ) : $source_editor_type;

		if ( 'core' === $target_editor_type ) {
			$target_editor_type = 'gutenberg';
		}
		$normalized_source = ( 'core' === $source_editor_type ) ? 'gutenberg' : $source_editor_type;

		if ( $target_editor_type !== $normalized_source && $target_editor_type !== $source_editor_type ) {
			return rest_ensure_response(
				array(
					'success'     => false,
					'editor_type' => $source_editor_type,
					/* translators: 1: Source editor type, 2: Target editor type */
					'message'     => sprintf( __( 'Source editor type (%1$s) must be same as Current Post editor type (%2$s).', 'translatesense' ), $source_editor_type, $target_editor_type ),
				)
			);
		}

		$source_language = Polylang_Bridge::get_post_language( $post_id );
		$package_strings = Hashing_Db::get_post_package( $post_id, $source_language, $source_editor_type );

		if ( empty( $package_strings ) ) {
			$package_strings = Content_Parser::parse( '', $post_id, $source_language, $source_editor_type );
		}

		$post_title = get_the_title( $post_id );

		if ( ! empty( $post_title ) ) {
			$post_title_hash   = Hashing_Db::generate_hash( 'post_title', $post_title );
			$package_strings[] = array(
				'hash'   => $post_title_hash,
				'name'   => 'post_title',
				'key'    => 'Post/Page Title',
				'source' => $post_title,
				'value'  => $post_title,
			);
		}

		$post_slug = get_post_field( 'post_name', $post_id );

		if ( ! empty( $post_slug ) ) {
			$post_slug_hash    = Hashing_Db::generate_hash( 'post_name', $post_slug );
			$package_strings[] = array(
				'hash'   => $post_slug_hash,
				'name'   => 'post_name',
				'key'    => 'Post/Page Slug',
				'source' => $post_slug,
				'value'  => $post_slug,
			);
		}

		$post_excerpt = get_post_field( 'post_excerpt', $post_id );

		if ( ! empty( $post_excerpt ) ) {
			$post_excerpt_hash = Hashing_Db::generate_hash( 'post_excerpt', $post_excerpt );
			$package_strings[] = array(
				'hash'   => $post_excerpt_hash,
				'name'   => 'post_excerpt',
				'key'    => 'Post/Page Excerpt',
				'source' => $post_excerpt,
				'value'  => $post_excerpt,
			);
		}

		return rest_ensure_response(
			array(
				'success'     => true,
				'editor_type' => $source_editor_type,
				'strings'     => $package_strings,
			)
		);
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

		$results = Translate::translate_batch(
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
		$params                 = $request->get_json_params();
		$post_id                = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$target_lang            = $params['target_lang'] ?? '';
		$provider               = $params['provider'] ?? '';
		$in_memory_translations = $params['in_memory_translations'] ?? array();

		if ( ! $post_id || empty( $target_lang ) ) {
			return new WP_Error( 'invalid_params', __( 'Post ID and Target Language are required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$result = Translate::translate_post( $post_id, (string) $target_lang, (string) $provider, (array) $in_memory_translations );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Start Bulk Translation Batch Endpoint.
	 */
	public static function bulk_start( WP_REST_Request $request ) {
		$params           = $request->get_json_params();
		$post_ids         = $params['post_ids'] ?? array();
		$target_languages = $params['target_languages'] ?? array();
		$provider         = $params['provider'] ?? 'openai';

		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return new WP_Error( 'invalid_posts', __( 'Post IDs array is required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		if ( empty( $target_languages ) || ! is_array( $target_languages ) ) {
			return new WP_Error( 'invalid_languages', __( 'Target languages array is required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$result = Bulk_Process::create_batch( $post_ids, $target_languages, (string) $provider );

		return rest_ensure_response( $result );
	}

	/**
	 * Bulk Translation Status Polling Endpoint (every 5 seconds).
	 */
	public static function bulk_status( WP_REST_Request $request ) {
		$batch_id = sanitize_text_field( (string) $request->get_param( 'batch_id' ) );
		$post_id  = (int) $request->get_param( 'post_id' );

		$status = Bulk_Process::get_batch_status( $batch_id, $post_id );

		return rest_ensure_response( $status );
	}

	/**
	 * Bulk Translation Update Job Endpoint (used by Chrome Local AI frontend).
	 */
	public static function bulk_update_job( WP_REST_Request $request ) {
		$params  = $request->get_json_params();
		$job_id  = isset( $params['job_id'] ) ? (int) $params['job_id'] : 0;
		$updates = $params['data'] ?? array();

		if ( ! $job_id || empty( $updates ) || ! is_array( $updates ) ) {
			return new WP_Error( 'invalid_params', __( 'Job ID and update data are required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		// Filter allowed update columns
		$allowed = array(
			'status',
			'progress_status',
			'total_strings',
			'completed_strings',
			'sent_ai_request_data',
			'received_ai_request_data',
			'error_message',
			'target_post_id',
		);

		$clean_data = array();
		foreach ( $allowed as $col ) {
			if ( isset( $updates[ $col ] ) ) {
				$val = $updates[ $col ];
				if ( is_array( $val ) ) {
					$clean_data[ $col ] = wp_json_encode( $val );
				} else {
					$clean_data[ $col ] = $val;
				}
			}
		}

		$updated = Bulk_Process::update_job( $job_id, $clean_data );

		return rest_ensure_response(
			array(
				'success' => $updated,
				'job_id'  => $job_id,
			)
		);
	}
}
