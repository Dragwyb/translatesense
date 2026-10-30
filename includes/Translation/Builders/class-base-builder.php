<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Builders;

use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Synchronizer;
use TranslateSense\Includes\Admin\Editor_Integration;

use WP_Post;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Abstract Base Builder for Translation.
 * Handles common post translation routines including title, slug, excerpt, and Polylang post linking.
 */
abstract class Base_Builder {

	/**
	 * Get the builder slug identifier (e.g. 'gutenberg', 'elementor', 'classic').
	 *
	 * @return string
	 */
	abstract public function get_builder_slug(): string;

	/**
	 * Translate builder-specific content structure.
	 * Returns string for block/classic editors or structured data (e.g. array) for page builders.
	 *
	 * @param WP_Post $source_post
	 * @param string  $source_lang
	 * @param string  $target_lang
	 * @param array   $custom_opts
	 * @return mixed
	 */
	abstract public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() );

	/**
	 * Translate post title.
	 *
	 * @param string $title
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 * @return string
	 */
	public function translate_title( string $title, string $source_lang, string $target_lang, int $post_id = 0, array $custom_opts = array() ): string {
		if ( empty( trim( $title ) ) ) {
			return $title;
		}

		$res = Translate::translate_string(
			$title,
			$source_lang,
			$target_lang,
			'post_title',
			$post_id,
			$custom_opts
		);

		return ! empty( $res['translated'] ) ? (string) $res['translated'] : $title;
	}

	/**
	 * Translate post excerpt.
	 *
	 * @param string $excerpt
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param int    $post_id
	 * @param array  $custom_opts
	 * @return string
	 */
	public function translate_excerpt( string $excerpt, string $source_lang, string $target_lang, int $post_id = 0, array $custom_opts = array() ): string {
		if ( empty( trim( $excerpt ) ) ) {
			return $excerpt;
		}

		$res = Translate::translate_string(
			$excerpt,
			$source_lang,
			$target_lang,
			'post_excerpt',
			$post_id,
			$custom_opts
		);

		return ! empty( $res['translated'] ) ? (string) $res['translated'] : $excerpt;
	}

	public function translate_post_name( string $post_name, string $source_lang, string $target_lang, int $post_id = 0, array $custom_opts = array() ): string {
		if ( empty( trim( $post_name ) ) ) {
			return $post_name;
		}

		$res = Translate::translate_string(
			$post_name,
			$source_lang,
			$target_lang,
			'post_name',
			$post_id,
			$custom_opts
		);

		return ! empty( $res['translated'] ) ? (string) $res['translated'] : $post_name;
	}

	/**
	 * Generate or translate slug for target post.
	 *
	 * @param WP_Post $source_post
	 * @param string  $translated_title
	 * @param string  $target_lang
	 * @return string
	 */
	public function generate_translated_slug( WP_Post $source_post, string $translated_title, string $target_lang ): string {
		$base_slug = sanitize_title( $translated_title );
		if ( empty( $base_slug ) ) {
			$base_slug = $source_post->post_name . '-' . $target_lang;
		}

		return wp_unique_post_slug(
			$base_slug,
			0,
			$source_post->post_status,
			$source_post->post_type,
			$source_post->post_parent
		);
	}

	/**
	 * Execute full post translation workflow for this builder.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $in_memory_translations
	 * @return array|WP_Error
	 */
	public function translate_post( int $post_id, string $target_lang, string $provider = '', array $in_memory_translations = array(), array $options = array() ) {
		$source_post = get_post( $post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Source post not found.', 'translatesense' ), array( 'status' => 404 ) );
		}

		$is_bulk          = ! empty( $options['is_bulk'] );
		$existing_post_id = Polylang_Bridge::get_existing_translation_post_id( $post_id, $target_lang );
		$is_existing      = $existing_post_id > 0 && $existing_post_id !== $post_id;
		Polylang_Synchronizer::reset_media_tracking();

		$settings      = get_option( 'translatesense_settings', array() );
		$raw_slug_mode = ( $is_bulk && ! empty( $settings['slug_translation'] ) ) ? sanitize_key( (string) $settings['slug_translation'] ) : 'slug_translate';
		$slug_mode     = in_array( $raw_slug_mode, array( 'keep_orignal', 'title_based', 'slug_translate' ), true ) ? $raw_slug_mode : 'slug_translate';

		$raw_post_status  = ( $is_bulk && ! empty( $settings['post_status'] ) ) ? sanitize_key( (string) $settings['post_status'] ) : 'draft';
		$bulk_post_status = in_array( $raw_post_status, array( 'publish', 'draft' ), true ) ? $raw_post_status : 'draft';

		$source_lang = Polylang_Bridge::get_post_language( $post_id );
		$custom_opts = array();

		if ( ! empty( $provider ) ) {
			$custom_opts['provider'] = $provider;
		}
		if ( ! empty( $in_memory_translations ) && is_array( $in_memory_translations ) ) {
			$custom_opts['in_memory_translations'] = $in_memory_translations;
		}

		/**
		 * Fires before TranslateSense translates a source post for a target language.
		 *
		 * @param int    $post_id          Source post ID.
		 * @param string $target_lang      Target language slug.
		 * @param bool   $is_existing      Whether a target translation already exists.
		 * @param int    $existing_post_id Existing target post ID, if any.
		 * @param array  $options          Translation options.
		 */
		do_action( 'translatesense_before_translate_post', $post_id, $target_lang, $is_existing, $existing_post_id, $options );

		// 1. Translate Title & Excerpt.
		$translated_title   = $this->translate_title( $source_post->post_title, $source_lang, $target_lang, $post_id, $custom_opts );
		$translated_excerpt = $this->translate_excerpt( $source_post->post_excerpt, $source_lang, $target_lang, $post_id, $custom_opts );

		// Never translate or change the slug of an existing target translation.
		$translated_post_name = $is_existing
			? $source_post->post_name
			: ( ( $is_bulk && 'slug_translate' !== $slug_mode )
				? $source_post->post_name
				: $this->translate_post_name( $source_post->post_name, $source_lang, $target_lang, $post_id, $custom_opts ) );

		// Allow style CSS properities temporarily
		add_filter( 'safe_style_css', array( $this, 'allowed_css_properties' ), 10, 1 );

		// 2. Translate Builder Content
		$translated_content = $this->translate_content( $source_post, $source_lang, $target_lang, $custom_opts );

		// Remove filter after translation
		remove_filter( 'safe_style_css', array( $this, 'allowed_css_properties' ), 10, 1 );

		$wp_post_content = is_string( $translated_content ) ? $translated_content : $source_post->post_content;

		// Translate attachment IDs and links after text translation, before
		// persistence. Elementor's structured data is handled by its builder.
		$wp_post_content = Polylang_Synchronizer::translate_content_media_references(
			$wp_post_content,
			$target_lang,
			$this->get_builder_slug(),
			$source_lang
		);

		// Existing translations are updated in place. Slug and status settings
		// are creation-only and must not overwrite editorial choices on a target.
		$create_args = array(
			'post_excerpt' => $translated_excerpt,
		);

		if ( $is_bulk && ! $is_existing ) {
			$create_args['post_status'] = $bulk_post_status;

			if ( 'keep_orignal' === $slug_mode ) {
				$create_args['post_name'] = sanitize_title( (string) $source_post->post_name );
			} elseif ( 'title_based' === $slug_mode ) {
				$slug_candidate           = sanitize_title( (string) $translated_title );
				$create_args['post_name'] = ! empty( $slug_candidate ) ? $slug_candidate : sanitize_title( (string) $source_post->post_name );
			} else {
				$slug_candidate = ! empty( $translated_post_name ) ? sanitize_title( (string) $translated_post_name ) : '';
				if ( ! empty( $slug_candidate ) ) {
					$create_args['post_name'] = $slug_candidate;
				}
			}
		} elseif ( ! $is_existing && ! $is_bulk && ! empty( $translated_post_name ) && $translated_post_name !== $source_post->post_name ) {
			$create_args['post_name'] = sanitize_title( $translated_post_name );
		}

		// 3. Create or update Polylang translated post
		$created_post_id = Polylang_Bridge::create_or_update_translated_post(
			$post_id,
			$target_lang,
			$translated_title,
			$wp_post_content,
			$create_args
		);

		if ( is_wp_error( $created_post_id ) ) {
			return $created_post_id;
		}

		// 4. Builder-specific persistence runs after the post and Polylang
		$this->after_save_post( $post_id, $created_post_id, $source_lang, $target_lang, $translated_content );
		Polylang_Synchronizer::attach_translated_media_to_post( $created_post_id );

		/**
		 * Fires after the complete TranslateSense post translation pipeline.
		 *
		 * @param int    $source_post_id Source post ID.
		 * @param int    $target_post_id Target post ID.
		 * @param string $target_lang    Target language slug.
		 * @param bool   $is_existing    Whether an existing translation was updated.
		 * @param array  $options        Translation options.
		 */
		do_action( 'translatesense_after_translate_post', $post_id, $created_post_id, $target_lang, $is_existing, $options );

		$editor_type = Editor_Integration::get_post_editor_type( $created_post_id );
		$edit_url    = Editor_Integration::get_post_edit_link( $created_post_id );

		return array(
			'success'           => true,
			'source_post_id'    => $post_id,
			'source_post_title' => $source_post->post_title,
			'target_post_id'    => $created_post_id,
			'target_language'   => $target_lang,
			'translated_title'  => $translated_title,
			'target_post_title' => $translated_title,
			'is_retranslation'  => $is_existing,
			'sync_status'       => get_post_meta( $created_post_id, '_translatesense_sync_status', true ),
			'sync_warnings'     => (array) get_post_meta( $created_post_id, '_translatesense_sync_warnings', true ),
			'builder'           => $this->get_builder_slug(),
			'editor_type'       => $editor_type,
			'edit_url'          => $edit_url,
			'view_url'          => get_permalink( $created_post_id ),
		);
	}

	/**
	 * Lifecycle method called immediately after target post is inserted/updated.
	 * Override in specific builder (e.g. Elementor_Builder) to update builder-specific meta & settings.
	 *
	 * @param int    $source_post_id
	 * @param int    $target_post_id
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param mixed  $translated_content
	 */
	public function after_save_post( int $source_post_id, int $target_post_id, string $source_lang, string $target_lang, $translated_content ): void {
		// Base implementation - can be extended by builders
	}

	/**
	 * Allow all CSS properties for builder content translation
	 *
	 * @param array $properties
	 * @return array
	 */
	public function allowed_css_properties( array $properties ): array {
		$layout_styles = array(
			'display',
			'justify-content',
			'align-items',
			'flex-direction',
			'flex-wrap',
			'gap',
			'fill',
		);

		return apply_filters( 'translatesense_allowed_css_properties', array_merge( $properties, $layout_styles ) );
	}
}
