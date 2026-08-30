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
	 * Render quick Translate button in top and bottom tablenav (only on Polylang translated post types).
	 */
	public static function render_filter_translate_button( $which ) {
		$post_type = self::get_current_screen_post_type();
		if ( ! Polylang_Bridge::is_translated_post_type( $post_type ) ) {
			return;
		}

		$btn_id = ( 'bottom' === $which ) ? 'ts-quick-filter-translate-btn-bottom' : 'ts-quick-filter-translate-btn';
		?>
		<button type="button" id="<?php echo esc_attr( $btn_id ); ?>" class="button button-primary ts-filter-action-btn">
			<span class="dashicons dashicons-translation"></span>
			<?php esc_html_e( 'Translate Selected', 'translatesense' ); ?>
		</button>
		<?php
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

		// 2. Chrome Built-in Translate Provider & Languages
		wp_enqueue_script(
			'translatesense-chrome-languages-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/providers/chrome-ai/chrome-languages.js',
			array( 'translatesense-core-js' ),
			TRANSLATESENSE_VERSION,
			true
		);
		wp_enqueue_script(
			'translatesense-chrome-built-translate-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/providers/chrome-ai/chrome-built-translate.js',
			array( 'translatesense-core-js', 'translatesense-chrome-languages-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 3. AI Translate Provider (OpenAI & Gemini)
		wp_enqueue_script(
			'translatesense-ai-translate-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/providers/ai-services/ai-translate.js',
			array( 'translatesense-core-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 4. Bulk Translation Script
		wp_enqueue_script(
			'translatesense-bulk-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/bulk-translate.js',
			array( 'jquery', 'translatesense-core-js', 'translatesense-chrome-built-translate-js', 'translatesense-ai-translate-js' ),
			TRANSLATESENSE_VERSION,
			true
		);

		$settings = get_option( 'translatesense_settings', array() );

		wp_localize_script(
			'translatesense-bulk-js',
			'TranslateSenseBulkData',
			array(
				'restUrl'          => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'polylangActive'   => Polylang_Bridge::is_polylang_active(),
				'defaultLanguage'  => Polylang_Bridge::get_default_language(),
				'languages'        => Polylang_Bridge::get_languages(),
				'defaultProvider'  => $settings['provider'] ?? 'openai',
				'enabledProviders' => $settings['enabled_providers'] ?? array( 'chrome_ai', 'openai', 'gemini' ),
				'pluginUrl'        => TRANSLATESENSE_PLUGIN_URL,
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
