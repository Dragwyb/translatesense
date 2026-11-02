<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Admin;

use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\AI\Ai_Connector_Bridge;

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
		add_action( 'in_admin_header', array( __CLASS__, 'hide_unrelated_admin_notices' ), 100 );
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
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/admin/dashboard' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.css',
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
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/admin/dashboard' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'wp-element', 'wp-components', 'wp-api-fetch' ),
			TRANSLATESENSE_VERSION,
			true
		);

		$bridge           = Ai_Connector_Bridge::get_instance();
		$active_providers = $bridge->get_active_providers();
		$admin_url        = admin_url();
		$provider_models  = array();
		foreach ( $active_providers as $p_id => $p_opts ) {
			$provider_models[ $p_id ] = $bridge->get_models( (string) $p_id, (array) $p_opts );
		}

		// Localize Script (Step 1.1)
		wp_localize_script(
			'translatesense-admin-js',
			'TranslateSenseData',
			array(
				'restUrl'         => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'polylangActive'  => Polylang_Bridge::is_polylang_active(),
				'languages'       => Polylang_Bridge::get_languages(),
				'activeBuilders'  => self::get_active_builders(),
				'activeProviders' => $active_providers,
				'providerModels'  => $provider_models,
				'connectorsUrl'   => esc_url_raw( admin_url( 'options-connectors.php' ) ),
				'pluginUrl'       => TRANSLATESENSE_PLUGIN_URL,
				'docsUrl'         => defined( 'TRANSLATESENSE_DOCS_URL' ) ? TRANSLATESENSE_DOCS_URL : 'https://docs.dragwyb.com/',
				'version'         => TRANSLATESENSE_VERSION,
				'adminUrl'        => $admin_url,
			)
		);
	}

	/**
	 * Get Dashboard Page URL with optional tab parameter.
	 *
	 * @param string $tab Optional tab name ('settings', 'gutenberg', 'elementor')
	 * @return string
	 */
	public static function get_dashboard_url( string $tab = '' ): string {
		$base_page = Polylang_Bridge::is_polylang_active() ? 'admin.php' : 'options-general.php';
		$url       = admin_url( $base_page . '?page=translatesense' );
		if ( ! empty( $tab ) ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		return $url;
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

	/**
	 * Check if current admin page belongs to TranslateSense plugin or related screens.
	 *
	 * @return bool
	 */
	public static function is_plugin_admin_page(): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : '';

		if ( 'translatesense' === $page ) {
			return true;
		}

		if ( function_exists( 'get_current_screen' ) ) {
			$screen = get_current_screen();
			if ( $screen ) {
				if ( ! empty( self::$page_hook ) && $screen->id === self::$page_hook ) {
					return true;
				}
				if ( false !== strpos( $screen->id, 'translatesense' ) ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Hide unrelated third-party and core admin notices on all plugin pages.
	 *
	 * @return void
	 */
	public static function hide_unrelated_admin_notices() {
		if ( ! self::is_plugin_admin_page() ) {
			return;
		}

		global $wp_filter;

		$notice_hooks = array(
			'user_admin_notices',
			'admin_notices',
			'all_admin_notices',
		);

		foreach ( $notice_hooks as $hook_name ) {
			if (
				empty( $wp_filter[ $hook_name ] ) ||
				empty( $wp_filter[ $hook_name ]->callbacks ) ||
				! is_array( $wp_filter[ $hook_name ]->callbacks )
			) {
				continue;
			}

			foreach ( $wp_filter[ $hook_name ]->callbacks as $priority => $callbacks ) {
				foreach ( $callbacks as $callback_id => $callback_data ) {
					if ( empty( $callback_data['function'] ) ) {
						continue;
					}

					unset(
						$wp_filter[ $hook_name ]->callbacks[ $priority ][ $callback_id ]
					);
				}
			}
		}

		// Remove delayed admin notices generated by WordPress.
		if (
			isset( $wp_filter['admin_footer']->callbacks ) &&
			is_array( $wp_filter['admin_footer']->callbacks )
		) {
			foreach ( $wp_filter['admin_footer']->callbacks as $priority => $callbacks ) {
				foreach ( $callbacks as $callback_id => $callback_data ) {
					if (
						isset( $callback_data['function'] ) &&
						'render_delayed_admin_notices' === $callback_data['function']
					) {
						unset(
							$wp_filter['admin_footer']->callbacks[ $priority ][ $callback_id ]
						);
					}
				}
			}
		}

		// Register this plugin's notices after unrelated notices have been removed.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : '';
		add_action(
			'admin_notices',
			function () use ( $page ) {
				self::display_admin_notices( $page );
			},
			PHP_INT_MAX
		);
	}

	/**
	 * Display plugin-specific admin notices.
	 *
	 * @param string $current_page Current admin page slug.
	 * @return void
	 */
	public static function display_admin_notices( $current_page = '' ) {
		do_action( 'translatesense_admin_notices', $current_page );
	}
}
