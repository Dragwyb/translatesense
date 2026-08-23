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
			__( 'TranslateSense - Translation & XML Mapping', 'translatesense' ),
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
		$languages = Polylang_Bridge::get_languages();
		$is_mapping = get_post_meta( $post_id, '_translatesense_mapping_mode', true );
		?>
		<div class="translatesense-metabox-content" style="padding: 6px 0;">
			<p><strong><?php esc_html_e( 'Current Post Language:', 'translatesense' ); ?></strong> <code><?php echo esc_html( strtoupper( $current_lang ) ); ?></code></p>
			
			<div style="margin: 12px 0;">
				<label for="ts-classic-target-lang"><strong><?php esc_html_e( 'Translate To:', 'translatesense' ); ?></strong></label>
				<select id="ts-classic-target-lang" class="widefat" style="margin-top: 4px;">
					<?php foreach ( $languages as $lang ) : ?>
						<?php if ( $lang['slug'] !== $current_lang ) : ?>
							<option value="<?php echo esc_attr( $lang['slug'] ); ?>"><?php echo esc_html( $lang['name'] ); ?> (<?php echo esc_html( $lang['slug'] ); ?>)</option>
						<?php endif; ?>
					<?php endforeach; ?>
				</select>
			</div>

			<button type="button" id="ts-classic-translate-btn" class="button button-primary widefat" style="margin-bottom: 8px;">
				<?php esc_html_e( '⚡ Translate Current Post', 'translatesense' ); ?>
			</button>

			<hr style="margin: 14px 0; border: none; border-top: 1px solid #ddd;" />

			<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
				<input type="checkbox" name="_translatesense_mapping_mode" value="1" <?php checked( $is_mapping, '1' ); ?> />
				<span><strong><?php esc_html_e( 'Enable Config Mapping Mode', 'translatesense' ); ?></strong></span>
			</label>
			<p class="description" style="font-size: 11px; margin-top: 4px;">
				<?php esc_html_e( 'When enabled, saving this post detects unmapped widgets or dummy text and updates custom XML.', 'translatesense' ); ?>
			</p>
			<div id="ts-classic-status-message" style="margin-top: 8px;"></div>
		</div>
		<script>
		jQuery(document).ready(function($){
			$('#ts-classic-translate-btn').on('click', function(){
				var btn = $(this);
				var targetLang = $('#ts-classic-target-lang').val();
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
						target_lang: targetLang
					}),
					success: function(res) {
						btn.prop('disabled', false).text('⚡ Translate Current Post');
						if(res.success && res.edit_url) {
							statusBox.html('<div class="notice notice-success inline"><p><strong>Success!</strong> Translated post created. <a href="'+res.edit_url+'" target="_blank">Edit Translation &rarr;</a></p></div>');
						} else {
							statusBox.html('<div class="notice notice-success inline"><p>Translation complete!</p></div>');
						}
					},
					error: function(xhr) {
						btn.prop('disabled', false).text('⚡ Translate Current Post');
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
