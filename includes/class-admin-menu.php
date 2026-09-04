<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin_Menu {

	/**
	 * Hook suffix for the admin menu page.
	 */
	private static $page_hook = '';

	/**
	 * Initialize admin menu hooks.
	 */
	public static function init() {
		// Priority 99 ensures Polylang menu 'mlang' is already registered before we attach the submenu
		add_action( 'admin_menu', array( __CLASS__, 'register_menu_pages' ), 99 );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_assets' ) );
	}

	/**
	 * Register menu and submenus.
	 */
	public static function register_menu_pages() {
		$capability = 'manage_options';
		if ( function_exists( 'pll_languages_list' ) ) {
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Using Polylang capability filter for compatibility.
			$capability = apply_filters( 'pll_capability_manage_options', $capability );
		}
		$capability = apply_filters( 'translatesense_menu_capability', $capability );

		// If Polylang is active, place directly under Polylang's main "Languages" (mlang) menu
		if ( Polylang_Bridge::is_polylang_active() ) {
			self::$page_hook = add_submenu_page(
				'mlang',
				__( 'TranslateSense Config', 'translatesense' ),
				__( 'TranslateSense', 'translatesense' ),
				$capability,
				'translatesense',
				array( __CLASS__, 'render_admin_root' )
			);
		} else {
			// Fallback under Options if Polylang is not yet active
			self::$page_hook = add_options_page(
				__( 'TranslateSense Config', 'translatesense' ),
				__( 'TranslateSense', 'translatesense' ),
				$capability,
				'translatesense',
				array( __CLASS__, 'render_admin_root' )
			);
		}
	}

	/**
	 * Get active status of all supported page builders / editors.
	 */
	public static function get_active_builders() {
		$is_elementor = did_action( 'elementor/loaded' ) || class_exists( '\Elementor\Plugin' ) || defined( 'ELEMENTOR_VERSION' );
		$is_divi      = defined( 'ET_BUILDER_VERSION' ) || function_exists( 'et_setup_theme' ) || class_exists( 'ET_Builder_Element' );
		$is_classic   = class_exists( 'Classic_Editor' ) || ( get_option( 'classic-editor-replace' ) === 'replace' );
		$is_gutenberg = function_exists( 'has_blocks' ) && ( ! $is_classic || get_option( 'classic-editor-replace' ) === 'block' );

		return array(
			'gutenberg' => (bool) $is_gutenberg,
			'elementor' => (bool) $is_elementor,
			'divi'      => (bool) $is_divi,
			'classic'   => (bool) $is_classic,
		);
	}

	/**
	 * Enqueue admin scripts & styles.
	 */
	public static function enqueue_admin_assets( $hook ) {
		if ( self::$page_hook && $hook !== self::$page_hook && false === strpos( $hook, 'translatesense' ) && false === strpos( $hook, 'mlang' ) ) {
			return;
		}

		// Enqueue CSS
		wp_enqueue_style(
			'translatesense-admin-css',
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/admin-dashboard.css',
			array(),
			TRANSLATESENSE_VERSION
		);

		// Enqueue React / WP Element
		wp_enqueue_script( 'wp-element' );
		wp_enqueue_script( 'wp-components' );
		wp_enqueue_script( 'wp-api-fetch' );

		// Enqueue App Script
		wp_enqueue_script(
			'translatesense-admin-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/admin-dashboard.js',
			array( 'wp-element', 'wp-components', 'wp-api-fetch' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// Localize Script (Step 1.1)
		wp_localize_script(
			'translatesense-admin-js',
			'TranslateSenseData',
			array(
				'restUrl'         => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'polylangActive'  => Polylang_Bridge::is_polylang_active(),
				'defaultLanguage' => Polylang_Bridge::get_default_language(),
				'languages'       => Polylang_Bridge::get_languages(),
				'activeBuilders'  => self::get_active_builders(),
				'pluginUrl'       => TRANSLATESENSE_PLUGIN_URL,
				'version'         => TRANSLATESENSE_VERSION,
			)
		);
	}

	/**
	 * Render React root container.
	 */
	public static function render_admin_root() {
		?>
		<div class="wrap translatesense-wrap">
			<div id="translatesense-admin-root">
				<div class="ts-loading-placeholder">
					<div class="ts-spinner"></div>
					<p><?php esc_html_e( 'Loading TranslateSense Dashboard...', 'translatesense' ); ?></p>
				</div>
			</div>
		</div>
		<?php
	}
}
