<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translate\Builders;

use WP_Post;
use WP_Error;
use TranslateSense\Includes\Translate\Translate;
use TranslateSense\Includes\Polylang_Bridge;
use TranslateSense\Includes\Editor_Integration;

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
	public function translate_post( int $post_id, string $target_lang, string $provider = '', array $in_memory_translations = array() ) {
		$source_post = get_post( $post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Source post not found.', 'translatesense' ), array( 'status' => 404 ) );
		}

		$source_lang = Polylang_Bridge::get_post_language( $post_id );
		$custom_opts = array();

		if ( ! empty( $provider ) ) {
			$custom_opts['provider'] = $provider;
		}
		if ( ! empty( $in_memory_translations ) && is_array( $in_memory_translations ) ) {
			$custom_opts['in_memory_translations'] = $in_memory_translations;
		}

		// 1. Translate Title & Excerpt
		$translated_title     = $this->translate_title( $source_post->post_title, $source_lang, $target_lang, $post_id, $custom_opts );
		$translated_excerpt   = $this->translate_excerpt( $source_post->post_excerpt, $source_lang, $target_lang, $post_id, $custom_opts );
		$translated_post_name = $this->translate_post_name( $source_post->post_name, $source_lang, $target_lang, $post_id, $custom_opts );

		// Allow style CSS properities temporarily
		add_filter( 'safe_style_css', array( $this, 'allowed_css_properties' ), 10, 1 );

		// 2. Translate Builder Content
		$translated_content = $this->translate_content( $source_post, $source_lang, $target_lang, $custom_opts );

		// Remove filter after translation
		remove_filter( 'safe_style_css', array( $this, 'allowed_css_properties' ), 10, 1 );

		$wp_post_content = is_string( $translated_content ) ? $translated_content : $source_post->post_content;

		// 3. Create or update Polylang translated post
		$created_post_id = Polylang_Bridge::create_or_update_translated_post(
			$post_id,
			$target_lang,
			$translated_title,
			$wp_post_content
		);

		if ( is_wp_error( $created_post_id ) ) {
			return $created_post_id;
		}

		// 4. Run builder post-insert lifecycle hook with translated content passed in last parameter
		$this->after_save_post( $post_id, $created_post_id, $source_lang, $target_lang, $translated_content );

		// Update excerpt if translated
		if ( ! empty( $translated_excerpt ) && $translated_excerpt !== $source_post->post_excerpt ) {
			wp_update_post(
				array(
					'ID'           => $created_post_id,
					'post_excerpt' => $translated_excerpt,
				)
			);
		}

		// Update slug if translated
		if ( ! empty( $translated_post_name ) && $translated_post_name !== $source_post->post_name ) {
			wp_update_post(
				array(
					'ID'        => $created_post_id,
					'post_name' => $translated_post_name,
				)
			);
		}

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
