<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Admin;

use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\AI\Ai_Connector_Bridge;
use TranslateSense\Includes\Content\Processor\Block_Processor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Editor_Integration {

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		// Save _translatesense_source_id when new translation post is created via Polylang '+' icon
		add_action( 'save_post', array( __CLASS__, 'save_source_post_id_on_create' ), 10, 3 );

		// Gutenberg Block Editor
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_block_editor_assets' ) );

		// Classic Editor & Admin Edit Screens
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_editor_assets' ) );

		// Meta Box for Gutenberg & Classic Editor
		add_action( 'add_meta_boxes', array( __CLASS__, 'add_translatesense_meta_box' ) );

		// Classic Editor Media Buttons (After Add Media)
		add_action( 'media_buttons', array( __CLASS__, 'render_media_translate_button' ), 25 );
		add_action( 'admin_footer', array( __CLASS__, 'render_editor_portal_container' ) );
		add_action( 'elementor/editor/footer', array( __CLASS__, 'render_editor_portal_container' ) );

		// Elementor Editor Hooks
		add_action( 'elementor/editor/after_enqueue_scripts', array( __CLASS__, 'enqueue_elementor_editor_assets' ) );
	}

	/**
	 * Automatically save _translatesense_source_id when creating a translation post via from_post query parameter.
	 *
	 * @param int           $post_id Post ID.
	 * @param \WP_Post|null $post    Post object.
	 * @param bool          $update  Whether this is an existing post being updated.
	 */
	public static function save_source_post_id_on_create( $post_id, $post = null, $update = false ) {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		// Do not overwrite existing source ID
		$existing_source_id = get_post_meta( $post_id, '_translatesense_source_id', true );
		if ( ! empty( $existing_source_id ) ) {
			return;
		}

		$from_post_id = 0;

		// 1. First check Polylang official translations map if Polylang is active
		if ( Polylang_Bridge::is_polylang_active() ) {
			$translations = Polylang_Bridge::get_post_translations( $post_id );
			$default_lang = Polylang_Bridge::get_default_language();
			if ( ! empty( $translations[ $default_lang ] ) && (int) $translations[ $default_lang ] !== (int) $post_id ) {
				$candidate_id = (int) $translations[ $default_lang ];
				if ( $candidate_id > 0 && get_post( $candidate_id ) && current_user_can( 'edit_post', $candidate_id ) ) {
					$from_post_id = $candidate_id;
				}
			}
		}

		// 2. If not resolved from Polylang, verify from_post query parameter with valid nonce and permission checks
		if ( ! $from_post_id && isset( $_GET['from_post'] ) && ! empty( $_GET['from_post'] ) ) {
			$nonce          = isset( $_REQUEST['_wpnonce'] ) ? sanitize_key( wp_unslash( $_REQUEST['_wpnonce'] ) ) : '';
			$is_valid_nonce = false;

			if ( ! empty( $nonce ) ) {
				if (
				wp_verify_nonce( $nonce, 'new-post-translation' )
				|| wp_verify_nonce( $nonce, 'update-post_' . $post_id )
				|| wp_verify_nonce( $nonce, 'add-post' )
				) {
					$is_valid_nonce = true;
				}
			}

			if ( $is_valid_nonce ) {
				$candidate_id = absint( wp_unslash( $_GET['from_post'] ) );
				if ( $candidate_id > 0 && get_post( $candidate_id ) && current_user_can( 'edit_post', $candidate_id ) ) {
					$from_post_id = $candidate_id;
				}
			}
		}

		if ( $from_post_id > 0 ) {
			update_post_meta( $post_id, '_translatesense_source_id', $from_post_id );
			update_post_meta( $post_id, '_show_initial_prompt_modal', '1' );
		}
	}

	/**
	 * Detect editor type for a given post ID.
	 *
	 * @param int $post_id
	 * @return string 'elementor' | 'gutenberg' | 'classic'
	 */
	public static function get_post_editor_type( $post_id ) {
		if ( ! $post_id ) {
			return 'classic';
		}

		// 1. Check Elementor
		$elementor_edit_mode = get_post_meta( $post_id, '_elementor_edit_mode', true );
		if ( 'builder' === $elementor_edit_mode ) {
			return 'elementor';
		}

		$post = get_post( $post_id );

		if ( ! $post instanceof \WP_Post ) {
			return 'classic';
		}

		if ( function_exists( 'use_block_editor_for_post' ) ) {
			if ( ! use_block_editor_for_post( $post ) ) {
				return 'classic';
			}
		}

		// 2. Check Gutenberg (has blocks)
		$post = get_post( $post_id );
		if ( $post && function_exists( 'has_blocks' ) && has_blocks( $post->post_content ) ) {
			return 'gutenberg';
		}

		return 'classic';
	}

	/**
	 * Get appropriate edit link based on post editor type (Elementor, Gutenberg, Classic).
	 *
	 * @param int $post_id
	 * @return string
	 */
	public static function get_post_edit_link( $post_id ): string {
		if ( ! $post_id ) {
			return '';
		}

		$editor_type = self::get_post_editor_type( (int) $post_id );

		if ( 'elementor' === $editor_type ) {
			if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->documents ) ) {
				$doc = \Elementor\Plugin::$instance->documents->get( $post_id );
				if ( $doc && method_exists( $doc, 'get_edit_url' ) ) {
					return (string) $doc->get_edit_url();
				}
			}
			return admin_url( 'post.php?post=' . (int) $post_id . '&action=elementor' );
		}

		$default_edit_link = get_edit_post_link( $post_id, 'raw' );
		return $default_edit_link ? (string) $default_edit_link : admin_url( 'post.php?post=' . (int) $post_id . '&action=edit' );
	}

	/**
	 * Check if post is already translated.
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_post_already_translated( int $post_id ): bool {
		if ( ! $post_id ) {
			return false;
		}

		$is_translated = get_post_meta( $post_id, '_translatesense_translated', true );
		if ( ! empty( $is_translated ) && $post_id === (int) $is_translated ) {
			return true;
		}

		return false;
	}


	/**
	 * Enqueue lightweight Editor Modal assets when source post was created in Elementor
	 * but target translation is opened in Gutenberg or Classic Editor.
	 *
	 * Skips loading heavy universal page editor translation assets.
	 *
	 * @param int    $post_id
	 * @param int    $source_post_id
	 * @param string $editor_type
	 * @param array  $localize_data
	 */
	public static function enqueue_editor_mismatch_modal_assets( int $post_id, int $source_post_id, string $editor_type = 'gutenberg', array $localize_data = array() ): void {
		if ( ! $post_id || ! $source_post_id ) {
			return;
		}

		// Enqueue minimal CSS for modal rendering
		wp_enqueue_style(
			'translatesense-common',
			esc_url( TRANSLATESENSE_PLUGIN_URL . 'assets/css/common' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.css' ),
			array(),
			TRANSLATESENSE_VERSION
		);

		$asset_file = TRANSLATESENSE_PLUGIN_DIR . 'assets/build/page/index.asset.php';
		$version    = file_exists( $asset_file ) ? ( require $asset_file )['version'] : TRANSLATESENSE_VERSION;

		wp_enqueue_style(
			'translatesense-editor-style',
			esc_url( TRANSLATESENSE_PLUGIN_URL . 'assets/build/page/index.css' ),
			array( 'translatesense-common' ),
			$version
		);

		$assets_ext = sanitize_text_field( TRANSLATESENSE_ASSETS_EXT );
		$script_url = TRANSLATESENSE_PLUGIN_URL . 'assets/js/editor/editor-modal' . $assets_ext . '.js';

		wp_enqueue_script(
			'translatesense-editor-modal',
			esc_url( $script_url ),
			array(),
			TRANSLATESENSE_VERSION,
			true
		);

		$show_initial_prompt_modal = get_post_meta( $post_id, '_show_initial_prompt_modal', true );
		$source_language           = Polylang_Bridge::get_post_language( $source_post_id );
		$target_language           = Polylang_Bridge::get_post_language( $post_id );

		$modal_data = array_merge(
			array(
				'postId'                 => $post_id,
				'sourcePostId'           => $source_post_id,
				'sourceEditorType'       => 'elementor',
				'editorType'             => $editor_type,
				'currentEditorType'      => $editor_type,
				'sourceLanguage'         => $source_language,
				'targetLanguage'         => $target_language,
				'languages'              => Polylang_Bridge::get_languages(),
				'showInitialPromptModal' => (bool) $show_initial_prompt_modal,
				'pluginUrl'              => TRANSLATESENSE_PLUGIN_URL,
			),
			$localize_data
		);

		wp_localize_script(
			'translatesense-editor-modal',
			'TranslateSenseEditorModalData',
			$modal_data
		);
	}

	/**
	 * Enqueue Universal Editor Assets (Helper).
	 */
	public static function enqueue_page_editor_assets( $post_id, $editor_type = 'gutenberg', $localize_data = array() ) {
		if ( ! $post_id || self::is_post_already_translated( (int) $post_id ) ) {
			return;
		}

		$source_post_id = self::get_source_post_id( $post_id );

		if ( ! $source_post_id ) {
			return;
		}

		$source_editor_type = $source_post_id ? self::get_post_editor_type( $source_post_id ) : '';

		// If source page was created in Elementor but target translation is opened in Gutenberg or Classic editor:
		// Do not load full page editor translation assets. Instead, load lightweight editorModal.js.
		if ( 'elementor' === $source_editor_type && 'elementor' !== $editor_type ) {
			self::enqueue_editor_mismatch_modal_assets( (int) $post_id, (int) $source_post_id, $editor_type, $localize_data );
			return;
		}

		$settings         = get_option( 'translatesense_settings', array() );
		$enable_providers = $settings['enabled_providers'];
		$active_providers = array();

		if ( class_exists( Ai_Connector_Bridge::class ) ) {
			$active_providers = Ai_Connector_Bridge::get_instance()->get_active_providers();

			foreach ( $active_providers as $key => $value ) {
				if ( ! in_array( $key, $enable_providers, true ) ) {
					unset( $active_providers[ $key ] );
				}
			}
		}

		$asset_file = TRANSLATESENSE_PLUGIN_DIR . 'assets/build/page/index.asset.php';
		$asset      = file_exists( $asset_file )
			? require $asset_file
			: array(
				'dependencies' => array( 'react', 'wp-element' ),
				'version'      => TRANSLATESENSE_VERSION,
			);

		wp_enqueue_style(
			'translatesense-common',
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/common' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.css',
			array(),
			TRANSLATESENSE_VERSION
		);

		wp_enqueue_style(
			'translatesense-editor',
			TRANSLATESENSE_PLUGIN_URL . 'assets/build/page/index.css',
			array( 'translatesense-common' ),
			$asset['version']
		);

		// 1. Spark MD5 (static library version. so no change).
		wp_enqueue_script(
			'translatesense-sparkmd',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/vendor/spark-md5/index.min.js',
			array(),
			'3.0.2',
			true
		);

		// 7. Universal Editor React App Bundle
		$editor_deps = array_merge(
			array( 'translatesense-sparkmd' ),
			$asset['dependencies']
		);

		$editor_script_url = file_exists( TRANSLATESENSE_PLUGIN_DIR . 'assets/build/page/index.js' )
			? TRANSLATESENSE_PLUGIN_URL . 'assets/build/page/index.js'
			: TRANSLATESENSE_PLUGIN_URL . 'assets/js/admin/editor-panel' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js';

		wp_enqueue_script(
			'translatesense-editor',
			$editor_script_url,
			$editor_deps,
			$asset['version'],
			true
		);

		// 3. Chrome Built-in Translate Provider & Languages
		wp_enqueue_script(
			'translatesense-chrome-languages',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/chrome-ai/chrome-languages' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-editor' ),
			TRANSLATESENSE_VERSION,
			true
		);

		wp_enqueue_script(
			'translatesense-chrome-ai',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/chrome-ai/chrome-built-translate' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-chrome-languages' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 4. AI Translate Provider (OpenAI & Gemini)
		wp_enqueue_script(
			'translatesense-ai',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/ai-services/ai-translate' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-editor' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 5. Providers Aggregator / Register
		wp_enqueue_script(
			'translatesense-providers',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/index' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-chrome-ai', 'translatesense-ai' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 6. Live Editor Updaters (Meta fields, Gutenberg, Elementor, Classic)
		wp_enqueue_script(
			'translatesense-live-meta-fields',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/editor/meta-fields' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array(),
			TRANSLATESENSE_VERSION,
			true
		);
		wp_enqueue_script(
			'translatesense-live-' . esc_attr( $editor_type ),
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/editor/' . esc_attr( $editor_type ) . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-live-meta-fields' ),
			TRANSLATESENSE_VERSION,
			true
		);

		wp_enqueue_script(
			'translatesense-page-editor',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/editor/index' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-editor', 'translatesense-live-meta-fields', 'translatesense-live-' . esc_attr( $editor_type ) ),
			TRANSLATESENSE_VERSION,
			true
		);

		$show_initial_prompt_modal = get_post_meta( $post_id, '_show_initial_prompt_modal', true );

		$source_language    = $source_post_id ? Polylang_Bridge::get_post_language( $source_post_id ) : '';
		$source_editor_type = $source_post_id ? self::get_post_editor_type( $source_post_id ) : '';

		$localize_data = array_merge(
			array(
				'postId'                 => $post_id,
				'editorType'             => $editor_type,
				'sourcePostId'           => $source_post_id,
				'sourceLanguage'         => $source_language,
				'sourceEditorType'       => $source_editor_type,
				'fromPost'               => $source_post_id,
				'restUrl'                => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'                  => wp_create_nonce( 'wp_rest' ),
				'polylangActive'         => Polylang_Bridge::is_polylang_active(),
				'targetLanguage'         => Polylang_Bridge::get_post_language( $post_id ),
				'languages'              => Polylang_Bridge::get_languages(),
				'defaultProvider'        => $settings['provider'] ?? '',
				'enabledProviders'       => $active_providers,
				'pluginUrl'              => TRANSLATESENSE_PLUGIN_URL,
				'docsUrl'                => defined( 'TRANSLATESENSE_DOCS_URL' ) ? TRANSLATESENSE_DOCS_URL : 'https://docs.dragwyb.com/',
				'showInitialPromptModal' => (bool) $show_initial_prompt_modal,
				'settingsUrl'            => esc_url_raw( Admin_Menu::get_dashboard_url( 'settings' ) ),
				'connectorsUrl'          => esc_url_raw( admin_url( 'options-connectors.php' ) ),
				'hasOpenAiKey'           => ! empty( $settings['openai_api_key'] ),
				'hasGeminiKey'           => ! empty( $settings['gemini_api_key'] ),
			),
			$localize_data
		);

		wp_localize_script(
			'translatesense-editor',
			'TranslateSenseEditorData',
			$localize_data
		);
	}

	/**
	 * Enqueue Gutenberg editor assets (only for Polylang translated post types).
	 */
	public static function enqueue_block_editor_assets() {
		global $post;
		if ( ! $post ) {
			return;
		}

		if ( ! function_exists( 'get_current_screen' ) ) {
			return;
		}

		if ( ! property_exists( get_current_screen(), 'is_block_editor' ) ) {
			return;
		}

		if ( ! get_current_screen()->is_block_editor ) {
			return;
		}

		if ( ! self::is_translate_current_post() ) {
			return;
		}

		$post_id = (int) $post->ID;

		// Check and enqueue Gutenberg Block Processor System if pending
		self::maybe_enqueue_block_processor_assets( $post_id );

		if ( self::is_post_already_translated( $post_id ) ) {
			return;
		}

		self::enqueue_page_editor_assets( $post_id, 'gutenberg' );
	}

	/**
	 * Maybe enqueue Gutenberg Block Processor assets based on strict post meta condition.
	 *
	 * Only loads if BOTH '_translatesense_translated' and 'block process meta are present,
	 * the post has Gutenberg blocks, and the user has permission to edit the post.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function maybe_enqueue_block_processor_assets( int $post_id ): void {
		if ( $post_id <= 0 ) {
			return;
		}

		$is_translated          = get_post_meta( $post_id, '_translatesense_translated', true );
		$is_block_state_pending = Block_Processor::is_block_state_pending( $post_id );

		// Strictly check that BOTH conditions are fulfilled
		if ( empty( $is_translated ) || '0' === (string) $is_translated || ! $is_block_state_pending ) {
			return;
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		self::enqueue_block_processor_assets( $post_id );
	}

	/**
	 * Enqueue dedicated Block Processor CSS and JS assets.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function enqueue_block_processor_assets( int $post_id ): void {
		$assets_ext = sanitize_text_field( TRANSLATESENSE_ASSETS_EXT );

		$js_file = file_exists( TRANSLATESENSE_PLUGIN_DIR . 'assets/js/translation/block-processor' . $assets_ext . '.js' )
		? 'assets/js/translation/block-processor' . $assets_ext . '.js'
		: 'assets/js/block-processor.js';

		wp_enqueue_script(
			'translatesense-block-processor',
			TRANSLATESENSE_PLUGIN_URL . $js_file,
			array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-data', 'wp-editor', 'wp-edit-post', 'wp-i18n', 'wp-notices', 'wp-plugins' ),
			TRANSLATESENSE_VERSION,
			true
		);

		wp_localize_script(
			'translatesense-block-processor',
			'TranslateSenseProcessorData',
			array(
				'postId'    => $post_id,
				'isPending' => true,
				'restUrl'   => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'pluginUrl' => TRANSLATESENSE_PLUGIN_URL,
			)
		);
	}

	/**
	 * Enqueue Classic Editor & Post Edit Admin Assets (only for Polylang translated post types).
	 */
	public static function enqueue_admin_editor_assets( $hook ) {
		if ( 'post.php' !== $hook && 'post-new.php' !== $hook ) {
			return;
		}
		global $post;

		if ( ! self::is_translate_current_post() ) {
			return;
		}

		$current_screen = get_current_screen();
		$post_id        = (int) $post->ID;

		if ( method_exists( $current_screen, 'is_block_editor' ) && ! $current_screen->is_block_editor() ) {
			self::enqueue_page_editor_assets( $post_id, 'classic' );
		}
	}

	/**
	 * Enqueue Elementor editor scripts (only for Polylang translated post types).
	 */
	public static function enqueue_elementor_editor_assets() {
		$post_id = (int) get_the_ID();
		if ( ! $post_id || self::is_post_already_translated( $post_id ) ) {
			return;
		}

		if ( ! self::is_translate_current_post() ) {
			return;
		}

		self::enqueue_page_editor_assets( $post_id, 'elementor' );
	}

	/**
	 * Get the source post ID for translation.
	 * Read-only resolution — never modifies the database during read/GET requests.
	 *
	 * @param int $post_id
	 * @return int
	 */
	public static function get_source_post_id( $post_id ): int {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return 0;
		}

		// 1. Check saved post meta
		$source_post_id = (int) get_post_meta( $post_id, '_translatesense_source_id', true );
		if ( $source_post_id > 0 && get_post( $source_post_id ) && current_user_can( 'edit_post', $source_post_id ) ) {
			return $source_post_id;
		}

		// 2. Check Polylang default language translation
		if ( Polylang_Bridge::is_polylang_active() ) {
			$translations = Polylang_Bridge::get_post_translations( $post_id );
			$default_lang = Polylang_Bridge::get_default_language();
			if ( ! empty( $translations[ $default_lang ] ) && (int) $translations[ $default_lang ] !== $post_id ) {
				$candidate_id = (int) $translations[ $default_lang ];
				if ( $candidate_id > 0 && get_post( $candidate_id ) && current_user_can( 'edit_post', $candidate_id ) ) {
					return $candidate_id;
				}
			}

			foreach ( $translations as $lang => $trans_id ) {
				$trans_id = (int) $trans_id;
				if ( $trans_id > 0 && $trans_id !== $post_id && get_post( $trans_id ) && current_user_can( 'edit_post', $trans_id ) ) {
					return $trans_id;
				}
			}
		}

		// 3. Fallback to query parameter only with valid nonce and permission verification
		if ( isset( $_GET['from_post'] ) && ! empty( $_GET['from_post'] ) && isset( $_GET['_wpnonce'] ) ) {
			$nonce = sanitize_key( wp_unslash( $_GET['_wpnonce'] ) );
			if ( wp_verify_nonce( $nonce, 'new-post-translation' ) ) {
				$candidate_id = absint( wp_unslash( $_GET['from_post'] ) );
				if ( $candidate_id > 0 && get_post( $candidate_id ) && current_user_can( 'edit_post', $candidate_id ) ) {
					return $candidate_id;
				}
			}
		}

		return 0;
	}

	private static function is_translate_current_post() {
		global $post;

		if ( ! $post instanceof \WP_Post && self::is_post_already_translated( (int) $post->ID ) ) {
			return false;
		}

		$post_types = Polylang_Bridge::get_translated_post_types();

		if ( ! is_array( $post_types ) || ! in_array( $post->post_type, $post_types ) ) {
			return false;
		}

		$post_id = (int) $post->ID;

		if ( self::is_post_already_translated( $post_id ) ) {
			return false;
		}

		$current_lang = Polylang_Bridge::get_post_language( $post_id );
		$default_lang = Polylang_Bridge::get_default_language( $post_id );

		if ( ! $current_lang || empty( $current_lang ) || $current_lang === $default_lang ) {
			return false;
		}

		return true;
	}

	/**
	 * Add TranslateSense Meta Box only for post types translated/supported by Polylang.
	 */
	public static function add_translatesense_meta_box() {
		global $post;
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		if ( empty( $post->post_type ) || function_exists( 'get_current_screen' ) ) {
			if ( property_exists( get_current_screen(), 'is_block_editor' ) && ! get_current_screen()->is_block_editor ) {
				return;
			}
		}

		if ( ! self::is_translate_current_post() ) {
			return;
		}

		add_meta_box(
			'translatesense-editor-metabox',
			__( 'TransalteSense', 'translatesense' ),
			array( __CLASS__, 'render_editor_meta_box' ),
			$post->post_type,
			'side',
			'high'
		);
	}

	/**
	 * Render Meta Box HTML for Gutenberg and Classic Editor.
	 */
	public static function render_editor_meta_box( $post ) {
		$post_id = (int) $post->ID;

		$source_post_id = self::get_source_post_id( $post_id );

		if ( ! $source_post_id ) {
			return;
		}

		$current_lang  = Polylang_Bridge::get_post_language( $post_id );
		$source_lang   = Polylang_Bridge::get_post_language( $source_post_id );
		$polylang_lang = Polylang_Bridge::get_languages();

		$source_lang_flag  = '';
		$current_lang_flag = '';

		if ( ! empty( $polylang_lang[ $current_lang ]['flag'] ) ) {
			$current_lang_flag = sprintf( '<img src="%s" alt="%s" style="width:15px"/>', esc_url( $polylang_lang[ $current_lang ]['flag'] ), esc_attr( $polylang_lang[ $current_lang ]['name'] ?? '' ) );
		}
		if ( ! empty( $polylang_lang[ $source_lang ]['flag'] ) ) {
			$source_lang_flag = sprintf( '<img src="%s" alt="%s" style="width:15px"/>', esc_url( $polylang_lang[ $source_lang ]['flag'] ), esc_attr( $polylang_lang[ $source_lang ]['name'] ?? '' ) );
		}
		?>
		<div class="translatesense-metabox-content">
			<button type="button" id="ts-metabox-translate-btn" class="button button-primary widefat ts-open-translate-btn">
			<span class="dashicons dashicons-translation"></span>	
			<?php esc_html_e( 'Auto Translate', 'translatesense' ); ?>
			</button>
			<p style="font-size: 12px; color: #64748b; margin: 6px 0 0 0; font-weight: 500; font-size: 14px">
				<?php
				// translators: %1$s source language flag, %2$s source language name, %3$s target langauge flag, %4$s target langauge name.
				echo wp_kses_post( sprintf( __( 'Language: %1$s (%2$s) to %3$s (%4$s)', 'translatesense' ), wp_kses_post( $source_lang_flag ), esc_html( strtoupper( $source_lang ) ), wp_kses_post( $current_lang_flag ), esc_html( strtoupper( $current_lang ) ) ) );
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Render universal editor portal root container.
	 */
	public static function render_editor_portal_container() {
		echo '<div id="translatesense-editor-portal-root"></div>';
	}

	/**
	 * Render Translate button in Classic Editor after the "Add Media" button (only for Polylang translated post types).
	 */
	public static function render_media_translate_button( $editor_id ) {
		if ( 'content' !== $editor_id && ! empty( $editor_id ) ) {
			return;
		}

		if ( ! self::is_translate_current_post() ) {
			return;
		}

		?>
		<button type="button" id="ts-media-translate-btn" class="button button-primary ts-open-translate-btn">
			<span class="dashicons dashicons-translation"></span>
			<?php esc_html_e( 'Auto Translate', 'translatesense' ); ?>
		</button>
		<?php
	}
}
