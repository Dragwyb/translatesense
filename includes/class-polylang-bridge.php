<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Polylang_Bridge {

	/**
	 * Check if Polylang is installed and active.
	 */
	public static function is_polylang_active() {
		return function_exists( 'pll_languages_list' ) || defined( 'POLYLANG_VERSION' ) || class_exists( 'Polylang' );
	}

	/**
	 * Check if a post type is translated / supported by Polylang.
	 *
	 * @param string $post_type
	 * @return bool
	 */
	public static function is_translated_post_type( $post_type ) {
		if ( empty( $post_type ) ) {
			return false;
		}

		if ( self::is_polylang_active() && function_exists( 'pll_is_translated_post_type' ) ) {
			return (bool) pll_is_translated_post_type( $post_type );
		}

		// Fallback for public post types when Polylang isn't fully initialized
		$public_types = get_post_types( array( 'public' => true ), 'names' );
		return in_array( $post_type, $public_types, true );
	}

	/**
	 * Get all post types supported/translated by Polylang.
	 *
	 * @return array
	 */
	public static function get_translated_post_types() {
		$public_types = get_post_types( array( 'public' => true ), 'names' );
		$translated   = array();

		foreach ( $public_types as $post_type ) {
			if ( self::is_translated_post_type( $post_type ) ) {
				$translated[] = $post_type;
			}
		}

		return ! empty( $translated ) ? $translated : array( 'post', 'page' );
	}

	/**
	 * Get configured Polylang languages list.
	 * Returns array of languages: [ [ 'slug' => 'en', 'name' => 'English', 'locale' => 'en_US', 'is_default' => true ], ... ]
	 */
	public static function get_languages() {
		if ( ! self::is_polylang_active() ) {
			return array();
		}

		$languages    = pll_languages_list( array( 'fields' => array() ) );
		$default_lang = function_exists( 'pll_default_language' ) ? pll_default_language() : '';

		$result = array();
		if ( ! empty( $languages ) ) {
			foreach ( $languages as $lang ) {
				$flag_url = $lang->flag_url ?? ( $lang->flag ?? '' );
				$result[] = array(
					'slug'       => $lang->slug,
					'name'       => $lang->name,
					'locale'     => $lang->locale,
					'flag'       => is_string( $flag_url ) ? $flag_url : '',
					'is_default' => ( $lang->slug === $default_lang ),
				);
			}
		}

		return $result;
	}

	/**
	 * Get default site language slug.
	 */
	public static function get_default_language() {
		if ( self::is_polylang_active() && function_exists( 'pll_default_language' ) ) {
			return pll_default_language();
		}
		return substr( get_locale(), 0, 2 );
	}

	/**
	 * Get language of a post.
	 */
	public static function get_post_language( $post_id ) {
		if ( self::is_polylang_active() && function_exists( 'pll_get_post_language' ) ) {
			return pll_get_post_language( $post_id );
		}
		return self::get_default_language();
	}

	/**
	 * Set language of a post.
	 */
	public static function set_post_language( $post_id, $lang_slug ) {
		if ( self::is_polylang_active() && function_exists( 'pll_set_post_language' ) ) {
			return pll_set_post_language( $post_id, $lang_slug );
		}
		return true;
	}

	/**
	 * Get post translations map (slug => post_id).
	 */
	public static function get_post_translations( $post_id ) {
		if ( self::is_polylang_active() && function_exists( 'pll_get_post_translations' ) ) {
			return pll_get_post_translations( $post_id );
		}
		return array();
	}

	/**
	 * Save translation links between posts.
	 */
	public static function save_post_translations( $translations_array ) {
		if ( self::is_polylang_active() && function_exists( 'pll_save_post_translations' ) ) {
			return pll_save_post_translations( $translations_array );
		}
		return true;
	}

	/**
	 * Find the target-language translation for a source post.
	 *
	 * Polylang's translation map is authoritative. The TranslateSense source
	 * marker is a recovery fallback for interrupted imports/older plugin builds.
	 *
	 * @param int    $source_post_id Source post ID.
	 * @param string $target_lang    Target language slug.
	 * @return int Target post ID, or 0 when none exists.
	 */
	public static function get_existing_translation_post_id( int $source_post_id, string $target_lang ): int {
		$source_post_id = absint( $source_post_id );
		$target_lang    = sanitize_key( $target_lang );

		if ( $source_post_id <= 0 || '' === $target_lang ) {
			return 0;
		}

		$source_language = self::get_post_language( $source_post_id );
		if ( $source_language && $source_language === $target_lang ) {
			return $source_post_id;
		}

		$translations = (array) self::get_post_translations( $source_post_id );
		$target_id    = isset( $translations[ $target_lang ] ) ? absint( $translations[ $target_lang ] ) : 0;

		if ( $target_id > 0 && $target_id !== $source_post_id ) {
			$target_post = get_post( $target_id );
			if ( $target_post && 'trash' !== $target_post->post_status ) {
				return $target_id;
			}
		}

		// Recover a target created by TranslateSense if a previous request
		// stopped after insertion but before saving the Polylang group.
		global $wpdb;

		// Query the source marker directly so private/draft target posts are
		// still discovered even when WP_Query visibility rules hide them.
		// The REST permission callback checks edit_post on the resolved ID
		// before any update is allowed.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$candidate_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT p.ID
				FROM {$wpdb->posts} AS p
				INNER JOIN {$wpdb->postmeta} AS pm ON p.ID = pm.post_id
				WHERE p.post_type = %s
					AND pm.meta_key = %s
					AND pm.meta_value = %d
					AND p.post_status NOT IN ('trash', 'auto-draft')
				ORDER BY p.ID DESC
				LIMIT 20",
				get_post_type( $source_post_id ),
				'_translatesense_source_id',
				$source_post_id
			)
		);

		foreach ( (array) $candidate_ids as $candidate_id ) {
			$candidate_id = absint( $candidate_id );
			if ( $candidate_id > 0 && $candidate_id !== $source_post_id && self::get_post_language( $candidate_id ) === $target_lang ) {
				return $candidate_id;
			}
		}

		return 0;
	}

	/**
	 * Create or update a translated version of a post.
	 */
	public static function create_or_update_translated_post( $source_post_id, $target_lang, $translated_title, $translated_content, $args = array() ) {
		$source_post_id = absint( $source_post_id );
		$target_lang    = sanitize_key( (string) $target_lang );
		$args           = is_array( $args ) ? $args : array();

		if ( $source_post_id <= 0 || '' === $target_lang ) {
			return new WP_Error( 'invalid_translation_request', __( 'A valid source post and target language are required.', 'translatesense' ) );
		}

		$source_post = get_post( $source_post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Source post not found.', 'translatesense' ) );
		}

		// Refuse unsupported target languages before creating or modifying posts.
		if ( function_exists( 'pll_languages_list' ) ) {
			$language_slugs = pll_languages_list( array( 'fields' => 'slug' ) );
			if ( is_array( $language_slugs ) && ! in_array( $target_lang, $language_slugs, true ) ) {
				return new WP_Error( 'invalid_target_language', __( 'The requested target language is not configured in Polylang.', 'translatesense' ) );
			}
		}

		$target_post_id = self::get_existing_translation_post_id( $source_post_id, $target_lang );
		if ( $target_post_id === $source_post_id ) {
			return new WP_Error( 'source_is_target_language', __( 'The source post already belongs to the requested target language.', 'translatesense' ) );
		}

		$is_existing = $target_post_id > 0;
		$target_post = $is_existing ? get_post( $target_post_id ) : null;

		if ( $is_existing && ( ! $target_post instanceof \WP_Post || $target_post->post_type !== $source_post->post_type ) ) {
			return new WP_Error( 'invalid_translation_target', __( 'The existing translated post is not a valid target for this source post.', 'translatesense' ) );
		}

		if ( $is_existing ) {
			$existing_language = self::get_post_language( $target_post_id );
			if ( $existing_language && $existing_language !== $target_lang ) {
				return new WP_Error( 'translation_language_mismatch', __( 'The existing translated post belongs to a different language.', 'translatesense' ) );
			}
		}

		// A translated parent must be used for hierarchical post types.
		$target_parent_id = 0;
		if ( ! empty( $source_post->post_parent ) ) {
			$target_parent_id = self::get_existing_translation_post_id( (int) $source_post->post_parent, $target_lang );
			if ( $target_parent_id === (int) $source_post->post_parent ) {
				$target_parent_id = 0;
			}
		}

		$allowed_statuses = array( 'publish', 'draft', 'pending', 'private', 'future' );

		// Existing translations retain their editorial status. Bulk status
		// preferences apply only to newly inserted target posts.
		if ( $is_existing ) {
			$post_status = $target_post->post_status;
		} else {
			$requested_status = isset( $args['post_status'] ) ? sanitize_key( (string) $args['post_status'] ) : '';
			$post_status      = in_array( $requested_status, $allowed_statuses, true )
				? $requested_status
				: ( in_array( $source_post->post_status, $allowed_statuses, true ) ? $source_post->post_status : 'draft' );
		}

		$translated_excerpt = isset( $args['post_excerpt'] ) && is_string( $args['post_excerpt'] )
			? $args['post_excerpt']
			: $source_post->post_excerpt;

		if ( $is_existing ) {
			// Re-translation updates only translated editorial fields. Preserve
			// target-specific slug, status, parent, author, dates and settings.
			$post_data = array(
				'ID'           => $target_post_id,
				'post_title'   => is_string( $translated_title ) && '' !== $translated_title ? $translated_title : $target_post->post_title,
				'post_content' => $translated_content,
				'post_excerpt' => $translated_excerpt,
			);
		} else {
			$post_data = array(
				'post_title'     => is_string( $translated_title ) && '' !== $translated_title ? $translated_title : $source_post->post_title,
				'post_content'   => $translated_content,
				'post_status'    => $post_status,
				'post_type'      => $source_post->post_type,
				'post_author'    => $source_post->post_author,
				'post_excerpt'   => $translated_excerpt,
				'post_parent'    => $target_parent_id,
				'post_date'      => $source_post->post_date,
				'post_date_gmt'  => $source_post->post_date_gmt,
				'comment_status' => $source_post->comment_status,
				'ping_status'    => $source_post->ping_status,
				'menu_order'     => (int) $source_post->menu_order,
				'post_password'  => $source_post->post_password,
			);
		}

		// Slugs are creation-time data. Never include post_name in an update
		// for an existing translation, even if a caller accidentally passes it.
		if ( ! $is_existing ) {
			$requested_slug = isset( $args['post_name'] ) ? sanitize_title( (string) $args['post_name'] ) : '';
			if ( '' === $requested_slug ) {
				$requested_slug = sanitize_title( $source_post->post_name . '-' . $target_lang );
			}

			$post_data['post_name'] = wp_unique_post_slug(
				$requested_slug,
				0,
				$post_status,
				$source_post->post_type,
				$target_parent_id
			);

			// New target post: honor Polylang's post-field synchronization filter.
			$sync_fields = array_keys( $post_data );
			$sync_fields = array_combine( $sync_fields, $sync_fields );

			/**
			 * Filters the post fields copied from the source when creating a translation.
		 *
			 * @param array  $fields      Associative list of allowed post fields.
			 * @param int    $post_id     Source post ID.
			 * @param string $target_lang        Target language slug.
			 * @param bool   $save_group  Whether the translation group is saved.
			 */
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Polylang integration filter.
			$sync_fields = apply_filters( 'pll_sync_post_fields', $sync_fields, $source_post_id, $target_lang, true );
			$sync_fields = is_array( $sync_fields ) ? $sync_fields : array();

			$always_keep = array_intersect_key(
				$post_data,
				array_flip( array( 'post_title', 'post_content', 'post_excerpt', 'post_name', 'post_type', 'post_status' ) )
			);
			$post_data   = array_merge( array_intersect_key( $post_data, $sync_fields ), $always_keep );

			// WordPress always needs the post type and selected creation status.
			$post_data['post_type']   = $source_post->post_type;
			$post_data['post_status'] = $post_status;
		}

		/**
		 * Fires immediately before TranslateSense inserts or updates a target post.
		 *
		 * @param int    $source_post_id Source post ID.
		 * @param int    $target_post_id Existing target ID, or 0 for a new post.
		 * @param string $target_lang    Target language slug.
		 * @param bool   $is_existing    Whether this is a re-translation.
		 * @param array  $post_data      Prepared wp_insert_post/wp_update_post data.
		 */
		do_action( 'translatesense_before_save_translation', $source_post_id, $target_post_id, $target_lang, $is_existing, $post_data );

		if ( $is_existing ) {
			$saved_id = wp_update_post( wp_slash( $post_data ), true );
			if ( is_wp_error( $saved_id ) ) {
				return $saved_id;
			}
			if ( absint( $saved_id ) !== $target_post_id ) {
				return new WP_Error( 'translated_post_update_failed', __( 'The existing translated post could not be updated.', 'translatesense' ) );
			}
		} else {
			$saved_id = wp_insert_post( wp_slash( $post_data ), true );
			if ( is_wp_error( $saved_id ) ) {
				return $saved_id;
			}
			$target_post_id = absint( $saved_id );
		}

		if ( $target_post_id <= 0 ) {
			return new WP_Error( 'translated_post_save_failed', __( 'The translated post could not be saved.', 'translatesense' ) );
		}

		// Language must be assigned before translation group and sync operations.
		self::set_post_language( $target_post_id, $target_lang );
		update_post_meta( $target_post_id, '_translatesense_translated', '1' );
		update_post_meta( $target_post_id, '_translatesense_source_id', $source_post_id );

		$translations                 = (array) self::get_post_translations( $source_post_id );
		$translations[ $target_lang ] = $target_post_id;
		$source_lang                  = self::get_post_language( $source_post_id );
		if ( $source_lang ) {
			$translations[ $source_lang ] = $source_post_id;
		}
		self::save_post_translations( $translations );

		// Generic taxonomy/meta duplication runs only on first creation.
		// Existing translations are content re-translations, not source copies.
		$sync_result = Polylang_Synchronizer::synchronize(
			$source_post_id,
			$target_post_id,
			$target_lang,
			! $is_existing
		);

		Polylang_Synchronizer::attach_translated_media_to_post( $target_post_id );

		update_post_meta(
			$target_post_id,
			'_translatesense_sync_status',
			! empty( $sync_result['skipped'] ) ? 'not_required' : ( ! empty( $sync_result['success'] ) ? 'complete' : 'partial' )
		);

		if ( ! empty( $sync_result['warnings'] ) ) {
			update_post_meta( $target_post_id, '_translatesense_sync_warnings', array_map( 'sanitize_text_field', (array) $sync_result['warnings'] ) );
		} else {
			delete_post_meta( $target_post_id, '_translatesense_sync_warnings' );
		}

		if ( 'post' === $source_post->post_type && function_exists( 'is_sticky' ) && function_exists( 'stick_post' ) && function_exists( 'unstick_post' ) ) {
			if ( is_sticky( $source_post_id ) ) {
				stick_post( $target_post_id );
			} else {
				unstick_post( $target_post_id );
			}
		}

		/**
		 * Fires after TranslateSense saves and links a target translation.
		 *
		 * @param int    $source_post_id Source post ID.
		 * @param int    $target_post_id Saved target post ID.
		 * @param string $target_lang    Target language slug.
		 * @param bool   $is_existing    Whether an existing translation was updated.
		 * @param array  $sync_result    Synchronization result and warnings.
		 */
		do_action( 'translatesense_after_save_translation', $source_post_id, $target_post_id, $target_lang, $is_existing, $sync_result );

		return $target_post_id;
	}
}
