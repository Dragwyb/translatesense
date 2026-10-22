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
	 * Create or update a translated version of a post.
	 */
	public static function create_or_update_translated_post( $source_post_id, $target_lang, $translated_title, $translated_content ) {
		$source_post = get_post( $source_post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Source post not found.', 'translatesense' ) );
		}

		$translations   = self::get_post_translations( $source_post_id );
		$target_post_id = $translations[ $target_lang ] ?? 0;

		$post_data = array(
			'post_title'   => $translated_title ? $translated_title : $source_post->post_title,
			'post_content' => $translated_content,
			'post_status'  => $source_post->post_status,
			'post_type'    => $source_post->post_type,
			'post_author'  => $source_post->post_author,
			'post_excerpt' => $source_post->post_excerpt,
		);

		if ( $target_post_id && get_post( $target_post_id ) ) {
			$post_data['ID'] = $target_post_id;
			wp_update_post( $post_data );
		} else {
			$post_data['post_name'] = wp_unique_post_slug(
				$source_post->post_name . '-' . $target_lang,
				0,
				$source_post->post_status,
				$source_post->post_type,
				$source_post->post_parent
			);
			$target_post_id         = wp_insert_post( $post_data );
			if ( is_wp_error( $target_post_id ) ) {
				return $target_post_id;
			}
		}

		// Set target post language
		self::set_post_language( $target_post_id, $target_lang );

		// translated flag on target post
		update_post_meta( $target_post_id, '_translatesense_translated', '1' );

		// Update translation group
		$translations[ $target_lang ] = $target_post_id;
		$source_lang                  = self::get_post_language( $source_post_id );
		if ( $source_lang ) {
			$translations[ $source_lang ] = $source_post_id;
		}
		self::save_post_translations( $translations );

		// Copy thumbnail if present
		$thumbnail_id = get_post_thumbnail_id( $source_post_id );
		if ( $thumbnail_id ) {
			set_post_thumbnail( $target_post_id, $thumbnail_id );
		}

		return $target_post_id;
	}
}
