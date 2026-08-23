<?php
/**
 * Bulk Translation Flow on WP List Table (Step 4.1)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TranslateSense_Bulk_Translate {

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_bulk_assets' ) );
		add_filter( 'bulk_actions-edit-post', array( __CLASS__, 'register_bulk_action' ) );
		add_filter( 'bulk_actions-edit-page', array( __CLASS__, 'register_bulk_action' ) );
		add_action( 'manage_posts_extra_tablenav', array( __CLASS__, 'render_filter_translate_button' ), 20, 1 );
		add_action( 'admin_footer-edit.php', array( __CLASS__, 'render_bulk_modal_container' ) );
	}

	/**
	 * Render quick Translate button directly next to the Filter button.
	 */
	public static function render_filter_translate_button( $which ) {
		if ( 'top' === $which ) {
			?>
			<button type="button" id="ts-quick-filter-translate-btn" class="button button-primary ts-filter-action-btn" style="margin-left: 6px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); border-color: #3730a3; color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(79,70,229,0.35);">
				<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1;"></span>
				<?php esc_html_e( 'Translate Selected', 'translatesense' ); ?>
			</button>
			<?php
		}
	}

	/**
	 * Register bulk action in dropdown.
	 */
	public static function register_bulk_action( $bulk_actions ) {
		$bulk_actions['translatesense_bulk_translate'] = __( '⚡ Translate with TranslateSense', 'translatesense' );
		return $bulk_actions;
	}

	/**
	 * Enqueue assets on edit.php.
	 */
	public static function enqueue_bulk_assets( $hook ) {
		if ( 'edit.php' !== $hook ) {
			return;
		}

		wp_enqueue_style(
			'translatesense-bulk-css',
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/bulk-translate.css',
			array(),
			TRANSLATESENSE_VERSION
		);

		wp_enqueue_script(
			'translatesense-bulk-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/bulk-translate.js',
			array( 'jquery' ),
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
				'polylangActive'  => TranslateSense_Polylang_Bridge::is_polylang_active(),
				'defaultLanguage' => TranslateSense_Polylang_Bridge::get_default_language(),
				'languages'       => TranslateSense_Polylang_Bridge::get_languages(),
				'defaultProvider' => $settings['provider'] ?? 'client_google',
			)
		);
	}

	/**
	 * Render portal container in admin footer on edit.php.
	 */
	public static function render_bulk_modal_container() {
		?>
		<div id="translatesense-bulk-modal-root"></div>
		<?php
	}
}
