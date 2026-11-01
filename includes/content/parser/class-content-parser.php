<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser;

use TranslateSense\Includes\Content\Parser\Builders\Base_Builder;
use TranslateSense\Includes\Content\Parser\Builders\Gutenberg_Builder;
use TranslateSense\Includes\Content\Parser\Builders\Elementor_Builder;
use TranslateSense\Includes\Content\Parser\Builders\Classic_Builder;
use TranslateSense\Includes\Admin\Editor_Integration;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Database\Hashing_Db;

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
	 * Temporary in-memory cache of existing post content before update.
	 *
	 * @var array<int, string>
	 */
	private static $existing_post_content = array();

	/**
	 * Initialize the Content Parser subsystem and register hooks.
	 */
	public static function init(): void {
		self::init_builders();

		// Hook before post update to capture existing post_content before it is overwritten in DB
		add_action( 'pre_post_update', array( __CLASS__, 'capture_pre_post_content' ), 10, 2 );
		add_action( 'post_updated', array( __CLASS__, 'capture_post_updated' ), 10, 3 );

		// Hook into post save lifecycle to check for content modifications
		add_action( 'save_post', array( __CLASS__, 'handle_save_post' ), 25, 2 );

		// Hook into elementor post save lifecycle to check for element modifications
		add_action( 'elementor/document/before_save', array( __CLASS__, 'handle_elementor_save_post' ), 10, 2 );

		// Hook into permanent post deletion lifecycle to purge package data
		add_action( 'before_delete_post', array( __CLASS__, 'handle_delete_post' ), 10, 1 );
	}

	/**
	 * Capture existing post_content before WordPress updates the database record.
	 *
	 * @param int   $post_id Post ID being updated.
	 * @param array $data    Array of post data (optional).
	 */
	public static function capture_pre_post_content( int $post_id, array $data = array() ): void {
		if ( ! isset( self::$existing_post_content[ $post_id ] ) ) {
			$post = get_post( $post_id );
			if ( $post && isset( $post->post_content ) ) {
				self::$existing_post_content[ $post_id ] = (string) $post->post_content;
			}
		}
	}

	/**
	 * Capture existing post_content from post_updated hook ($post_before).
	 *
	 * @param int      $post_id     Post ID.
	 * @param \WP_Post $post_after  Post object following the update.
	 * @param \WP_Post $post_before Post object before the update.
	 */
	public static function capture_post_updated( int $post_id, \WP_Post $post_after, \WP_Post $post_before ): void {
		self::$existing_post_content[ $post_id ] = (string) $post_before->post_content;
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
		if ( $post_id > 0 && class_exists( 'TranslateSense\\Includes\\Admin\\Editor_Integration' ) ) {
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
		if ( empty( $lang ) && $post_id > 0 && class_exists( 'TranslateSense\\Includes\\Integrations\\Polylang\\Polylang_Bridge' ) ) {
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
					$title_hash  = Hashing_Db::generate_hash( 'post_title', $title );
					$string_hash = md5( $title );
					$string_id   = Hashing_Db::get_or_create_string_id( $title, $title );
					if ( $string_id > 0 ) {
						Hashing_Db::record_package( $post_id, $lang, $title_hash, $builder, 'post_title', 'Post/Page Title', $title, $title, $string_hash );
						$extracted[] = array(
							'hash'        => $title_hash,
							'name'        => 'post_title',
							'key'         => 'Post/Page Title',
							'source'      => $title,
							'value'       => $title,
							'string_hash' => $string_hash,
						);
					}
				}

				// 2. Post Name (Slug)
				$slug = $post_obj->post_name;
				if ( ! empty( $slug ) && '' !== trim( (string) $slug ) && ! in_array( 'post_name', $existing_names, true ) ) {
					$slug_hash   = Hashing_Db::generate_hash( 'post_name', $slug );
					$string_hash = md5( $slug );
					$string_id   = Hashing_Db::get_or_create_string_id( $slug, $slug );
					if ( $string_id > 0 ) {
						Hashing_Db::record_package( $post_id, $lang, $slug_hash, $builder, 'post_name', 'Post/Page Slug', $slug, $slug, $string_hash );
						$extracted[] = array(
							'hash'        => $slug_hash,
							'name'        => 'post_name',
							'key'         => 'Post/Page Slug',
							'source'      => $slug,
							'value'       => $slug,
							'string_hash' => $string_hash,
						);
					}
				}

				// 3. Post Excerpt
				$excerpt = $post_obj->post_excerpt;
				if ( ! empty( $excerpt ) && '' !== trim( (string) $excerpt ) && ! in_array( 'post_excerpt', $existing_names, true ) ) {
					$excerpt_hash = Hashing_Db::generate_hash( 'post_excerpt', $excerpt );
					$string_hash  = md5( $excerpt );
					$string_id    = Hashing_Db::get_or_create_string_id( $excerpt, $excerpt );
					if ( $string_id > 0 ) {
						Hashing_Db::record_package( $post_id, $lang, $excerpt_hash, $builder, 'post_excerpt', 'Post/Page Excerpt', $excerpt, $excerpt, $string_hash );
						$extracted[] = array(
							'hash'        => $excerpt_hash,
							'name'        => 'post_excerpt',
							'key'         => 'Post/Page Excerpt',
							'source'      => $excerpt,
							'value'       => $excerpt,
							'string_hash' => $string_hash,
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
		if ( class_exists( 'TranslateSense\\Includes\\Integrations\\Polylang\\Polylang_Bridge' ) && Polylang_Bridge::is_polylang_active() ) {
			$default_lang = Polylang_Bridge::get_default_language();
			$post_lang    = Polylang_Bridge::get_post_language( $post_id );
			$translations = Polylang_Bridge::get_post_translations( $post_id );

			if ( ! empty( $translations ) && is_array( $translations ) ) {
				foreach ( $translations as $lang => $linked_post_id ) {
					$linked_post_id = (int) $linked_post_id;
					if ( $linked_post_id > 0 && $linked_post_id !== (int) $post_id ) {
						// If any linked post is in Polylang default language and already has packages saved, return false
						if ( $lang === $default_lang && class_exists( Hashing_Db::class ) && Hashing_Db::has_post_packages( $linked_post_id ) ) {
							return false;
						}
						// If this post is not default language, and another linked post already has packages saved, return false
						if ( $post_lang !== $default_lang && class_exists( Hashing_Db::class ) && Hashing_Db::has_post_packages( $linked_post_id ) ) {
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
	 * Compares new update data with existing saved data for _elementor_data.
	 * If they are not the same, triggers delete_post_packages (does not re-parse content).
	 *
	 * @param \Elementor\Core\DocumentTypes\Page|\Elementor\Core\Base\Document $document Elementor document
	 * @param array                                                            $data     Post data
	 */
	public static function handle_elementor_save_post( $document, $data ): void {

		if ( ! isset( $data ) || ! is_array( $data ) || count( $data ) === 0 ) {
			return;
		}

		if ( ! $document || ! is_object( $document ) || ! method_exists( $document, 'get_id' ) ) {
			return;
		}

		$post_id = (int) $document->get_id();

		if ( ! self::is_save_package( $post_id ) ) {
			return;
		}

		// Detect source language
		$lang = '';
		if ( class_exists( 'TranslateSense\\Includes\\Integrations\\Polylang\\Polylang_Bridge' ) ) {
			$lang = Polylang_Bridge::get_post_language( $post_id );
		}

		// Extract new elements data from payload
		$new_elements = null;
		if ( isset( $data['elements'] ) ) {
			$new_elements = $data['elements'];
		} elseif ( isset( $data[0] ) || isset( $data['elType'] ) ) {
			$new_elements = $data;
		} else {
			// No element tree in payload (e.g. settings-only update), element data did not change.
			$override_meta = array();
			if ( isset( $data['settings']['post_title'] ) && is_string( $data['settings']['post_title'] ) ) {
				$override_meta['post_title'] = $data['settings']['post_title'];
			}
			self::check_and_delete_changed_metadata_packages( $post_id, null, $override_meta );
			return;
		}

		$new_data_array = is_string( $new_elements ) ? json_decode( $new_elements, true ) : $new_elements;

		// Get existing saved _elementor_data from post meta
		$existing_raw        = get_post_meta( $post_id, '_elementor_data', true );
		$existing_data_array = is_string( $existing_raw ) && '' !== trim( $existing_raw )
			? json_decode( $existing_raw, true )
			: ( is_array( $existing_raw ) ? $existing_raw : null );

		// Compare new and existing _elementor_data
		$is_changed = false;
		if ( empty( $new_data_array ) && empty( $existing_data_array ) ) {
			$is_changed = false;
		} elseif ( empty( $new_data_array ) || empty( $existing_data_array ) ) {
			$is_changed = true;
		} else {
			$is_changed = ( $new_data_array != $existing_data_array );
		}

		// If new or existing data not same, trigger only delete_post_packages (do not parse here)
		if ( $is_changed && class_exists( Hashing_Db::class ) ) {
			Hashing_Db::delete_post_packages( $post_id, ! empty( $lang ) ? $lang : null, 'elementor' );
		} else {
			// Elements condition is false: delete post_title / post_name package if changed
			$override_meta = array();
			if ( isset( $data['settings']['post_title'] ) && is_string( $data['settings']['post_title'] ) ) {
				$override_meta['post_title'] = $data['settings']['post_title'];
			}
			self::check_and_delete_changed_metadata_packages( $post_id, null, $override_meta );
		}
	}

	/**
	 * Handle WordPress save_post action.
	 * Compares new update data with existing saved data for post_content.
	 * If they are not the same, triggers delete_post_packages (does not re-parse content).
	 * If content did not change (delete condition false), deletes post_name or post_title package if value changed.
	 *
	 * @param int           $post_id Post ID
	 * @param \WP_Post|null $post    Post object
	 */
	public static function handle_save_post( int $post_id, $post = null ): void {

		if ( ! self::is_save_package( $post_id ) ) {
			unset( self::$existing_post_content[ $post_id ] );
			return;
		}

		if ( ! $post ) {
			$post = get_post( $post_id );
		}

		if ( ! $post ) {
			unset( self::$existing_post_content[ $post_id ] );
			return;
		}

		// Detect source language
		$lang = '';
		if ( class_exists( 'TranslateSense\\Includes\\Integrations\\Polylang\\Polylang_Bridge' ) ) {
			$lang = Polylang_Bridge::get_post_language( $post_id );
		}

		if ( ! $lang ) {
			unset( self::$existing_post_content[ $post_id ] );
			return;
		}

		// Detect editor type / builder
		$builder = self::detect_builder( $post->post_content, $post_id );

		// Elementor content (_elementor_data) is handled in handle_elementor_save_post
		if ( 'elementor' === $builder ) {
			unset( self::$existing_post_content[ $post_id ] );
			// If an Elementor post is saved via WP admin, check and delete changed title or slug
			self::check_and_delete_changed_metadata_packages( $post_id, $post );
			return;
		}

		$existing_content = self::$existing_post_content[ $post_id ] ?? null;
		unset( self::$existing_post_content[ $post_id ] );

		// If there is no existing content recorded (e.g. brand new post), check metadata
		if ( null === $existing_content ) {
			self::check_and_delete_changed_metadata_packages( $post_id, $post );
			return;
		}

		$new_content = (string) $post->post_content;

		// Normalize line breaks for accurate comparison
		$normalized_new      = str_replace( "\r\n", "\n", $new_content );
		$normalized_existing = str_replace( "\r\n", "\n", (string) $existing_content );

		// If new or existing data not same, trigger only delete_post_packages (do not parse here)
		if ( $normalized_new !== $normalized_existing && class_exists( Hashing_Db::class ) ) {
			Hashing_Db::delete_post_packages( $post_id, ! empty( $lang ) ? $lang : null, ! empty( $builder ) ? $builder : null );
		} else {
			// Content condition is false: delete post_title / post_name package if value changed
			self::check_and_delete_changed_metadata_packages( $post_id, $post );
		}
	}

	/**
	 * Check if post_title or post_name have changed compared to saved packages,
	 * and simply delete the changed package record(s) so they are automatically
	 * re-extracted during translation without deleting any content block packages.
	 *
	 * @param int           $post_id           Post ID.
	 * @param \WP_Post|null $post              Post object (optional).
	 * @param array         $override_metadata Explicit metadata overrides (optional).
	 * @return bool True if any metadata package was deleted, false otherwise.
	 */
	public static function check_and_delete_changed_metadata_packages(
		int $post_id,
		$post = null,
		array $override_metadata = array()
	): bool {
		if ( $post_id <= 0 || ! class_exists( Hashing_Db::class ) ) {
			return false;
		}

		$post = $post instanceof \WP_Post ? $post : get_post( $post_id );
		if ( ! $post ) {
			return false;
		}

		$current_title = isset( $override_metadata['post_title'] ) ? trim( (string) $override_metadata['post_title'] ) : trim( (string) $post->post_title );
		$current_slug  = isset( $override_metadata['post_name'] ) ? trim( (string) $override_metadata['post_name'] ) : trim( (string) $post->post_name );

		global $wpdb;
		$packages_table = Hashing_Db::get_packages_table();
		$strings_table  = Hashing_Db::get_strings_table();

		// Fetch currently saved post_title and post_name packages for this post
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$saved_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.widget_name, s.source_string
				FROM {$packages_table} p
				INNER JOIN {$strings_table} s ON p.string_hash = s.string_hash
				WHERE p.post_id = %d AND p.widget_name IN ('post_title', 'post_name')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id
			),
			ARRAY_A
		);

		if ( empty( $saved_rows ) ) {
			return false;
		}

		$delete_keys = array();
		foreach ( $saved_rows as $row ) {
			if ( 'post_title' === $row['widget_name'] && '' !== $current_title && $current_title !== (string) $row['source_string'] ) {
				$delete_keys[] = 'post_title';
			} elseif ( 'post_name' === $row['widget_name'] && '' !== $current_slug && $current_slug !== (string) $row['source_string'] ) {
				$delete_keys[] = 'post_name';
			}
		}

		if ( empty( $delete_keys ) ) {
			return false;
		}

		$delete_keys  = array_unique( $delete_keys );
		$placeholders = implode( ',', array_fill( 0, count( $delete_keys ), '%s' ) );
		$params       = array_merge( array( $post_id ), $delete_keys );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$deleted = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$packages_table} WHERE post_id = %d AND widget_name IN ($placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$params
			)
		);

		if ( $deleted ) {
			Hashing_Db::cleanup_unused_strings();
		}

		return ! empty( $deleted );
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

		if ( class_exists( 'TranslateSense\\Includes\\Database\\Hashing_Db' ) ) {
			Hashing_Db::delete_post_packages( $post_id );
		}
	}
}
