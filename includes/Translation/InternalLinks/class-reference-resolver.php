<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reference Resolver.
 * Resolves posts, terms, attachments, and URLs with Polylang APIs, runtime caching,
 * and selective bulk SQL validation.
 */
class Reference_Resolver {

	/**
	 * URL resolver instance.
	 *
	 * @var URL_Resolver
	 */
	protected $url_resolver;

	/**
	 * Media reference translator instance.
	 *
	 * @var Media_Reference_Translator
	 */
	protected $media_translator;

	/**
	 * Constructor.
	 *
	 * @param URL_Resolver|null               $url_resolver
	 * @param Media_Reference_Translator|null $media_translator
	 */
	public function __construct( ?URL_Resolver $url_resolver = null, ?Media_Reference_Translator $media_translator = null ) {
		$this->url_resolver     = $url_resolver ?: new URL_Resolver();
		$this->media_translator = $media_translator ?: new Media_Reference_Translator();
	}

	/**
	 * Resolve collected references and build verified replacement maps.
	 *
	 * @param array           $references Collected references from Reference_Collector.
	 * @param string          $target_language
	 * @param Reference_Cache $cache
	 * @return array {
	 *     @type array<string, string> $url_map       Map of original internal URLs to translated URLs.
	 *     @type array<int, int>       $media_id_map  Map of original attachment IDs to translated IDs.
	 *     @type array<string, string> $media_url_map Map of original media URLs to translated URLs.
	 * }
	 */
	public function resolve( array $references, string $target_language, Reference_Cache $cache ): array {
		$target_language = sanitize_key( $target_language );
		if ( '' === $target_language ) {
			return array(
				'url_map'       => array(),
				'media_id_map'  => array(),
				'media_url_map' => array(),
			);
		}

		$url_map       = array();
		$media_id_map  = array();
		$media_url_map = array();

		// 1. Resolve Media Attachment IDs
		$attachment_ids = ! empty( $references['attachment_ids'] ) ? (array) $references['attachment_ids'] : array();
		if ( ! empty( $attachment_ids ) ) {
			$this->bulk_validate_attachments( $attachment_ids, $cache, $target_language );

			foreach ( $attachment_ids as $aid ) {
				$aid = absint( $aid );
				if ( $aid <= 0 ) {
					continue;
				}

				$translated_id = $this->media_translator->resolve_translated_attachment_id( $aid, $target_language, $cache );
				if ( $translated_id > 0 && $translated_id !== $aid ) {
					$media_id_map[ $aid ] = $translated_id;

					// Also map original attachment full URL if available
					$orig_url   = wp_get_attachment_url( $aid );
					$target_url = wp_get_attachment_url( $translated_id );
					if ( is_string( $orig_url ) && is_string( $target_url ) && '' !== $orig_url && $orig_url !== $target_url ) {
						$media_url_map[ $orig_url ] = $target_url;
					}
				}
			}
		}

		// 2. Resolve Media URLs (thumbnails, sizes, full images)
		$media_urls = ! empty( $references['media_urls'] ) ? (array) $references['media_urls'] : array();
		foreach ( $media_urls as $m_url ) {
			if ( ! is_string( $m_url ) || '' === trim( $m_url ) ) {
				continue;
			}
			$m_url = trim( $m_url );

			$translated_m_url = $this->media_translator->resolve_translated_media_url( $m_url, $target_language, $cache );
			if ( is_string( $translated_m_url ) && '' !== $translated_m_url && $translated_m_url !== $m_url ) {
				$media_url_map[ $m_url ] = $translated_m_url;
			}
		}

		// 3. Resolve Internal URLs (Posts, Pages, CPTs, Taxonomies, Terms)
		$urls = ! empty( $references['urls'] ) ? (array) $references['urls'] : array();
		foreach ( $urls as $url ) {
			if ( ! is_string( $url ) || '' === trim( $url ) ) {
				continue;
			}
			$url = trim( $url );

			$translated_url = $this->url_resolver->resolve_translated_url( $url, $target_language, $cache );
			if ( is_string( $translated_url ) && '' !== $translated_url && $translated_url !== $url ) {
				$url_map[ $url ] = $translated_url;

				// Register decoded key if original was percent-encoded
				$decoded_url = $this->url_resolver->decode_url( $url );
				if ( $decoded_url !== $url ) {
					$url_map[ $decoded_url ] = $translated_url;
				}

				// Also register trailing slash variant if path without query/fragment
				if ( ! str_contains( $url, '?' ) && ! str_contains( $url, '#' ) ) {
					if ( str_ends_with( $url, '/' ) ) {
						$u_alt = rtrim( $url, '/' );
						$t_alt = rtrim( $translated_url, '/' );
					} else {
						$u_alt = $url . '/';
						$t_alt = str_ends_with( $translated_url, '/' ) ? $translated_url : $translated_url . '/';
					}

					if ( '' !== $u_alt && ! isset( $url_map[ $u_alt ] ) ) {
						$url_map[ $u_alt ] = $t_alt;
						$decoded_alt       = $this->url_resolver->decode_url( $u_alt );
						if ( $decoded_alt !== $u_alt ) {
							$url_map[ $decoded_alt ] = $t_alt;
						}
					}
				}
			}
		}

		return array(
			'url_map'       => $url_map,
			'media_id_map'  => $media_id_map,
			'media_url_map' => $media_url_map,
		);
	}

	/**
	 * Perform selective SQL bulk validation for discovered attachment IDs to reduce individual queries.
	 *
	 * @param int[]           $attachment_ids
	 * @param Reference_Cache $cache
	 * @param string          $target_language
	 */
	protected function bulk_validate_attachments( array $attachment_ids, Reference_Cache $cache, string $target_language ): void {
		global $wpdb;

		if ( ! is_object( $wpdb ) ) {
			return;
		}

		$uncached = array();
		foreach ( $attachment_ids as $id ) {
			$id = absint( $id );
			if ( $id > 0 && ! $cache->has_media( $id, $target_language ) ) {
				$uncached[] = $id;
			}
		}

		$uncached = array_values( array_unique( $uncached ) );
		if ( count( $uncached ) <= 1 ) {
			return;
		}

		// Chunk large batches to stay safely within SQL parameter limits
		$chunks = array_chunk( $uncached, 100 );
		foreach ( $chunks as $chunk ) {
			$placeholders = implode( ',', array_fill( 0, count( $chunk ), '%d' ) );
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Placeholders dynamically constructed with %d.
			$query = $wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE ID IN ($placeholders) AND post_type = %s",
				array_merge( $chunk, array( 'attachment' ) )
			);

			$valid_ids = $wpdb->get_col( $query );
			$valid_map = array_flip( array_map( 'intval', (array) $valid_ids ) );

			// Mark invalid IDs in cache so no further queries are performed
			foreach ( $chunk as $check_id ) {
				if ( ! isset( $valid_map[ $check_id ] ) ) {
					$cache->set_media( $check_id, $target_language, 0 );
				}
			}
		}
	}
}
