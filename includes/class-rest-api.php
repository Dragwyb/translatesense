<?php
/**
 * REST API Endpoints for TranslateSense
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TranslateSense_Rest_Api {

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
		$rules = TranslateSense_Xml_Engine::get_all_rules();
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
			'core/paragraph'   => array( 'title' => 'Paragraph', 'category' => 'core' ),
			'core/heading'     => array( 'title' => 'Heading', 'category' => 'core' ),
			'core/button'      => array( 'title' => 'Button', 'category' => 'core' ),
			'core/list-item'   => array( 'title' => 'List Item', 'category' => 'core' ),
			'core/quote'       => array( 'title' => 'Quote', 'category' => 'core' ),
			'core/pullquote'   => array( 'title' => 'Pullquote', 'category' => 'core' ),
			'core/cover'       => array( 'title' => 'Cover', 'category' => 'core' ),
			'core/image'       => array( 'title' => 'Image', 'category' => 'core' ),
			'core/media-text'  => array( 'title' => 'Media & Text', 'category' => 'core' ),
			'core/columns'     => array( 'title' => 'Columns', 'category' => 'core' ),
			'core/group'       => array( 'title' => 'Group', 'category' => 'core' ),
			'core/table'       => array( 'title' => 'Table', 'category' => 'core' ),
			'core/code'        => array( 'title' => 'Code', 'category' => 'core' ),
		);

		// Merge all blocks present in rules (from core-config.xml or custom)
		foreach ( $rules as $block_name => $block_data ) {
			if ( ! isset( $standard_blocks[ $block_name ] ) ) {
				$parts = explode( '/', $block_name );
				$cat = count( $parts ) > 1 ? $parts[0] : 'custom';
				$title = ucwords( str_replace( array( '-', '_' ), ' ', count( $parts ) > 1 ? $parts[1] : $block_name ) );
				$standard_blocks[ $block_name ] = array(
					'title'    => $title,
					'category' => $cat,
				);
			}
		}

		// Merge registered server blocks if WP_Block_Type_Registry is available
		if ( class_exists( 'WP_Block_Type_Registry' ) ) {
			$registered = WP_Block_Type_Registry::get_instance()->get_all_registered();
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
			$source = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$keys = $is_supported ? $rules[ $name ]['keys'] : array();

			$result[] = array(
				'id'          => $name,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported',
				'source'      => $source,
				'field_count' => count( $keys ),
				'fields'      => $keys,
				'xml_snippet' => TranslateSense_Xml_Engine::get_widget_xml_snippet( 'gutenberg', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan registered Elementor widgets and match with rules.
	 */
	private static function get_elementor_widgets_list( $rules ) {
		$standard_widgets = array(
			'heading'        => array( 'title' => 'Heading', 'category' => 'basic' ),
			'text-editor'    => array( 'title' => 'Text Editor', 'category' => 'basic' ),
			'button'         => array( 'title' => 'Button', 'category' => 'basic' ),
			'icon-box'       => array( 'title' => 'Icon Box', 'category' => 'general' ),
			'image-box'      => array( 'title' => 'Image Box', 'category' => 'general' ),
			'call-to-action' => array( 'title' => 'Call to Action', 'category' => 'general' ),
			'testimonial'    => array( 'title' => 'Testimonial', 'category' => 'general' ),
			'alert'          => array( 'title' => 'Alert Box', 'category' => 'general' ),
			'counter'        => array( 'title' => 'Counter', 'category' => 'general' ),
			'progress'       => array( 'title' => 'Progress Bar', 'category' => 'general' ),
			'tabs'           => array( 'title' => 'Tabs', 'category' => 'general' ),
			'accordion'      => array( 'title' => 'Accordion', 'category' => 'general' ),
			'toggle'         => array( 'title' => 'Toggle', 'category' => 'general' ),
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
			$source = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$fields = $is_supported ? $rules[ $name ]['fields'] : array();

			$result[] = array(
				'id'          => $name,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported',
				'source'      => $source,
				'field_count' => count( $fields ),
				'fields'      => $fields,
				'xml_snippet' => TranslateSense_Xml_Engine::get_widget_xml_snippet( 'elementor', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan Divi modules and match with rules.
	 */
	private static function get_divi_widgets_list( $rules ) {
		$standard_modules = array(
			'et_pb_text'   => array( 'title' => 'Divi Text', 'category' => 'content' ),
			'et_pb_header' => array( 'title' => 'Divi Fullwidth Header', 'category' => 'header' ),
			'et_pb_blurb'  => array( 'title' => 'Divi Blurb', 'category' => 'content' ),
			'et_pb_cta'    => array( 'title' => 'Divi Call To Action', 'category' => 'content' ),
			'et_pb_button' => array( 'title' => 'Divi Button', 'category' => 'content' ),
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
			$source = $is_supported ? ( $rules[ $name ]['source'] ?? 'core' ) : 'none';
			$fields = $is_supported ? $rules[ $name ]['fields'] : array();

			$result[] = array(
				'id'          => $name,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? ( 'custom' === $source ? 'custom' : 'supported' ) : 'unsupported',
				'source'      => $source,
				'field_count' => count( $fields ),
				'fields'      => $fields,
				'xml_snippet' => TranslateSense_Xml_Engine::get_widget_xml_snippet( 'divi', $name ),
			);
		}

		return $result;
	}

	/**
	 * Scan Classic & Custom fields list.
	 */
	private static function get_classic_widgets_list( $rules ) {
		$fields = array(
			'post_title'              => array( 'title' => 'Post Title', 'category' => 'standard' ),
			'post_content'            => array( 'title' => 'Post Body (Classic Editor)', 'category' => 'standard' ),
			'post_excerpt'            => array( 'title' => 'Post Excerpt', 'category' => 'standard' ),
			'_yoast_wpseo_title'      => array( 'title' => 'Yoast SEO Title', 'category' => 'seo' ),
			'_yoast_wpseo_metadesc'   => array( 'title' => 'Yoast Meta Description', 'category' => 'seo' ),
			'rank_math_title'         => array( 'title' => 'Rank Math Title', 'category' => 'seo' ),
			'rank_math_description'   => array( 'title' => 'Rank Math Description', 'category' => 'seo' ),
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

		$result = array();
		foreach ( $fields as $key => $info ) {
			$is_supported = isset( $rules[ $key ] ) || in_array( $key, array( 'post_title', 'post_content', 'post_excerpt' ), true );
			$result[] = array(
				'id'          => $key,
				'name'        => $info['title'],
				'category'    => $info['category'],
				'status'      => $is_supported ? 'supported' : 'unsupported',
				'source'      => isset( $rules[ $key ] ) ? ( $rules[ $key ]['source'] ?? 'core' ) : 'core',
				'field_count' => 1,
				'fields'      => array( $key => array( 'name' => $key, 'type' => 'text' ) ),
				'xml_snippet' => TranslateSense_Xml_Engine::get_widget_xml_snippet( 'classic', $key ),
			);
		}

		return $result;
	}

	/**
	 * Get XML configuration strings (supports builder filter).
	 */
	public static function get_xml_config( WP_REST_Request $request ) {
		$builder = $request->get_param( 'builder' ) ? sanitize_key( $request->get_param( 'builder' ) ) : 'all';

		return rest_ensure_response(
			array(
				'builder'       => $builder,
				'core_xml'      => TranslateSense_Xml_Engine::get_core_xml_raw(),
				'custom_xml'    => TranslateSense_Xml_Engine::get_builder_xml_raw( $builder ),
				'gutenberg_xml' => TranslateSense_Xml_Engine::get_builder_xml_raw( 'gutenberg' ),
				'elementor_xml' => TranslateSense_Xml_Engine::get_builder_xml_raw( 'elementor' ),
				'divi_xml'      => TranslateSense_Xml_Engine::get_builder_xml_raw( 'divi' ),
				'classic_xml'   => TranslateSense_Xml_Engine::get_builder_xml_raw( 'classic' ),
				'rules'         => TranslateSense_Xml_Engine::get_all_rules(),
			)
		);
	}

	/**
	 * Save custom XML configuration (supports builder and widget_id parameters).
	 */
	public static function save_xml_config( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$builder = isset( $params['builder'] ) ? sanitize_key( $params['builder'] ) : 'all';
		$custom_xml = $params['custom_xml'] ?? '';
		$widget_id = isset( $params['widget_id'] ) ? sanitize_text_field( $params['widget_id'] ) : '';

		if ( ! empty( $widget_id ) ) {
			$saved = TranslateSense_Xml_Engine::save_widget_xml_snippet( $builder, $widget_id, $custom_xml );
		} else {
			$saved = TranslateSense_Xml_Engine::save_builder_xml( $builder, $custom_xml );
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
				'custom_xml' => TranslateSense_Xml_Engine::get_builder_xml_raw( $builder ),
				'core_xml'   => TranslateSense_Xml_Engine::get_core_xml_raw(),
				'rules'      => TranslateSense_Xml_Engine::get_all_rules( true ),
			)
		);
	}

	/**
	 * Generate XML config from in-memory editor content containing "Translate This Content".
	 */
	public static function generate_config_from_content( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$builder = isset( $params['builder'] ) ? sanitize_key( $params['builder'] ) : 'gutenberg';
		$blocks = $params['blocks'] ?? array();
		$elements = $params['elements'] ?? array();

		$detection = null;
		if ( 'gutenberg' === $builder && ! empty( $blocks ) ) {
			$detection = TranslateSense_Detector::detect_from_gutenberg_blocks( $blocks );
		} elseif ( 'elementor' === $builder && ! empty( $elements ) ) {
			$detection = TranslateSense_Detector::detect_from_elementor_data( $elements );
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
		$params = $request->get_json_params();
		$builder = isset( $params['builder'] ) ? sanitize_key( $params['builder'] ) : 'gutenberg';

		// Find existing or create draft sandbox post
		$existing_sandbox = get_posts(
			array(
				'post_type'      => 'page',
				'post_status'    => 'draft',
				'meta_key'       => '_translatesense_sandbox',
				'meta_value'     => $builder,
				'posts_per_page' => 1,
			)
		);

		if ( ! empty( $existing_sandbox ) ) {
			$sandbox_id = $existing_sandbox[0]->ID;
		} else {
			$sandbox_id = wp_insert_post(
				array(
					'post_title'   => sprintf( 'TranslateSense Mapping Sandbox (%s)', ucfirst( $builder ) ),
					'post_type'    => 'page',
					'post_status'  => 'draft',
					'post_content' => '<!-- wp:paragraph --><p>Translate This Content</p><!-- /wp:paragraph -->',
				)
			);
			update_post_meta( $sandbox_id, '_translatesense_sandbox', $builder );
			update_post_meta( $sandbox_id, '_translatesense_mapping_mode', '1' );
		}

		$edit_url = get_edit_post_link( $sandbox_id, 'raw' );

		// If Elementor builder requested
		if ( 'elementor' === $builder && class_exists( '\Elementor\Plugin' ) ) {
			update_post_meta( $sandbox_id, '_elementor_edit_mode', 'builder' );
			$edit_url = add_query_arg( array( 'post' => $sandbox_id, 'action' => 'elementor' ), admin_url( 'post.php' ) );
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
	 * Get Settings endpoint.
	 */
	public static function get_settings( WP_REST_Request $request ) {
		global $wpdb;
		$settings = get_option( 'translatesense_settings', array() );
		$languages = TranslateSense_Polylang_Bridge::get_languages();
		$polylang_active = TranslateSense_Polylang_Bridge::is_polylang_active();

		// Stats
		$table_translations = TranslateSense_Hashing_Db::get_translations_table();
		$packages_count = (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$wpdb->prefix}translatesense_packages" );
		$results_count = (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$table_translations} WHERE translated_strings != '' AND translated_strings != '{}' AND translated_strings != '[]'" );

		return rest_ensure_response(
			array(
				'settings'        => $settings,
				'languages'       => $languages,
				'polylang_active' => $polylang_active,
				'active_builders' => TranslateSense_Admin_Menu::get_active_builders(),
				'stats'           => array(
					'total_packages'  => $packages_count,
					'cached_results'  => $results_count,
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
	 * Extract translatable strings from post content / Elementor data.
	 */
	public static function extract_strings( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$content = $params['content'] ?? '';
		$target_lang = $params['target_lang'] ?? 'es';

		if ( $post_id && empty( $content ) ) {
			$post = get_post( $post_id );
			if ( $post ) {
				$content = $post->post_content;
			}
		}

		$extracted = self::parse_content_for_strings( $content, $post_id );

		// Pre-populate with cached values if available
		$hashes = array();
		foreach ( $extracted as $item ) {
			$hashes[] = $item['hash'];
		}
		$cache_map = TranslateSense_Hashing_Db::get_cached_translations_batch( $hashes, $target_lang );

		foreach ( $extracted as &$item ) {
			if ( isset( $cache_map[ $item['hash'] ] ) ) {
				$item['translated'] = $cache_map[ $item['hash'] ];
				$item['status'] = 'Cached';
			} else {
				$item['translated'] = '';
				$item['status'] = 'Pending';
			}
		}

		return rest_ensure_response( array( 'strings' => $extracted ) );
	}

	/**
	 * Parse content (blocks or Elementor JSON or plain text) into translatable strings array.
	 */
	private static function parse_content_for_strings( $content, $post_id = 0 ) {
		$rules = TranslateSense_Xml_Engine::get_all_rules();
		$extracted = array();

		// Check if Elementor post
		if ( $post_id && 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ) ) {
			$elementor_data = get_post_meta( $post_id, '_elementor_data', true );
			if ( ! empty( $elementor_data ) ) {
				$elements = is_string( $elementor_data ) ? json_decode( $elementor_data, true ) : $elementor_data;
				if ( is_array( $elements ) ) {
					self::extract_elementor_strings_recursive( $elements, $rules['elementor'], $extracted );
					return $extracted;
				}
			}
		}

		// Gutenberg Blocks parsing
		if ( function_exists( 'has_blocks' ) && has_blocks( $content ) ) {
			$blocks = parse_blocks( $content );
			self::extract_gutenberg_strings_recursive( $blocks, $rules['gutenberg'], $extracted );
			return $extracted;
		}

		// Plain text fallback / Classic Editor
		if ( ! empty( trim( $content ) ) ) {
			$h = TranslateSense_Hashing_Db::generate_hash( 'classic_content', $content );
			$extracted[] = array(
				'widget_id'   => 'classic_content',
				'widget_name' => 'Classic Editor Body',
				'field'       => 'post_content',
				'source'      => $content,
				'hash'        => $h,
			);
		}

		return $extracted;
	}

	/**
	 * Extract strings recursively from Gutenberg blocks.
	 */
	private static function extract_gutenberg_strings_recursive( $blocks, $gutenberg_rules, &$extracted ) {
		foreach ( $blocks as $index => $block ) {
			$name = $block['blockName'];
			if ( empty( $name ) ) {
				continue;
			}

			if ( isset( $gutenberg_rules[ $name ] ) ) {
				$keys = $gutenberg_rules[ $name ]['keys'];
				foreach ( $keys as $k_name => $k_info ) {
					if ( isset( $block['attrs'][ $k_name ] ) && is_string( $block['attrs'][ $k_name ] ) && '' !== trim( $block['attrs'][ $k_name ] ) ) {
						$val = $block['attrs'][ $k_name ];
						$extracted[] = array(
							'widget_id'   => $name,
							'widget_name' => $name,
							'field'       => $k_name,
							'source'      => $val,
							'hash'        => TranslateSense_Hashing_Db::generate_hash( $name, $val ),
						);
					}
				}
			}

			// Also extract innerHTML for core/paragraph or generic blocks if content is inside
			if ( 'core/paragraph' === $name && ! empty( $block['innerHTML'] ) ) {
				$clean = trim( strip_tags( $block['innerHTML'] ) );
				if ( ! empty( $clean ) ) {
					$extracted[] = array(
						'widget_id'   => 'core/paragraph',
						'widget_name' => 'Paragraph',
						'field'       => 'innerHTML',
						'source'      => $clean,
						'hash'        => TranslateSense_Hashing_Db::generate_hash( 'core/paragraph', $clean ),
					);
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::extract_gutenberg_strings_recursive( $block['innerBlocks'], $gutenberg_rules, $extracted );
			}
		}
	}

	/**
	 * Extract strings recursively from Elementor element trees.
	 */
	private static function extract_elementor_strings_recursive( $elements, $elementor_rules, &$extracted ) {
		foreach ( $elements as $element ) {
			$el_type = $element['elType'] ?? '';
			$widget_type = $element['widgetType'] ?? '';

			if ( 'widget' === $el_type && ! empty( $widget_type ) && isset( $elementor_rules[ $widget_type ] ) ) {
				$fields = $elementor_rules[ $widget_type ]['fields'];
				$settings = $element['settings'] ?? array();

				foreach ( $fields as $path => $f_info ) {
					$val = self::get_nested_val( $settings, $path );
					if ( is_string( $val ) && '' !== trim( $val ) ) {
						$extracted[] = array(
							'widget_id'   => $widget_type,
							'widget_name' => 'Elementor ' . $widget_type,
							'field'       => $path,
							'source'      => $val,
							'hash'        => TranslateSense_Hashing_Db::generate_hash( $widget_type, $val ),
						);
					}
				}
			}

			if ( ! empty( $element['elements'] ) ) {
				self::extract_elementor_strings_recursive( $element['elements'], $elementor_rules, $extracted );
			}
		}
	}

	/**
	 * Helper for nested keys with `>` delimiter.
	 */
	private static function get_nested_val( $arr, $path ) {
		$keys = explode( '>', $path );
		$cur = $arr;
		foreach ( $keys as $k ) {
			if ( is_array( $cur ) && isset( $cur[ $k ] ) ) {
				$cur = $cur[ $k ];
			} else {
				return null;
			}
		}
		return $cur;
	}

	/**
	 * Translate a batch of strings endpoint.
	 */
	public static function translate_batch( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$strings = $params['strings'] ?? array();
		$source_lang = $params['source_lang'] ?? 'en';
		$target_lang = $params['target_lang'] ?? 'es';
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$provider = $params['provider'] ?? null;

		$custom_opts = array();
		if ( $provider ) {
			$custom_opts['provider'] = $provider;
		}

		$results = TranslateSense_Translator::translate_batch(
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
		$params = $request->get_json_params();
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$target_lang = $params['target_lang'] ?? '';
		$provider = $params['provider'] ?? null;

		if ( ! $post_id || ! $target_lang ) {
			return new WP_Error( 'invalid_params', __( 'Post ID and Target Language are required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$source_post = get_post( $post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Post not found.', 'translatesense' ), array( 'status' => 404 ) );
		}

		$source_lang = TranslateSense_Polylang_Bridge::get_post_language( $post_id );
		$custom_opts = $provider ? array( 'provider' => $provider ) : array();

		// 1. Translate Title
		$title_res = TranslateSense_Translator::translate_string(
			$source_post->post_title,
			$source_lang,
			$target_lang,
			'post_title',
			$post_id,
			$custom_opts
		);
		$translated_title = $title_res['translated'];

		// 2. Check if Elementor
		$is_elementor = ( 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ) );
		$new_elementor_data = null;
		$translated_content = $source_post->post_content;

		if ( $is_elementor ) {
			$elementor_data_raw = get_post_meta( $post_id, '_elementor_data', true );
			$elements = is_string( $elementor_data_raw ) ? json_decode( $elementor_data_raw, true ) : $elementor_data_raw;
			if ( is_array( $elements ) ) {
				$rules = TranslateSense_Xml_Engine::get_all_rules();
				self::translate_elementor_elements_tree( $elements, $rules['elementor'], $source_lang, $target_lang, $post_id, $custom_opts );
				$new_elementor_data = $elements;
			}
		} elseif ( function_exists( 'has_blocks' ) && has_blocks( $source_post->post_content ) ) {
			// Gutenberg Blocks
			$blocks = parse_blocks( $source_post->post_content );
			$rules = TranslateSense_Xml_Engine::get_all_rules();
			self::translate_gutenberg_blocks_tree( $blocks, $rules['gutenberg'], $source_lang, $target_lang, $post_id, $custom_opts );
			$translated_content = serialize_blocks( $blocks );
		} else {
			// Classic post content
			$content_res = TranslateSense_Translator::translate_string(
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
		$created_post_id = TranslateSense_Polylang_Bridge::create_or_update_translated_post(
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
				'success'            => true,
				'source_post_id'     => $post_id,
				'target_post_id'     => $created_post_id,
				'target_language'    => $target_lang,
				'translated_title'   => $translated_title,
				'edit_url'           => get_edit_post_link( $created_post_id, 'raw' ),
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
						$res = TranslateSense_Translator::translate_string(
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
					$res = TranslateSense_Translator::translate_string(
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
			$el_type = $element['elType'] ?? '';
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
		$ref = &$settings;

		foreach ( $keys as $k ) {
			if ( ! isset( $ref[ $k ] ) ) {
				return;
			}
			$ref = &$ref[ $k ];
		}

		if ( is_string( $ref ) && '' !== trim( $ref ) ) {
			$res = TranslateSense_Translator::translate_string(
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
