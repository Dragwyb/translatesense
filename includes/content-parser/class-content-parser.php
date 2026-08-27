<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content_Parser;

use TranslateSense\Includes\Content_Parser\Builders\Base_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Gutenberg_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Elementor_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Divi_Builder;
use TranslateSense\Includes\Content_Parser\Builders\Classic_Builder;
use TranslateSense\Includes\Editor_Integration;
use TranslateSense\Includes\Polylang_Bridge;
use TranslateSense\Includes\Hashing_Db;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core Content Parser Class.
 * Coordinates parsing post content for strings across Gutenberg, Elementor, Divi, and Classic builders.
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
		self::register_builder( 'divi', new Divi_Builder() );
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
	 * @return string 'gutenberg' | 'elementor' | 'divi' | 'classic'
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

		// Check Divi builder post meta or shortcodes
		if ( $post_id > 0 && 'on' === get_post_meta( $post_id, '_et_pb_use_builder', true ) ) {
			return 'divi';
		}

		if ( is_string( $content ) && false !== strpos( $content, '[et_pb_' ) ) {
			return 'divi';
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

		return $parser->parse( $content, $post_id, $lang );
	}

	/**
	 * Parse a post object or ID directly.
	 *
	 * @param int    $post_id
	 * @param string $lang
	 * @param string $builder
	 * @return array
	 */
	public static function parse_post( int $post_id, string $lang = '', string $builder = '' ): array {
		if ( ! $post_id ) {
			return array();
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return array();
		}

		return self::parse( $post->post_content, $post_id, $lang, $builder );
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

		if ( ! empty( $is_translated_post ) && $is_translated_post !== intval( $post_id ) ) {
			return false;
		}

		$post = get_post( $post_id );

		if ( ! $post || 'trash' === $post->post_status || 'auto-draft' === $post->post_status ) {
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
	public static function handle_elementor_save_post( $ele_doc, array $ele_data ): void {

		if ( ! isset( $ele_data ) || ! is_array( $ele_data ) || count( $ele_data ) === 0 ) {
			return;
		}

		if ( ! $ele_doc || ! $ele_doc instanceof \Elementor\Core\DocumentTypes\Page ) {
			return;
		}

		$post_id = (int) $ele_doc->get_id();

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
