<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Editor_Integration {

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		// Gutenberg Block Editor
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_block_editor_assets' ) );

		// Classic Editor Meta Box
		add_action( 'add_meta_boxes', array( __CLASS__, 'add_classic_meta_box' ) );

		// Elementor Editor Hooks
		add_action( 'elementor/editor/after_enqueue_scripts', array( __CLASS__, 'enqueue_elementor_editor_assets' ) );
	}

	/**
	 * Enqueue Gutenberg editor sidebar plugin.
	 */
	public static function enqueue_block_editor_assets() {
		global $post;
		$post_id = $post ? $post->ID : 0;

		wp_enqueue_style(
			'translatesense-editor-css',
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/editor.css',
			array(),
			TRANSLATESENSE_VERSION
		);

		wp_enqueue_script(
			'translatesense-editor-panel-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/editor-panel.js',
			array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-compose', 'wp-api-fetch' ),
			TRANSLATESENSE_VERSION,
			true
		);

		$settings = get_option( 'translatesense_settings', array() );

		wp_localize_script(
			'translatesense-editor-panel-js',
			'TranslateSenseEditorData',
			array(
				'postId'          => $post_id,
				'restUrl'         => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'polylangActive'  => Polylang_Bridge::is_polylang_active(),
				'currentLanguage' => Polylang_Bridge::get_post_language( $post_id ),
				'languages'       => Polylang_Bridge::get_languages(),
				'defaultProvider' => $settings['provider'] ?? 'client_google',
				'mappingMode'     => Detector::is_mapping_mode_active( $post_id ),
			)
		);
	}

	/**
	 * Enqueue Elementor editor scripts.
	 */
	public static function enqueue_elementor_editor_assets() {
		$post_id = get_the_ID();

		wp_enqueue_style(
			'translatesense-editor-css',
			TRANSLATESENSE_PLUGIN_URL . 'assets/css/editor.css',
			array(),
			TRANSLATESENSE_VERSION
		);

		wp_enqueue_script(
			'translatesense-elementor-panel-js',
			TRANSLATESENSE_PLUGIN_URL . 'assets/js/editor-panel.js',
			array( 'jquery' ),
			TRANSLATESENSE_VERSION,
			true
		);

		$settings = get_option( 'translatesense_settings', array() );

		wp_localize_script(
			'translatesense-elementor-panel-js',
			'TranslateSenseEditorData',
			array(
				'postId'          => $post_id,
				'restUrl'         => esc_url_raw( rest_url( 'translatesense/v1/' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'polylangActive'  => Polylang_Bridge::is_polylang_active(),
				'currentLanguage' => Polylang_Bridge::get_post_language( $post_id ),
				'languages'       => Polylang_Bridge::get_languages(),
				'defaultProvider' => $settings['provider'] ?? 'client_google',
				'mappingMode'     => Detector::is_mapping_mode_active( $post_id ),
			)
		);
	}

	/**
	 * Add Classic Editor Meta Box.
	 */
	public static function add_classic_meta_box() {
		$screen = get_current_screen();
		if ( $screen && method_exists( $screen, 'is_block_editor' ) && $screen->is_block_editor() ) {
			return; // Handled by Gutenberg sidebar
		}

		add_meta_box(
			'translatesense-classic-metabox',
			__( 'TranslateSense', 'translatesense' ),
			array( __CLASS__, 'render_classic_meta_box' ),
			array( 'post', 'page' ),
			'side',
			'high'
		);
	}

	/**
	 * Render Classic Editor Meta Box HTML.
	 */
	public static function render_classic_meta_box( $post ) {
		$post_id = $post->ID;
		$current_lang = Polylang_Bridge::get_post_language( $post_id );
		?>
		<div class="translatesense-metabox-content" style="padding: 6px 0;">
			<button type="button" id="ts-classic-translate-btn" class="button button-primary widefat" style="margin-bottom: 4px; font-weight: 600;">
				<?php esc_html_e( '⚡ Translate Page', 'translatesense' ); ?>
			</button>

			<div id="ts-classic-status-message" style="margin-top: 8px;"></div>
		</div>
		<script>
		jQuery(document).ready(function($){
			$('#ts-classic-translate-btn').on('click', function(){
				var btn = $(this);
				var targetLang = '<?php echo esc_js( $current_lang ); ?>';
				var statusBox = $('#ts-classic-status-message');
				
				btn.prop('disabled', true).text('Translating...');
				statusBox.html('<div class="notice notice-info inline"><p>Processing translation...</p></div>');
				
				$.ajax({
					url: '<?php echo esc_url_raw( rest_url( 'translatesense/v1/translate-post' ) ); ?>',
					method: 'POST',
					headers: { 'X-WP-Nonce': '<?php echo wp_create_nonce( 'wp_rest' ); ?>' },
					contentType: 'application/json',
					data: JSON.stringify({
						post_id: <?php echo (int) $post_id; ?>,
						target_lang: targetLang,
						provider: 'openai'
					}),
					success: function(res) {
						btn.prop('disabled', false).text('⚡ Translate Page');
						if(res.success && res.edit_url) {
							statusBox.html('<div class="notice notice-success inline"><p><strong>Success!</strong> Translated post updated/created. <a href="'+res.edit_url+'" target="_blank">Edit Translation &rarr;</a></p></div>');
						} else {
							statusBox.html('<div class="notice notice-success inline"><p>Translation complete!</p></div>');
						}
					},
					error: function(xhr) {
						btn.prop('disabled', false).text('⚡ Translate Page');
						var msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Translation failed.';
						statusBox.html('<div class="notice notice-error inline"><p>'+msg+'</p></div>');
					}
				});
			});
		});
		</script>
		<?php
	}
}
