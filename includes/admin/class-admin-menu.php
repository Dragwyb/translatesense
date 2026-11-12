<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Admin;

use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Translation\Statics;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin_Menu {

	const REVIEW_NONCE_ACTION = 'translatesense_review_notice_nonce';
	const REVIEW_AJAX_ACTION  = 'translatesense_dismiss_review';

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
		add_action( 'wp_ajax_' . self::REVIEW_AJAX_ACTION, array( __CLASS__, 'ajax_dismiss_review_notice' ) );
	}

	/**
	 * Resolve the administration capability for TranslateSense settings and site-wide actions.
	 *
	 * @return string
	 */
	public static function get_manage_capability(): string {
		$capability = 'manage_options';
		if ( function_exists( 'pll_languages_list' ) ) {
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Using Polylang capability filter for compatibility.
			$capability = apply_filters( 'pll_capability_manage_options', $capability );
		}
		return (string) apply_filters( 'translatesense_menu_capability', $capability );
	}

	/**
	 * Check whether the review notice should be hidden globally or for the current user.
	 *
	 * @return bool
	 */
	public static function is_review_notice_hidden(): bool {
		$is_review_hidden = ( 1 === (int) get_option( 'translatesense_hide_review', 0 ) );

		return ( $is_review_hidden || ! current_user_can( self::get_manage_capability() ) );
	}

	/**
	 * Get shared global review notice AJAX config for localized scripts.
	 *
	 * @return array{ajaxUrl: string, reviewNonce: string}
	 */
	public static function get_review_notice_data(): array {
		$can_manage = current_user_can( self::get_manage_capability() );

		return array(
			'ajaxUrl'     => esc_url_raw( admin_url( 'admin-ajax.php' ) ),
			'reviewNonce' => $can_manage ? wp_create_nonce( self::REVIEW_NONCE_ACTION ) : '',
		);
	}

	/**
	 * Authenticated AJAX handler to dismiss the global review notice.
	 *
	 * @return void
	 */
	public static function ajax_dismiss_review_notice(): void {
		if ( ! check_ajax_referer( self::REVIEW_NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Security check failed.', 'translatesense' ),
				),
				403
			);
		}

		if ( ! is_user_logged_in() || ! current_user_can( self::get_manage_capability() ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You do not have permission to perform this action.', 'translatesense' ),
				),
				403
			);
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified above via check_ajax_referer().
		$review_action = isset( $_POST['review_action'] ) ? sanitize_key( wp_unslash( $_POST['review_action'] ) ) : '';

		if ( ! in_array( $review_action, array( 'not_interested', 'already_reviewed' ), true ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Invalid review notice action.', 'translatesense' ),
				),
				400
			);
		}

		update_option( 'translatesense_hide_review', 1 );

		if ( 1 !== (int) get_option( 'translatesense_hide_review', 0 ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Unable to save review notice preference.', 'translatesense' ),
				),
				500
			);
		}

		wp_send_json_success(
			array(
				'hidden' => true,
			)
		);
	}

	/**
	 * Register menu and submenus.
	 */
	public static function register_menu_pages() {
		$capability = self::get_manage_capability();

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

		// Asset file metadata handling with fallback
		$asset_file = TRANSLATESENSE_PLUGIN_DIR . 'assets/build/dashboard/index.asset.php';
		$asset      = file_exists( $asset_file )
			? require $asset_file
			: array(
				'dependencies' => array( 'wp-element', 'wp-components', 'wp-api-fetch', 'wp-i18n' ),
				'version'      => TRANSLATESENSE_VERSION,
			);

		// Enqueue CSS
		wp_enqueue_style(
			'translatesense-admin-css',
			TRANSLATESENSE_PLUGIN_URL . 'assets/build/dashboard/index.css',
			array( 'wp-components' ),
			$asset['version']
		);

		// Enqueue WordPress Script Dependencies
		wp_enqueue_script( 'wp-element' );
		wp_enqueue_script( 'wp-components' );
		wp_enqueue_script( 'wp-api-fetch' );
		wp_enqueue_script( 'wp-i18n' );

		// Enqueue App Script (Production React Bundle)
		$script_url = TRANSLATESENSE_PLUGIN_URL . 'assets/build/dashboard/index.js';

		wp_enqueue_script(
			'translatesense-admin-js',
			$script_url,
			$asset['dependencies'],
			$asset['version'],
			true
		);

		$admin_url          = admin_url();
		$review_data        = self::get_review_notice_data();
		$is_review_hidden   = self::is_review_notice_hidden();
		$show_review_notice = false;
		$current_utc_date   = gmdate( 'Y-m-d H:i:s' );
		$current_timestamp  = strtotime( $current_utc_date . ' UTC' );

		$install_raw = get_option( 'translatesense_activation_date', false );
		if ( false === $install_raw || '' === $install_raw ) {
			update_option( 'translatesense_activation_date', $current_utc_date, false );
			$install_timestamp = $current_timestamp;
		} else {
			$install_timestamp = is_numeric( $install_raw )
				? (int) $install_raw
				: strtotime( trim( (string) $install_raw ) . ' UTC' );
			if ( false === $install_timestamp || $install_timestamp <= 0 ) {
				update_option( 'translatesense_activation_date', $current_utc_date, false );
				$install_timestamp = $current_timestamp;
			}
		}

		if ( ! $is_review_hidden ) {
			$is_old_enough = ( false !== $current_timestamp ) && ( ( $current_timestamp - $install_timestamp ) >= ( 3 * DAY_IN_SECONDS ) );

			if ( $is_old_enough ) {
				$stats       = Statics::get_translation_statistics();
				$total_chars = isset( $stats['total_characters'] ) ? (int) $stats['total_characters'] : 0;

				// Exclude legacy stats where only failed translations were recorded.
				if ( isset( $stats['successful_translations'], $stats['failed_translations'] ) && (int) $stats['failed_translations'] > 0 && (int) $stats['successful_translations'] <= 0 ) {
					$total_chars = 0;
				}

				$show_review_notice = ( $total_chars >= 5000 );
			}
		}

		// Localize Script (Step 1.1)
		wp_localize_script(
			'translatesense-admin-js',
			'TranslateSenseData',
			array(
				'restUrl'          => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'polylangActive'   => Polylang_Bridge::is_polylang_active(),
				'connectorsUrl'    => esc_url_raw( admin_url( 'options-connectors.php' ) ),
				'pluginUrl'        => TRANSLATESENSE_PLUGIN_URL,
				'docsUrl'          => defined( 'TRANSLATESENSE_DOCS_URL' ) ? TRANSLATESENSE_DOCS_URL : 'https://docs.dragwyb.com/',
				'version'          => TRANSLATESENSE_VERSION,
				'adminUrl'         => $admin_url,
				'activeBuilders'   => self::get_active_builders(),
				'showReviewNotice' => $show_review_notice,
				'hideReviewNotice' => $is_review_hidden,
			) + $review_data
		);
	}

	/**
	 * Get Dashboard Page URL with optional tab parameter.
	 *
	 * @param string $tab Optional tab name ('home', 'settings', 'gutenberg', 'elementor', 'cache')
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
