<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser;

use TranslateSense\Includes\Content_Parser\Builders\Base_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Gutenberg_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Elementor_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Classic_Builder;
use TranslateSense\Includes\Editor_Integration;
use TranslateSense\Includes\Polylang_Bridge;
use TranslateSense\Includes\Hashing_Db;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core Content Parser Class.
 * Coordinates parsing post content for strings across Gutenberg, Elementor, and Classic builders.
 */
class Content_Parser {

	/**
	 * Registered builder instances.
	 *
	 * @var array<string, Base_Builder>
	 */
	private static $builders = array();

	/**
	 * Whether builders have been initialized.
	 *
	 * @var bool
	 */
	private static $initialized = false;

	/**
	 * Initialize the Content Parser subsystem and register hooks.
	 */
	public static function init(): void {
		self::init_builders();

		// Hook into post save lifecycle to parse and hash content automatically
		add_action( 'save_post', array( __CLASS__, 'handle_save_post' ), 25, 2 );

		// Hook into elementor post save lifecycle to parse the hash content automatically
		add_action( 'elementor/document/before_save', array( __CLASS__, 'handle_elementor_save_post' ), 10, 2 );

		// Hook into permanent post deletion lifecycle to purge package data
		add_action( 'before_delete_post', array( __CLASS__, 'handle_delete_post' ), 10, 1 );
	}

	/**
	 * Initialize default builder parsers.
	 */
	public static function init_builders(): void {
		if ( self::$initialized ) {
			return;
		}

		self::register_builder( 'gutenberg', new Gutenberg_Builder() );
		self::register_builder( 'elementor', new Elementor_Builder() );
		self::register_builder( 'classic', new Classic_Builder() );

		self::$initialized = true;
	}

	/**
	 * Register or override a builder parser instance.
	 *
	 * @param string       $slug
	 * @param Base_Builder $builder
	 */
	public static function register_builder( string $slug, Base_Builder $builder ): void {
		self::$builders[ sanitize_key( $slug ) ] = $builder;
	}

	/**
	 * Get a builder parser instance by slug.
	 *
	 * @param string $slug
	 * @return Base_Builder|null
	 */
	public static function get_builder( string $slug ): ?Base_Builder {
		self::init_builders();
		$slug = sanitize_key( $slug );
		return self::$builders[ $slug ] ?? null;
	}

	/**
	 * Automatically detect builder type from post ID or content structure.
	 *
	 * @param mixed $content
	 * @param int   $post_id
	 * @return string 'gutenberg' | 'elementor' | 'classic'
	 */
	public static function detect_builder( $content = '', int $post_id = 0 ): string {
		if ( $post_id > 0 && class_exists( 'TranslateSense\Includes\Editor_Integration' ) ) {
			$editor_type = Editor_Integration::get_post_editor_type( $post_id );
			if ( ! empty( $editor_type ) ) {
				return $editor_type;
			}
		}

		// Check Elementor edit mode post meta
		if ( $post_id > 0 && 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ) ) {
			return 'elementor';
		}

		// Check Gutenberg blocks
		if ( is_array( $content ) || ( is_string( $content ) && function_exists( 'has_blocks' ) && has_blocks( $content ) ) ) {
			return 'gutenberg';
		}

		return 'classic';
	}

	/**
	 * Parse content for translatable strings using the appropriate builder.
	 *
	 * @param mixed  $content Content string, block array, or Elementor JSON/array
	 * @param int    $post_id Post ID (optional)
	 * @param string $lang    Source language code (optional, auto-detected if empty)
	 * @param string $builder Builder slug (optional, auto-detected if empty)
	 * @return array Extracted strings array
	 */
	public static function parse( $content = '', int $post_id = 0, string $lang = '', string $builder = '' ): array {
		self::init_builders();

		// Auto-detect source language
		if ( empty( $lang ) && $post_id > 0 && class_exists( 'TranslateSense\Includes\Polylang_Bridge' ) ) {
			$lang = Polylang_Bridge::get_post_language( $post_id );
		}

		// If content is empty and post_id is provided, retrieve content from post
		if ( empty( $content ) && $post_id > 0 ) {
			$post = get_post( $post_id );
			if ( $post ) {
				$content = $post->post_content;
			}
		}

		// Auto-detect builder
		if ( empty( $builder ) ) {
			$builder = self::detect_builder( $content, $post_id );
		}

		$builder = sanitize_key( $builder );
		if ( 'core' === $builder ) {
			$builder = 'gutenberg';
		}

		$parser = self::get_builder( $builder );
		if ( ! $parser ) {
			$parser = self::get_builder( 'classic' );
		}

		if ( ! $parser ) {
			return array();
		}

		$extracted = array();

		// Save and append core post fields (post_title, post_name, post_excerpt)
		if ( $post_id > 0 && ! empty( $lang ) && class_exists( Hashing_Db::class ) ) {
			$post_obj = get_post( $post_id );
			if ( $post_obj ) {
				$existing_names = array_column( (array) $extracted, 'name' );

				// 1. Post Title
				$title = $post_obj->post_title;
				if ( ! empty( $title ) && '' !== trim( (string) $title ) && ! in_array( 'post_title', $existing_names, true ) ) {
					$title_hash = Hashing_Db::generate_hash( 'post_title', $title );
					$string_id  = Hashing_Db::get_or_create_string_id( $title, $title );
					if ( $string_id > 0 ) {
						Hashing_Db::record_package( $post_id, $lang, $title_hash, $builder, 'post_title', 'Post/Page Title', $title, $title, $string_id );
						$extracted[] = array(
							'hash'      => $title_hash,
							'name'      => 'post_title',
							'key'       => 'Post/Page Title',
							'source'    => $title,
							'value'     => $title,
							'string_id' => $string_id,
						);
					}
				}

				// 2. Post Name (Slug)
				$slug = $post_obj->post_name;
				if ( ! empty( $slug ) && '' !== trim( (string) $slug ) && ! in_array( 'post_name', $existing_names, true ) ) {
					$slug_hash = Hashing_Db::generate_hash( 'post_name', $slug );
					$string_id = Hashing_Db::get_or_create_string_id( $slug, $slug );
					if ( $string_id > 0 ) {
						Hashing_Db::record_package( $post_id, $lang, $slug_hash, $builder, 'post_name', 'Post/Page Slug', $slug, $slug, $string_id );
						$extracted[] = array(
							'hash'      => $slug_hash,
							'name'      => 'post_name',
							'key'       => 'Post/Page Slug',
							'source'    => $slug,
							'value'     => $slug,
							'string_id' => $string_id,
						);
					}
				}

				// 3. Post Excerpt
				$excerpt = $post_obj->post_excerpt;
				if ( ! empty( $excerpt ) && '' !== trim( (string) $excerpt ) && ! in_array( 'post_excerpt', $existing_names, true ) ) {
					$excerpt_hash = Hashing_Db::generate_hash( 'post_excerpt', $excerpt );
					$string_id    = Hashing_Db::get_or_create_string_id( $excerpt, $excerpt );
					if ( $string_id > 0 ) {
						Hashing_Db::record_package( $post_id, $lang, $excerpt_hash, $builder, 'post_excerpt', 'Post/Page Excerpt', $excerpt, $excerpt, $string_id );
						$extracted[] = array(
							'hash'      => $excerpt_hash,
							'name'      => 'post_excerpt',
							'key'       => 'Post/Page Excerpt',
							'source'    => $excerpt,
							'value'     => $excerpt,
							'string_id' => $string_id,
						);
					}
				}
			}
		}

		$extracted = array_merge( $extracted, $parser->parse( $content, $post_id, $lang ) );

		return array_values( (array) $extracted );
	}

	public static function is_save_package( $post_id ): bool {
		if ( ! $post_id ) {
			return false;
		}

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return false;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return false;
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return false;
		}

		$is_translated_post = get_post_meta( $post_id, '_translatesense_source_id', true );

		if ( ! empty( $is_translated_post ) && intval( $is_translated_post ) !== intval( $post_id ) ) {
			return false;
		}

		if ( get_post_meta( $post_id, '_translatesense_translated', true ) ) {
			return false;
		}

		// Check all linked Polylang translation posts
		if ( class_exists( 'TranslateSense\Includes\Polylang_Bridge' ) && Polylang_Bridge::is_polylang_active() ) {
			$default_lang = Polylang_Bridge::get_default_language();
			$translations = Polylang_Bridge::get_post_translations( $post_id );

			if ( ! empty( $translations ) && is_array( $translations ) ) {
				foreach ( $translations as $lang => $linked_post_id ) {
					$linked_post_id = (int) $linked_post_id;
					if ( $linked_post_id > 0 && $linked_post_id !== (int) $post_id ) {
						// If any linked post is in Polylang default language and already has packages saved, return false
						if ( $lang === $default_lang && class_exists( Hashing_Db::class ) && Hashing_Db::has_post_packages( $linked_post_id ) ) {
							return false;
						}
					}
				}
			}
		}

		$post = get_post( $post_id );

		if ( ! $post || 'trash' === $post->post_status || 'auto-draft' === $post->post_status || 'ts_config_post' === $post->post_type ) {
			return false;
		}

		return true;
	}

	/**
	 * Handle Elementor document save action.
	 * Removes old package records for the post and re-parses new strings into packages.
	 *
	 * @param \Elementor\Core\DocumentTypes\Page $document Elementor document
	 * @param array                              $data     Post data
	 */
	public static function handle_elementor_save_post( $document, $data ): void {

		if ( ! isset( $data ) || ! is_array( $data ) || count( $data ) === 0 ) {
			return;
		}

		if ( ! $document || ! $document instanceof \Elementor\Core\DocumentTypes\Page ) {
			return;
		}

		$post_id = (int) $document->get_id();

		if ( ! self::is_save_package( $post_id ) ) {
			return;
		}

		$post = get_post( $post_id );

		// Detect source language
		$lang = '';
		if ( class_exists( 'TranslateSense\Includes\Polylang_Bridge' ) ) {
			$lang = Polylang_Bridge::get_post_language( $post_id );
		}

		// Detect editor type / builder
		$builder = self::detect_builder( $post->post_content, $post_id );

		// Remove old package records for this post before storing new parsed strings
		if ( class_exists( Hashing_Db::class ) ) {
			Hashing_Db::delete_post_packages( $post_id, ! empty( $lang ) ? $lang : null, ! empty( $builder ) ? $builder : null );
		}

		// Parse updated post content and store new string packages
		self::parse( $post->post_content, $post_id, $lang, $builder );
	}

	/**
	 * Handle WordPress save_post action.
	 * Removes old package records for the post and re-parses new strings into packages.
	 *
	 * @param int           $post_id Post ID
	 * @param \WP_Post|null $post    Post object
	 */
	public static function handle_save_post( int $post_id, $post = null ): void {

		if ( ! self::is_save_package( $post_id ) ) {
			return;
		}

		if ( ! $post ) {
			$post = get_post( $post_id );
		}

		// Detect source language
		$lang = '';

		if ( class_exists( 'TranslateSense\Includes\Polylang_Bridge' ) ) {
			$lang = Polylang_Bridge::get_post_language( $post_id );
		}

		if ( ! $lang ) {
			return;
		}

		// Detect editor type / builder
		$builder = self::detect_builder( $post->post_content, $post_id );

		// Remove old package records for this post before storing new parsed strings
		if ( class_exists( Hashing_Db::class ) ) {
			Hashing_Db::delete_post_packages( $post_id, ! empty( $lang ) ? $lang : null, ! empty( $builder ) ? $builder : null );
		}

		// Parse updated post content and store new string packages
		self::parse( $post->post_content, $post_id, $lang, $builder );
	}

	/**
	 * Handle permanent post deletion.
	 * Removes all stored package records associated with the deleted post.
	 *
	 * @param int $post_id Post ID being permanently deleted.
	 */
	public static function handle_delete_post( int $post_id ): void {
		if ( $post_id <= 0 ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		if ( class_exists( 'TranslateSense\Includes\Hashing_Db' ) ) {
			Hashing_Db::delete_post_packages( $post_id );
		}
	}
}
