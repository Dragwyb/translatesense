<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Bulk;

use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Admin\Admin_Menu;
use TranslateSense\Includes\AI\Ai_Connector_Bridge;

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
		if ( isset( $_GET['post_type'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$type = sanitize_key( wp_unslash( $_GET['post_type'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( post_type_exists( $type ) ) {
				return $type;
			}
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
			<?php esc_html_e( 'Bulk Translate', 'translatesense' ); ?>
			<span class="ts-active-pulse-dot" style="display: none;" title="<?php esc_attr_e( 'Background translations running', 'translatesense' ); ?>"></span>
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

		$settings         = get_option( 'translatesense_settings', array() );
		$enable_providers = is_array( $settings ) && isset( $settings['enabled_providers'] ) && is_array( $settings['enabled_providers'] ) ? $settings['enabled_providers'] : array();
		$active_providers = array();

		if ( class_exists( Ai_Connector_Bridge::class ) ) {
			$active_providers = Ai_Connector_Bridge::get_instance()->get_active_providers();

			foreach ( $active_providers as $key => $value ) {
				if ( ! in_array( $key, $enable_providers, true ) ) {
					unset( $active_providers[ $key ] );
				}
			}
		}

		$asset_file = TRANSLATESENSE_PLUGIN_DIR . 'assets/build/bulk/index.asset.php';
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
			'translatesense-bulk',
			TRANSLATESENSE_PLUGIN_URL . 'assets/build/bulk/index.css',
			array( 'translatesense-common' ),
			$asset['version']
		);

		// 2. Chrome Built-in Translate Provider & Languages
		wp_enqueue_script(
			'translatesense-chrome-languages',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/chrome-ai/chrome-languages' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array(),
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

		// 3. AI Translate Provider (OpenAI & Gemini)
		wp_enqueue_script(
			'translatesense-ai',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/ai-services/ai-translate' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array(),
			TRANSLATESENSE_VERSION,
			true
		);

		// 4. Providers Aggregator / Register
		wp_enqueue_script(
			'translatesense-providers',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/translation/providers/index' . sanitize_text_field( TRANSLATESENSE_ASSETS_EXT ) . '.js',
			array( 'translatesense-chrome-ai', 'translatesense-ai' ),
			TRANSLATESENSE_VERSION,
			true
		);

		// 5. Bulk Translation React App Bundle
		$bulk_deps = array_merge(
			array( 'jquery', 'translatesense-providers' ),
			$asset['dependencies']
		);

		wp_enqueue_script(
			'translatesense-bulk',
			esc_url( TRANSLATESENSE_PLUGIN_URL . 'assets/build/bulk/index.js' ),
			$bulk_deps,
			$asset['version'],
			true
		);

		$settings = get_option( 'translatesense_settings', array() );

		wp_localize_script(
			'translatesense-bulk',
			'TranslateSenseBulkData',
			array(
				'restUrl'          => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'polylangActive'   => Polylang_Bridge::is_polylang_active(),
				'defaultLanguage'  => Polylang_Bridge::get_default_language(),
				'languages'        => Polylang_Bridge::get_languages(),
				'defaultProvider'  => $settings['provider'] ?? '',
				'enabledProviders' => $active_providers,
				'pluginUrl'        => TRANSLATESENSE_PLUGIN_URL,
				'docsUrl'          => defined( 'TRANSLATESENSE_DOCS_URL' ) ? TRANSLATESENSE_DOCS_URL : 'https://docs.dragwyb.com/',
				'settingsUrl'      => Admin_Menu::get_dashboard_url( 'settings' ),
				'connectorsUrl'    => admin_url( 'options-connectors.php' ),
				'hasOpenAiKey'     => ! empty( $settings['openai_api_key'] ),
				'hasGeminiKey'     => ! empty( $settings['gemini_api_key'] ),
				'slugTranslation'  => ( isset( $settings['slug_translation'] ) && in_array( sanitize_key( (string) $settings['slug_translation'] ), array( 'keep_orignal', 'title_based', 'slug_translate' ), true ) ) ? sanitize_key( (string) $settings['slug_translation'] ) : 'slug_translate',
				'postStatus'       => ( isset( $settings['post_status'] ) && in_array( sanitize_key( (string) $settings['post_status'] ), array( 'publish', 'draft' ), true ) ) ? sanitize_key( (string) $settings['post_status'] ) : 'draft',
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
