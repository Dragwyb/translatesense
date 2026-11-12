<?php

declare(strict_types=1);

namespace TranslateSense\Includes\REST;

use TranslateSense\Includes\Content\Parser\Content_Parser;
use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Manager;
use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Parser;
use TranslateSense\Includes\Content\Parser\Taxonomy\Taxonomy_Parser;
use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\Translation\Taxonomy\Taxonomy_Translator;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Admin\Editor_Integration;
use TranslateSense\Includes\Admin\Admin_Menu;
use TranslateSense\Includes\AI\Ai_Connector_Bridge;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Bulk\Bulk_Process;
use TranslateSense\Includes\Translation\Statics;
use TranslateSense\Includes\Content\Processor\Block_Processor;
use TranslateSense\Includes\Core\Detector;

use WP_REST_Server;
use WP_REST_Request;
use WP_Error;

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
	 * Register REST routes.
	 */
	public static function register_routes() {

		/*
		 * 1. Scan and get widgets support status.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/widgets',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_widgets_status' ),
				'permission_callback' => array( __CLASS__, 'permission_get_widgets' ),
			)
		);

		/*
		 * 2. Read XML configuration.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/xml-config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_xml_config' ),
				'permission_callback' => array( __CLASS__, 'permission_get_xml_config' ),
				'args'                => array(
					'builder' => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => 'all',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);

		/*
		 * 3. Save XML configuration.
		 *
		 * This modifies global plugin configuration and therefore
		 * remains restricted to administrators.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/xml-config',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'save_xml_config' ),
				'permission_callback' => array( __CLASS__, 'permission_save_xml_config' ),
				'args'                => array(
					'builder'    => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => 'all',
						'sanitize_callback' => 'sanitize_key',
					),
					'custom_xml' => array(
						'required' => false,
						'type'     => 'string',
					),
					'xml'        => array(
						'required' => false,
						'type'     => 'string',
					),
					'widget_id'  => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		/*
		 * 3.1 Generate XML configuration from editor state.
		 *
		 * This endpoint can be used as part of the configuration
		 * workflow and therefore remains administrator-only.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/generate-config',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'generate_config_from_content' ),
				'permission_callback' => array( __CLASS__, 'permission_generate_config' ),
				'args'                => array(
					'builder'  => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => 'gutenberg',
						'sanitize_callback' => 'sanitize_key',
					),
					'blocks'   => array(
						'required' => false,
						'type'     => 'array',
						'default'  => array(),
					),
					'elements' => array(
						'required' => false,
						'type'     => 'array',
						'default'  => array(),
					),
				),
			)
		);

		/*
		 * 3.2 Open/create mapping sandbox.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/open-mapping-sandbox',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'open_mapping_sandbox' ),
				'permission_callback' => array( __CLASS__, 'permission_open_mapping_sandbox' ),
				'args'                => array(
					'builder'     => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => 'gutenberg',
						'sanitize_callback' => 'sanitize_key',
					),
					'widget_id'   => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'widget_slug' => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		/*
		 * 3.3 Gutenberg block configuration.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/gutenberg-config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_gutenberg_config' ),
				'permission_callback' => array( __CLASS__, 'permission_get_gutenberg_config' ),
			)
		);

		/*
		 * 3.4 Specific editor XML configuration.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/editor-xml-config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_editor_xml_config' ),
				'permission_callback' => array( __CLASS__, 'permission_get_editor_xml_config' ),
				'args'                => array(
					'editor'  => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'builder' => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);

		/*
		 * 3.5 Page content retrieval.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/get-page-content',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_page_content' ),
				'permission_callback' => array( __CLASS__, 'permission_get_page_content' ),
				'args'                => array(
					'post_id' => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
				),
			)
		);

		/*
		 * 4. Get plugin settings and languages.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/settings',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_settings' ),
				'permission_callback' => array( __CLASS__, 'permission_get_settings' ),
			)
		);

		/*
		 * 5. Update plugin settings.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/settings',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'update_settings' ),
				'permission_callback' => array( __CLASS__, 'permission_update_settings' ),
				'args'                => array(
					'provider'          => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'openai_api_key'    => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'gemini_api_key'    => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'openai_model'      => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'gemini_model'      => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'enabled_providers' => array(
						'required'          => false,
						'type'              => 'array',
						'items'             => array(
							'type' => 'string',
						),
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value ) ? array_map( 'sanitize_key', $value ) : array();
						},
					),
					'batch_size'        => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'response_timeout'  => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'max_tokens'        => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'temperature'       => array(
						'required'          => false,
						'type'              => 'number',
						'validate_callback' => static function ( $value ) {
							return is_numeric( $value );
						},
					),
					'custom_prompt'     => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_textarea_field',
					),
					'default_prompt'    => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_textarea_field',
					),
					'slug_translation'  => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'post_status'       => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);

		/*
		 * 6. Extract strings.
		 *
		 * This is post-scoped. Users who can edit the current post may
		 * extract its strings. Global XML configuration endpoints remain
		 * administrator-only. The parser must not write global configuration
		 * as a side effect of this endpoint.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/extract-strings',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'extract_strings' ),
				'permission_callback' => array( __CLASS__, 'permission_extract_strings' ),
				'args'                => array(
					'post_id'            => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
					'builder'            => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'target_lang'        => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'type'               => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'subtype'            => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'include_taxonomies' => array(
						'required' => false,
						'type'     => 'boolean',
						'default'  => false,
					),
				),
			)
		);

		/*
		 * 7. Translate batch of strings.
		 *
		 * Translating arbitrary strings without a post context requires 'manage_options'.
		 * When translating within a post context, non-administrators must have permission
		 * to edit the post, and every submitted string is verified to belong to that post
		 * (or its source post) to prevent unauthorized consumption of AI translation services.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/translate-batch',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'translate_batch' ),
				'permission_callback' => array( __CLASS__, 'permission_translate_batch' ),
				'args'                => array(
					'post_id'     => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
					'strings'     => array(
						'required'          => true,
						'type'              => 'array',
						'validate_callback' => static function ( $value ) {
							return is_array( $value ) && ! empty( $value );
						},
					),
					'target_lang' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
						'validate_callback' => static function ( $value ) {
							return '' !== sanitize_key( (string) $value );
						},
					),
					'source_lang' => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'provider'    => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);

		/*
		 * 8. Translate single post.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/translate-post',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'translate_post' ),
				'permission_callback' => array( __CLASS__, 'permission_translate_post' ),
				'args'                => array(
					'post_id'     => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
					'target_lang' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
						'validate_callback' => static function ( $value ) {
							return '' !== sanitize_key( (string) $value );
						},
					),
				),
			)
		);

		/*
		 * 9. Start bulk translation.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-start',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_start' ),
				'permission_callback' => array( __CLASS__, 'permission_bulk_start' ),
				'args'                => array(
					'post_ids'         => array(
						'required'          => true,
						'type'              => 'array',
						'items'             => array(
							'type' => 'integer',
						),
						'validate_callback' => static function ( $value ) {
							return is_array( $value ) && ! empty( $value );
						},
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value ) ? array_map( 'absint', $value ) : array();
						},
					),
					'target_languages' => array(
						'required'          => true,
						'type'              => 'array',
						'items'             => array(
							'type' => 'string',
						),
						'validate_callback' => static function ( $value ) {
							return is_array( $value ) && ! empty( $value );
						},
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value ) ? array_map( 'sanitize_key', $value ) : array();
						},
					),
					'provider'         => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'type'             => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'subtype'          => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'options'          => array(
						'required' => false,
						'type'     => 'object',
					),
				),
			)
		);

		/*
		 * 10. Bulk translation status.
		 *
		 * batch_id is the primary resource.
		 * If post_id is also supplied, it must belong to the batch.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'bulk_status' ),
				'permission_callback' => array( __CLASS__, 'permission_bulk_status' ),
				'args'                => array(
					'batch_id' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => static function ( $value ) {
							return '' !== trim( (string) $value );
						},
					),
					'post_id'  => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
				),
			)
		);

		/*
		 * 11. Bulk translation update job.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-update-job',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_update_job' ),
				'permission_callback' => array( __CLASS__, 'permission_bulk_update_job' ),
				'args'                => array(
					'job_id'           => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
					'type'             => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'status'           => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => 'success',
						'sanitize_callback' => 'sanitize_key',
					),
					'total_characters' => array(
						'required'          => false,
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'total_strings'    => array(
						'required'          => false,
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'provider'         => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'time_take'        => array(
						'required'          => false,
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		/*
		 * 11b. Bulk translation skip post jobs.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-skip-post',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_skip_post' ),
				'permission_callback' => array( __CLASS__, 'permission_bulk_skip' ),
				'args'                => array(
					'batch_id' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => static function ( $value ) {
							return '' !== trim( (string) $value );
						},
					),
					'post_id'  => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
				),
			)
		);

		/*
		 * 11c. Get active background translation batches.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-active-batches',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'bulk_active_batches' ),
				'permission_callback' => array( __CLASS__, 'permission_bulk_active_batches' ),
			)
		);

		/*
		 * 12. Mark post as translated (pending translation).
		 */
		register_rest_route(
			self::NAMESPACE,
			'/mark-translated',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'mark_translated' ),
				'permission_callback' => array( __CLASS__, 'permission_mark_translated' ),
				'args'                => array(
					'post_id'          => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
					'status'           => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => 'success',
						'sanitize_callback' => 'sanitize_key',
					),
					'total_characters' => array(
						'required'          => false,
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'total_strings'    => array(
						'required'          => false,
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'provider'         => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'time_take'        => array(
						'required'          => false,
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		/*
		 * 12b. Translate/create/update a taxonomy term in the bulk taxonomy workflow.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-translate-term',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_translate_term' ),
				'permission_callback' => array( __CLASS__, 'permission_bulk_translate_term' ),
				'args'                => array(
					'term_id'                => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
					'taxonomy'               => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
						'validate_callback' => static function ( $value ) {
							return '' !== sanitize_key( (string) $value );
						},
					),
					'target_lang'            => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
						'validate_callback' => static function ( $value ) {
							return '' !== sanitize_key( (string) $value );
						},
					),
					'provider'               => array(
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'in_memory_translations' => array(
						'required' => false,
						'default'  => array(),
					),
				),
			)
		);

		/*
		 * 13. Clear Gutenberg block process pending flag.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/clear-block-state',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'clear_block_state' ),
				'permission_callback' => array( __CLASS__, 'permission_clear_block_state' ),
				'args'                => array(
					'post_id' => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
				),
			)
		);

		/*
		 * 14. Get translation and memory cache statistics.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/cache-stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_cache_stats' ),
				'permission_callback' => array( __CLASS__, 'permission_get_settings' ),
			)
		);

		/*
		 * 15. Clear specific or all translation and memory caches.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/clear-cache',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'clear_cache' ),
				'permission_callback' => array( __CLASS__, 'permission_update_settings' ),
				'args'                => array(
					'type' => array(
						'required'          => true,
						'type'              => 'string',
						'enum'              => array( 'strings', 'translations', 'logs', 'packages', 'all' ),
						'sanitize_callback' => 'sanitize_key',
						'validate_callback' => static function ( $value ) {
							return in_array( sanitize_key( (string) $value ), array( 'strings', 'translations', 'logs', 'packages', 'all' ), true );
						},
					),
				),
			)
		);

		/*
		 * 16. Dismiss initial prompt modal (delete _show_initial_prompt_modal post meta).
		 */
		register_rest_route(
			self::NAMESPACE,
			'/dismiss-initial-prompt',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'dismiss_initial_prompt' ),
				'permission_callback' => array( __CLASS__, 'permission_dismiss_initial_prompt' ),
				'args'                => array(
					'post_id' => array(
						'required'          => true,
						'type'              => 'integer',
						'validate_callback' => static function ( $param ) {
							return is_numeric( $param ) && absint( $param ) > 0;
						},
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}


	/**
	 * Build a standard REST authorization error.
	 *
	 * This is a private helper only. Every REST route has its own public
	 * permission callback so that each endpoint has an explicit,
	 * independently auditable authorization policy.
	 *
	 * @param string   $message Error message.
	 * @param string   $code Error code.
	 * @param int|null $status HTTP status.
	 * @return WP_Error
	 */
	private static function permission_error( $message, $code = 'rest_forbidden', $status = null ) {

		if ( null === $status ) {
			$status = rest_authorization_required_code();
		}

		return new WP_Error(
			$code,
			$message,
			array( 'status' => $status )
		);
	}

	/**
	 * Require plugin configuration access.
	 *
	 * @return true|WP_Error
	 */
	private static function require_manage_options() {

		if ( ! current_user_can( 'manage_options' ) ) {
			return self::permission_error(
				__( 'You are not allowed to manage TranslateSense configuration.', 'translatesense' )
			);
		}

		return true;
	}

	/**
	 * Require edit permission for a specific post.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $message Error message.
	 * @return true|WP_Error
	 */
	private static function require_edit_post( $post_id, $message ) {

		$post_id = absint( $post_id );

		if ( ! $post_id ) {
			return self::permission_error(
				__( 'A valid post ID is required.', 'translatesense' ),
				'rest_invalid_post',
				400
			);
		}

		if ( ! get_post( $post_id ) ) {
			return self::permission_error(
				__( 'The requested post could not be found.', 'translatesense' ),
				'rest_post_not_found',
				404
			);
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return self::permission_error( $message );
		}

		return true;
	}

	/**
	 * Permission: GET /widgets.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_get_widgets() {
		return self::require_manage_options();
	}

	/**
	 * Permission: GET /xml-config.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_get_xml_config() {
		return self::require_manage_options();
	}

	/**
	 * Permission: POST /xml-config.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_save_xml_config() {
		return self::require_manage_options();
	}

	/**
	 * Permission: POST /generate-config.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_generate_config() {
		return self::require_manage_options();
	}

	/**
	 * Permission: POST /open-mapping-sandbox.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_open_mapping_sandbox( WP_REST_Request $request ) {

		$auth = self::require_manage_options();

		if ( is_wp_error( $auth ) ) {
			return $auth;
		}

		$params  = $request->get_json_params();
		$builder = is_array( $params ) && isset( $params['builder'] )
			? sanitize_key( $params['builder'] )
			: 'gutenberg';

		if ( 'core' === $builder ) {
			$builder = 'gutenberg';
		}

		if ( ! self::is_valid_builder( $builder ) ) {
			return self::permission_error(
				__( 'Invalid builder.', 'translatesense' ),
				'rest_invalid_builder',
				400
			);
		}

		return true;
	}

	/**
	 * Permission: GET /gutenberg-config.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_get_gutenberg_config() {
		return self::require_manage_options();
	}

	/**
	 * Permission: GET /editor-xml-config.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_get_editor_xml_config() {
		return self::require_manage_options();
	}

	/**
	 * Permission: GET /get-page-content.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_get_page_content( WP_REST_Request $request ) {

		return self::require_edit_post(
			self::get_request_post_id( $request ),
			__( 'You are not allowed to access this post content.', 'translatesense' )
		);
	}

	/**
	 * Permission: GET /settings.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_get_settings() {
		return self::require_manage_options();
	}

	/**
	 * Permission: POST /settings.
	 *
	 * @return true|WP_Error
	 */
	public static function permission_update_settings() {
		return self::require_manage_options();
	}

	/**
	 * Permission: POST /extract-strings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	/**
	 * Resolve runtime item type ('post' or 'term') from REST request without storing it in DB.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return string `'post'`, `'term'`, or `''` when an invalid type was submitted.
	 */
	private static function get_request_item_type( WP_REST_Request $request ): string {
		$params   = $request->get_json_params();
		$raw_type = ( is_array( $params ) && array_key_exists( 'type', $params ) )
			? $params['type']
			: $request->get_param( 'type' );

		if ( null !== $raw_type && '' !== (string) $raw_type ) {
			$type = sanitize_key( (string) $raw_type );
			return in_array( $type, array( 'post', 'term' ), true ) ? $type : '';
		}

		$subtype = sanitize_key( (string) ( ( is_array( $params ) && isset( $params['subtype'] ) ) ? $params['subtype'] : $request->get_param( 'subtype' ) ) );
		return ( '' !== $subtype && taxonomy_exists( $subtype ) ) ? 'term' : 'post';
	}

	/**
	 * Resolve item type (`'post'` or `'term'`) for an existing queue job record.
	 *
	 * Uses the persisted `item_type` column (`'post'` or `'taxonomy'`) and verifies
	 * that any explicit runtime `type` parameter matches the stored job type.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @param object          $job     Queue job object.
	 * @return string `'post'`, `'term'`, or empty string when invalid/mismatched.
	 */
	private static function resolve_job_item_type( WP_REST_Request $request, $job ): string {
		$job_type = ( ! empty( $job->item_type ) && 'taxonomy' === sanitize_key( (string) $job->item_type ) )
			? 'term'
			: 'post';

		$params   = $request->get_json_params();
		$raw_type = ( is_array( $params ) && array_key_exists( 'type', $params ) )
			? $params['type']
			: $request->get_param( 'type' );

		if ( null !== $raw_type && '' !== (string) $raw_type ) {
			$req_type = sanitize_key( (string) $raw_type );
			if ( ! in_array( $req_type, array( 'post', 'term' ), true ) || $req_type !== $job_type ) {
				return '';
			}
		}

		return $job_type;
	}

	/**
	 * Permission: POST /extract-strings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_extract_strings( WP_REST_Request $request ) {
		$post_id = self::get_request_post_id( $request );
		$type    = self::get_request_item_type( $request );

		if ( '' === $type ) {
			return self::permission_error( __( 'Invalid item type specified.', 'translatesense' ), 'rest_invalid_type', 400 );
		}

		if ( 'term' === $type ) {
			if ( ! is_user_logged_in() ) {
				return self::permission_error( __( 'You must be logged in to extract taxonomy strings.', 'translatesense' ), 'rest_forbidden', 401 );
			}

			$params  = $request->get_json_params();
			$subtype = sanitize_key( (string) ( is_array( $params ) && isset( $params['subtype'] ) ? $params['subtype'] : $request->get_param( 'subtype' ) ) );
			if ( '' !== $subtype && ! Taxonomy_Parser::is_translatable_taxonomy( $subtype ) ) {
				return self::permission_error( __( 'The selected taxonomy is not supported for translation.', 'translatesense' ), 'rest_invalid_taxonomy', 400 );
			}

			$term = get_term( $post_id, $subtype );
			if ( ! $term instanceof \WP_Term || ! Taxonomy_Parser::is_translatable_taxonomy( (string) $term->taxonomy ) ) {
				return self::permission_error( __( 'The selected taxonomy term could not be found.', 'translatesense' ), 'rest_term_not_found', 404 );
			}

			if ( ! current_user_can( 'edit_term', $post_id ) ) {
				return self::permission_error( __( 'You are not allowed to extract strings from this taxonomy term.', 'translatesense' ) );
			}

			return true;
		}

		return self::require_edit_post(
			$post_id,
			__( 'You are not allowed to extract strings from this post.', 'translatesense' )
		);
	}

	/**
	 * Permission: POST /translate-batch.
	 *
	 * Translating arbitrary strings without a post context requires 'manage_options'.
	 * When translating within a post context, non-administrators must have permission
	 * to edit the post, and every submitted string must be verified to belong to that post
	 * (or its linked source post) to ensure AI translation services are only consumed
	 * for authorized post content.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_translate_batch( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return self::permission_error(
				__( 'Invalid request data.', 'translatesense' ),
				'rest_invalid_params',
				400
			);
		}

		if ( empty( $params['strings'] ) || ! is_array( $params['strings'] ) ) {
			return self::permission_error(
				__( 'A non-empty strings array is required.', 'translatesense' ),
				'rest_invalid_strings',
				400
			);
		}

		if ( count( $params['strings'] ) > 500 ) {
			return self::permission_error(
				__( 'The translation batch contains too many items.', 'translatesense' ),
				'rest_request_too_large',
				400
			);
		}

		foreach ( $params['strings'] as $string ) {
			if ( ! is_string( $string ) || '' === $string ) {
				return self::permission_error(
					__( 'Every translation item must be a non-empty string.', 'translatesense' ),
					'rest_invalid_strings',
					400
				);
			}
		}

		$post_id = self::get_request_post_id( $request );

		// Post ownership and source-string membership are mandatory for every user.
		// Administrators and users with manage_options receive no bypass.
		if ( ! $post_id ) {
			return self::permission_error(
				__( 'A valid post ID is required to translate strings.', 'translatesense' ),
				'rest_invalid_post',
				400
			);
		}

		$edit_check = self::require_edit_post(
			$post_id,
			__( 'You are not allowed to translate this post.', 'translatesense' )
		);

		if ( is_wp_error( $edit_check ) ) {
			return $edit_check;
		}

		if ( true !== $edit_check ) {
			return self::permission_error(
				__( 'You are not allowed to translate this post.', 'translatesense' ),
				'rest_forbidden',
				403
			);
		}

		$target_lang = isset( $params['target_lang'] ) ? sanitize_key( (string) $params['target_lang'] ) : '';
		if ( ! self::verify_strings_belong_to_post( $params['strings'], $post_id, $target_lang ) ) {
			return self::permission_error(
				__( 'One or more submitted strings do not belong to the source post for this translation.', 'translatesense' ),
				'rest_forbidden',
				403
			);
		}

		return true;
	}

	/**
	 * Permission: POST /translate-post.
	 *
	 * The source, existing target, or target creation capability is checked
	 * before the translation service is allowed to execute.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_translate_post( WP_REST_Request $request ) {

		$source_post_id = self::get_request_post_id( $request );

		$source_auth = self::require_edit_post(
			$source_post_id,
			__( 'You are not allowed to edit the source post.', 'translatesense' )
		);

		if ( is_wp_error( $source_auth ) ) {
			return $source_auth;
		}

		$source_post = get_post( $source_post_id );

		$target_language = sanitize_key(
			(string) $request->get_param( 'target_lang' )
		);

		if ( '' === $target_language ) {
			return self::permission_error(
				__( 'A target language is required.', 'translatesense' ),
				'rest_invalid_target_language',
				400
			);
		}

		$target_post_id = self::get_existing_translation_post_id(
			$source_post_id,
			$target_language
		);

		if ( $target_post_id ) {
			return self::require_edit_post(
				$target_post_id,
				__( 'You are not allowed to edit the target translation post.', 'translatesense' )
			);
		}

		$post_type = get_post_type_object( $source_post->post_type );

		if ( ! $post_type ) {
			return self::permission_error(
				__( 'The source post type could not be determined.', 'translatesense' ),
				'rest_invalid_post_type',
				400
			);
		}

		$create_capability = ! empty( $post_type->cap->create_posts )
			? $post_type->cap->create_posts
			: 'edit_posts';

		if ( ! current_user_can( $create_capability ) ) {
			return self::permission_error(
				__( 'You are not allowed to create the target translation post.', 'translatesense' )
			);
		}

		return true;
	}

	/**
	 * Permission: POST /bulk-start.
	 *
	 * Each source and each existing target is individually authorized.
	 * A missing target requires the relevant post type create capability.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_bulk_start( WP_REST_Request $request ) {

		$params  = $request->get_json_params();
		$subtype = sanitize_key( (string) ( is_array( $params ) && isset( $params['subtype'] ) ? $params['subtype'] : '' ) );

		$post_ids = is_array( $params ) && isset( $params['post_ids'] )
			? $params['post_ids']
			: array();

		$target_languages = is_array( $params ) && isset( $params['target_languages'] )
			? $params['target_languages']
			: array();

		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return self::permission_error(
				__( 'At least one item ID is required.', 'translatesense' ),
				'rest_invalid_posts',
				400
			);
		}

		if ( empty( $target_languages ) || ! is_array( $target_languages ) ) {
			return self::permission_error(
				__( 'At least one target language is required.', 'translatesense' ),
				'rest_invalid_languages',
				400
			);
		}

		$clean_post_ids = array_values(
			array_unique(
				array_filter(
					array_map( 'absint', $post_ids )
				)
			)
		);

		$clean_languages = array_values(
			array_unique(
				array_filter(
					array_map(
						static function ( $language ) {
							return sanitize_key( (string) $language );
						},
						$target_languages
					)
				)
			)
		);

		$type    = self::get_request_item_type( $request );
		$subtype = sanitize_key( (string) ( is_array( $params ) && isset( $params['subtype'] ) ? $params['subtype'] : '' ) );

		if ( '' === $type ) {
			return self::permission_error(
				__( 'Invalid item type specified.', 'translatesense' ),
				'rest_invalid_type',
				400
			);
		}

		if ( 'term' === $type ) {
			if ( '' === $subtype && ! empty( $clean_post_ids ) ) {
				$first_term = get_term( $clean_post_ids[0] );
				if ( $first_term instanceof \WP_Term ) {
					$subtype = sanitize_key( (string) $first_term->taxonomy );
				}
			}

			if ( '' === $subtype || ! Taxonomy_Parser::is_translatable_taxonomy( $subtype ) ) {
				return self::permission_error(
					__( 'The selected taxonomy is not registered or supported for translation in Polylang.', 'translatesense' ),
					'rest_invalid_taxonomy',
					400
				);
			}

			$clean_term_ids = Taxonomy_Parser::filter_linked_terms( $clean_post_ids, $subtype );
			if ( empty( $clean_term_ids ) || empty( $clean_languages ) ) {
				return self::permission_error(
					__( 'Valid taxonomy term IDs and target languages are required.', 'translatesense' ),
					'rest_invalid_params',
					400
				);
			}

			if ( count( $clean_term_ids ) > 100 || count( $clean_languages ) > 50 ) {
				return self::permission_error(
					__( 'The bulk translation request is too large.', 'translatesense' ),
					'rest_request_too_large',
					400
				);
			}

			foreach ( $clean_term_ids as $term_id ) {
				$term = get_term( $term_id, $subtype );
				if ( ! $term instanceof \WP_Term ) {
					return self::permission_error(
						__( 'One or more requested taxonomy terms could not be found.', 'translatesense' ),
						'rest_term_not_found',
						404
					);
				}
			}

			foreach ( $clean_languages as $target_language ) {
				$term_perm = Taxonomy_Translator::check_terms_permissions(
					$clean_term_ids,
					$subtype,
					$target_language,
					get_current_user_id()
				);
				if ( is_wp_error( $term_perm ) ) {
					return $term_perm;
				}
			}

			return true;
		}

		$clean_post_ids = Bulk_Process::filter_linked_posts( $clean_post_ids );

		if ( empty( $clean_post_ids ) || empty( $clean_languages ) ) {
			return self::permission_error(
				__( 'Valid post IDs and target languages are required.', 'translatesense' ),
				'rest_invalid_params',
				400
			);
		}

		if ( count( $clean_post_ids ) > 100 || count( $clean_languages ) > 50 ) {
			return self::permission_error(
				__( 'The bulk translation request is too large.', 'translatesense' ),
				'rest_request_too_large',
				400
			);
		}

		foreach ( $clean_post_ids as $post_id ) {

			$post = get_post( $post_id );

			if ( ! $post ) {
				return self::permission_error(
					__( 'One or more requested posts could not be found.', 'translatesense' ),
					'rest_post_not_found',
					404
				);
			}

			if ( ! current_user_can( 'edit_post', $post_id ) ) {
				return self::permission_error(
					__( 'You are not allowed to translate one or more requested posts.', 'translatesense' )
				);
			}

			$post_type = get_post_type_object( $post->post_type );

			if ( ! $post_type ) {
				return self::permission_error(
					__( 'A requested post has an invalid post type.', 'translatesense' ),
					'rest_invalid_post_type',
					400
				);
			}

			$create_capability = ! empty( $post_type->cap->create_posts )
				? $post_type->cap->create_posts
				: 'edit_posts';

			foreach ( $clean_languages as $target_language ) {

				$target_post_id = self::get_existing_translation_post_id( $post_id, $target_language );

				if ( $target_post_id ) {

					if ( ! get_post( $target_post_id ) ) {
						return self::permission_error(
							__( 'A translation target associated with this post could not be found.', 'translatesense' ),
							'rest_target_post_not_found',
							404
						);
					}

					if ( ! current_user_can( 'edit_post', $target_post_id ) ) {
						return self::permission_error(
							__( 'You are not allowed to update one or more target translation posts.', 'translatesense' )
						);
					}
				} elseif ( ! current_user_can( $create_capability ) ) {

					return self::permission_error(
						__( 'You are not allowed to create one or more target translation posts.', 'translatesense' )
					);
				}
			}
		}

		return true;
	}

	/**
	 * Permission: GET /bulk-status.
	 *
	 * The batch and every post/target exposed by the status response must be
	 * accessible to the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_bulk_status( WP_REST_Request $request ) {

		$batch_id = sanitize_text_field(
			(string) $request->get_param( 'batch_id' )
		);
		$post_id  = absint( $request->get_param( 'post_id' ) );

		if ( '' === $batch_id ) {
			return self::permission_error(
				__( 'A valid batch ID is required.', 'translatesense' ),
				'rest_invalid_batch',
				400
			);
		}

		global $wpdb;

		$table = Bulk_Process::get_table_name();

		if ( ! is_string( $table ) || '' === $table ) {
			return self::permission_error(
				__( 'The translation batch storage is unavailable.', 'translatesense' ),
				'rest_batch_storage_error',
				500
			);
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT item_type, post_id, target_post_id FROM {$table} WHERE batch_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$batch_id
			),
			ARRAY_A
		);

		if ( ! is_array( $rows ) || empty( $rows ) ) {
			return self::permission_error(
				__( 'Batch not found.', 'translatesense' ),
				'rest_batch_not_found',
				404
			);
		}

		$source_items = array();
		$has_post_id  = false;

		foreach ( $rows as $row ) {
			$row_type       = ! empty( $row['item_type'] ) ? sanitize_key( (string) $row['item_type'] ) : 'post';
			$is_taxonomy    = ( 'taxonomy' === $row_type );
			$required_cap   = $is_taxonomy ? 'edit_term' : 'edit_post';
			$source_post_id = isset( $row['post_id'] ) ? absint( $row['post_id'] ) : 0;
			$target_post_id = isset( $row['target_post_id'] ) ? absint( $row['target_post_id'] ) : 0;

			if ( $is_taxonomy ) {
				if ( ! $source_post_id || ! get_term( $source_post_id ) instanceof \WP_Term ) {
					return self::permission_error(
						__( 'A taxonomy term associated with this batch could not be found.', 'translatesense' ),
						'rest_post_not_found',
						404
					);
				}
			} elseif ( ! $source_post_id || ! get_post( $source_post_id ) ) {
				return self::permission_error(
					__( 'A post associated with this batch could not be found.', 'translatesense' ),
					'rest_post_not_found',
					404
				);
			}

			$source_items[ $row_type . ':' . $source_post_id ] = array(
				'id'  => $source_post_id,
				'cap' => $required_cap,
			);
			if ( $post_id && $source_post_id === $post_id ) {
				$has_post_id = true;
			}

			if ( $target_post_id ) {

				if ( $is_taxonomy ) {
					if ( ! get_term( $target_post_id ) instanceof \WP_Term ) {
						return self::permission_error(
							__( 'A target translation term associated with this batch could not be found.', 'translatesense' ),
							'rest_target_post_not_found',
							404
						);
					}
				} elseif ( ! get_post( $target_post_id ) ) {
					return self::permission_error(
						__( 'A target translation post associated with this batch could not be found.', 'translatesense' ),
						'rest_target_post_not_found',
						404
					);
				}

				if ( ! current_user_can( $required_cap, $target_post_id ) ) {
					return self::permission_error(
						__( 'You are not allowed to access a target translation in this batch.', 'translatesense' )
					);
				}
			}
		}

		if ( $post_id && ! $has_post_id ) {
			return self::permission_error(
				__( 'The requested item does not belong to this batch.', 'translatesense' )
			);
		}

		foreach ( $source_items as $source_item ) {
			if ( ! current_user_can( $source_item['cap'], $source_item['id'] ) ) {
				return self::permission_error(
					__( 'You are not allowed to access this batch.', 'translatesense' )
				);
			}
		}

		return true;
	}

	/**
	 * Permission: POST /bulk-update-job.
	 *
	 * A job can only be modified when its source post is editable and any
	 * target_post_id is the actual translation target for that job.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_bulk_update_job( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		$job_id = absint( $request->get_param( 'job_id' ) );

		if ( ! $job_id && is_array( $params ) && ! empty( $params['job_id'] ) ) {
			$job_id = absint( $params['job_id'] );
		}

		if ( ! $job_id ) {
			return self::permission_error(
				__( 'A valid job ID is required.', 'translatesense' ),
				'rest_invalid_job',
				400
			);
		}

		$job = Bulk_Process::get_job( $job_id );

		if ( ! $job ) {
			return self::permission_error(
				__( 'The requested translation job could not be found.', 'translatesense' ),
				'rest_job_not_found',
				404
			);
		}

		$type = self::resolve_job_item_type( $request, $job );
		if ( '' === $type ) {
			return self::permission_error(
				__( 'Invalid item type specified.', 'translatesense' ),
				'rest_invalid_type',
				400
			);
		}

		$is_term        = ( 'term' === $type );
		$source_post_id = ! empty( $job->post_id ) ? absint( $job->post_id ) : 0;
		$source_term    = $is_term ? get_term( $source_post_id ) : null;
		$job_taxonomy   = $source_term instanceof \WP_Term ? (string) $source_term->taxonomy : '';
		$required_cap   = $is_term ? 'edit_term' : 'edit_post';

		if ( $is_term ) {
			if ( ! $source_term instanceof \WP_Term || ! Taxonomy_Parser::is_translatable_taxonomy( $job_taxonomy ) ) {
				return self::permission_error(
					__( 'The translation job has no valid source taxonomy term.', 'translatesense' ),
					'rest_invalid_job',
					400
				);
			}
		} elseif ( ! $source_post_id || ! get_post( $source_post_id ) ) {
			return self::permission_error(
				__( 'The translation job has no valid source post.', 'translatesense' ),
				'rest_invalid_job',
				400
			);
		}

		if ( ! current_user_can( $required_cap, $source_post_id ) ) {
			return self::permission_error(
				__( 'You are not allowed to update this translation job.', 'translatesense' )
			);
		}

		if ( ! empty( $job->target_post_id ) ) {

			$target_post_id = absint( $job->target_post_id );

			if ( $is_term ) {
				if ( ! $target_post_id || ! get_term( $target_post_id, $job_taxonomy ) instanceof \WP_Term ) {
					return self::permission_error(
						__( 'The translation job has an invalid target term.', 'translatesense' ),
						'rest_invalid_target_post',
						400
					);
				}
			} elseif ( ! $target_post_id || ! get_post( $target_post_id ) ) {
				return self::permission_error(
					__( 'The translation job has an invalid target post.', 'translatesense' ),
					'rest_invalid_target_post',
					400
				);
			}

			if ( ! self::is_job_target( $job, $target_post_id, $type ) ) {
				return self::permission_error(
					__( 'The job target does not match the source translation relationship.', 'translatesense' )
				);
			}

			if ( ! current_user_can( $required_cap, $target_post_id ) ) {
				return self::permission_error(
					__( 'You are not allowed to update the target translation item.', 'translatesense' )
				);
			}
		}

		$updates = is_array( $params ) && isset( $params['data'] ) && is_array( $params['data'] )
			? $params['data']
			: array();

		if ( isset( $updates['target_post_id'] ) ) {

			$target_post_id = absint( $updates['target_post_id'] );

			if ( ! $target_post_id ) {
				return self::permission_error(
					__( 'The target ID is invalid.', 'translatesense' ),
					'rest_invalid_target_post',
					400
				);
			}

			if ( $is_term ) {
				if ( ! get_term( $target_post_id, $job_taxonomy ) instanceof \WP_Term ) {
					return self::permission_error(
						__( 'The target term could not be found.', 'translatesense' ),
						'rest_target_post_not_found',
						404
					);
				}
			} elseif ( ! get_post( $target_post_id ) ) {
				return self::permission_error(
					__( 'The target post could not be found.', 'translatesense' ),
					'rest_target_post_not_found',
					404
				);
			}

			if ( ! self::is_job_target( $job, $target_post_id, $type ) ) {
				return self::permission_error(
					__( 'The requested target is not the translation target for this job.', 'translatesense' )
				);
			}

			if ( ! current_user_can( $required_cap, $target_post_id ) ) {
				return self::permission_error(
					__( 'You are not allowed to update the requested target translation item.', 'translatesense' )
				);
			}
		}

		return true;
	}

	/**
	 * Verify that a candidate target is the actual translation target for a job.
	 *
	 * @param object $job            Job row.
	 * @param int    $target_post_id Candidate target ID.
	 * @param string $type           Runtime item type (`'post'` or `'term'`).
	 * @return bool
	 */
	private static function is_job_target( $job, $target_post_id, string $type = 'post' ) {

		$source_post_id  = ! empty( $job->post_id ) ? absint( $job->post_id ) : 0;
		$target_post_id  = absint( $target_post_id );
		$target_language = '';

		if ( isset( $job->target_language ) ) {
			$target_language = sanitize_key( (string) $job->target_language );
		} elseif ( isset( $job->target_lang ) ) {
			$target_language = sanitize_key( (string) $job->target_lang );
		}

		if ( ! $source_post_id || ! $target_post_id || '' === $target_language ) {
			return false;
		}

		$expected_target_id = ( 'term' === $type )
			? Taxonomy_Parser::get_translation_id( $source_post_id, $target_language )
			: self::get_existing_translation_post_id( $source_post_id, $target_language );

		return $expected_target_id === $target_post_id;
	}

	/**
	 * Permission: GET /bulk-active-batches.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_bulk_active_batches( WP_REST_Request $request ) {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return self::permission_error(
				__( 'You are not allowed to view active translation batches.', 'translatesense' )
			);
		}

		return true;
	}

	/**
	 * Permission: POST /bulk-skip-post.
	 *
	 * Validates:
	 * - batch_id and post_id.
	 * - User capability for the source post and any target posts.
	 * - Provider is strictly OpenAI or Gemini.
	 * - Current job status: must have at least one pending or running job.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_bulk_skip( WP_REST_Request $request ) {
		$params = $request->get_json_params();

		$batch_id = sanitize_text_field( (string) $request->get_param( 'batch_id' ) );
		if ( '' === $batch_id && is_array( $params ) && ! empty( $params['batch_id'] ) ) {
			$batch_id = sanitize_text_field( (string) $params['batch_id'] );
		}

		$post_id = absint( $request->get_param( 'post_id' ) );
		if ( ! $post_id && is_array( $params ) && ! empty( $params['post_id'] ) ) {
			$post_id = absint( $params['post_id'] );
		}

		if ( '' === $batch_id || ! $post_id ) {
			return self::permission_error(
				__( 'A valid batch ID and item ID are required.', 'translatesense' ),
				'rest_invalid_params',
				400
			);
		}

		global $wpdb;
		$table = Bulk_Process::get_table_name();

		if ( ! is_string( $table ) || '' === $table ) {
			return self::permission_error(
				__( 'The translation batch storage is unavailable.', 'translatesense' ),
				'rest_batch_storage_error',
				500
			);
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, post_id, target_post_id, provider, status FROM {$table} WHERE batch_id = %s AND post_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$batch_id,
				$post_id
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return self::permission_error(
				__( 'No translation jobs found for the requested item in this batch.', 'translatesense' ),
				'rest_jobs_not_found',
				404
			);
		}

		if ( ! get_post( $post_id ) ) {
			return self::permission_error(
				__( 'The requested post could not be found.', 'translatesense' ),
				'rest_post_not_found',
				404
			);
		}

		if ( ! is_user_logged_in() || ! current_user_can( 'edit_post', $post_id ) ) {
			return self::permission_error(
				__( 'You are not allowed to modify translations for this post.', 'translatesense' )
			);
		}

		// Provider validation: STRICTLY restricted to OpenAI and Gemini
		foreach ( $rows as $row ) {
			$provider = strtolower( (string) $row['provider'] );
			if ( ! in_array( $provider, array( 'openai', 'gemini' ), true ) ) {
				return self::permission_error(
					__( 'Skip functionality is strictly restricted to OpenAI and Google Gemini background translations.', 'translatesense' ),
					'rest_unsupported_provider',
					403
				);
			}

			$target_post_id = ! empty( $row['target_post_id'] ) ? absint( $row['target_post_id'] ) : 0;
			if ( $target_post_id && get_post( $target_post_id ) && ! current_user_can( 'edit_post', $target_post_id ) ) {
				return self::permission_error(
					__( 'You are not allowed to modify target translations for this post.', 'translatesense' )
				);
			}
		}

		// Status validation: At least one job must be in pending or running state
		$has_active = false;
		foreach ( $rows as $row ) {
			if ( in_array( $row['status'], array( 'pending', 'running' ), true ) ) {
				$has_active = true;
				break;
			}
		}

		if ( ! $has_active ) {
			return self::permission_error(
				__( 'No pending or running translation jobs remain to skip for this post.', 'translatesense' ),
				'rest_no_active_jobs',
				400
			);
		}

		return true;
	}

	/**
	 * Permission: POST /mark-translated.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_mark_translated( WP_REST_Request $request ) {

		return self::require_edit_post(
			self::get_request_post_id( $request ),
			__( 'You are not allowed to mark this post as translated.', 'translatesense' )
		);
	}

	/**
	 * Permission: POST /bulk-translate-term.
	 *
	 * Validates authentication, Polylang taxonomy support, term ownership, and
	 * capabilities to create/update the translated term.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_bulk_translate_term( WP_REST_Request $request ) {

		if ( ! is_user_logged_in() ) {
			return self::permission_error(
				__( 'You must be logged in to translate taxonomy terms.', 'translatesense' ),
				'rest_forbidden',
				401
			);
		}

		$term_id     = absint( $request->get_param( 'term_id' ) );
		$taxonomy    = sanitize_key( (string) $request->get_param( 'taxonomy' ) );
		$target_lang = sanitize_key( (string) $request->get_param( 'target_lang' ) );

		if ( $term_id <= 0 || '' === $taxonomy || '' === $target_lang ) {
			return self::permission_error(
				__( 'A valid taxonomy term ID, taxonomy slug, and target language are required.', 'translatesense' ),
				'rest_invalid_params',
				400
			);
		}

		return Taxonomy_Translator::check_terms_permissions(
			array( $term_id ),
			$taxonomy,
			$target_lang,
			get_current_user_id()
		);
	}

	/**
	 * Permission: POST /clear-block-state.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_clear_block_state( WP_REST_Request $request ) {

		return self::require_edit_post(
			self::get_request_post_id( $request ),
			__( 'You are not allowed to clear block process status for this post.', 'translatesense' )
		);
	}

	/**
	 * Permission: POST /dismiss-initial-prompt.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function permission_dismiss_initial_prompt( WP_REST_Request $request ) {

		return self::require_edit_post(
			self::get_request_post_id( $request ),
			__( 'You are not allowed to update this post.', 'translatesense' )
		);
	}

	/**
	 * Get post ID from REST request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return int
	 */
	private static function get_request_post_id( WP_REST_Request $request ) {

		$post_id = absint( $request->get_param( 'post_id' ) );

		if ( $post_id ) {
			return $post_id;
		}

		$params = $request->get_json_params();

		if ( is_array( $params ) && ! empty( $params['post_id'] ) ) {
			return absint( $params['post_id'] );
		}

		return 0;
	}


	/**
	 * Get widgets status endpoint.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_widgets_status( WP_REST_Request $request ) {

		$rules = Xml_Engine::get_all_rules();

		$response = array(
			'gutenberg' => self::get_gutenberg_widgets_list( $rules['gutenberg'] ),
			'elementor' => self::get_elementor_widgets_list( $rules['elementor'] ),
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Scan registered Gutenberg blocks and match with rules.
	 *
	 * @param array $rules Gutenberg rules.
	 * @return array
	 */
	private static function get_gutenberg_widgets_list( $rules ) {

		$standard_blocks = array();

		if ( class_exists( '\WP_Block_Type_Registry' ) ) {

			$registered = \WP_Block_Type_Registry::get_instance()->get_all_registered();

			foreach ( $registered as $name => $type ) {

				$title = ! empty( $type->title ) ? $type->title : $name;
				$cat   = ! empty( $type->category ) ? $type->category : 'widgets';

				$standard_blocks[ $name ] = array(
					'title'    => $title,
					'category' => $cat,
				);
			}
		}

		$gb_builder = Xml_Engine::get_builder( 'gutenberg' );

		$result = array();

		foreach ( $standard_blocks as $name => $info ) {

			$is_supported = isset( $rules[ $name ] );

			$source = $is_supported
				? ( $rules[ $name ]['source'] ?? 'core' )
				: 'none';

			$keys = $is_supported
				? ( $rules[ $name ]['keys'] ?? array() )
				: array();

			$no_translate = $is_supported
				? ( $rules[ $name ]['no_translate'] ?? array() )
				: array();

			$field_count = $gb_builder
				? $gb_builder->count_leaf_keys( $keys )
				: count( $keys );

			$no_translate_count = count( $no_translate );

			$status = (
				$field_count > 0 ||
				$no_translate_count > 0
			)
				? ( 'custom' === $source ? 'custom' : 'supported' )
				: 'unsupported';

			$xpath  = $is_supported ? ( $rules[ $name ]['xpath'] ?? '' ) : '';
			$xpaths = $is_supported ? ( $rules[ $name ]['xpaths'] ?? array() ) : array();

			$result[] = array(
				'id'                 => $name,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => $status,
				'source'             => $source,
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $keys,
				'xpath'              => $xpath,
				'xpaths'             => $xpaths,
				'xml_snippet'        => Xml_Engine::get_widget_xml_snippet(
					'gutenberg',
					$name
				),
			);
		}

		usort(
			$result,
			static function ( $a, $b ) {
				return strcasecmp(
					(string) $a['name'],
					(string) $b['name']
				);
			}
		);

		return $result;
	}

	/**
	 * Scan registered Elementor widgets and match with rules.
	 *
	 * @param array $rules Elementor rules.
	 * @return array
	 */
	private static function get_elementor_widgets_list( $rules ) {

		$standard_widgets = array();

		if (
			did_action( 'elementor/loaded' ) &&
			class_exists( '\Elementor\Plugin' )
		) {

			$widgets_mgr = \Elementor\Plugin::instance()->widgets_manager;

			if ( $widgets_mgr ) {

				$elementor_registered = $widgets_mgr->get_widget_types();

				foreach ( $elementor_registered as $name => $widget_obj ) {

					$title = method_exists(
						$widget_obj,
						'get_title'
					)
						? $widget_obj->get_title()
						: $name;

					$cat = method_exists(
						$widget_obj,
						'get_categories'
					)
						? implode(
							', ',
							$widget_obj->get_categories()
						)
						: 'general';

					$standard_widgets[ $name ] = array(
						'title'    => $title,
						'category' => $cat,
					);
				}
			}
		}

		$result = array();

		foreach ( $standard_widgets as $name => $info ) {

			$is_supported = isset( $rules[ $name ] );

			$source = $is_supported
				? ( $rules[ $name ]['source'] ?? 'core' )
				: 'none';

			$fields = $is_supported
				? ( $rules[ $name ]['fields'] ?? array() )
				: array();

			$no_translate = $is_supported
				? ( $rules[ $name ]['no_translate'] ?? array() )
				: array();

			$field_count        = count( $fields );
			$no_translate_count = count( $no_translate );

			$status = (
				$field_count > 0 ||
				$no_translate_count > 0
			)
				? ( 'custom' === $source ? 'custom' : 'supported' )
				: 'unsupported';

			$result[] = array(
				'id'                 => $name,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => $status,
				'source'             => $source,
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $fields,
				'xml_snippet'        => Xml_Engine::get_widget_xml_snippet(
					'elementor',
					$name
				),
			);
		}

		usort(
			$result,
			static function ( $a, $b ) {
				return strcasecmp(
					(string) $a['name'],
					(string) $b['name']
				);
			}
		);

		return $result;
	}

	/**
	 * Scan Classic and Custom fields list.
	 *
	 * @param array $rules Custom field rules.
	 * @return array
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

		foreach ( $rules as $field_name => $field_data ) {

			if ( ! isset( $fields[ $field_name ] ) ) {

				$fields[ $field_name ] = array(
					'title'    => ucwords(
						str_replace(
							array( '-', '_' ),
							' ',
							$field_name
						)
					),
					'category' => 'custom',
				);
			}
		}

		$all_engine_rules = Xml_Engine::get_all_rules( 'all' );

		$no_translate_cfs = $all_engine_rules['custom_fields_no_translate'] ?? array();

		$result = array();

		foreach ( $fields as $key => $info ) {

			$is_no_translate = isset(
				$no_translate_cfs[ $key ]
			);

			$is_supported = (
				! $is_no_translate &&
				(
					isset( $rules[ $key ] ) ||
					in_array(
						$key,
						array(
							'post_title',
							'post_content',
							'post_excerpt',
						),
						true
					)
				)
			);

			$field_count        = $is_supported ? 1 : 0;
			$no_translate_count = $is_no_translate ? 1 : 0;

			$field_data = $is_supported
				? array(
					$key => array(
						'name' => $key,
						'type' => 'text',
					),
				)
				: array();

			$result[] = array(
				'id'                 => $key,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => (
					$is_supported || $is_no_translate
				)
					? 'supported'
					: 'unsupported',
				'source'             => isset( $rules[ $key ] )
					? ( $rules[ $key ]['source'] ?? 'core' )
					: 'core',
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $field_data,
				'xml_snippet'        => Xml_Engine::get_widget_xml_snippet(
					'classic',
					$key
				),
			);
		}

		return $result;
	}

	/**
	 * Get XML configuration strings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_xml_config( WP_REST_Request $request ) {
		$builder = $request->get_param( 'builder' )
			? sanitize_key(
				$request->get_param( 'builder' )
			)
			: 'all';

		if ( 'core' === $builder ) {
			$builder = 'all';
		}

		$response = array(
			'builder'    => $builder,
			'custom_xml' => Xml_Engine::get_config( $builder ),
			'rules'      => Xml_Engine::get_all_rules( $builder ),
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Save custom XML configuration.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function save_xml_config( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return new WP_Error(
				'invalid_params',
				__( 'Invalid request data.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$builder = isset( $params['builder'] )
			? sanitize_key( $params['builder'] )
			: 'all';

		if ( 'core' === $builder ) {
			$builder = 'all';
		}

		if ( ! self::is_valid_builder( $builder, true ) ) {
			return new WP_Error( 'invalid_builder', __( 'Invalid builder.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$custom_xml = isset( $params['custom_xml'] )
			? (string) $params['custom_xml']
			: ( isset( $params['xml'] ) ? (string) $params['xml'] : '' );

		$widget_id = isset( $params['widget_id'] )
			? sanitize_text_field( $params['widget_id'] )
			: '';

		if ( strlen( $custom_xml ) > 100000 ) {
			return new WP_Error( 'xml_too_large', __( 'The XML configuration is too large.', 'translatesense' ), array( 'status' => 400 ) );
		}

		if ( ! empty( $widget_id ) ) {

			$saved = Xml_Engine::save_widget_xml_snippet(
				$builder,
				$widget_id,
				$custom_xml
			);

		} else {

			$saved = Xml_Engine::save_config(
				$builder,
				$custom_xml
			);
		}

		if ( is_wp_error( $saved ) ) {
			return new WP_Error(
				'xml_save_failed',
				$saved->get_error_message(),
				array(
					'status' => 400,
				)
			);
		}

		return rest_ensure_response(
			array(
				'success'    => true,
				'builder'    => $builder,
				'widget_id'  => $widget_id,
				'message'    => sprintf(
					/* translators: %s: Page builder name. */
					__( '%s XML configuration saved successfully.', 'translatesense' ),
					ucfirst( $builder )
				),
				'custom_xml' => Xml_Engine::get_config( $builder ),
				'rules'      => Xml_Engine::get_all_rules(
					$builder,
					true
				),
				'all_rules'  => Xml_Engine::get_all_rules(
					'all',
					true
				),
			)
		);
	}

	/**
	 * Generate XML config from in-memory editor content.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function generate_config_from_content( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return new WP_Error(
				'invalid_params',
				__( 'Invalid request data.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$builder = isset( $params['builder'] )
			? sanitize_key( $params['builder'] )
			: 'gutenberg';

		if ( ! self::is_valid_builder( $builder ) ) {
			return new WP_Error( 'invalid_builder', __( 'Invalid builder.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$blocks   = $params['blocks'] ?? array();
		$elements = $params['elements'] ?? array();

		$detection = null;

		if (
			'gutenberg' === $builder &&
			! empty( $blocks ) &&
			is_array( $blocks )
		) {
			$detection = Detector::detect_from_gutenberg_blocks(
				$blocks
			);
		} elseif (
			'elementor' === $builder &&
			! empty( $elements ) &&
			is_array( $elements )
		) {
			$detection = Detector::detect_from_elementor_data(
				$elements
			);
		}

		if (
			! $detection ||
			empty( $detection['xml_snippet'] )
		) {
			return new WP_Error(
				'no_dummy_found',
				__(
					"No placeholder text 'Translate This Content' was found. Please add this text into the block/widget fields you wish to map.",
					'translatesense'
				),
				array(
					'status' => 404,
				)
			);
		}

		return rest_ensure_response(
			array(
				'success'     => true,
				'builder'     => $builder,
				'xml_snippet' => $detection['xml_snippet'],
				'found_items' => $detection['found_items'],
				'message'     => __(
					'XML configuration rule generated successfully!',
					'translatesense'
				),
			)
		);
	}

	/**
	 * Open or create drafting mapping sandbox post.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function open_mapping_sandbox( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		$builder = (
			is_array( $params ) &&
			isset( $params['builder'] )
		)
			? sanitize_key( $params['builder'] )
			: 'gutenberg';

		$sandbox_id = Detector::get_or_create_config_post(
			$builder
		);

		if ( ! $sandbox_id ) {
			return new WP_Error(
				'sandbox_creation_failed',
				__( 'Unable to create mapping sandbox.', 'translatesense' ),
				array(
					'status' => 500,
				)
			);
		}

		$edit_url = get_edit_post_link(
			$sandbox_id,
			'raw'
		);

		if (
			'elementor' === $builder &&
			class_exists( '\Elementor\Plugin' )
		) {

			update_post_meta(
				$sandbox_id,
				'_elementor_edit_mode',
				'builder'
			);
			if ( ! get_post_meta( $sandbox_id, '_elementor_template_type', true ) ) {
				update_post_meta( $sandbox_id, '_elementor_template_type', 'wp-post' );
			}
			if ( ! get_post_meta( $sandbox_id, '_elementor_data', true ) ) {
				update_post_meta( $sandbox_id, '_elementor_data', '[]' );
			}
			if ( defined( 'ELEMENTOR_VERSION' ) ) {
				update_post_meta( $sandbox_id, '_elementor_version', ELEMENTOR_VERSION );
			}

			$document = class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->documents ) ? \Elementor\Plugin::$instance->documents->get( $sandbox_id ) : null;
			$edit_url = $document ? $document->get_edit_url() : add_query_arg(
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
	 * Get Gutenberg block configuration rules.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_gutenberg_config( WP_REST_Request $request ) {

		$gutenberg_rules = Xml_Engine::get_all_rules(
			'gutenberg'
		);

		return rest_ensure_response(
			array(
				'success'     => true,
				'block_rules' => $gutenberg_rules,
				'block_names' => array_keys( $gutenberg_rules ),
			)
		);
	}

	/**
	 * Get specific editor XML configuration.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_editor_xml_config( WP_REST_Request $request ) {

		$editor = sanitize_key(
			(string) (
				$request->get_param( 'editor' )
				?: $request->get_param( 'builder' )
				?: ''
			)
		);

		if (
			empty( $editor ) ||
			'all' === $editor ||
			! in_array(
				$editor,
				Xml_Engine::BUILDERS,
				true
			)
		) {
			return new WP_Error(
				'invalid_editor',
				__(
					'Invalid or missing editor parameter. Please specify a specific editor (gutenberg, elementor).',
					'translatesense'
				),
				array(
					'status' => 400,
				)
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
				'block_rules'  => (
					'gutenberg' === $editor
				)
					? $rules
					: array(),
				'widget_rules' => (
					'elementor' === $editor
				)
					? $rules
					: array(),
				'field_rules'  => (
					'classic' === $editor
				)
					? $rules
					: array(),
			)
		);
	}

	/**
	 * Get comprehensive page content.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_page_content( WP_REST_Request $request ) {

		$post_id = absint(
			$request->get_param( 'post_id' )
		);

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post_id',
				__( 'A valid post_id parameter is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'post_not_found',
				__( 'Post not found.', 'translatesense' ),
				array(
					'status' => 404,
				)
			);
		}

		$editor_type = Editor_Integration::get_post_editor_type(
			$post_id
		);

		if ( 'elementor' === $editor_type ) {

			$elementor_data = array();

			if (
				class_exists( '\Elementor\Plugin' ) &&
				isset( \Elementor\Plugin::$instance->documents )
			) {

				$elementor_doc = \Elementor\Plugin::$instance->documents->get(
					$post_id
				);

				if (
					$elementor_doc &&
					method_exists(
						$elementor_doc,
						'get_elements_data'
					)
				) {
					$elementor_data     = $elementor_doc->get_elements_data();
					$post->post_content = $elementor_data;
				} else {
					$post->post_content = '';
				}
			}
		}

		return rest_ensure_response(
			array(
				'success'          => true,
				'title'            => $post->post_title,
				'content'          => $post->post_content,
				'excerpt'          => $post->post_excerpt,
				'slug'             => $post->post_name,
				'hideReviewNotice' => Admin_Menu::is_review_notice_hidden(),
			)
		);
	}

	/**
	 * Get plugin settings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_settings( WP_REST_Request $request ) {

		global $wpdb;

		$settings = get_option(
			'translatesense_settings',
			array()
		);

		$defaults = array(
			'provider'          => '',
			'openai_api_key'    => '',
			'openai_model'      => 'gpt-4o-mini',
			'gemini_api_key'    => '',
			'gemini_model'      => 'gemini-3.5-flash-lite',
			'enabled_providers' => array(
				'chrome_ai',
				'openai',
				'gemini',
			),
			'batch_size'        => 25,
			'response_timeout'  => 30,
			'max_tokens'        => 4096,
			'temperature'       => 0.2,
			'custom_prompt'     => '',
			'default_prompt'    => Translate::DEFAULT_PROMPT,
			'slug_translation'  => 'slug_translate',
			'post_status'       => 'draft',
		);

		$settings = wp_parse_args(
			$settings,
			$defaults
		);

		$settings['slug_translation'] = ( isset( $settings['slug_translation'] ) && in_array( sanitize_key( (string) $settings['slug_translation'] ), array( 'keep_orignal', 'title_based', 'slug_translate' ), true ) )
			? sanitize_key( (string) $settings['slug_translation'] )
			: 'slug_translate';

		$settings['post_status'] = ( isset( $settings['post_status'] ) && in_array( sanitize_key( (string) $settings['post_status'] ), array( 'publish', 'draft' ), true ) )
			? sanitize_key( (string) $settings['post_status'] )
			: 'draft';

		if ( empty( $settings['default_prompt'] ) ) {
			$settings['default_prompt'] = Translate::DEFAULT_PROMPT;
		}

		$languages = Polylang_Bridge::get_languages();

		$polylang_active = Polylang_Bridge::is_polylang_active();

		$table_translations = Hashing_Db::get_translations_table();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$packages_count = (int) $wpdb->get_var(
			"SELECT COUNT(id) FROM {$wpdb->prefix}translatesense_packages" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results_count = (int) $wpdb->get_var(
			"SELECT COUNT(id) FROM {$table_translations} WHERE translated_string != ''" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		$bridge = Ai_Connector_Bridge::get_instance();

		$active_providers = self::redact_sensitive_values(
			$bridge->get_active_providers()
		);

		$provider_models = array();

		foreach ( $active_providers as $p_id => $p_opts ) {

			$provider_models[ $p_id ] = self::redact_sensitive_values(
				$bridge->get_models(
					(string) $p_id,
					(array) $p_opts
				)
			);
		}

		$response_settings = $settings;

		foreach ( array( 'openai_api_key', 'gemini_api_key' ) as $secret_key ) {
			$response_settings[ $secret_key ] = self::mask_api_key( ! empty( $settings[ $secret_key ] ) ? (string) $settings[ $secret_key ] : '' );
		}

		return rest_ensure_response(
			array(
				'settings'         => $response_settings,
				'languages'        => $languages,
				'polylang_active'  => $polylang_active,
				'active_builders'  => Admin_Menu::get_active_builders(),
				'active_providers' => $active_providers,
				'provider_models'  => $provider_models,
				'connectors_url'   => esc_url_raw(
					admin_url( 'options-connectors.php' )
				),
				'cache_counts'     => Hashing_Db::get_cache_counts(),
				'stats'            => array_merge(
					array(
						'total_packages' => $packages_count,
						'cached_results' => $results_count,
					),
					Statics::get_translation_statistics()
				),
			)
		);
	}

	/**
	 * Update plugin settings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_settings( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return new WP_Error(
				'invalid_params',
				__( 'Invalid request data.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$current = get_option(
			'translatesense_settings',
			array()
		);

		$updated = self::sanitize_settings( $params, $current );

		if ( is_wp_error( $updated ) ) {
			return rest_ensure_response(
				array(
					'success' => false,
					'message' => $updated->get_error_message(),
				)
			);
		}

		update_option(
			'translatesense_settings',
			$updated
		);

		$bridge = Ai_Connector_Bridge::get_instance();

		$active_providers = self::redact_sensitive_values(
			$bridge->get_active_providers( true )
		);

		$provider_models = array();

		foreach ( $active_providers as $p_id => $p_opts ) {

			$provider_models[ $p_id ] = self::redact_sensitive_values(
				$bridge->get_models(
					(string) $p_id,
					(array) $p_opts
				)
			);
		}

		$response_settings = $updated;

		foreach ( array( 'openai_api_key', 'gemini_api_key' ) as $secret_key ) {
			$response_settings[ $secret_key ]          = self::mask_api_key( ! empty( $updated[ $secret_key ] ) ? (string) $updated[ $secret_key ] : '' );
			$response_settings[ 'has_' . $secret_key ] = ! empty( $updated[ $secret_key ] );
		}

		return rest_ensure_response(
			array(
				'success'          => true,
				'message'          => __(
					'Settings updated successfully.',
					'translatesense'
				),
				'settings'         => $response_settings,
				'active_providers' => $active_providers,
				'provider_models'  => $provider_models,
			)
		);
	}


	/**
	 * Redact sensitive provider configuration before it is returned by REST.
	 *
	 * @param mixed $value Provider configuration.
	 * @param int   $depth Recursion depth.
	 * @return mixed
	 */
	private static function redact_sensitive_values( $value, $depth = 0 ) {

		if ( $depth > 10 ) {
			return null;
		}

		if ( is_array( $value ) ) {

			$redacted = array();

			foreach ( $value as $key => $item ) {

				$key_string = is_string( $key ) ? strtolower( $key ) : '';

				if (
					false !== strpos( $key_string, 'api_key' ) ||
					false !== strpos( $key_string, 'apikey' ) ||
					false !== strpos( $key_string, 'access_token' ) ||
					false !== strpos( $key_string, 'refresh_token' ) ||
					false !== strpos( $key_string, 'client_secret' ) ||
					false !== strpos( $key_string, 'password' ) ||
					false !== strpos( $key_string, 'secret_key' )
				) {
					$redacted[ $key ] = ! empty( $item );
					continue;
				}

				$redacted[ $key ] = self::redact_sensitive_values(
					$item,
					$depth + 1
				);
			}

			return $redacted;
		}

		return $value;
	}


	/**
	 * Check whether a builder slug is supported.
	 *
	 * @param string $builder Builder slug.
	 * @param bool   $allow_all Whether the all value is allowed.
	 * @return bool
	 */
	private static function is_valid_builder( $builder, $allow_all = false ) {
		$allowed = array( 'gutenberg', 'elementor' );

		if ( $allow_all ) {
			$allowed[] = 'all';
		}

		return in_array( sanitize_key( $builder ), $allowed, true );
	}

	/**
	 * Mask an API key, keeping only the last 4–5 characters visible.
	 *
	 * @param string $key Raw API key.
	 * @return string Masked API key, or empty string if key is empty.
	 */
	private static function mask_api_key( string $key ): string {
		$key = trim( $key );
		$len = strlen( $key );

		if ( 0 === $len ) {
			return '';
		}

		$visible_len = $len > 5 ? 5 : max( 1, $len - 1 );
		$masked_len  = max( 8, $len - $visible_len );

		return str_repeat( '•', $masked_len ) . substr( $key, -$visible_len );
	}

	/**
	 * Sanitize supported plugin settings before persistence.
	 *
	 * @param array $input Submitted settings.
	 * @param array $current Current settings.
	 * @return array|WP_Error
	 */
	private static function sanitize_settings( $input, $current ) {

		$updated = is_array( $current ) ? $current : array();

		if ( isset( $input['provider'] ) ) {
			$updated['provider'] = sanitize_key( $input['provider'] );
		}

		$bridge = Ai_Connector_Bridge::get_instance();

		foreach ( array( 'openai_api_key', 'gemini_api_key' ) as $key ) {
			if ( ! isset( $input[ $key ] ) ) {
				continue;
			}

			if ( is_bool( $input[ $key ] ) ) {
				continue;
			}

			$value           = trim( (string) $input[ $key ] );
			$existing_key    = isset( $current[ $key ] ) ? trim( (string) $current[ $key ] ) : '';
			$expected_masked = self::mask_api_key( $existing_key );

			// 1. If the submitted API key is empty, do not update the existing saved API key.
			if ( '' === $value ) {
				continue;
			}

			// 2 & 3. If submitted key is unchanged from or contains the existing masked representation, preserve existing key.
			if ( '' !== $expected_masked && ( $value === $expected_masked || false !== strpos( $value, $expected_masked ) ) ) {
				continue;
			}

			// 4. Only update the saved API key when the user submits a new, actual API key.
			if ( 'true' !== $value && 'false' !== $value && '1' !== $value && '0' !== $value ) {

				$api_key     = sanitize_text_field( $value );
				$provider_id = str_replace( '_api_key', '', $key );

				$validate_key = $bridge->api_key_validation( $provider_id, $api_key );

				if ( is_wp_error( $validate_key ) ) {
					$error_message = (string) $validate_key->get_error_message();

					$is_invalid_key = false !== stripos( $error_message, 'incorrect api key' )
					|| false !== stripos( $error_message, 'API key not valid.' );

					return new WP_Error(
						'api_key_validation_failed',
						sprintf(
						/* translators: %1$s: AI provider ID, %2$s: validation error. */
							__( '%1$s: %2$s', 'translatesense' ),
							$provider_id,
							$is_invalid_key
							? __( 'Invalid API key.', 'translatesense' )
							: __( 'API key validation failed.', 'translatesense' )
						)
					);
				}

				$updated[ $key ] = $api_key;
			}
		}

		foreach ( array( 'openai_model', 'gemini_model' ) as $key ) {
			if ( isset( $input[ $key ] ) ) {
				$updated[ $key ] = sanitize_text_field( $input[ $key ] );
			}
		}

		if ( isset( $input['enabled_providers'] ) && is_array( $input['enabled_providers'] ) ) {
			$updated['enabled_providers'] = array_values( array_unique( array_filter( array_map( 'sanitize_key', $input['enabled_providers'] ) ) ) );
		}

		if ( isset( $input['batch_size'] ) ) {
			$updated['batch_size'] = max( 1, min( 500, absint( $input['batch_size'] ) ) );
		}

		if ( isset( $input['response_timeout'] ) ) {
			$updated['response_timeout'] = max( 1, min( 300, absint( $input['response_timeout'] ) ) );
		}

		if ( isset( $input['max_tokens'] ) ) {
			$updated['max_tokens'] = max( 1, min( 100000, absint( $input['max_tokens'] ) ) );
		}

		if ( isset( $input['temperature'] ) ) {
			$updated['temperature'] = max( 0, min( 2, (float) $input['temperature'] ) );
		}

		foreach ( array( 'custom_prompt', 'default_prompt' ) as $key ) {
			if ( isset( $input[ $key ] ) ) {
				$updated[ $key ] = sanitize_textarea_field( $input[ $key ] );
			}
		}

		if ( isset( $input['slug_translation'] ) ) {
			$allowed_slug_trans          = array( 'keep_orignal', 'title_based', 'slug_translate' );
			$val                         = sanitize_key( (string) $input['slug_translation'] );
			$updated['slug_translation'] = in_array( $val, $allowed_slug_trans, true ) ? $val : 'slug_translate';
		}

		if ( isset( $input['post_status'] ) ) {
			$allowed_post_status    = array( 'publish', 'draft' );
			$val                    = sanitize_key( (string) $input['post_status'] );
			$updated['post_status'] = in_array( $val, $allowed_post_status, true ) ? $val : 'draft';
		}

		if ( empty( $updated['default_prompt'] ) ) {
			$updated['default_prompt'] = Translate::DEFAULT_PROMPT;
		}

		return $updated;
	}

	/**
	 * Extract translatable strings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function extract_strings( WP_REST_Request $request ) {

		$params  = $request->get_json_params();
		$subtype = sanitize_key( (string) ( is_array( $params ) && isset( $params['subtype'] ) ? $params['subtype'] : $request->get_param( 'subtype' ) ) );

		$post_id = self::get_request_post_id(
			$request
		);

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post_id',
				__( 'Post or term ID is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$target_language = isset( $params['target_lang'] ) ? sanitize_key( (string) $params['target_lang'] ) : sanitize_key( (string) $request->get_param( 'target_lang' ) );
		$type            = self::get_request_item_type( $request );

		if ( '' === $type ) {
			return new WP_Error( 'invalid_type', __( 'Invalid item type specified.', 'translatesense' ), array( 'status' => 400 ) );
		}

		if ( 'term' === $type ) {
			if ( '' !== $subtype && ! Taxonomy_Parser::is_translatable_taxonomy( $subtype ) ) {
				return new WP_Error( 'invalid_taxonomy', __( 'The selected taxonomy is not supported for translation.', 'translatesense' ), array( 'status' => 400 ) );
			}

			$term = get_term( $post_id, $subtype );
			if ( ! $term instanceof \WP_Term || ! Taxonomy_Parser::is_translatable_taxonomy( (string) $term->taxonomy ) ) {
				return new WP_Error( 'term_not_found', __( 'Taxonomy term not found.', 'translatesense' ), array( 'status' => 404 ) );
			}

			$term_taxonomy = (string) $term->taxonomy;
			$term_lang     = Taxonomy_Parser::get_term_language( $post_id );
			$source_lang   = '' !== $term_lang ? $term_lang : sanitize_key( (string) Polylang_Bridge::get_default_language() );

			$term_strings = '' !== $target_language
				? Taxonomy_Parser::extract_terms_strings( array( $post_id ), $term_taxonomy, $target_language, get_current_user_id(), true )
				: array();

			return rest_ensure_response(
				array(
					'success'                     => true,
					'editor_type'                 => 'taxonomy',
					'type'                        => 'term',
					'taxonomy'                    => $term_taxonomy,
					'subtype'                     => $term_taxonomy,
					'source_language'             => $source_lang,
					'strings'                     => $term_strings,
					'custom_fields_sync_enabled'  => false,
					'skipped_custom_fields_count' => 0,
				)
			);
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'post_not_found',
				__( 'Post not found.', 'translatesense' ),
				array(
					'status' => 404,
				)
			);
		}

		$source_editor_type = Editor_Integration::get_post_editor_type(
			$post_id
		);

		$target_editor_type = (
			is_array( $params ) &&
			! empty( $params['builder'] )
		)
			? sanitize_key( $params['builder'] )
			: $source_editor_type;

		if ( 'core' === $target_editor_type ) {
			$target_editor_type = 'gutenberg';
		}

		$normalized_source = (
			'core' === $source_editor_type
		)
			? 'gutenberg'
			: $source_editor_type;

		if (
			$target_editor_type !== $normalized_source &&
			$target_editor_type !== $source_editor_type
		) {
			return new WP_Error(
				'invalid_editor_type',
				sprintf(
					/* translators: 1: Source editor type, 2: Target editor type. */
					__(
						'Source editor type (%1$s) must be same as Current Post editor type (%2$s).',
						'translatesense'
					),
					$source_editor_type,
					$target_editor_type
				),
				array(
					'status' => 400,
				)
			);
		}

		$source_language = Polylang_Bridge::get_post_language(
			$post_id
		);

		if ( ! $source_language ) {
			return new WP_Error(
				'invalid_source_language',
				__( 'Source language is required. It seems the post is not assigned a language.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$is_sync_enabled = Polylang_Bridge::is_custom_fields_sync_enabled();
		$package_options = array();
		if ( $is_sync_enabled ) {
			$package_options['exclude'] = array( 'custom_field' ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude
		}

		$package_strings = Hashing_Db::get_post_package(
			$post_id,
			$source_language,
			$source_editor_type,
			$package_options
		);

		if ( empty( $package_strings ) ) {

			$package_strings = Content_Parser::parse(
				'',
				$post_id,
				$source_language,
				$source_editor_type
			);
		}

		$skipped_cf_count = 0;

		if ( $is_sync_enabled ) {
			// Count translatable custom fields skipped due to Polylang synchronization
			$fields           = Custom_Field_Parser::get_post_fields( $post_id, $source_editor_type );
			$user_rules       = Xml_Engine::get_user_custom_field_rules( $source_editor_type );
			$resolved_rules   = Custom_Field_Rule_Resolver::resolve_all_rules( $fields, $user_rules );
			$cf_strings       = Custom_Field_Parser::extract_strings( $post_id, $fields, $resolved_rules );
			$skipped_cf_count = count( $cf_strings );

			if ( Custom_Field_Manager::has_package_rows( $post_id, $source_editor_type ) ) {
				Custom_Field_Manager::purge_package_rows( $post_id, $source_editor_type );
			}
		} else {
			Custom_Field_Manager::ensure_package_prepared(
				$post_id,
				$source_language,
				$source_editor_type
			);
		}

		$package_strings = Hashing_Db::get_post_package(
			$post_id,
			$source_language,
			$source_editor_type,
			$package_options
		);

		if ( is_wp_error( $package_strings ) ) {
			return $package_strings;
		}

		// Taxonomy strings are extracted for Workflow B (post bulk translation) only.
		// Individual editor translation omits taxonomy extraction/translation.
		$include_taxonomies = is_array( $params ) && ! empty( $params['include_taxonomies'] );
		$taxonomy_strings   = ( $include_taxonomies && '' !== $target_language )
			? Taxonomy_Parser::extract_strings( $post_id, $target_language, get_current_user_id(), true )
			: array();

		if ( ! empty( $taxonomy_strings ) ) {
			$package_strings = array_merge( $package_strings, $taxonomy_strings );
		}

		return rest_ensure_response(
			array(
				'success'                     => true,
				'editor_type'                 => $source_editor_type,
				'source_language'             => $source_language,
				'strings'                     => $package_strings,
				'custom_fields_sync_enabled'  => $is_sync_enabled,
				'skipped_custom_fields_count' => $skipped_cf_count,
			)
		);
	}

	/**
	 * Translate a batch of strings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function translate_batch( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return new WP_Error(
				'invalid_params',
				__( 'Invalid request data.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$strings = isset( $params['strings'] ) ? $params['strings'] : array();

		$source_lang = isset( $params['source_lang'] )
			? sanitize_key( $params['source_lang'] )
			: 'en';

		$target_lang = isset( $params['target_lang'] )
			? sanitize_key( $params['target_lang'] )
			: 'es';

		$provider = isset( $params['provider'] )
			? sanitize_key( $params['provider'] )
			: '';

		if ( empty( $strings ) || ! is_array( $strings ) ) {
			return new WP_Error(
				'invalid_strings',
				__( 'A valid strings array is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		if ( empty( $target_lang ) ) {
			return new WP_Error(
				'invalid_target_language',
				__( 'A target language is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$custom_opts = array();

		if ( $provider ) {
			$custom_opts['provider'] = $provider;
		}

		$results = Translate::translate_batch(
			$strings,
			$source_lang,
			$target_lang,
			$custom_opts
		);

		if ( is_wp_error( $results ) ) {
			return $results;
		}

		return rest_ensure_response(
			array(
				'results' => $results,
			)
		);
	}

	/**
	 * Translate complete post.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function translate_post( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		$post_id = self::get_request_post_id(
			$request
		);

		$target_lang = isset( $params['target_lang'] )
			? sanitize_key( $params['target_lang'] )
			: '';

		$provider = isset( $params['provider'] )
			? sanitize_key( $params['provider'] )
			: '';

		$in_memory_translations = isset(
			$params['in_memory_translations']
		)
			? $params['in_memory_translations']
			: array();

		if ( ! $post_id || empty( $target_lang ) ) {
			return new WP_Error(
				'invalid_params',
				__(
					'Post ID and Target Language are required.',
					'translatesense'
				),
				array(
					'status' => 400,
				)
			);
		}

		if (
			! is_array( $in_memory_translations )
		) {
			return new WP_Error(
				'invalid_translations',
				__( 'Invalid translation data.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$normalized_translations = self::normalize_translation_value(
			$in_memory_translations
		);

		if ( ! is_array( $normalized_translations ) ) {
			return new WP_Error(
				'invalid_translations',
				__( 'Invalid translation data.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		if ( strlen( wp_json_encode( $normalized_translations ) ) > 1048576 ) {
			return new WP_Error(
				'rest_request_too_large',
				__( 'The translation data is too large.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$result = Translate::translate_post(
			$post_id,
			(string) $target_lang,
			(string) $provider,
			$normalized_translations,
			array(
				'user_id'            => get_current_user_id(),
				'skip_unauthorized'  => true,
				'include_taxonomies' => is_array( $params ) && ! empty( $params['include_taxonomies'] ),
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! empty( $result['target_post_id'] ) ) {

			$target_post_id            = absint( $result['target_post_id'] );
			$authorized_target_post_id = self::get_existing_translation_post_id(
				$post_id,
				$target_lang
			);

			if (
				$target_post_id > 0 &&
				$target_post_id === $authorized_target_post_id &&
				current_user_can( 'edit_post', $target_post_id )
			) {
				update_post_meta(
					$target_post_id,
					'_translatesense_translated',
					$target_post_id
				);
			}
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Start bulk translation batch.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_start( WP_REST_Request $request ) {

		$params  = $request->get_json_params();
		$subtype = sanitize_key( (string) ( is_array( $params ) && isset( $params['subtype'] ) ? $params['subtype'] : '' ) );

		$post_ids = (
			is_array( $params ) &&
			isset( $params['post_ids'] )
		)
			? $params['post_ids']
			: array();

		$target_languages = (
			is_array( $params ) &&
			isset( $params['target_languages'] )
		)
			? $params['target_languages']
			: array();

		$provider = (
			is_array( $params ) &&
			isset( $params['provider'] )
		)
			? sanitize_key( $params['provider'] )
			: 'openai';

		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return new WP_Error(
				'invalid_posts',
				__( 'Item IDs array is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		if (
			empty( $target_languages ) ||
			! is_array( $target_languages )
		) {
			return new WP_Error(
				'invalid_languages',
				__( 'Target languages array is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$clean_post_ids = array();

		foreach ( $post_ids as $post_id ) {

			$post_id = absint( $post_id );

			if ( $post_id ) {
				$clean_post_ids[] = $post_id;
			}
		}

		$clean_post_ids = array_values(
			array_unique( $clean_post_ids )
		);

		$type = self::get_request_item_type( $request );
		if ( '' === $type ) {
			return new WP_Error(
				'invalid_type',
				__( 'Invalid item type specified.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		if ( 'term' === $type ) {
			if ( '' === $subtype && ! empty( $clean_post_ids ) ) {
				$first_term = get_term( $clean_post_ids[0] );
				if ( $first_term instanceof \WP_Term ) {
					$subtype = sanitize_key( (string) $first_term->taxonomy );
				}
			}
			$clean_post_ids = Taxonomy_Parser::filter_linked_terms( $clean_post_ids, $subtype );
		} else {
			$clean_post_ids = Bulk_Process::filter_linked_posts( $clean_post_ids );
		}

		if ( empty( $clean_post_ids ) ) {
			return new WP_Error(
				'invalid_posts',
				__( 'No valid item IDs were supplied.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$result = Bulk_Process::create_batch(
			$clean_post_ids,
			$target_languages,
			(string) $provider,
			array(
				'type'    => $type,
				'subtype' => $subtype,
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! empty( $result['error'] ) ) {
			return new WP_Error(
				'bulk_batch_error',
				(string) $result['error'],
				array( 'status' => 400 )
			);
		}

		if ( is_array( $result ) ) {
			$result['hideReviewNotice'] = Admin_Menu::is_review_notice_hidden();
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Bulk Translation Status Polling Endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_status( WP_REST_Request $request ) {

		$batch_id = sanitize_text_field(
			(string) $request->get_param( 'batch_id' )
		);

		$post_id = absint(
			$request->get_param( 'post_id' )
		);

		if ( '' === $batch_id ) {
			return new WP_Error(
				'invalid_batch',
				__( 'A valid batch ID is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$status = Bulk_Process::get_batch_status(
			$batch_id,
			$post_id
		);

		if ( is_wp_error( $status ) ) {
			return $status;
		}

		return rest_ensure_response( $status );
	}

	/**
	 * Bulk Translation Update Job Endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_update_job( WP_REST_Request $request ) {

		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return new WP_Error(
				'invalid_params',
				__( 'Invalid request data.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$job_id = isset( $params['job_id'] )
			? absint( $params['job_id'] )
			: 0;

		$updates = isset( $params['data'] )
			? $params['data']
			: array();

		if (
			! $job_id ||
			empty( $updates ) ||
			! is_array( $updates )
		) {
			return new WP_Error(
				'invalid_params',
				__(
					'Job ID and update data are required.',
					'translatesense'
				),
				array(
					'status' => 400,
				)
			);
		}

		/*
		 * Only these columns may be updated.
		 */
		$allowed = array(
			'status',
			'progress_status',
			'total_strings',
			'completed_strings',
			'sent_data',
			'receive_data',
			'error_message',
			'target_post_id',
		);

		$clean_data = array();

		foreach ( $allowed as $column ) {

			if ( ! array_key_exists( $column, $updates ) ) {
				continue;
			}

			$value = $updates[ $column ];

			switch ( $column ) {
				case 'total_strings':
				case 'completed_strings':
				case 'target_post_id':
					$clean_data[ $column ] = absint( $value );
					break;

				case 'status':
				case 'progress_status':
				case 'error_message':
					$clean_data[ $column ] = sanitize_text_field( (string) $value );
					break;

				case 'sent_data':
				case 'receive_data':
					$normalized_value      = self::normalize_translation_value( $value );
					$clean_data[ $column ] = is_array( $normalized_value )
						? wp_json_encode( $normalized_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES )
						: (string) $normalized_value;
					break;
			}
		}

		$job = Bulk_Process::get_job( $job_id );

		if ( ! $job ) {
			return new WP_Error(
				'job_not_found',
				__( 'The requested translation job could not be found.', 'translatesense' ),
				array( 'status' => 404 )
			);
		}

		if ( isset( $clean_data['status'] ) ) {

			$allowed_statuses = array(
				'pending',
				'processing',
				'completed',
				'failed',
				'cancelled',
				'error',
			);

			if ( ! in_array( $clean_data['status'], $allowed_statuses, true ) ) {
				return new WP_Error(
					'invalid_status',
					__( 'Invalid translation job status.', 'translatesense' ),
					array( 'status' => 400 )
				);
			}
		}

		$type = self::resolve_job_item_type( $request, $job );
		if ( '' === $type ) {
			return new WP_Error(
				'invalid_type',
				__( 'Invalid item type specified.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		if (
			isset( $clean_data['target_post_id'] ) &&
			$clean_data['target_post_id'] > 0 &&
			! self::is_job_target( $job, $clean_data['target_post_id'], $type )
		) {
			return new WP_Error(
				'invalid_target_post',
				__( 'The target post does not belong to this translation job.', 'translatesense' ),
				array( 'status' => 403 )
			);
		}

		if ( empty( $clean_data ) ) {
			return new WP_Error(
				'invalid_updates',
				__( 'No valid job fields were supplied.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		if (
			isset( $updates['status'] ) &&
			'completed' === $updates['status'] &&
			! empty( $updates['target_post_id'] )
		) {

			$target_post_id = absint( $updates['target_post_id'] );

			if ( 'term' === $type ) {
				$source_term  = ! empty( $job->post_id ) ? get_term( absint( $job->post_id ) ) : null;
				$job_taxonomy = $source_term instanceof \WP_Term ? (string) $source_term->taxonomy : '';
				if (
					'' === $job_taxonomy
					|| ! get_term( $target_post_id, $job_taxonomy ) instanceof \WP_Term
					|| ! self::is_job_target( $job, $target_post_id, 'term' )
					|| ! current_user_can( 'edit_term', $target_post_id )
				) {
					return new WP_Error(
						'rest_forbidden',
						__( 'You are not allowed to update the target translation term.', 'translatesense' ),
						array( 'status' => rest_authorization_required_code() )
					);
				}
			} else {
				if (
					! get_post( $target_post_id ) ||
					! self::is_job_target( $job, $target_post_id, 'post' ) ||
					! current_user_can( 'edit_post', $target_post_id )
				) {
					return new WP_Error(
						'rest_forbidden',
						__( 'You are not allowed to update the target translation post.', 'translatesense' ),
						array( 'status' => rest_authorization_required_code() )
					);
				}

				update_post_meta(
					$target_post_id,
					'_translatesense_translated',
					$target_post_id
				);

				$target_post = get_post( $target_post_id );
				if ( $target_post && function_exists( 'has_blocks' ) && has_blocks( $target_post->post_content ) ) {
					Block_Processor::mark_process_pending( $target_post_id );
				}
			}
		}

		$updated = Bulk_Process::update_job(
			$job_id,
			$clean_data
		);

		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		if ( isset( $clean_data['status'] ) && in_array( $clean_data['status'], array( 'completed', 'failed' ), true ) ) {
			$job_provider = ! empty( $job->provider ) ? $job->provider : 'chrome_ai';
			$c_strings    = isset( $clean_data['completed_strings'] )
				? (int) $clean_data['completed_strings']
				: ( isset( $clean_data['total_strings'] ) ? (int) $clean_data['total_strings'] : 0 );
			$c_chars      = isset( $updates['total_characters'] )
				? absint( $updates['total_characters'] )
				: ( isset( $params['total_characters'] ) ? absint( $params['total_characters'] ) : 0 );

			if ( 0 === $c_chars && ! empty( $clean_data['sent_data'] ) ) {
				$sent_arr = json_decode( $clean_data['sent_data'], true );
				if ( is_array( $sent_arr ) ) {
					foreach ( $sent_arr as $item_text ) {
						$c_chars += mb_strlen( (string) $item_text );
					}
				}
			}

			$time_take = isset( $updates['time_take'] )
				? absint( $updates['time_take'] )
				: 0;

			$is_job_completed = ( 'completed' === $clean_data['status'] );

			Statics::update_translation_statistics(
				array(
					'status'           => $is_job_completed ? 'success' : 'failed',
					'total_characters' => $is_job_completed ? $c_chars : 0,
					'total_strings'    => $is_job_completed ? $c_strings : 0,
					'provider'         => $job_provider,
					'time_take'        => $time_take,
					'request_id'       => 'bulk_job_' . $job_id,
				)
			);
		}

		return rest_ensure_response(
			array(
				'success' => (bool) $updated,
				'job_id'  => $job_id,
			)
		);
	}

	/**
	 * Bulk Skip Post Jobs Endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_skip_post( WP_REST_Request $request ) {
		$params = $request->get_json_params();

		$batch_id = sanitize_text_field( (string) $request->get_param( 'batch_id' ) );
		if ( '' === $batch_id && is_array( $params ) && ! empty( $params['batch_id'] ) ) {
			$batch_id = sanitize_text_field( (string) $params['batch_id'] );
		}

		$post_id = absint( $request->get_param( 'post_id' ) );
		if ( ! $post_id && is_array( $params ) && ! empty( $params['post_id'] ) ) {
			$post_id = absint( $params['post_id'] );
		}

		$result = Bulk_Process::skip_post_in_batch( $batch_id, $post_id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Bulk Active Batches Endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_active_batches( WP_REST_Request $request ) {
		$batches          = Bulk_Process::get_active_background_batches();
		$filtered_batches = array();

		foreach ( $batches as $batch ) {
			if ( empty( $batch['items'] ) || ! is_array( $batch['items'] ) ) {
				continue;
			}

			$filtered_items = array();
			foreach ( $batch['items'] as $item ) {
				$item_post_id = isset( $item['post_id'] ) ? absint( $item['post_id'] ) : 0;
				if ( $item_post_id > 0 && current_user_can( 'edit_post', $item_post_id ) ) {
					$filtered_items[] = $item;
				}
			}

			if ( ! empty( $filtered_items ) ) {
				$batch['items']      = $filtered_items;
				$batch['total_jobs'] = count( $filtered_items );
				$filtered_batches[]  = $batch;
			}
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'batches' => $filtered_batches,
			)
		);
	}

	/**
	 * Mark post as translated.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function mark_translated( WP_REST_Request $request ) {
		$post_id = self::get_request_post_id(
			$request
		);

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post',
				__( 'A valid Post ID is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'post_not_found',
				__( 'The requested post could not be found.', 'translatesense' ),
				array(
					'status' => 404,
				)
			);
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error(
				'rest_forbidden',
				__(
					'You do not have permission to edit this post.',
					'translatesense'
				),
				array(
					'status' => rest_authorization_required_code(),
				)
			);
		}

		update_post_meta(
			$post_id,
			'_translatesense_translation_update_pending',
			$post_id
		);

		// Extract and sanitize translation statistics parameters.
		$raw_status       = $request->get_param( 'status' );
		$status           = ! empty( $raw_status ) ? sanitize_key( (string) $raw_status ) : 'success';
		$total_characters = absint( $request->get_param( 'total_characters' ) );
		$total_strings    = absint( $request->get_param( 'total_strings' ) );
		$provider         = sanitize_key( (string) $request->get_param( 'provider' ) );
		$time_take        = absint( $request->get_param( 'time_take' ) );

		$stats = null;
		if ( $total_characters > 0 || $total_strings > 0 || ! empty( $provider ) || $time_take > 0 ) {
			$stats = Statics::update_translation_statistics(
				array(
					'status'           => $status,
					'total_characters' => $total_characters,
					'total_strings'    => $total_strings,
					'provider'         => $provider,
					'time_take'        => $time_take,
					'request_id'       => 'mark_translated_' . $post_id . '_' . $provider . '_' . current_time( 'timestamp' ),
				)
			);
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'post_id' => $post_id,
				'stats'   => $stats,
			)
		);
	}

	/**
	 * Translate, create, update, and link a taxonomy term for the bulk taxonomy workflow.
	 *
	 * Used exclusively by browser AI bulk taxonomy translation (Workflow A).
	 * Reuses `Taxonomy_Translator::translate_terms()`.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|WP_Error
	 */
	public static function bulk_translate_term( WP_REST_Request $request ) {

		$term_id         = absint( $request->get_param( 'term_id' ) );
		$taxonomy        = sanitize_key( (string) $request->get_param( 'taxonomy' ) );
		$target_lang     = sanitize_key( (string) $request->get_param( 'target_lang' ) );
		$provider        = sanitize_key( (string) $request->get_param( 'provider' ) );
		$raw_memory      = $request->get_param( 'in_memory_translations' );
		$current_user_id = get_current_user_id();

		if ( ! is_array( $raw_memory ) ) {
			$raw_memory = is_object( $raw_memory ) ? (array) $raw_memory : array();
		}

		$normalized_translations = self::normalize_translation_value( $raw_memory );
		if ( ! is_array( $normalized_translations ) ) {
			return new WP_Error( 'invalid_translations', __( 'Invalid taxonomy translation data.', 'translatesense' ), array( 'status' => 400 ) );
		}

		if ( strlen( (string) wp_json_encode( $normalized_translations ) ) > 1048576 ) {
			return new WP_Error( 'rest_request_too_large', __( 'The taxonomy translation payload is too large.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$term_strings = Taxonomy_Parser::extract_terms_strings( array( $term_id ), $taxonomy, $target_lang, $current_user_id, true );
		$sent_values  = array_values(
			array_filter(
				array_map(
					static function ( $item ) {
						return isset( $item['value'] ) ? (string) $item['value'] : '';
					},
					$term_strings
				)
			)
		);
		$total_chars  = 0;
		foreach ( $sent_values as $val ) {
			$total_chars += mb_strlen( $val, 'UTF-8' );
		}

		$translated_map = Taxonomy_Translator::translate_terms(
			array( $term_id ),
			$taxonomy,
			$target_lang,
			$provider,
			$normalized_translations,
			array(
				'user_id'             => $current_user_id,
				'enforce_permissions' => true,
				'skip_unauthorized'   => false,
			)
		);

		if ( is_wp_error( $translated_map ) ) {
			return $translated_map;
		}

		$target_term_id = isset( $translated_map[ $term_id ] ) ? absint( $translated_map[ $term_id ] ) : 0;
		$target_term    = $target_term_id > 0 ? get_term( $target_term_id, $taxonomy ) : null;
		if ( ! $target_term instanceof \WP_Term ) {
			return new WP_Error( 'translatesense_term_translate_failed', __( 'The translated taxonomy term could not be saved.', 'translatesense' ), array( 'status' => 500 ) );
		}

		return rest_ensure_response(
			array(
				'success'          => true,
				'type'             => 'term',
				'source_term_id'   => $term_id,
				'target_term_id'   => $target_term_id,
				'target_post_id'   => $target_term_id,
				'translated_title' => $target_term->name,
				'taxonomy'         => $taxonomy,
				'target_lang'      => $target_lang,
				'total_strings'    => count( $sent_values ),
				'total_characters' => $total_chars,
				'sent_data'        => $sent_values,
				'edit_url'         => (string) get_edit_term_link( $target_term_id, $taxonomy ),
				'view_url'         => Bulk_Process::get_safe_term_link( $target_term_id, $taxonomy ),
			)
		);
	}

	/**
	 * Get cache statistics.
	 *
	 * @return \WP_REST_Response
	 */
	public static function get_cache_stats() {
		return rest_ensure_response(
			array(
				'success' => true,
				'counts'  => Hashing_Db::get_cache_counts(),
			)
		);
	}

	/**
	 * Clear cache endpoint callback.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function clear_cache( WP_REST_Request $request ) {
		$type = sanitize_key( (string) $request->get_param( 'type' ) );

		if ( ! in_array( $type, array( 'strings', 'translations', 'logs', 'packages', 'all' ), true ) ) {
			return new WP_Error(
				'invalid_cache_type',
				__( 'Invalid cache type specified.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$result = Hashing_Db::clear_cache( $type );

		if ( ! $result ) {
			return new WP_Error(
				'cache_clear_failed',
				__( 'Failed to clear cache.', 'translatesense' ),
				array( 'status' => 500 )
			);
		}

		$labels = array(
			'strings'      => __( 'Strings cache', 'translatesense' ),
			'translations' => __( 'Translations cache', 'translatesense' ),
			'logs'         => __( 'Translation logs & queue', 'translatesense' ),
			'packages'     => __( 'Packages cache', 'translatesense' ),
			'all'          => __( 'All caches', 'translatesense' ),
		);

		$label = $labels[ $type ] ?? __( 'Cache', 'translatesense' );

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => sprintf(
					/* translators: %s: Cache type label */
					__( '%s cleared successfully.', 'translatesense' ),
					$label
				),
				'type'    => $type,
				'counts'  => Hashing_Db::get_cache_counts(),
			)
		);
	}

	/**
	 * Clear block process pending flag.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function clear_block_state( WP_REST_Request $request ) {
		$post_id = self::get_request_post_id( $request );

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post',
				__( 'A valid Post ID is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'post_not_found',
				__( 'The requested post could not be found.', 'translatesense' ),
				array(
					'status' => 404,
				)
			);
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error(
				'rest_forbidden',
				__(
					'You do not have permission to edit this post.',
					'translatesense'
				),
				array(
					'status' => rest_authorization_required_code(),
				)
			);
		}

		Block_Processor::clear_process_flag( $post_id );

		return rest_ensure_response(
			array(
				'success' => true,
				'post_id' => $post_id,
			)
		);
	}

	/**
	 * Delete _show_initial_prompt_modal post meta key.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|WP_Error
	 */
	public static function dismiss_initial_prompt( WP_REST_Request $request ) {
		$post_id = self::get_request_post_id( $request );

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post',
				__( 'A valid Post ID is required.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'post_not_found',
				__( 'The requested post could not be found.', 'translatesense' ),
				array(
					'status' => 404,
				)
			);
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error(
				'rest_forbidden',
				__(
					'You do not have permission to edit this post.',
					'translatesense'
				),
				array(
					'status' => rest_authorization_required_code(),
				)
			);
		}

		delete_post_meta( $post_id, '_show_initial_prompt_modal' );

		return rest_ensure_response(
			array(
				'success' => true,
				'post_id' => $post_id,
				'message' => __( 'Initial prompt modal dismissed.', 'translatesense' ),
			)
		);
	}

	/**
	 * Get an existing target translation post ID.
	 *
	 * @param int    $source_post_id  Source post ID.
	 * @param string $target_language Target language slug.
	 * @return int Target post ID or 0.
	 */
	private static function get_existing_translation_post_id( $source_post_id, $target_language ) {
		// Use the same authoritative Polylang + TranslateSense processor lookup
		// as the save pipeline. This also ensures permission checks cover an
		// orphaned target recovered through _translatesense_source_id.
		return Polylang_Bridge::get_existing_translation_post_id(
			absint( $source_post_id ),
			sanitize_key( (string) $target_language ),
		);
	}

	/**
	 * Normalize nested translation data without stripping HTML.
	 *
	 * Translation payloads may contain HTML, Elementor data, Gutenberg
	 * markup, placeholders, attributes, and JSON structures. Do not use
	 * sanitize_text_field() or wp_strip_all_tags() for these values.
	 *
	 * @param mixed $value Submitted value.
	 * @param int   $depth Recursion depth.
	 * @return mixed
	 */
	private static function normalize_translation_value( $value, $depth = 0 ) {

		if ( $depth > 20 ) {
			return '';
		}

		if ( is_array( $value ) ) {
			$normalized = array();

			foreach ( $value as $key => $item ) {
				$normalized_key                = is_int( $key ) ? $key : sanitize_key( $key );
				$normalized[ $normalized_key ] = self::normalize_translation_value( $item, $depth + 1 );
			}

			return $normalized;
		}

		if ( is_string( $value ) ) {
			return wp_check_invalid_utf8( $value );
		}

		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			return $value;
		}

		return '';
	}

	/**
	 * Verify that every submitted string belongs to the resolved source post.
	 *
	 * This check is called by the REST permission callback before translation.
	 * It fails closed if the source post cannot be resolved or has no stored strings.
	 *
	 * @param array  $strings     List of strings to translate.
	 * @param int    $post_id     Translation target post ID.
	 * @param string $target_lang Optional target language slug.
	 * @return bool True if every string belongs to the source post, false otherwise.
	 */
	public static function verify_strings_belong_to_post( array $strings, int $post_id, string $target_lang = '' ): bool {

		if ( empty( $strings ) ) {
			return false;
		}

		$post_id = absint( $post_id );

		if ( ! $post_id || ! get_post( $post_id ) ) {
			return false;
		}

		// This endpoint is used for a translation target whose content may be
		// empty. Resolve its original source post and verify strings only against
		// that source post's stored package records. Never fall back to the target.
		if ( ! class_exists( Editor_Integration::class ) ) {
			return false;
		}

		$source_post_id = absint( Editor_Integration::get_source_post_id( $post_id ) );

		if ( ! $source_post_id || ! get_post( $source_post_id ) ) {
			return false;
		}

		if ( ! class_exists( Hashing_Db::class ) ) {
			return false;
		}

		global $wpdb;

		$packages_table = esc_sql( Hashing_Db::get_packages_table() );
		$strings_table  = esc_sql( Hashing_Db::get_strings_table() );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$allowed_results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DISTINCT s.filter_string, s.string_hash
				FROM `{$packages_table}` p
				INNER JOIN `{$strings_table}` s ON p.string_hash = s.string_hash
				WHERE p.post_id = %d",
				$source_post_id
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$filter_strings = array_column( $allowed_results, 'filter_string' );
		$string_hashes  = array_column( $allowed_results, 'string_hash' );

		if ( ! is_array( $filter_strings ) || empty( $filter_strings ) ) {
			return false;
		}

		// Every submitted string must exactly match a stored source string.
		// Strict matching prevents type coercion and partial/loose matches.
		foreach ( $strings as $submitted ) {
			if ( ! in_array( $submitted, $filter_strings, true ) ) {
				$hash = md5( $submitted );

				if ( ! in_array( $hash, $string_hashes, true ) ) {
					return false;
				}
			}
		}

		return true;
	}
}
