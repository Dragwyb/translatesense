<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bulk_Translate {

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_bulk_assets' ) );
		add_action( 'manage_posts_extra_tablenav', array( __CLASS__, 'render_filter_translate_button' ), 20, 1 );
		add_action( 'admin_footer-edit.php', array( __CLASS__, 'render_bulk_modal_container' ) );

		// Register bulk action dynamically on all Polylang-supported post types
		add_action( 'admin_init', array( __CLASS__, 'register_bulk_actions_for_supported_types' ) );
	}

	/**
	 * Register bulk actions for all post types translated by Polylang.
	 */
	public static function register_bulk_actions_for_supported_types() {
		$supported_types = Polylang_Bridge::get_translated_post_types();
		foreach ( $supported_types as $post_type ) {
			add_filter( "bulk_actions-edit-{$post_type}", array( __CLASS__, 'register_bulk_action' ) );
		}
	}

	/**
	 * Helper to get current post type on edit.php screen.
	 */
	private static function get_current_screen_post_type() {
		global $typenow, $current_screen;
		if ( ! empty( $typenow ) ) {
			return $typenow;
		}
		if ( $current_screen && ! empty( $current_screen->post_type ) ) {
			return $current_screen->post_type;
		}
		if ( isset( $_GET['post_type'] ) ) { // phpcs:ignore
			return sanitize_key( $_GET['post_type'] ); // phpcs:ignore
		}
		return 'post';
	}

	/**
	 * Render quick Translate button directly next to the Filter button (only on Polylang translated post types).
	 */
	public static function render_filter_translate_button( $which ) {
		if ( 'top' !== $which ) {
			return;
		}

		$post_type = self::get_current_screen_post_type();
		if ( ! Polylang_Bridge::is_translated_post_type( $post_type ) ) {
			return;
		}
		?>
		<button type="button" id="ts-quick-filter-translate-btn" class="button button-primary ts-filter-action-btn" style="margin-left: 6px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); border-color: #3730a3; color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(79,70,229,0.35);">
			<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1;"></span>
			<?php esc_html_e( 'Translate Selected', 'translatesense' ); ?>
		</button>
		<?php
	}

	/**
	 * Register bulk action in dropdown.
	 */
	public static function register_bulk_action( $bulk_actions ) {
		$bulk_actions['translatesense_bulk_translate'] = __( '⚡ Translate with TranslateSense', 'translatesense' );
		return $bulk_actions;
	}

	/**
	 * Enqueue assets on edit.php only for Polylang translated post types.
	 */
	public static function enqueue_bulk_assets( $hook ) {
		if ( 'edit.php' !== $hook ) {
			return;
		}

		$post_type = self::get_current_screen_post_type();
		if ( ! Polylang_Bridge::is_translated_post_type( $post_type ) ) {
			return;
		}

		wp_enqueue_style(
			'translatesense-bulk-css',
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/bulk-translate.css',
			array(),
			TRANSLATESENSE_VERSION
		);

		// 1. Core Translate Registry
		wp_enqueue_script(
			'translatesense-core-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/core-translate.js',
			array( 'jquery' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 2. Google Translate Provider
		wp_enqueue_script(
			'translatesense-google-translate-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/google-translate.js',
			array( 'translatesense-core-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 3. Chrome Built-in Translate Provider
		wp_enqueue_script(
			'translatesense-chrome-built-translate-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/chrome-built-translate-.js',
			array( 'translatesense-core-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 4. AI Translate Provider (OpenAI, Gemini)
		wp_enqueue_script(
			'translatesense-ai-translate-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/ai-translate.js',
			array( 'translatesense-core-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 5. Bulk Translation Script
		wp_enqueue_script(
			'translatesense-bulk-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/bulk-translate.js',
			array( 'jquery', 'translatesense-core-js', 'translatesense-google-translate-js', 'translatesense-chrome-built-translate-js', 'translatesense-ai-translate-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		$settings = get_option( 'translatesense_settings', array() );

		wp_localize_script(
			'translatesense-bulk-js',
			'TranslateSenseBulkData',
			array(
				'restUrl'         => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'polylangActive'  => Polylang_Bridge::is_polylang_active(),
				'defaultLanguage' => Polylang_Bridge::get_default_language(),
				'languages'       => Polylang_Bridge::get_languages(),
				'defaultProvider' => $settings['provider'] ?? 'openai',
			)
		);
	}

	/**
	 * Render portal container in admin footer on edit.php (only for Polylang translated post types).
	 */
	public static function render_bulk_modal_container() {
		$post_type = self::get_current_screen_post_type();
		if ( ! Polylang_Bridge::is_translated_post_type( $post_type ) ) {
			return;
		}
		?>
		<div id="translatesense-bulk-modal-root"></div>
		<?php
	}
}
