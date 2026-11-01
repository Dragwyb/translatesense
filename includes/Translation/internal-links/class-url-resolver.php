<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use WP_Post;
use WP_Term;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * URL Resolver.
 * Identifies, categorizes, and translates internal WordPress URLs (Posts, Pages, CPTs, Taxonomies/Terms, Media).
 * Preserves query parameters and URL fragments.
 */
class URL_Resolver {

	/**
	 * Site home URL components for matching.
	 *
	 * @var array
	 */
	protected $home_parts = array();

	/**
	 * Constructor.
	 */
	public function __construct() {
		$home = home_url();
		$this->home_parts = (array) wp_parse_url( $home );
	}

	/**
	 * Check whether a URL is internal to this WordPress site.
	 *
	 * @param string $url
	 * @return bool
	 */
	public function is_internal_url( string $url ): bool {
		$url = trim( $url );
		if ( '' === $url || str_starts_with( $url, '#' ) || str_starts_with( $url, 'javascript:' ) || str_starts_with( $url, 'mailto:' ) || str_starts_with( $url, 'tel:' ) ) {
			return false;
		}

		// Relative URL with path or query
		if ( str_starts_with( $url, '/' ) && ! str_starts_with( $url, '//' ) ) {
			return true;
		}

		if ( str_starts_with( $url, '?' ) ) {
			return true;
		}

		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return false;
		}

		$home_host = $this->home_parts['host'] ?? '';
		if ( empty( $home_host ) ) {
			return false;
		}

		// Exact host match or www/non-www equivalence
		$url_host  = strtolower( (string) $parts['host'] );
		$home_host = strtolower( (string) $home_host );

		if ( $url_host === $home_host ) {
			return true;
		}

		return ltrim( $url_host, 'w.' ) === ltrim( $home_host, 'w.' );
	}

	/**
	 * Resolve an internal URL into its translated counterpart if available.
	 * Returns null if the URL is external, unknown, or has no target translation.
	 *
	 * @param string          $url
	 * @param string          $target_language
	 * @param Reference_Cache $cache
	 * @return string|null
	 */
	public function resolve_translated_url( string $url, string $target_language, Reference_Cache $cache ): ?string {
		$url = trim( $url );
		if ( ! $this->is_internal_url( $url ) ) {
			return null;
		}

		if ( $cache->has_url( $url ) ) {
			$cached = $cache->get_url( $url );
			return is_string( $cached ) ? $cached : null;
		}

		$parsed = wp_parse_url( $url );
		if ( ! is_array( $parsed ) ) {
			$cache->set_url( $url, null );
			return null;
		}

		$query_params = array();
		if ( ! empty( $parsed['query'] ) ) {
			if ( function_exists( 'wp_parse_str' ) ) {
				wp_parse_str( $parsed['query'], $query_params );
			} else {
				parse_str( $parsed['query'], $query_params );
			}
		}
		$fragment = ! empty( $parsed['fragment'] ) ? '#' . $parsed['fragment'] : '';

		// Identify the object referenced by this URL
		$object = $this->resolve_url_object( $url, $parsed, $query_params );
		if ( ! $object ) {
			// If it is an internal URL that contains percent-encoded characters, decode it so it's readable
			if ( str_contains( $url, '%' ) ) {
				$decoded = $this->decode_url( $url );
				if ( $decoded !== $url ) {
					$cache->set_url( $url, $decoded );
					return $decoded;
				}
			}
			$cache->set_url( $url, null );
			return null;
		}

		$translated_url = null;

		if ( 'post' === $object['type'] || 'media' === $object['type'] ) {
			$post_id        = (int) $object['id'];
			$translated_id  = 0;

			if ( $cache->has_post( $post_id, $target_language ) ) {
				$translated_id = $cache->get_post( $post_id, $target_language );
			} elseif ( function_exists( 'pll_get_post' ) ) {
				$translated_id = (int) pll_get_post( $post_id, $target_language );
				$cache->set_post( $post_id, $target_language, $translated_id );
			}

			if ( $translated_id > 0 && $translated_id !== $post_id ) {
				$target_post = get_post( $translated_id );
				if ( $target_post instanceof WP_Post && 'trash' !== $target_post->post_status ) {
					$translated_base = get_permalink( $translated_id );
					if ( is_string( $translated_base ) && '' !== $translated_base ) {
						$translated_url = $this->rebuild_url( $translated_base, $query_params, $fragment, array( 'p', 'page_id', 'post_type' ) );
						$orig_path      = $parsed['path'] ?? '';
						if ( '' !== $orig_path && ! str_ends_with( $orig_path, '/' ) && empty( $query_params ) && empty( $fragment ) ) {
							$translated_url = rtrim( $translated_url, '/' );
						}
						// Decode percent-encoded Unicode characters (e.g. Hindi, Arabic, Cyrillic)
						// so that URLs appear clean and readable in href and text.
						$translated_url = $this->decode_url( $translated_url );
					}
				}
			} elseif ( $translated_id === $post_id ) {
				// The URL already references the target language post.
				// If it is percent-encoded, provide the clean decoded version.
				$decoded = $this->decode_url( $url );
				if ( $decoded !== $url ) {
					$translated_url = $decoded;
				}
			}
		} elseif ( 'term' === $object['type'] && ! empty( $object['taxonomy'] ) ) {
			$term_id       = (int) $object['id'];
			$taxonomy      = (string) $object['taxonomy'];
			$translated_id = 0;

			if ( $cache->has_term( $term_id, $taxonomy, $target_language ) ) {
				$translated_id = $cache->get_term( $term_id, $taxonomy, $target_language );
			} elseif ( function_exists( 'pll_get_term' ) ) {
				$translated_id = (int) pll_get_term( $term_id, $target_language );
				$cache->set_term( $term_id, $taxonomy, $target_language, $translated_id );
			}

			if ( $translated_id > 0 && $translated_id !== $term_id ) {
				$term_link = get_term_link( $translated_id, $taxonomy );
				if ( is_string( $term_link ) && ! is_wp_error( $term_link ) ) {
					$translated_url = $this->rebuild_url( $term_link, $query_params, $fragment, array( 'cat', 'tag_id', 'tag', $taxonomy ) );
					$orig_path      = $parsed['path'] ?? '';
					if ( '' !== $orig_path && ! str_ends_with( $orig_path, '/' ) && empty( $query_params ) && empty( $fragment ) ) {
						$translated_url = rtrim( $translated_url, '/' );
					}
					// Decode percent-encoded Unicode characters for terms as well.
					$translated_url = $this->decode_url( $translated_url );
				}
			} elseif ( $translated_id === $term_id ) {
				$decoded = $this->decode_url( $url );
				if ( $decoded !== $url ) {
					$translated_url = $decoded;
				}
			}
		}

		$cache->set_url( $url, $translated_url );
		return $translated_url;
	}

	/**
	 * Identify whether a URL references a Post, Page, CPT, Taxonomy/Term, or Media.
	 *
	 * @param string $url
	 * @param array  $parsed
	 * @param array  $query_params
	 * @return array|null { 'type' => 'post'|'term'|'media', 'id' => int, 'taxonomy' => string|null }
	 */
	public function resolve_url_object( string $url, array $parsed, array $query_params ): ?array {
		// 1. Direct query-based post resolution
		if ( ! empty( $query_params['p'] ) && is_numeric( $query_params['p'] ) ) {
			$post_id = absint( $query_params['p'] );
			return $this->build_post_object_result( $post_id );
		}

		if ( ! empty( $query_params['page_id'] ) && is_numeric( $query_params['page_id'] ) ) {
			$post_id = absint( $query_params['page_id'] );
			return $this->build_post_object_result( $post_id );
		}

		// 2. Direct query-based taxonomy resolution
		if ( ! empty( $query_params['cat'] ) && is_numeric( $query_params['cat'] ) ) {
			return array(
				'type'     => 'term',
				'id'       => absint( $query_params['cat'] ),
				'taxonomy' => 'category',
			);
		}

		if ( ! empty( $query_params['tag_id'] ) && is_numeric( $query_params['tag_id'] ) ) {
			return array(
				'type'     => 'term',
				'id'       => absint( $query_params['tag_id'] ),
				'taxonomy' => 'post_tag',
			);
		}

		if ( ! empty( $query_params['tag'] ) && is_string( $query_params['tag'] ) ) {
			$term = get_term_by( 'slug', sanitize_title( $query_params['tag'] ), 'post_tag' );
			if ( $term instanceof WP_Term ) {
				return array(
					'type'     => 'term',
					'id'       => (int) $term->term_id,
					'taxonomy' => 'post_tag',
				);
			}
		}

		// 3. Absolute URL for WordPress URL-to-post ID lookup
		$full_url = $this->make_absolute_url( $url );
		$post_id  = url_to_postid( $full_url );
		if ( $post_id <= 0 && str_contains( $full_url, '%' ) ) {
			// Fallback: try decoded URL in case rewrite rules match decoded Unicode slug
			$post_id = url_to_postid( $this->decode_url( $full_url ) );
		}
		if ( $post_id > 0 ) {
			return $this->build_post_object_result( $post_id );
		}

		// 4. Taxonomy resolution from pretty permalinks
		$term_result = $this->resolve_taxonomy_url( $full_url, $parsed );
		if ( $term_result ) {
			return $term_result;
		}

		return null;
	}

	/**
	 * Build post object result after validating existence.
	 *
	 * @param int $post_id
	 * @return array|null
	 */
	protected function build_post_object_result( int $post_id ): ?array {
		if ( $post_id <= 0 ) {
			return null;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || 'trash' === $post->post_status ) {
			return null;
		}

		return array(
			'type'     => ( 'attachment' === $post->post_type ) ? 'media' : 'post',
			'id'       => $post_id,
			'taxonomy' => null,
		);
	}

	/**
	 * Resolve pretty taxonomy permalinks using registered taxonomy information.
	 * Supports categories, tags, custom taxonomies, and WooCommerce product categories & tags.
	 *
	 * @param string $full_url
	 * @param array  $parsed
	 * @return array|null
	 */
	protected function resolve_taxonomy_url( string $full_url, array $parsed ): ?array {
		$home_path = isset( $this->home_parts['path'] ) ? trim( (string) $this->home_parts['path'], '/' ) : '';
		$url_path  = isset( $parsed['path'] ) ? trim( (string) $parsed['path'], '/' ) : '';

		if ( '' !== $home_path && str_starts_with( $url_path, $home_path ) ) {
			$url_path = trim( substr( $url_path, strlen( $home_path ) ), '/' );
		}

		if ( '' === $url_path ) {
			return null;
		}

		// Get all public taxonomies
		$taxonomies = get_taxonomies( array( 'public' => true ), 'objects' );
		if ( empty( $taxonomies ) ) {
			return null;
		}

		foreach ( $taxonomies as $taxonomy => $tax_obj ) {
			$slug = $tax_obj->rewrite['slug'] ?? $taxonomy;
			$slug = trim( (string) $slug, '/' );
			if ( '' === $slug ) {
				continue;
			}

			// Path starts with taxonomy rewrite slug (e.g. "category/news" or "product-category/shoes")
			if ( str_starts_with( $url_path, $slug . '/' ) || $url_path === $slug ) {
				$term_path = trim( substr( $url_path, strlen( $slug ) ), '/' );
				if ( '' === $term_path ) {
					continue;
				}

				// If hierarchical (e.g. parent/child), get the leaf slug
				$segments  = explode( '/', $term_path );
				$leaf_slug = sanitize_title( end( $segments ) );

				$term = get_term_by( 'slug', $leaf_slug, $taxonomy );
				if ( $term instanceof WP_Term ) {
					return array(
						'type'     => 'term',
						'id'       => (int) $term->term_id,
						'taxonomy' => $taxonomy,
					);
				}
			}
		}

		return null;
	}

	/**
	 * Make a URL absolute using site home URL.
	 *
	 * @param string $url
	 * @return string
	 */
	public function make_absolute_url( string $url ): string {
		if ( str_starts_with( $url, 'http://' ) || str_starts_with( $url, 'https://' ) ) {
			return $url;
		}

		$home = rtrim( home_url(), '/' );
		if ( str_starts_with( $url, '/' ) ) {
			return $home . $url;
		}

		return $home . '/' . $url;
	}

	/**
	 * Rebuild a URL keeping non-WordPress query parameters and fragment.
	 *
	 * @param string   $base_url
	 * @param array    $original_query_params
	 * @param string   $fragment
	 * @param string[] $strip_keys
	 * @return string
	 */
	protected function rebuild_url( string $base_url, array $original_query_params, string $fragment, array $strip_keys = array() ): string {
		$remaining_params = array_diff_key( $original_query_params, array_flip( $strip_keys ) );

		if ( ! empty( $remaining_params ) ) {
			$base_url = add_query_arg( $remaining_params, $base_url );
		}

		if ( '' !== $fragment ) {
			$base_url .= $fragment;
		}

		return $base_url;
	}

	/**
	 * Decode a URL so that non-ASCII Unicode characters (e.g. Hindi, Arabic, Cyrillic)
	 * are human-readable instead of %xx percent-encoded sequences.
	 * Preserves query parameter delimiters (&, =, +, #, ?).
	 *
	 * @param string $url
	 * @return string
	 */
	public function decode_url( string $url ): string {
		$url = trim( $url );
		if ( '' === $url || ! str_contains( $url, '%' ) ) {
			return $url;
		}

		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return rawurldecode( $url );
		}

		$scheme = '';
		if ( str_starts_with( $url, '//' ) ) {
			$scheme = '//';
		} elseif ( isset( $parts['scheme'] ) ) {
			$scheme = $parts['scheme'] . '://';
		}

		$host     = $parts['host'] ?? '';
		$port     = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
		$user     = $parts['user'] ?? '';
		$pass     = isset( $parts['pass'] ) ? ':' . $parts['pass'] : '';
		$auth     = ( '' !== $user || '' !== $pass ) ? $user . $pass . '@' : '';
		$path     = isset( $parts['path'] ) ? implode( '/', array_map( 'rawurldecode', explode( '/', (string) $parts['path'] ) ) ) : '';
		$query    = '';
		if ( isset( $parts['query'] ) ) {
			$decoded_query = preg_replace_callback(
				'/%[0-9a-fA-F]{2}/',
				static function ( $m ) {
					$hex = strtoupper( $m[0] );
					// Do not decode reserved query characters &, =, +, #, ?, space
					if ( in_array( $hex, array( '%26', '%3D', '%2B', '%23', '%3F', '%20' ), true ) ) {
						return $m[0];
					}
					return rawurldecode( $m[0] );
				},
				(string) $parts['query']
			);
			$query = '?' . $decoded_query;
		}
		$fragment = isset( $parts['fragment'] ) ? '#' . rawurldecode( (string) $parts['fragment'] ) : '';

		return $scheme . $auth . $host . $port . $path . $query . $fragment;
	}
}
