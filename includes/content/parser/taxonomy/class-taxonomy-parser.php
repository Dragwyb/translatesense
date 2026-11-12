<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Taxonomy;

use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Parser;
use TranslateSense\Includes\Content\Parser\Dom_Filter;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\XML\Custom_Field_Rule_Resolver;
use TranslateSense\Includes\XML\Xml_Engine;
use WP_Post;
use WP_Term;
use WP_User;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Discovers translatable taxonomies, resolves post term trees, and extracts
 * runtime taxonomy strings (term names, descriptions, and configured meta).
 */
class Taxonomy_Parser {

	const MAX_PARENT_DEPTH = 25;

	/**
	 * Return the active Polylang term model when available.
	 *
	 * @return object|null
	 */
	public static function get_term_model() {
		if ( ! function_exists( 'PLL' ) ) {
			return null;
		}

		$polylang = PLL();
		if ( ! is_object( $polylang ) || empty( $polylang->model->term ) || ! is_object( $polylang->model->term ) ) {
			return null;
		}

		return $polylang->model->term;
	}

	/**
	 * Get a taxonomy term's Polylang language slug, or empty string when unassigned.
	 *
	 * @param int $term_id Term ID.
	 * @return string
	 */
	public static function get_term_language( int $term_id ): string {
		$model = self::get_term_model();
		if ( ! $model || $term_id <= 0 ) {
			return '';
		}

		$language = $model->get_language( $term_id );
		return ( is_object( $language ) && ! empty( $language->slug ) ) ? sanitize_key( (string) $language->slug ) : '';
	}

	/**
	 * Check whether a taxonomy is enabled for translation in Polylang.
	 *
	 * @param string $taxonomy Taxonomy name.
	 * @return bool
	 */
	public static function is_translatable_taxonomy( string $taxonomy ): bool {
		$taxonomy = sanitize_key( $taxonomy );
		if ( '' === $taxonomy || ! taxonomy_exists( $taxonomy ) ) {
			return false;
		}

		return Polylang_Bridge::is_polylang_active()
			&& function_exists( 'pll_is_translated_taxonomy' )
			&& (bool) pll_is_translated_taxonomy( $taxonomy );
	}

	/**
	 * Resolve and validate the target-language term ID for a source term.
	 *
	 * Uses only Polylang's ID-based translation mapping (never names/slugs) and
	 * verifies taxonomy membership and target language integrity.
	 *
	 * @param int    $term_id     Source term ID.
	 * @param string $target_lang Target language slug.
	 * @return int Target term ID or 0 when untranslated or invalid.
	 */
	public static function get_translation_id( int $term_id, string $target_lang ): int {
		$target_lang = sanitize_key( $target_lang );
		$model       = self::get_term_model();
		if ( ! $model || $term_id <= 0 || '' === $target_lang ) {
			return 0;
		}

		$translated_id = absint( $model->get_translation( $term_id, $target_lang ) );
		if ( $translated_id <= 0 ) {
			return 0;
		}

		$source_term = get_term( $term_id );
		$target_term = get_term( $translated_id );
		if ( ! $source_term instanceof WP_Term || ! $target_term instanceof WP_Term || $target_term->taxonomy !== $source_term->taxonomy ) {
			return 0;
		}

		if ( self::get_term_language( $translated_id ) !== $target_lang ) {
			return 0;
		}

		return $translated_id;
	}

	/**
	 * Get explicitly configured, basic translatable term-meta keys.
	 *
	 * ACF taxonomy field discovery and advanced SEO/meta mapping remain Pro
	 * features. Free supports scalar term meta configured via WPML XML rules
	 * or the `translatesense_taxonomy_translatable_term_meta_keys` filter.
	 *
	 * @param WP_Term $term Source term.
	 * @return string[]
	 */
	public static function get_translatable_meta_keys( WP_Term $term ): array {
		$keys  = array();
		$rules = Xml_Engine::get_user_custom_field_rules( 'all' );

		if ( ! empty( $rules ) ) {
			foreach ( array_keys( (array) get_term_meta( (int) $term->term_id ) ) as $meta_key ) {
				if ( ! is_string( $meta_key ) || '' === $meta_key ) {
					continue;
				}
				if ( '_' === $meta_key[0] && ! isset( $rules[ $meta_key ] ) ) {
					continue;
				}
				$resolved = Custom_Field_Rule_Resolver::resolve_field_rule( $meta_key, $rules );
				if ( Custom_Field_Rule_Resolver::ACTION_TRANSLATE === ( $resolved['action'] ?? '' ) ) {
					$keys[] = $meta_key;
				}
			}
		}

		/**
		 * Filters explicitly translatable basic term-meta keys in Free.
		 *
		 * @param string[] $keys     Configured metadata keys.
		 * @param WP_Term  $term     Source term.
		 * @param string   $taxonomy Taxonomy name.
		 */
		$keys = apply_filters( 'translatesense_taxonomy_translatable_term_meta_keys', $keys, $term, $term->taxonomy );

		return array_values(
			array_unique(
				array_filter(
					(array) $keys,
					static function ( $key ) {
						return is_string( $key ) && '' !== trim( $key ) && false === strpos( $key, "\0" );
					}
				)
			)
		);
	}

	/**
	 * Return all registered taxonomies supported by Polylang for translation.
	 *
	 * @return string[]
	 */
	public static function get_supported_taxonomies(): array {
		return array_values(
			array_filter(
				(array) get_taxonomies( array(), 'names' ),
				array( __CLASS__, 'is_translatable_taxonomy' )
			)
		);
	}

	/**
	 * Order taxonomy terms or term IDs parent-first within `$terms`, guarded against cycles.
	 *
	 * @param array<int|WP_Term> $terms    Term objects or term IDs.
	 * @param string             $taxonomy Taxonomy slug.
	 * @return array<int, WP_Term> Terms keyed by term ID in parent-first order.
	 */
	public static function order_terms_parent_first( array $terms, string $taxonomy ): array {
		$taxonomy = sanitize_key( $taxonomy );
		if ( '' === $taxonomy || empty( $terms ) ) {
			return array();
		}

		$terms_by_id = array();
		foreach ( $terms as $term_or_id ) {
			$term = $term_or_id instanceof WP_Term
				? $term_or_id
				: get_term( absint( $term_or_id ), $taxonomy );
			if ( $term instanceof WP_Term && $term->taxonomy === $taxonomy ) {
				$terms_by_id[ (int) $term->term_id ] = $term;
			}
		}

		if ( empty( $terms_by_id ) ) {
			return array();
		}

		$ordered      = array();
		$seen         = array();
		$append_entry = static function ( WP_Term $term, int $depth = 0 ) use ( &$append_entry, &$terms_by_id, &$ordered, &$seen ): void {
			$term_id = (int) $term->term_id;
			if ( $depth > self::MAX_PARENT_DEPTH || isset( $seen[ $term_id ] ) ) {
				return;
			}
			$seen[ $term_id ] = true;

			$parent_id = (int) $term->parent;
			if ( $parent_id > 0 && $parent_id !== $term_id && isset( $terms_by_id[ $parent_id ] ) ) {
				$append_entry( $terms_by_id[ $parent_id ], $depth + 1 );
			}

			$ordered[ $term_id ] = $term;
		};

		foreach ( $terms_by_id as $term ) {
			$append_entry( $term );
		}

		return $ordered;
	}

	/**
	 * Filter and deduplicate selected term IDs so linked Polylang translations
	 * in the same batch are represented only once (preferring the default language term).
	 *
	 * @param array  $term_ids Candidate term IDs.
	 * @param string $taxonomy Taxonomy slug.
	 * @return int[]
	 */
	public static function filter_linked_terms( array $term_ids, string $taxonomy ): array {
		$taxonomy = sanitize_key( $taxonomy );
		if ( '' === $taxonomy || ! self::is_translatable_taxonomy( $taxonomy ) ) {
			return array();
		}

		$clean_ids = array();
		foreach ( $term_ids as $raw_id ) {
			$term_id = absint( $raw_id );
			if ( $term_id <= 0 || isset( $clean_ids[ $term_id ] ) ) {
				continue;
			}
			$term = get_term( $term_id, $taxonomy );
			if ( $term instanceof WP_Term && $term->taxonomy === $taxonomy ) {
				$clean_ids[ $term_id ] = $term_id;
			}
		}

		$clean_ids = array_values( $clean_ids );
		if ( empty( $clean_ids ) ) {
			return array();
		}

		$model = self::get_term_model();
		if ( ! $model ) {
			return $clean_ids;
		}

		$default_lang     = sanitize_key( (string) Polylang_Bridge::get_default_language() );
		$selected_lookup  = array_fill_keys( $clean_ids, true );
		$processed_groups = array();
		$filtered         = array();

		foreach ( $clean_ids as $term_id ) {
			$translations = (array) $model->get_translations( $term_id );
			$group_ids    = array_values( array_unique( array_filter( array_map( 'absint', $translations ) ) ) );

			if ( empty( $group_ids ) ) {
				$filtered[ $term_id ] = $term_id;
				continue;
			}

			sort( $group_ids );
			$group_key = implode( '_', $group_ids );
			if ( isset( $processed_groups[ $group_key ] ) ) {
				continue;
			}
			$processed_groups[ $group_key ] = true;

			$default_term_id = ( '' !== $default_lang && isset( $translations[ $default_lang ] ) )
				? absint( $translations[ $default_lang ] )
				: 0;

			$chosen_id = 0;
			if ( $default_term_id > 0 && isset( $selected_lookup[ $default_term_id ] ) ) {
				$chosen_id = $default_term_id;
			} else {
				foreach ( $clean_ids as $candidate_id ) {
					if ( in_array( $candidate_id, $group_ids, true ) ) {
						$chosen_id = $candidate_id;
						break;
					}
				}
			}

			if ( $chosen_id > 0 ) {
				$filtered[ $chosen_id ] = $chosen_id;
			}
		}

		return array_values( $filtered );
	}

	/**
	 * Collect directly assigned translatable terms for a post, ordered parent-first
	 * when both a parent and child term are assigned to the same post.
	 *
	 * Never pulls unassigned parent terms into extraction or automatic translation.
	 *
	 * @param int $post_id Post ID.
	 * @return array<string, array<int, WP_Term>>
	 */
	public static function get_post_term_tree( int $post_id ): array {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return array();
		}

		$tree = array();

		$taxonomies = get_object_taxonomies( $post->post_type, 'objects' );
		foreach ( (array) $taxonomies as $taxonomy_object ) {
			if ( ! is_object( $taxonomy_object ) || empty( $taxonomy_object->name ) ) {
				continue;
			}

			$taxonomy = sanitize_key( $taxonomy_object->name );
			if ( ! self::is_translatable_taxonomy( $taxonomy ) ) {
				continue;
			}

			$terms = wp_get_object_terms(
				$post_id,
				$taxonomy,
				array( 'fields' => 'all' )
			);

			if ( is_wp_error( $terms ) || empty( $terms ) ) {
				continue;
			}

			$ordered = self::order_terms_parent_first( (array) $terms, $taxonomy );
			if ( ! empty( $ordered ) ) {
				$tree[ $taxonomy ] = $ordered;
			}
		}

		return $tree;
	}

	/**
	 * Evaluate a WordPress capability against a WP_User, explicit user ID, or current user.
	 *
	 * @param WP_User|int|null $user       WP_User, explicit user ID, or null for current user.
	 * @param string           $capability Capability name.
	 * @param mixed            ...$args    Optional object ID or context arguments.
	 * @return bool
	 */
	public static function user_has_cap( $user, string $capability, ...$args ): bool {
		if ( '' === $capability ) {
			return false;
		}

		return null === $user
			? current_user_can( $capability, ...$args )
			: user_can( $user, $capability, ...$args );
	}

	/**
	 * Normalize and format a taxonomy field or meta value using shared parser filters.
	 *
	 * @param WP_Term $term       Source term.
	 * @param string  $widget     Hashing widget namespace.
	 * @param string  $key        UI/package key identifier.
	 * @param mixed   $raw_value  Raw field/meta value.
	 * @param string  $term_field Field type (`name`, `description`, `meta`).
	 * @param string  $meta_key   Optional term meta key.
	 * @return array<string, mixed>|null
	 */
	private static function format_string_item(
		WP_Term $term,
		string $widget,
		string $key,
		$raw_value,
		string $term_field,
		string $meta_key = ''
	): ?array {
		if ( ! is_string( $raw_value ) || '' === trim( $raw_value ) ) {
			return null;
		}

		$filtered = Dom_Filter::filter_dom_content( $raw_value );
		if ( false === $filtered ) {
			return null;
		}

		$value = (string) $filtered;
		if (
			'' === trim( $value )
			|| Translate::is_email_or_url( $value )
			|| ( 'meta' === $term_field && Custom_Field_Parser::is_only_numbers( $value ) )
		) {
			return null;
		}

		$item = array(
			'hash'       => Hashing_Db::generate_hash( $widget, $value ),
			'name'       => $widget,
			'key'        => $key,
			'source'     => $raw_value,
			'value'      => $value,
			'type'       => 'taxonomy',
			'taxonomy'   => $term->taxonomy,
			'term_id'    => (int) $term->term_id,
			'term_field' => $term_field,
		);

		if ( '' !== $meta_key ) {
			$item['meta_key'] = sanitize_key( $meta_key ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		}

		return $item;
	}

	/**
	 * Extract translatable strings for a single taxonomy term.
	 *
	 * Shared by both post-level taxonomy extraction and standalone taxonomy bulk translation.
	 *
	 * @param WP_Term  $term                Source term.
	 * @param object   $taxonomy_object     Registered taxonomy object.
	 * @param string   $target_lang         Target language slug.
	 * @param object   $model               Polylang term model.
	 * @param int|null $user_id             Optional acting user ID.
	 * @param bool     $enforce_permissions Whether capability checks apply.
	 * @return array<int, array<string, mixed>>
	 */
	private static function collect_term_strings(
		WP_Term $term,
		object $taxonomy_object,
		string $target_lang,
		object $model,
		?int $user_id,
		bool $enforce_permissions
	): array {
		if ( self::get_term_language( (int) $term->term_id ) === $target_lang ) {
			return array();
		}

		$can_manage_terms = ! $enforce_permissions || self::user_has_cap( $user_id, (string) $taxonomy_object->cap->manage_terms );
		$target_term_id   = self::get_translation_id( (int) $term->term_id, $target_lang );
		$strings          = array();

		if ( $target_term_id <= 0 ) {
			if ( ! $can_manage_terms ) {
				return array();
			}

			foreach ( array(
				'name'        => (string) $term->name,
				'description' => (string) $term->description,
			) as $field => $raw_val ) {
				$item = self::format_string_item( $term, 'taxonomy_term', 'term_' . (int) $term->term_id . '_' . $field, $raw_val, $field );
				if ( null !== $item ) {
					$strings[] = $item;
				}
			}
		} elseif ( $enforce_permissions && ! self::user_has_cap( $user_id, 'edit_term', $target_term_id ) ) {
			return array();
		}

		foreach ( self::get_translatable_meta_keys( $term ) as $meta_key ) {
			if ( $target_term_id > 0 && metadata_exists( 'term', $target_term_id, $meta_key ) ) {
				continue;
			}

			foreach ( (array) get_term_meta( (int) $term->term_id, $meta_key, false ) as $raw_val ) {
				$item = self::format_string_item(
					$term,
					'taxonomy_term_meta',
					'term_' . (int) $term->term_id . '_meta_' . substr( md5( $meta_key ), 0, 12 ),
					$raw_val,
					'meta',
					$meta_key
				);
				if ( null !== $item ) {
					$strings[] = $item;
				}
			}
		}

		return $strings;
	}

	/**
	 * Extract runtime taxonomy strings for explicit taxonomy terms (Workflow A: Bulk Taxonomy Translation).
	 *
	 * @param int[]    $term_ids            Term IDs to extract strings for.
	 * @param string   $taxonomy            Taxonomy slug.
	 * @param string   $target_lang         Target language slug.
	 * @param int|null $user_id             Optional user ID to authorize against (null uses current user).
	 * @param bool     $enforce_permissions Whether to enforce capability checks.
	 * @return array<int, array<string, mixed>>
	 */
	public static function extract_terms_strings(
		array $term_ids,
		string $taxonomy,
		string $target_lang,
		?int $user_id = null,
		bool $enforce_permissions = true
	): array {
		$taxonomy    = sanitize_key( $taxonomy );
		$target_lang = sanitize_key( $target_lang );
		$model       = self::get_term_model();
		if ( '' === $taxonomy || '' === $target_lang || ! $model || ! self::is_translatable_taxonomy( $taxonomy ) ) {
			return array();
		}

		$languages = Polylang_Bridge::get_languages();
		if ( ! empty( $languages ) && ! isset( $languages[ $target_lang ] ) ) {
			return array();
		}

		$taxonomy_object = get_taxonomy( $taxonomy );
		if ( ! $taxonomy_object ) {
			return array();
		}

		$ordered_terms = self::order_terms_parent_first( $term_ids, $taxonomy );
		$strings       = array();

		foreach ( $ordered_terms as $term ) {
			if ( $enforce_permissions && ! self::user_has_cap( $user_id, 'edit_term', (int) $term->term_id ) ) {
				continue;
			}
			$strings = array_merge(
				$strings,
				self::collect_term_strings( $term, $taxonomy_object, $target_lang, $model, $user_id, $enforce_permissions )
			);
		}

		return $strings;
	}

	/**
	 * Extract runtime taxonomy strings into the existing browser/editor string format.
	 *
	 * Taxonomy strings are extracted dynamically and are deliberately not recorded
	 * as post package rows. Permission checks filter out any taxonomy operations
	 * the acting user is not authorized to perform without blocking non-taxonomy
	 * post string extraction.
	 *
	 * @param int      $post_id             Post ID.
	 * @param string   $target_lang         Target language slug.
	 * @param int|null $user_id             Optional user ID to authorize against (null uses current user).
	 * @param bool     $enforce_permissions Whether to enforce capability checks.
	 * @return array<int, array<string, mixed>>
	 */
	public static function extract_strings(
		int $post_id,
		string $target_lang,
		?int $user_id = null,
		bool $enforce_permissions = true
	): array {
		$target_lang = sanitize_key( $target_lang );
		$model       = self::get_term_model();
		if ( $post_id <= 0 || '' === $target_lang || ! $model ) {
			return array();
		}

		$languages = Polylang_Bridge::get_languages();
		if ( ! empty( $languages ) && ! isset( $languages[ $target_lang ] ) ) {
			return array();
		}

		if ( $enforce_permissions && ! self::user_has_cap( $user_id, 'edit_post', $post_id ) ) {
			return array();
		}

		$strings = array();
		foreach ( self::get_post_term_tree( $post_id ) as $taxonomy => $terms ) {
			$taxonomy_object = get_taxonomy( $taxonomy );
			if ( ! $taxonomy_object ) {
				continue;
			}

			if ( $enforce_permissions && ! self::user_has_cap( $user_id, (string) $taxonomy_object->cap->assign_terms ) ) {
				continue;
			}

			foreach ( $terms as $term ) {
				$strings = array_merge(
					$strings,
					self::collect_term_strings( $term, $taxonomy_object, $target_lang, $model, $user_id, $enforce_permissions )
				);
			}
		}

		return $strings;
	}
}
