<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Taxonomy;

use TranslateSense\Includes\Content\Parser\Custom_Fields\Custom_Field_Parser;
use TranslateSense\Includes\Content\Parser\Taxonomy\Taxonomy_Parser;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Translation\Translate;
use WP_Error;
use WP_Post;
use WP_Term;
use WP_User;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Translates, creates/links in Polylang, and assigns taxonomy terms
 * required by translated posts.
 */
class Taxonomy_Translator {

	const BROWSER_PROVIDERS = array( 'chrome_ai', 'chrome_local_ai', 'edge_ai' );

	/**
	 * Validate target language configuration and optional acting user record.
	 *
	 * @param string   $target_lang         Target language slug.
	 * @param int|null $user_id             Optional user ID (`null` uses current user).
	 * @param bool     $enforce_permissions Whether capability checks apply.
	 * @return true|WP_Error
	 */
	private static function validate_language_and_user(
		string $target_lang,
		?int $user_id,
		bool $enforce_permissions
	) {
		$target_lang = sanitize_key( $target_lang );
		$languages   = Polylang_Bridge::get_languages();
		if ( '' === $target_lang || ! isset( $languages[ $target_lang ] ) ) {
			return new WP_Error( 'translatesense_invalid_taxonomy_language', __( 'The selected taxonomy target language is not configured in Polylang.', 'translatesense' ), array( 'status' => 400 ) );
		}

		if ( $enforce_permissions && null !== $user_id ) {
			$user_obj = $user_id > 0 ? get_userdata( $user_id ) : null;
			if ( ! $user_obj instanceof WP_User || ! $user_obj->exists() ) {
				return new WP_Error( 'translatesense_taxonomy_invalid_user', __( 'The user account for taxonomy translation could not be verified.', 'translatesense' ), array( 'status' => 403 ) );
			}
		}

		return true;
	}

	/**
	 * Validate common post, user, and target language context.
	 *
	 * @param int      $post_id             Source post ID.
	 * @param string   $target_lang         Target language slug.
	 * @param int|null $user_id             Optional user ID (`null` uses current user).
	 * @param bool     $enforce_permissions Whether capability checks apply.
	 * @return true|WP_Error
	 */
	private static function validate_context(
		int $post_id,
		string $target_lang,
		?int $user_id,
		bool $enforce_permissions
	) {
		$lang_user_valid = self::validate_language_and_user( $target_lang, $user_id, $enforce_permissions );
		if ( is_wp_error( $lang_user_valid ) ) {
			return $lang_user_valid;
		}

		if ( $enforce_permissions ) {
			if ( $post_id <= 0 || ! get_post( $post_id ) || ! Taxonomy_Parser::user_has_cap( $user_id, 'edit_post', $post_id ) ) {
				return new WP_Error( 'translatesense_taxonomy_source_forbidden', __( 'You are not allowed to translate taxonomy terms for this post.', 'translatesense' ), array( 'status' => 403 ) );
			}
		}

		return true;
	}

	/**
	 * Check whether an existing translated term is missing configured source metadata.
	 *
	 * @param WP_Term $source_term    Source term.
	 * @param int     $target_term_id Target term ID.
	 * @return bool
	 */
	private static function has_missing_translatable_meta( WP_Term $source_term, int $target_term_id ): bool {
		foreach ( Taxonomy_Parser::get_translatable_meta_keys( $source_term ) as $meta_key ) {
			if ( ! metadata_exists( 'term', $target_term_id, $meta_key ) && metadata_exists( 'term', (int) $source_term->term_id, $meta_key ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check capability to create or update a single source term's target translation.
	 *
	 * @param WP_Term  $term            Source term.
	 * @param string   $target_lang     Target language slug.
	 * @param int|null $user_id         Optional user ID (`null` uses current user).
	 * @param object   $taxonomy_object Registered taxonomy object.
	 * @return true|WP_Error
	 */
	private static function validate_term_capability(
		WP_Term $term,
		string $target_lang,
		?int $user_id,
		object $taxonomy_object
	) {
		if ( Taxonomy_Parser::get_term_language( (int) $term->term_id ) === $target_lang ) {
			return true;
		}

		$target_term_id = Taxonomy_Parser::get_translation_id( (int) $term->term_id, $target_lang );
		if ( $target_term_id <= 0 ) {
			if ( ! Taxonomy_Parser::user_has_cap( $user_id, (string) $taxonomy_object->cap->manage_terms ) ) {
				return new WP_Error(
					'translatesense_taxonomy_create_forbidden',
					sprintf(
						/* translators: %s: taxonomy label */
						__( 'You are not allowed to create translated terms for the %s taxonomy.', 'translatesense' ),
						$taxonomy_object->labels->name
					),
					array( 'status' => 403 )
				);
			}
			return true;
		}

		$target_term      = get_term( $target_term_id, $term->taxonomy );
		$target_parent_id = ( $target_term instanceof WP_Term && ! empty( $term->parent ) )
			? self::resolve_existing_parent_id( $term, $target_lang, $target_term_id )
			: 0;
		$needs_edit       = ( $target_parent_id > 0 && $target_term instanceof WP_Term && (int) $target_term->parent !== $target_parent_id )
			|| self::has_missing_translatable_meta( $term, $target_term_id );

		if ( $needs_edit && ! Taxonomy_Parser::user_has_cap( $user_id, 'edit_term', $target_term_id ) ) {
			return new WP_Error(
				'translatesense_taxonomy_edit_forbidden',
				__( 'You are not allowed to update the translated taxonomy term or its configured metadata.', 'translatesense' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * Build the authorized taxonomy term tree for a post, either rejecting or
	 * skipping unauthorized taxonomies/terms according to `$skip_unauthorized`.
	 *
	 * @param int      $post_id             Source post ID.
	 * @param string   $target_lang         Target language slug.
	 * @param int|null $user_id             Optional initiating user ID (`null` uses current user).
	 * @param bool     $enforce_permissions Whether capability checks apply.
	 * @param bool     $skip_unauthorized   Skip unauthorized taxonomies/terms instead of erroring.
	 * @param string[] $taxonomies_filter   Optional list of taxonomy slugs to restrict checks to.
	 * @return array<string, array<int, WP_Term>>|WP_Error
	 */
	private static function build_authorized_tree(
		int $post_id,
		string $target_lang,
		?int $user_id,
		bool $enforce_permissions,
		bool $skip_unauthorized,
		array $taxonomies_filter = array()
	) {
		$target_lang = sanitize_key( $target_lang );
		$context     = self::validate_context( $post_id, $target_lang, $user_id, $enforce_permissions );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		$taxonomies_filter = array_values( array_unique( array_filter( array_map( 'sanitize_key', $taxonomies_filter ) ) ) );
		$authorized_tree   = array();

		foreach ( Taxonomy_Parser::get_post_term_tree( $post_id ) as $taxonomy => $terms ) {
			if ( ! empty( $taxonomies_filter ) && ! in_array( $taxonomy, $taxonomies_filter, true ) ) {
				continue;
			}

			$taxonomy_object = get_taxonomy( $taxonomy );
			if ( ! $taxonomy_object ) {
				continue;
			}

			if ( $enforce_permissions && ! Taxonomy_Parser::user_has_cap( $user_id, (string) $taxonomy_object->cap->assign_terms ) ) {
				if ( $skip_unauthorized ) {
					continue;
				}
				return new WP_Error(
					'translatesense_taxonomy_assign_forbidden',
					sprintf(
						/* translators: %s: taxonomy label */
						__( 'You are not allowed to assign terms for the %s taxonomy.', 'translatesense' ),
						$taxonomy_object->labels->name
					),
					array( 'status' => 403 )
				);
			}

			foreach ( $terms as $term_id => $term ) {
				if ( $enforce_permissions ) {
					$term_perm = self::validate_term_capability( $term, $target_lang, $user_id, $taxonomy_object );
					if ( is_wp_error( $term_perm ) ) {
						if ( $skip_unauthorized ) {
							continue;
						}
						return $term_perm;
					}
				}
				$authorized_tree[ $taxonomy ][ (int) $term_id ] = $term;
			}
		}

		return $authorized_tree;
	}

	/**
	 * Validate permissions required to resolve taxonomy terms for a post.
	 *
	 * @param int      $post_id           Source post ID.
	 * @param string   $target_lang       Target language slug.
	 * @param int|null $user_id           Optional initiating user ID (`null` uses current user).
	 * @param string[] $taxonomies_filter Optional list of taxonomy slugs to restrict checks to.
	 * @return true|WP_Error
	 */
	public static function check_post_permissions(
		int $post_id,
		string $target_lang,
		?int $user_id = null,
		array $taxonomies_filter = array()
	) {
		$authorized = self::build_authorized_tree( $post_id, $target_lang, $user_id, true, false, $taxonomies_filter );
		return is_wp_error( $authorized ) ? $authorized : true;
	}

	/**
	 * Ensure every extracted taxonomy string is available in `$in_memory_translations`
	 * or translation memory, translating any uncached strings in a single batch call.
	 *
	 * @param array<int, array<string, mixed>>   $items                  Extracted taxonomy string items.
	 * @param array<string, array<int, WP_Term>> $authorized_tree        Authorized term map.
	 * @param string                             $source_lang            Source language slug.
	 * @param string                             $target_lang            Target language slug.
	 * @param string                             $provider               Provider ID.
	 * @param array                              $in_memory_translations Map indexed by hash (updated in place).
	 * @return true|WP_Error
	 */
	private static function ensure_items_translated(
		array $items,
		array $authorized_tree,
		string $source_lang,
		string $target_lang,
		string $provider,
		array &$in_memory_translations
	) {
		if ( empty( $items ) ) {
			return true;
		}

		$effective_source_lang = '' !== sanitize_key( $source_lang )
			? sanitize_key( $source_lang )
			: sanitize_key( (string) Polylang_Bridge::get_default_language() );

		if ( '' !== $effective_source_lang && $effective_source_lang === $target_lang ) {
			return true;
		}

		$uncached = array();

		foreach ( $items as $item ) {
			$taxonomy = (string) ( $item['taxonomy'] ?? '' );
			$term_id  = absint( $item['term_id'] ?? 0 );
			if ( ! isset( $authorized_tree[ $taxonomy ][ $term_id ] ) ) {
				continue;
			}

			$hash     = (string) $item['hash'];
			$widget   = (string) $item['name'];
			$value    = (string) $item['value'];
			$raw      = (string) ( $item['source'] ?? $value );
			$raw_hash = Hashing_Db::generate_hash( $widget, $raw );

			if ( ! isset( $in_memory_translations[ $hash ] ) && $raw_hash !== $hash && isset( $in_memory_translations[ $raw_hash ] ) ) {
				$in_memory_translations[ $hash ] = $in_memory_translations[ $raw_hash ];
			}

			if ( isset( $in_memory_translations[ $hash ] ) && is_scalar( $in_memory_translations[ $hash ] ) && '' !== trim( (string) $in_memory_translations[ $hash ] ) ) {
				$sanitized_res = Translate::translate_string(
					$value,
					$effective_source_lang,
					$target_lang,
					$widget,
					array( 'in_memory_translations' => array( $hash => (string) $in_memory_translations[ $hash ] ) )
				);
				Hashing_Db::save_translation_result( $hash, $target_lang, (string) ( $sanitized_res['translated'] ?? '' ) );
				continue;
			}

			$cached_res = Translate::translate_string( $raw, $effective_source_lang, $target_lang, $widget );
			if ( ! empty( $cached_res['cached'] ) ) {
				continue;
			}

			// Reuse generic translation-memory entries stored under string_hash by Translate::translate_batch().
			$shared_tm = Hashing_Db::get_cached_translation( md5( $value ), $target_lang );
			if ( null !== $shared_tm && '' !== trim( $shared_tm ) ) {
				$in_memory_translations[ $hash ] = $shared_tm;
				continue;
			}

			$uncached[ $hash ] = $value;
		}

		if ( empty( $uncached ) ) {
			return true;
		}

		$provider = sanitize_key( $provider );
		if ( in_array( $provider, self::BROWSER_PROVIDERS, true ) ) {
			return new WP_Error(
				'translatesense_taxonomy_browser_translation_missing',
				__( 'The browser AI translation for one or more taxonomy strings is missing. Please retry the translation.', 'translatesense' )
			);
		}

		if ( '' === $provider ) {
			$settings = get_option( 'translatesense_settings', array() );
			$provider = isset( $settings['provider'] ) && '' !== sanitize_key( (string) $settings['provider'] )
				? sanitize_key( (string) $settings['provider'] )
				: 'openai';
		}

		$batch_values = array_values( array_unique( $uncached ) );
		$batch_res    = Translate::translate_batch(
			$batch_values,
			$effective_source_lang,
			$target_lang,
			array( 'provider' => $provider )
		);

		if ( is_wp_error( $batch_res ) ) {
			return $batch_res;
		}

		$value_map = array();
		foreach ( $batch_values as $idx => $source_text ) {
			if ( ! isset( $batch_res[ $idx ]['translated'] ) || ! is_string( $batch_res[ $idx ]['translated'] ) || '' === trim( $batch_res[ $idx ]['translated'] ) ) {
				return new WP_Error(
					'translatesense_taxonomy_translation_failed',
					__( 'The AI provider did not return a valid taxonomy translation.', 'translatesense' )
				);
			}
			$value_map[ $source_text ] = $batch_res[ $idx ]['translated'];
		}

		foreach ( $uncached as $hash => $source_text ) {
			$translated                      = $value_map[ $source_text ];
			$in_memory_translations[ $hash ] = $translated;
			Hashing_Db::save_translation_result( $hash, $target_lang, $translated );
		}

		return true;
	}

	/**
	 * Ensure every required taxonomy string for a post is available in `$in_memory_translations`
	 * or translation memory, translating any uncached strings in a single batch call.
	 *
	 * @param int                                $source_post_id         Source post ID.
	 * @param array<string, array<int, WP_Term>> $authorized_tree        Authorized term map.
	 * @param string                             $source_lang            Source language slug.
	 * @param string                             $target_lang            Target language slug.
	 * @param string                             $provider               Provider ID.
	 * @param array                              $in_memory_translations Map indexed by hash (updated in place).
	 * @param int|null                           $user_id                Optional user ID.
	 * @param bool                               $enforce_permissions    Whether capability checks apply.
	 * @return true|WP_Error
	 */
	private static function ensure_translations_available(
		int $source_post_id,
		array $authorized_tree,
		string $source_lang,
		string $target_lang,
		string $provider,
		array &$in_memory_translations,
		?int $user_id,
		bool $enforce_permissions
	) {
		$items = Taxonomy_Parser::extract_strings( $source_post_id, $target_lang, $user_id, $enforce_permissions );
		return self::ensure_items_translated(
			$items,
			$authorized_tree,
			$source_lang,
			$target_lang,
			$provider,
			$in_memory_translations
		);
	}

	/**
	 * Inspect whether a term already has a completed translation or needs creation/update.
	 *
	 * @param int    $term_id     Source term ID.
	 * @param string $taxonomy    Taxonomy slug.
	 * @param string $target_lang Target language slug.
	 * @return array{ exists: bool, target_term_id: int, needs_update: bool, is_same_lang: bool }
	 */
	public static function term_has_completed_translation( int $term_id, string $taxonomy, string $target_lang ): array {
		$target_lang = sanitize_key( $target_lang );
		$taxonomy    = sanitize_key( $taxonomy );
		$result      = array(
			'exists'         => false,
			'target_term_id' => 0,
			'needs_update'   => false,
			'is_same_lang'   => false,
		);

		$term = get_term( $term_id, $taxonomy );
		if ( ! $term instanceof WP_Term || '' === $target_lang || ! Taxonomy_Parser::is_translatable_taxonomy( $taxonomy ) ) {
			return $result;
		}

		if ( Taxonomy_Parser::get_term_language( (int) $term->term_id ) === $target_lang ) {
			$result['exists']         = true;
			$result['target_term_id'] = (int) $term->term_id;
			$result['is_same_lang']   = true;
			return $result;
		}

		$target_term_id = Taxonomy_Parser::get_translation_id( (int) $term->term_id, $target_lang );
		if ( $target_term_id <= 0 ) {
			return $result;
		}

		$target_term = get_term( $target_term_id, $taxonomy );
		if ( ! $target_term instanceof WP_Term ) {
			return $result;
		}

		$target_parent_id = self::resolve_existing_parent_id( $term, $target_lang, $target_term_id );
		$needs_parent     = $target_parent_id > 0 && (int) $target_term->parent !== $target_parent_id;
		$needs_meta       = self::has_missing_translatable_meta( $term, $target_term_id );

		$result['exists']         = true;
		$result['target_term_id'] = $target_term_id;
		$result['needs_update']   = $needs_parent || $needs_meta;

		return $result;
	}

	/**
	 * Build authorized ordered terms array and validate capabilities for explicit terms.
	 *
	 * @param int[]    $term_ids            Term IDs.
	 * @param string   $taxonomy            Taxonomy slug.
	 * @param string   $target_lang         Target language slug.
	 * @param int|null $user_id             Optional user ID.
	 * @param bool     $enforce_permissions Whether to enforce capability checks.
	 * @param bool     $skip_unauthorized   Skip unauthorized terms rather than failing.
	 * @return array<int, WP_Term>|WP_Error
	 */
	private static function build_authorized_terms_list(
		array $term_ids,
		string $taxonomy,
		string $target_lang,
		?int $user_id,
		bool $enforce_permissions,
		bool $skip_unauthorized
	) {
		$taxonomy    = sanitize_key( $taxonomy );
		$target_lang = sanitize_key( $target_lang );

		$lang_user_valid = self::validate_language_and_user( $target_lang, $user_id, $enforce_permissions );
		if ( is_wp_error( $lang_user_valid ) ) {
			return $lang_user_valid;
		}

		if ( '' === $taxonomy || ! Taxonomy_Parser::is_translatable_taxonomy( $taxonomy ) ) {
			return new WP_Error( 'translatesense_invalid_taxonomy', __( 'The selected taxonomy is not registered or enabled for translation in Polylang.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$taxonomy_object = get_taxonomy( $taxonomy );
		if ( ! $taxonomy_object ) {
			return new WP_Error( 'translatesense_invalid_taxonomy', __( 'The selected taxonomy could not be found.', 'translatesense' ), array( 'status' => 404 ) );
		}

		$ordered_terms    = Taxonomy_Parser::order_terms_parent_first( $term_ids, $taxonomy );
		$authorized_terms = array();

		if ( empty( $ordered_terms ) ) {
			return new WP_Error( 'translatesense_invalid_taxonomy_terms', __( 'No valid taxonomy terms were provided for translation.', 'translatesense' ), array( 'status' => 400 ) );
		}

		foreach ( $ordered_terms as $term_id => $term ) {
			if ( $enforce_permissions ) {
				if ( ! Taxonomy_Parser::user_has_cap( $user_id, 'edit_term', (int) $term_id ) ) {
					if ( $skip_unauthorized ) {
						continue;
					}
					return new WP_Error(
						'translatesense_taxonomy_edit_forbidden',
						__( 'You are not allowed to translate one or more selected taxonomy terms.', 'translatesense' ),
						array( 'status' => 403 )
					);
				}

				$term_perm = self::validate_term_capability( $term, $target_lang, $user_id, $taxonomy_object );
				if ( is_wp_error( $term_perm ) ) {
					if ( $skip_unauthorized ) {
						continue;
					}
					return $term_perm;
				}
			}

			$authorized_terms[ (int) $term_id ] = $term;
		}

		return $authorized_terms;
	}

	/**
	 * Validate permissions required to translate/create/update explicit taxonomy terms.
	 *
	 * @param int[]    $term_ids    Term IDs.
	 * @param string   $taxonomy    Taxonomy slug.
	 * @param string   $target_lang Target language slug.
	 * @param int|null $user_id     Optional acting user ID (`null` uses current user).
	 * @return true|WP_Error
	 */
	public static function check_terms_permissions(
		array $term_ids,
		string $taxonomy,
		string $target_lang,
		?int $user_id = null
	) {
		$authorized = self::build_authorized_terms_list( $term_ids, $taxonomy, $target_lang, $user_id, true, false );
		return is_wp_error( $authorized ) ? $authorized : true;
	}

	/**
	 * Translate, create, update, and link explicit taxonomy terms in parent-first order.
	 *
	 * Entry point for standalone taxonomy bulk translation (Workflow A). Reuses
	 * `Taxonomy_Parser::extract_terms_strings()`, `ensure_items_translated()`, and `resolve_term()`.
	 *
	 * @param int[]  $term_ids               Term IDs to translate.
	 * @param string $taxonomy               Taxonomy slug.
	 * @param string $target_lang            Target language slug.
	 * @param string $provider               AI provider ID.
	 * @param array  $in_memory_translations Optional translation map indexed by hash.
	 * @param array  $options                Optional `{ user_id?: ?int, enforce_permissions?: bool, skip_unauthorized?: bool, source_lang?: string }`.
	 * @return array<int, int>|WP_Error Map of source term ID => target term ID, or error.
	 */
	public static function translate_terms(
		array $term_ids,
		string $taxonomy,
		string $target_lang,
		string $provider = '',
		array $in_memory_translations = array(),
		array $options = array()
	) {
		$taxonomy            = sanitize_key( $taxonomy );
		$target_lang         = sanitize_key( $target_lang );
		$user_id             = ( array_key_exists( 'user_id', $options ) && null !== $options['user_id'] ) ? (int) $options['user_id'] : null;
		$enforce_permissions = array_key_exists( 'enforce_permissions', $options ) ? (bool) $options['enforce_permissions'] : true;
		$skip_unauthorized   = ! empty( $options['skip_unauthorized'] );

		$authorized_terms = self::build_authorized_terms_list(
			$term_ids,
			$taxonomy,
			$target_lang,
			$user_id,
			$enforce_permissions,
			$skip_unauthorized
		);
		if ( is_wp_error( $authorized_terms ) ) {
			return $authorized_terms;
		}

		$source_lang = sanitize_key( (string) ( $options['source_lang'] ?? '' ) );
		if ( '' === $source_lang ) {
			foreach ( $authorized_terms as $term ) {
				$slug = Taxonomy_Parser::get_term_language( (int) $term->term_id );
				if ( '' !== $slug && $slug !== $target_lang ) {
					$source_lang = $slug;
					break;
				}
			}
		}

		$items     = Taxonomy_Parser::extract_terms_strings( array_keys( $authorized_terms ), $taxonomy, $target_lang, $user_id, $enforce_permissions );
		$preloaded = self::ensure_items_translated(
			$items,
			array( $taxonomy => $authorized_terms ),
			$source_lang,
			$target_lang,
			$provider,
			$in_memory_translations
		);
		if ( is_wp_error( $preloaded ) ) {
			return $preloaded;
		}

		$resolved_map = array();
		foreach ( $authorized_terms as $source_term_id => $source_term ) {
			$resolved_id = self::resolve_term(
				$source_term,
				$target_lang,
				$source_lang,
				$provider,
				$in_memory_translations,
				$user_id,
				$enforce_permissions
			);
			if ( is_wp_error( $resolved_id ) ) {
				return $resolved_id;
			}
			$resolved_map[ (int) $source_term_id ] = absint( $resolved_id );
		}

		return $resolved_map;
	}

	/**
	 * Resolve all assigned terms for a post without automatically translating
	 * unassigned parents or children.
	 *
	 * @param int    $source_post_id         Source post ID.
	 * @param string $target_lang            Target language slug.
	 * @param string $source_lang            Source language slug.
	 * @param string $provider               Provider ID.
	 * @param array  $in_memory_translations Browser/batch translation map indexed by hash.
	 * @param array  $options                Optional `{ user_id?: ?int, enforce_permissions?: bool, skip_unauthorized?: bool, taxonomies?: string[] }`.
	 * @return array<string, int[]>|WP_Error Map of taxonomy => translated assigned term IDs.
	 */
	public static function prepare_post_translation(
		int $source_post_id,
		string $target_lang,
		string $source_lang,
		string $provider = '',
		array $in_memory_translations = array(),
		array $options = array()
	) {
		$target_lang         = sanitize_key( $target_lang );
		$user_id             = ( array_key_exists( 'user_id', $options ) && null !== $options['user_id'] ) ? (int) $options['user_id'] : null;
		$enforce_permissions = array_key_exists( 'enforce_permissions', $options ) ? (bool) $options['enforce_permissions'] : true;
		$skip_unauthorized   = ! empty( $options['skip_unauthorized'] );
		$taxonomies_filter   = ! empty( $options['taxonomies'] ) && is_array( $options['taxonomies'] )
			? array_values( array_unique( array_filter( array_map( 'sanitize_key', $options['taxonomies'] ) ) ) )
			: array();

		$authorized_tree = self::build_authorized_tree(
			$source_post_id,
			$target_lang,
			$user_id,
			$enforce_permissions,
			$skip_unauthorized,
			$taxonomies_filter
		);
		if ( is_wp_error( $authorized_tree ) ) {
			return $authorized_tree;
		}

		$preloaded = self::ensure_translations_available(
			$source_post_id,
			$authorized_tree,
			$source_lang,
			$target_lang,
			$provider,
			$in_memory_translations,
			$user_id,
			$enforce_permissions
		);
		if ( is_wp_error( $preloaded ) ) {
			return $preloaded;
		}

		$map = array();
		foreach ( $authorized_tree as $taxonomy => $terms ) {
			foreach ( $terms as $source_term_id => $source_term ) {
				$resolved = self::resolve_term(
					$source_term,
					$target_lang,
					$source_lang,
					$provider,
					$in_memory_translations,
					$user_id,
					$enforce_permissions
				);

				if ( is_wp_error( $resolved ) ) {
					return $resolved;
				}

				$map[ $taxonomy ][] = absint( $resolved );
			}

			if ( isset( $map[ $taxonomy ] ) ) {
				$map[ $taxonomy ] = array_values( array_unique( array_filter( $map[ $taxonomy ] ) ) );
			}
		}

		return $map;
	}

	/**
	 * Assign resolved translated terms to a translated post.
	 *
	 * @param int   $target_post_id   Target post ID.
	 * @param array $translated_terms Map of taxonomy => term IDs.
	 * @param bool  $append           Preserve unrelated manual target assignments when true.
	 * @param int   $source_post_id   Optional source post ID to strip copied source assignments.
	 * @param array $options          Optional `{ user_id?: ?int, enforce_permissions?: bool }`.
	 * @return true|WP_Error
	 */
	public static function assign_translated_terms(
		int $target_post_id,
		array $translated_terms,
		bool $append = false,
		int $source_post_id = 0,
		array $options = array()
	) {
		$user_id             = ( array_key_exists( 'user_id', $options ) && null !== $options['user_id'] ) ? (int) $options['user_id'] : null;
		$enforce_permissions = array_key_exists( 'enforce_permissions', $options ) ? (bool) $options['enforce_permissions'] : true;

		if (
			$target_post_id <= 0
			|| ! get_post( $target_post_id )
			|| ( $enforce_permissions && ! Taxonomy_Parser::user_has_cap( $user_id, 'edit_post', $target_post_id ) )
		) {
			return new WP_Error( 'translatesense_invalid_target_post', __( 'You are not allowed to update taxonomy assignments for the translated post.', 'translatesense' ), array( 'status' => 403 ) );
		}

		foreach ( $translated_terms as $taxonomy => $term_ids ) {
			$taxonomy = sanitize_key( (string) $taxonomy );
			if ( ! Taxonomy_Parser::is_translatable_taxonomy( $taxonomy ) ) {
				continue;
			}

			$taxonomy_object = get_taxonomy( $taxonomy );
			if ( ! $taxonomy_object || ( $enforce_permissions && ! Taxonomy_Parser::user_has_cap( $user_id, (string) $taxonomy_object->cap->assign_terms ) ) ) {
				return new WP_Error( 'translatesense_taxonomy_assign_forbidden', __( 'You are not allowed to assign translated taxonomy terms.', 'translatesense' ), array( 'status' => 403 ) );
			}

			$clean_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $term_ids ) ) ) );
			foreach ( $clean_ids as $term_id ) {
				if ( ! get_term( $term_id, $taxonomy ) instanceof WP_Term ) {
					return new WP_Error( 'translatesense_invalid_target_term', __( 'A translated taxonomy term is invalid.', 'translatesense' ) );
				}
			}

			if ( $append ) {
				$existing_ids = wp_get_object_terms( $target_post_id, $taxonomy, array( 'fields' => 'ids' ) );
				if ( ! is_wp_error( $existing_ids ) ) {
					$existing_ids = array_map( 'absint', (array) $existing_ids );

					// Remove source-language assignments left by an interrupted/older
					// translation while retaining unrelated manual target terms.
					if ( $source_post_id > 0 ) {
						$source_ids = wp_get_object_terms( $source_post_id, $taxonomy, array( 'fields' => 'ids' ) );
						if ( ! is_wp_error( $source_ids ) ) {
							$existing_ids = array_diff( $existing_ids, array_map( 'absint', (array) $source_ids ) );
						}
					}

					$clean_ids = array_values( array_unique( array_merge( $existing_ids, $clean_ids ) ) );
				}
			}

			$result = wp_set_object_terms( $target_post_id, $clean_ids, $taxonomy, false );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		return true;
	}

	/**
	 * Complete taxonomy translation and term assignment for an existing editor translation.
	 *
	 * @param int    $source_post_id         Source post ID.
	 * @param int    $target_post_id         Target post ID.
	 * @param string $target_lang            Target language slug.
	 * @param string $provider               Provider ID.
	 * @param array  $in_memory_translations Browser translation map indexed by hash.
	 * @param array  $options                Optional permission/taxonomy filter options.
	 * @return array<string, int[]>|WP_Error Resolved taxonomy => term IDs map on success, or error.
	 */
	public static function apply_to_existing_translation(
		int $source_post_id,
		int $target_post_id,
		string $target_lang,
		string $provider,
		array $in_memory_translations,
		array $options = array()
	) {
		$user_id             = ( array_key_exists( 'user_id', $options ) && null !== $options['user_id'] ) ? (int) $options['user_id'] : null;
		$enforce_permissions = array_key_exists( 'enforce_permissions', $options ) ? (bool) $options['enforce_permissions'] : true;

		$source_post = get_post( $source_post_id );
		$target_post = get_post( $target_post_id );
		if (
			! $source_post instanceof WP_Post
			|| ! $target_post instanceof WP_Post
			|| $source_post_id === $target_post_id
			|| $source_post->post_type !== $target_post->post_type
			|| ( $enforce_permissions && ( ! Taxonomy_Parser::user_has_cap( $user_id, 'edit_post', $source_post_id ) || ! Taxonomy_Parser::user_has_cap( $user_id, 'edit_post', $target_post_id ) ) )
		) {
			return new WP_Error( 'translatesense_invalid_taxonomy_post_pair', __( 'The source and translated posts are not a valid translation pair.', 'translatesense' ), array( 'status' => 403 ) );
		}

		$actual_target_lang = Polylang_Bridge::get_post_language( $target_post_id );
		if ( $actual_target_lang && sanitize_key( (string) $actual_target_lang ) !== sanitize_key( $target_lang ) ) {
			return new WP_Error( 'translatesense_taxonomy_target_language_mismatch', __( 'The translated post language does not match the requested taxonomy language.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$source_lang      = Polylang_Bridge::get_post_language( $source_post_id );
		$translated_terms = self::prepare_post_translation(
			$source_post_id,
			$target_lang,
			(string) $source_lang,
			$provider,
			$in_memory_translations,
			$options
		);

		if ( is_wp_error( $translated_terms ) ) {
			return $translated_terms;
		}

		$assigned = self::assign_translated_terms( $target_post_id, $translated_terms, true, $source_post_id, $options );
		if ( is_wp_error( $assigned ) ) {
			return $assigned;
		}

		return $translated_terms;
	}

	/**
	 * Copy non-translatable source term metadata unchanged when creating a target term.
	 *
	 * @param WP_Term $source_term    Source term.
	 * @param int     $target_term_id Target term ID.
	 * @return void
	 */
	private static function copy_term_meta( WP_Term $source_term, int $target_term_id ): void {
		$translate = array_flip( Taxonomy_Parser::get_translatable_meta_keys( $source_term ) );

		foreach ( (array) get_term_meta( (int) $source_term->term_id ) as $meta_key => $values ) {
			if (
				! is_string( $meta_key )
				|| '' === $meta_key
				|| isset( $translate[ $meta_key ] )
				|| metadata_exists( 'term', $target_term_id, $meta_key )
			) {
				continue;
			}

			foreach ( (array) $values as $value ) {
				add_term_meta( $target_term_id, $meta_key, wp_slash( self::safe_unserialize_meta( $value ) ), false );
			}
		}
	}

	/**
	 * Unserialize metadata values safely without instantiating PHP objects.
	 *
	 * @param mixed $value Raw metadata value.
	 * @return mixed
	 */
	private static function safe_unserialize_meta( $value ) {
		if ( ! is_string( $value ) || ! is_serialized( $value ) ) {
			return $value;
		}

		$trimmed = trim( $value );

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize -- Required to safely decode serialized metadata without instantiating PHP objects.
		$unserialized = @unserialize(
			$trimmed,
			array(
				'allowed_classes' => false,
			)
		);

		if ( false !== $unserialized || 'b:0;' === $trimmed ) {
			return $unserialized;
		}

		return $value;
	}

	/**
	 * Translate configured basic term metadata using `Translate::translate_string()`,
	 * filling missing values only for existing translated terms.
	 *
	 * @param WP_Term $source_term            Source term.
	 * @param int     $target_term_id         Target term ID.
	 * @param string  $source_lang            Source language slug.
	 * @param string  $target_lang            Target language slug.
	 * @param string  $provider               Provider ID.
	 * @param array   $in_memory_translations Browser/batch translations indexed by hash.
	 * @param bool    $overwrite              Whether this is a newly created term.
	 * @return void
	 */
	private static function translate_term_meta(
		WP_Term $source_term,
		int $target_term_id,
		string $source_lang,
		string $target_lang,
		string $provider,
		array $in_memory_translations,
		bool $overwrite = false
	): void {
		$custom_opts = array(
			'provider'               => $provider,
			'in_memory_translations' => $in_memory_translations,
		);

		foreach ( Taxonomy_Parser::get_translatable_meta_keys( $source_term ) as $meta_key ) {
			$source_values = get_term_meta( (int) $source_term->term_id, $meta_key, false );
			if ( empty( $source_values ) || ( ! $overwrite && metadata_exists( 'term', $target_term_id, $meta_key ) ) ) {
				continue;
			}

			delete_term_meta( $target_term_id, $meta_key );

			foreach ( (array) $source_values as $source_value ) {
				if ( ! is_string( $source_value ) || '' === trim( $source_value ) || Custom_Field_Parser::is_only_numbers( $source_value ) ) {
					add_term_meta( $target_term_id, $meta_key, wp_slash( $source_value ), false );
					continue;
				}

				$res = Translate::translate_string( $source_value, $source_lang, $target_lang, 'taxonomy_term_meta', $custom_opts );
				add_term_meta( $target_term_id, $meta_key, wp_slash( (string) ( $res['translated'] ?? $source_value ) ), false );
			}
		}
	}

	/**
	 * Determine whether assigning `$candidate_parent_id` as the parent of `$term_id`
	 * would introduce self-parenting or a circular hierarchy.
	 *
	 * @param int    $term_id             Target child term ID (`0` when term is not created yet).
	 * @param int    $candidate_parent_id Target parent term ID.
	 * @param string $taxonomy            Taxonomy slug.
	 * @return bool True if a self-parent or cycle would be formed.
	 */
	public static function would_create_parent_cycle( int $term_id, int $candidate_parent_id, string $taxonomy ): bool {
		if ( $candidate_parent_id <= 0 ) {
			return false;
		}

		if ( $term_id > 0 && $term_id === $candidate_parent_id ) {
			return true;
		}

		$visited = $term_id > 0 ? array( $term_id => true ) : array();
		$cursor  = $candidate_parent_id;
		$steps   = 0;

		while ( $cursor > 0 && $steps <= Taxonomy_Parser::MAX_PARENT_DEPTH ) {
			if ( isset( $visited[ $cursor ] ) ) {
				return true;
			}
			$visited[ $cursor ] = true;

			$node = get_term( $cursor, $taxonomy );
			if ( ! $node instanceof WP_Term || empty( $node->parent ) ) {
				break;
			}

			$cursor = (int) $node->parent;
			++$steps;
		}

		return false;
	}

	/**
	 * Resolve the existing target-language parent term ID from Polylang's ID mapping.
	 *
	 * Never creates a missing parent translation and never returns a source-language
	 * term ID or mismatched taxonomy/language term ID.
	 *
	 * @param WP_Term $source_term    Source term.
	 * @param string  $target_lang    Target language slug.
	 * @param int     $target_term_id Optional existing target term ID to guard against self-parenting/cycles.
	 * @return int Existing translated parent term ID in `$target_lang`, or `0`.
	 */
	public static function resolve_existing_parent_id(
		WP_Term $source_term,
		string $target_lang,
		int $target_term_id = 0
	): int {
		$source_parent_id = (int) $source_term->parent;
		if ( $source_parent_id <= 0 || $source_parent_id === (int) $source_term->term_id ) {
			return 0;
		}

		// `Taxonomy_Parser::get_translation_id()` resolves strictly by Polylang ID
		// and validates target existence, taxonomy membership, and target language.
		$target_parent_id = Taxonomy_Parser::get_translation_id( $source_parent_id, $target_lang );
		if (
			$target_parent_id <= 0
			|| $target_parent_id === $source_parent_id
			|| $target_parent_id === (int) $source_term->term_id
		) {
			return 0;
		}

		$target_parent = get_term( $target_parent_id );
		if ( ! $target_parent instanceof WP_Term || $target_parent->taxonomy !== $source_term->taxonomy ) {
			return 0;
		}

		if ( self::would_create_parent_cycle( $target_term_id, $target_parent_id, $source_term->taxonomy ) ) {
			return 0;
		}

		return $target_parent_id;
	}

	/**
	 * Resolve, update, or create one translated term, synchronizing existing
	 * parent and direct children without creating missing translations.
	 *
	 * @param WP_Term  $source_term            Source term.
	 * @param string   $target_lang            Target language slug.
	 * @param string   $source_lang            Post/source language slug.
	 * @param string   $provider               Provider ID.
	 * @param array    $in_memory_translations Browser/batch translations indexed by hash.
	 * @param int|null $user_id                Optional user ID for child-sync capability checks.
	 * @param bool     $enforce_permissions    Whether permission checks are enforced.
	 * @return int|WP_Error Target term ID or error.
	 */
	private static function resolve_term(
		WP_Term $source_term,
		string $target_lang,
		string $source_lang,
		string $provider,
		array $in_memory_translations,
		?int $user_id = null,
		bool $enforce_permissions = true
	) {
		$source_term_id = (int) $source_term->term_id;
		$model          = Taxonomy_Parser::get_term_model();
		if ( ! $model ) {
			return new WP_Error( 'translatesense_polylang_term_api_unavailable', __( 'Polylang term translation APIs are unavailable.', 'translatesense' ) );
		}

		$term_language      = Taxonomy_Parser::get_term_language( $source_term_id );
		$actual_source_lang = '' !== $term_language ? $term_language : sanitize_key( $source_lang );

		if ( $actual_source_lang === $target_lang ) {
			return $source_term_id;
		}

		$existing_id      = Taxonomy_Parser::get_translation_id( $source_term_id, $target_lang );
		$target_parent_id = self::resolve_existing_parent_id( $source_term, $target_lang, $existing_id );

		if ( $existing_id > 0 ) {
			$existing_term = get_term( $existing_id, $source_term->taxonomy );
			if ( ! $existing_term instanceof WP_Term ) {
				return new WP_Error( 'translatesense_target_term_missing', __( 'The linked translated taxonomy term could not be found.', 'translatesense' ) );
			}

			if (
				$target_parent_id > 0
				&& (int) $existing_term->parent !== $target_parent_id
				&& ! self::would_create_parent_cycle( $existing_id, $target_parent_id, $source_term->taxonomy )
			) {
				$parent_update = wp_update_term( $existing_id, $source_term->taxonomy, array( 'parent' => $target_parent_id ) );
				if ( is_wp_error( $parent_update ) ) {
					return $parent_update;
				}
			}

			self::translate_term_meta(
				$source_term,
				$existing_id,
				$actual_source_lang,
				$target_lang,
				$provider,
				$in_memory_translations,
				false
			);

			self::synchronize_existing_children( $source_term, $existing_id, $target_lang, $user_id, $enforce_permissions );

			return $existing_id;
		}

		return self::create_translated_term(
			$source_term,
			$actual_source_lang,
			$target_lang,
			$target_parent_id,
			$provider,
			$in_memory_translations,
			$model,
			$user_id,
			$enforce_permissions
		);
	}

	/**
	 * Translate fields using `Translate::translate_string()`, create the target term,
	 * and link it in Polylang.
	 *
	 * @param WP_Term  $source_term            Source term.
	 * @param string   $actual_source_lang     Source language slug.
	 * @param string   $target_lang            Target language slug.
	 * @param int      $target_parent_id       Resolved target parent term ID.
	 * @param string   $provider               Provider ID.
	 * @param array    $in_memory_translations Browser/batch translations indexed by hash.
	 * @param object   $model                  Polylang term model.
	 * @param int|null $user_id                Optional user ID for child-sync capability checks.
	 * @param bool     $enforce_permissions    Whether permission checks are enforced.
	 * @return int|WP_Error
	 */
	private static function create_translated_term(
		WP_Term $source_term,
		string $actual_source_lang,
		string $target_lang,
		int $target_parent_id,
		string $provider,
		array $in_memory_translations,
		object $model,
		?int $user_id,
		bool $enforce_permissions
	) {
		$source_term_id = (int) $source_term->term_id;
		$lock_key       = 'translatesense_term_lock_' . md5( $source_term->taxonomy . ':' . $source_term_id . ':' . $target_lang );
		$lock           = get_option( $lock_key, 0 );
		if ( $lock && ( time() - absint( $lock ) ) > 300 ) {
			delete_option( $lock_key );
		}

		if ( ! add_option( $lock_key, time(), '', false ) ) {
			$existing_id = Taxonomy_Parser::get_translation_id( $source_term_id, $target_lang );
			return $existing_id > 0
				? $existing_id
				: new WP_Error( 'translatesense_taxonomy_translation_locked', __( 'This taxonomy term is already being translated. Please retry shortly.', 'translatesense' ) );
		}

		try {
			$custom_opts = array(
				'provider'               => $provider,
				'in_memory_translations' => $in_memory_translations,
			);

			$name_res        = Translate::translate_string( (string) $source_term->name, $actual_source_lang, $target_lang, 'taxonomy_term', $custom_opts );
			$translated_name = sanitize_text_field( (string) ( $name_res['translated'] ?? '' ) );
			if ( '' === $translated_name ) {
				return new WP_Error( 'translatesense_empty_term_name', __( 'The translated taxonomy term name is empty.', 'translatesense' ) );
			}

			$translated_desc = '';
			if ( '' !== trim( (string) $source_term->description ) ) {
				$desc_res        = Translate::translate_string( (string) $source_term->description, $actual_source_lang, $target_lang, 'taxonomy_term', $custom_opts );
				$translated_desc = (string) ( $desc_res['translated'] ?? $source_term->description );
				if ( '' !== trim( $translated_desc ) && false !== strpos( $translated_desc, '<' ) ) {
					$translated_desc = wp_kses_post( $translated_desc );
				}
			}

			$target_term_id = self::insert_or_reuse_term(
				$source_term,
				$translated_name,
				$translated_desc,
				$target_parent_id,
				$actual_source_lang,
				$target_lang,
				$model
			);

			if ( is_wp_error( $target_term_id ) ) {
				return $target_term_id;
			}

			$model->set_language( $target_term_id, $target_lang );
			$translations                        = (array) $model->get_translations( $source_term_id );
			$translations[ $actual_source_lang ] = $source_term_id;
			$translations[ $target_lang ]        = $target_term_id;
			$model->save_translations( $source_term_id, $translations );

			self::copy_term_meta( $source_term, $target_term_id );
			self::translate_term_meta(
				$source_term,
				$target_term_id,
				$actual_source_lang,
				$target_lang,
				$provider,
				$in_memory_translations,
				true
			);

			/**
			 * Fires after TranslateSense creates a translated taxonomy term.
			 *
			 * @param int    $source_term_id Source term ID.
			 * @param int    $target_term_id Translated term ID.
			 * @param string $target_lang    Target language slug.
			 */
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Polylang integration hook.
			do_action( 'pll_duplicate_term', $source_term_id, $target_term_id, $target_lang );

			self::synchronize_existing_children( $source_term, $target_term_id, $target_lang, $user_id, $enforce_permissions );

			return $target_term_id;
		} finally {
			delete_option( $lock_key );
		}
	}

	/**
	 * Insert the translated term, safely reusing matching unlinked target terms or
	 * disambiguating the slug when another language already uses it.
	 *
	 * @param WP_Term $source_term        Source term.
	 * @param string  $translated_name    Translated term name.
	 * @param string  $translated_desc    Translated term description.
	 * @param int     $target_parent_id   Resolved target parent term ID.
	 * @param string  $actual_source_lang Source language slug.
	 * @param string  $target_lang        Target language slug.
	 * @param object  $model              Polylang term model.
	 * @return int|WP_Error Inserted or reused term ID, or error.
	 */
	private static function insert_or_reuse_term(
		WP_Term $source_term,
		string $translated_name,
		string $translated_desc,
		int $target_parent_id,
		string $actual_source_lang,
		string $target_lang,
		object $model
	) {
		$slug = sanitize_title( $translated_name );
		if ( '' === $slug ) {
			$slug = sanitize_title( $source_term->slug . '-' . $target_lang );
		}

		$inserted = wp_insert_term(
			wp_slash( $translated_name ),
			$source_term->taxonomy,
			array(
				'description' => wp_slash( $translated_desc ),
				'parent'      => $target_parent_id,
				'slug'        => $slug,
			)
		);

		if ( is_wp_error( $inserted ) && 'term_exists' === $inserted->get_error_code() ) {
			$data         = $inserted->get_error_data();
			$duplicate_id = is_array( $data ) && isset( $data['term_id'] )
				? absint( $data['term_id'] )
				: ( is_numeric( $data ) ? absint( $data ) : 0 );

			if ( $duplicate_id > 0 ) {
				$duplicate_term     = get_term( $duplicate_id, $source_term->taxonomy );
				$duplicate_language = $model->get_language( $duplicate_id );
				$parent_matches     = $duplicate_term instanceof WP_Term && (int) $duplicate_term->parent === $target_parent_id;

				$dup_translations = (array) $model->get_translations( $duplicate_id );
				$existing_source  = isset( $dup_translations[ $actual_source_lang ] ) ? absint( $dup_translations[ $actual_source_lang ] ) : 0;
				$no_source_clash  = 0 === $existing_source || $existing_source === (int) $source_term->term_id;

				if ( $parent_matches && $no_source_clash && ! $duplicate_language ) {
					$model->set_language( $duplicate_id, $target_lang );
					$duplicate_language = $model->get_language( $duplicate_id );
				}

				if ( $parent_matches && $no_source_clash && is_object( $duplicate_language ) && $target_lang === $duplicate_language->slug ) {
					$inserted = array( 'term_id' => $duplicate_id );
				} else {
					$fallback_slug = wp_unique_term_slug(
						$slug . '-' . $target_lang,
						(object) array(
							'taxonomy' => $source_term->taxonomy,
							'parent'   => $target_parent_id,
						)
					);

					$inserted = wp_insert_term(
						wp_slash( $translated_name ),
						$source_term->taxonomy,
						array(
							'description' => wp_slash( $translated_desc ),
							'parent'      => $target_parent_id,
							'slug'        => $fallback_slug,
						)
					);
				}
			}
		}

		if ( is_wp_error( $inserted ) ) {
			return $inserted;
		}

		$target_term_id = isset( $inserted['term_id'] ) ? absint( $inserted['term_id'] ) : 0;
		if ( $target_term_id <= 0 ) {
			return new WP_Error( 'translatesense_term_create_failed', __( 'The translated taxonomy term could not be created.', 'translatesense' ) );
		}

		return $target_term_id;
	}

	/**
	 * Synchronize the parent of already translated direct children in `$target_lang`.
	 *
	 * Never creates missing child translations and never modifies a child's name,
	 * slug, description, or metadata. Prevents cross-taxonomy links, language
	 * mismatches, self-parenting, cycles, and redundant DB writes.
	 *
	 * @param WP_Term          $source_parent       Source parent term.
	 * @param int              $target_parent_id    Translated parent term ID.
	 * @param string           $target_lang         Target language slug.
	 * @param WP_User|int|null $user                User context for capability checks (`null` uses current user).
	 * @param bool             $enforce_permissions Whether permission checks are enforced.
	 * @return void
	 */
	public static function synchronize_existing_children(
		WP_Term $source_parent,
		int $target_parent_id,
		string $target_lang,
		$user = null,
		bool $enforce_permissions = true
	): void {
		$target_lang = sanitize_key( $target_lang );
		if (
			$target_parent_id <= 0
			|| '' === $target_lang
			|| $target_parent_id === (int) $source_parent->term_id
		) {
			return;
		}

		$target_parent = get_term( $target_parent_id );
		if ( ! $target_parent instanceof WP_Term || $target_parent->taxonomy !== $source_parent->taxonomy ) {
			return;
		}

		if ( Taxonomy_Parser::get_term_model() && Taxonomy_Parser::get_term_language( $target_parent_id ) !== $target_lang ) {
			return;
		}

		$children = get_terms(
			array(
				'taxonomy'               => $source_parent->taxonomy,
				'parent'                 => (int) $source_parent->term_id,
				'hide_empty'             => false,
				'fields'                 => 'all',
				'number'                 => 0,
				'update_term_meta_cache' => false,
			)
		);

		if ( is_wp_error( $children ) || empty( $children ) ) {
			return;
		}

		foreach ( $children as $source_child ) {
			if (
				! $source_child instanceof WP_Term
				|| $source_child->taxonomy !== $source_parent->taxonomy
				|| (int) $source_child->term_id === (int) $source_parent->term_id
			) {
				continue;
			}

			$target_child_id = Taxonomy_Parser::get_translation_id( (int) $source_child->term_id, $target_lang );
			if (
				$target_child_id <= 0
				|| $target_child_id === $target_parent_id
				|| $target_child_id === (int) $source_child->term_id
				|| $target_child_id === (int) $source_parent->term_id
			) {
				continue;
			}

			$target_child = get_term( $target_child_id );
			if ( ! $target_child instanceof WP_Term || (int) $target_child->parent === $target_parent_id ) {
				continue;
			}

			if ( self::would_create_parent_cycle( $target_child_id, $target_parent_id, $source_parent->taxonomy ) ) {
				continue;
			}

			if ( $enforce_permissions && ! Taxonomy_Parser::user_has_cap( $user, 'edit_term', $target_child_id ) ) {
				continue;
			}

			wp_update_term(
				$target_child_id,
				$target_child->taxonomy,
				array( 'parent' => $target_parent_id )
			);
		}
	}
}
