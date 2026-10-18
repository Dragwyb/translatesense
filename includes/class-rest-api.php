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
					'post_id' => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
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
						'validate_callback' => static function ( $value ) {
							return is_array( $value ) && ! empty( $value );
						},
					),
					'target_languages' => array(
						'required'          => true,
						'type'              => 'array',
						'validate_callback' => static function ( $value ) {
							return is_array( $value ) && ! empty( $value );
						},
					),
					'provider'         => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
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
					'job_id' => array(
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
		 * 12. Mark post as translated.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/mark-translated',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'mark_translated' ),
				'permission_callback' => array( __CLASS__, 'permission_mark_translated' ),
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
	public static function permission_extract_strings( WP_REST_Request $request ) {

		return self::require_edit_post(
			self::get_request_post_id( $request ),
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
				__( 'A valid strings array is required.', 'translatesense' ),
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

		// Non-administrators MUST provide a valid post_id that they are permitted to edit.
		$post_id = self::get_request_post_id( $request );

		if ( ! $post_id ) {
			return self::permission_error(
				__( 'A valid post ID is required.', 'translatesense' ),
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

		if ( ! self::verify_strings_belong_to_post( $params['strings'], $post_id ) ) {
			return self::permission_error(
				__( 'One or more submitted strings do not belong to the specified post.', 'translatesense' ),
				'rest_forbidden',
				403
			);
		}

		return false;
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

		$params = $request->get_json_params();

		$post_ids = is_array( $params ) && isset( $params['post_ids'] )
			? $params['post_ids']
			: array();

		$target_languages = is_array( $params ) && isset( $params['target_languages'] )
			? $params['target_languages']
			: array();

		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return self::permission_error(
				__( 'At least one post ID is required.', 'translatesense' ),
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

			$translations = function_exists( 'pll_get_post_translations' )
				? pll_get_post_translations( $post_id )
				: array();

			$translations = is_array( $translations ) ? $translations : array();

			foreach ( $clean_languages as $target_language ) {

				$target_post_id = ! empty( $translations[ $target_language ] )
					? absint( $translations[ $target_language ] )
					: 0;

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
				"SELECT post_id, target_post_id FROM {$table} WHERE batch_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
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

		$source_ids = array();

		foreach ( $rows as $row ) {

			$source_post_id = isset( $row['post_id'] ) ? absint( $row['post_id'] ) : 0;
			$target_post_id = isset( $row['target_post_id'] ) ? absint( $row['target_post_id'] ) : 0;

			if ( ! $source_post_id || ! get_post( $source_post_id ) ) {
				return self::permission_error(
					__( 'A post associated with this batch could not be found.', 'translatesense' ),
					'rest_post_not_found',
					404
				);
			}

			$source_ids[ $source_post_id ] = true;

			if ( $target_post_id ) {

				if ( ! get_post( $target_post_id ) ) {
					return self::permission_error(
						__( 'A target translation post associated with this batch could not be found.', 'translatesense' ),
						'rest_target_post_not_found',
						404
					);
				}

				if ( ! current_user_can( 'edit_post', $target_post_id ) ) {
					return self::permission_error(
						__( 'You are not allowed to access a target translation in this batch.', 'translatesense' )
					);
				}
			}
		}

		if ( $post_id && ! isset( $source_ids[ $post_id ] ) ) {
			return self::permission_error(
				__( 'The requested post does not belong to this batch.', 'translatesense' )
			);
		}

		foreach ( array_keys( $source_ids ) as $source_post_id ) {
			if ( ! current_user_can( 'edit_post', $source_post_id ) ) {
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

		$source_post_id = ! empty( $job->post_id ) ? absint( $job->post_id ) : 0;

		if ( ! $source_post_id || ! get_post( $source_post_id ) ) {
			return self::permission_error(
				__( 'The translation job has no valid source post.', 'translatesense' ),
				'rest_invalid_job',
				400
			);
		}

		if ( ! current_user_can( 'edit_post', $source_post_id ) ) {
			return self::permission_error(
				__( 'You are not allowed to update this translation job.', 'translatesense' )
			);
		}

		if ( ! empty( $job->target_post_id ) ) {

			$target_post_id = absint( $job->target_post_id );

			if ( ! $target_post_id || ! get_post( $target_post_id ) ) {
				return self::permission_error(
					__( 'The translation job has an invalid target post.', 'translatesense' ),
					'rest_invalid_target_post',
					400
				);
			}

			if ( ! self::is_job_target( $job, $target_post_id ) ) {
				return self::permission_error(
					__( 'The job target does not match the source translation relationship.', 'translatesense' )
				);
			}

			if ( ! current_user_can( 'edit_post', $target_post_id ) ) {
				return self::permission_error(
					__( 'You are not allowed to update the target translation post.', 'translatesense' )
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
					__( 'The target post ID is invalid.', 'translatesense' ),
					'rest_invalid_target_post',
					400
				);
			}

			if ( ! get_post( $target_post_id ) ) {
				return self::permission_error(
					__( 'The target post could not be found.', 'translatesense' ),
					'rest_target_post_not_found',
					404
				);
			}

			if ( ! self::is_job_target( $job, $target_post_id ) ) {
				return self::permission_error(
					__( 'The requested target post is not the translation target for this job.', 'translatesense' )
				);
			}

			if ( ! current_user_can( 'edit_post', $target_post_id ) ) {
				return self::permission_error(
					__( 'You are not allowed to update the requested target translation post.', 'translatesense' )
				);
			}
		}

		return true;
	}

	/**
	 * Verify that a candidate target is the actual translation target for a job.
	 *
	 * @param object $job Job row.
	 * @param int    $target_post_id Candidate target post ID.
	 * @return bool
	 */
	private static function is_job_target( $job, $target_post_id ) {

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

		$expected_target_id = self::get_existing_translation_post_id(
			$source_post_id,
			$target_language
		);

		return $expected_target_id === $target_post_id;
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
			'classic'   => self::get_classic_widgets_list( $rules['custom_fields'] ),
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

			$result[] = array(
				'id'                 => $name,
				'name'               => $info['title'],
				'category'           => $info['category'],
				'status'             => $status,
				'source'             => $source,
				'field_count'        => $field_count,
				'no_translate_count' => $no_translate_count,
				'fields'             => $keys,
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
			: '';

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
					'Invalid or missing editor parameter. Please specify a specific editor (gutenberg, elementor, classic).',
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
				'success' => true,
				'title'   => $post->post_title,
				'content' => $post->post_content,
				'excerpt' => $post->post_excerpt,
				'slug'    => $post->post_name,
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
			'gemini_model'      => 'gemini-1.5-flash',
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
		);

		$settings = wp_parse_args(
			$settings,
			$defaults
		);

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
			$response_settings[ $secret_key ] = ! empty( $settings[ $secret_key ] );
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
				'stats'            => array(
					'total_packages' => $packages_count,
					'cached_results' => $results_count,
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
			$response_settings[ $secret_key ] = ! empty( $updated[ $secret_key ] );
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
		$allowed = array( 'gutenberg', 'elementor', 'classic' );

		if ( $allow_all ) {
			$allowed[] = 'all';
		}

		return in_array( sanitize_key( $builder ), $allowed, true );
	}

	/**
	 * Sanitize supported plugin settings before persistence.
	 *
	 * @param array $input Submitted settings.
	 * @param array $current Current settings.
	 * @return array
	 */
	private static function sanitize_settings( $input, $current ) {

		$updated = is_array( $current ) ? $current : array();

		if ( isset( $input['provider'] ) ) {
			$updated['provider'] = sanitize_key( $input['provider'] );
		}

		foreach ( array( 'openai_api_key', 'gemini_api_key' ) as $key ) {

			if ( ! isset( $input[ $key ] ) ) {
				continue;
			}

			$value = trim( (string) $input[ $key ] );

			/*
			 * REST GET exposes only a boolean for credentials. An empty
			 * submitted value therefore means "keep the current credential".
			 */
			if ( '' !== $value ) {
				$updated[ $key ] = sanitize_text_field( $value );
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

		$params = $request->get_json_params();

		$post_id = self::get_request_post_id(
			$request
		);

		if ( ! $post_id ) {
			return new WP_Error(
				'invalid_post_id',
				__( 'Post ID is required.', 'translatesense' ),
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

		$package_strings = Hashing_Db::get_post_package(
			$post_id,
			$source_language,
			$source_editor_type
		);

		if ( empty( $package_strings ) ) {

			$package_strings = Content_Parser::parse(
				'',
				$post_id,
				$source_language,
				$source_editor_type
			);
		}

		if ( is_wp_error( $package_strings ) ) {
			return $package_strings;
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
			(array) $in_memory_translations
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
					'1'
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

		$params = $request->get_json_params();

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
				__( 'Post IDs array is required.', 'translatesense' ),
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

		if ( empty( $clean_post_ids ) ) {
			return new WP_Error(
				'invalid_posts',
				__( 'No valid post IDs were supplied.', 'translatesense' ),
				array(
					'status' => 400,
				)
			);
		}

		$result = Bulk_Process::create_batch(
			$clean_post_ids,
			$target_languages,
			(string) $provider
		);

		if ( is_wp_error( $result ) ) {
			return $result;
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

		if (
			isset( $clean_data['target_post_id'] ) &&
			$clean_data['target_post_id'] > 0 &&
			! self::is_job_target( $job, $clean_data['target_post_id'] )
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

			if (
				! get_post( $target_post_id ) ||
				! self::is_job_target( $job, $target_post_id ) ||
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
				'1'
			);
		}

		$updated = Bulk_Process::update_job(
			$job_id,
			$clean_data
		);

		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		return rest_ensure_response(
			array(
				'success' => (bool) $updated,
				'job_id'  => $job_id,
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
			'_translatesense_translated',
			'1'
		);

		return rest_ensure_response(
			array(
				'success' => true,
				'post_id' => $post_id,
			)
		);
	}

	/**
	 * Get an existing target translation post ID.
	 *
	 * @param int    $source_post_id Source post ID.
	 * @param string $target_language Target language slug.
	 * @return int Target post ID or 0.
	 */
	private static function get_existing_translation_post_id( $source_post_id, $target_language ) {

		$source_post_id  = absint( $source_post_id );
		$target_language = sanitize_key( $target_language );

		if ( ! $source_post_id || empty( $target_language ) ) {
			return 0;
		}

		if ( ! function_exists( 'pll_get_post_translations' ) ) {
			return 0;
		}

		$translations = pll_get_post_translations( $source_post_id );

		if ( ! is_array( $translations ) || empty( $translations[ $target_language ] ) ) {
			return 0;
		}

		$target_post_id = absint( $translations[ $target_language ] );

		return ( $target_post_id && get_post( $target_post_id ) )
			? $target_post_id
			: 0;
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
	 * Verify that submitted strings belong to a specific post or its source post.
	 *
	 * Prevents unauthorized users from submitting arbitrary strings to consume
	 * configured AI translation services.
	 *
	 * @param array $strings List of strings to translate.
	 * @param int   $post_id Target or source post ID.
	 * @param int   $source_post_id Optional explicit source post ID.
	 * @return bool True if all strings belong to the post context, false otherwise.
	 */
	public static function verify_strings_belong_to_post( array $strings, int $post_id ): bool {

		if ( empty( $strings ) ) {
			return true;
		}

		$post_id = absint( $post_id );

		if ( ! $post_id || ! get_post( $post_id ) ) {
			return false;
		}

		$deletected_source_post_id = 0;

		// 2. Resolve source post from Editor_Integration helper.
		if ( class_exists( '\TranslateSense\Includes\Editor_Integration' ) ) {
			$detected_source = absint( Editor_Integration::get_source_post_id( $post_id ) );
			if ( $detected_source > 0 && get_post( $detected_source ) ) {
				$deletected_source_post_id = $detected_source;
			}
		}

		if ( ! $deletected_source_post_id ) {
			return false;
		}

		$allowed_strings = array();

		// Step A: Check DB packages recorded in translatesense_packages / translatesense_strings.
		global $wpdb;
		if ( class_exists( '\TranslateSense\Includes\Hashing_Db' ) ) {
			$packages_table = Hashing_Db::get_packages_table();
			$strings_table  = Hashing_Db::get_strings_table();

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$allowed_strings = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT s.source_string
					 FROM {$packages_table} p
					 INNER JOIN {$strings_table} s ON p.string_id = s.id
					 WHERE p.post_id = %d",
					$deletected_source_post_id
				),
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}

		if ( empty( $allowed_strings ) ) {
			return false;
		}

		// Step C: Verify each submitted string.
		foreach ( $strings as $submitted ) {
			if ( ! in_array( $submitted, $allowed_strings ) ) {
				return false;
			}
		}

		return true;
	}
}
