<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Media Reference Translator.
 * Handles attachment ID translation, thumbnail resolution, registered size detection,
 * responsive srcset generation, and translation without creating new attachments automatically.
 */
class Media_Reference_Translator {

	/**
	 * Resolve translated attachment ID for a given source attachment ID.
	 * Returns 0 if no translation exists or object is invalid.
	 *
	 * @param int             $attachment_id
	 * @param string          $target_language
	 * @param Reference_Cache $cache
	 * @return int
	 */
	public function resolve_translated_attachment_id( int $attachment_id, string $target_language, Reference_Cache $cache ): int {
		if ( $attachment_id <= 0 ) {
			return 0;
		}

		if ( $cache->has_media( $attachment_id, $target_language ) ) {
			return $cache->get_media( $attachment_id, $target_language );
		}

		// Validate that the source object is indeed an attachment
		$source = get_post( $attachment_id );
		if ( ! $source instanceof WP_Post || 'attachment' !== $source->post_type ) {
			$cache->set_media( $attachment_id, $target_language, 0 );
			return 0;
		}

		$translated_id = 0;
		if ( function_exists( 'pll_get_post' ) ) {
			$translated_id = (int) pll_get_post( $attachment_id, $target_language );
		}

		// Validate translated object
		if ( $translated_id > 0 && $translated_id !== $attachment_id ) {
			$target = get_post( $translated_id );
			if ( $target instanceof WP_Post && 'attachment' === $target->post_type && 'trash' !== $target->post_status ) {
				$cache->set_media( $attachment_id, $target_language, $translated_id );
				return $translated_id;
			}
		}

		// Never auto-create media translations
		$cache->set_media( $attachment_id, $target_language, 0 );
		return 0;
	}

	/**
	 * Identify the original attachment ID and image size from an image URL.
	 * Handles both full uploads and generated intermediate thumbnail sizes (e.g. image-150x150.png).
	 *
	 * @param string $url
	 * @return array|null { 'attachment_id' => int, 'size' => string|array }
	 */
	public function resolve_attachment_from_url( string $url ): ?array {
		$clean_url = preg_replace( '/[?#].*$/', '', trim( $url ) );
		if ( '' === $clean_url ) {
			return null;
		}

		// 1. Check for intermediate dimension suffix first: -(\d+)x(\d+)\.ext
		if ( preg_match( '/^(.*?)-(\d+)x(\d+)\.([a-zA-Z0-9]+)$/', $clean_url, $dim_match ) ) {
			$base_url = $dim_match[1] . '.' . $dim_match[4];
			$width    = absint( $dim_match[2] );
			$height   = absint( $dim_match[3] );

			$id = function_exists( 'attachment_url_to_postid' ) ? attachment_url_to_postid( $base_url ) : 0;
			if ( $id <= 0 ) {
				// Also check if base had "-scaled" suffix
				$scaled_url = $dim_match[1] . '-scaled.' . $dim_match[4];
				$id         = function_exists( 'attachment_url_to_postid' ) ? attachment_url_to_postid( $scaled_url ) : 0;
			}

			if ( $id > 0 && 'attachment' === get_post_type( $id ) ) {
				$matched_size = $this->find_registered_size_name( $id, $width, $height, basename( $clean_url ) );
				return array(
					'attachment_id' => $id,
					'size'          => $matched_size ?: array( $width, $height ),
				);
			}
		}

		// 2. Direct full attachment lookup
		if ( function_exists( 'attachment_url_to_postid' ) ) {
			$id = attachment_url_to_postid( $clean_url );
			if ( $id > 0 && 'attachment' === get_post_type( $id ) ) {
				return array(
					'attachment_id' => $id,
					'size'          => 'full',
				);
			}
		}

		return null;
	}

	/**
	 * Find registered size slug (e.g. 'thumbnail', 'medium', 'large') from attachment metadata.
	 *
	 * @param int    $attachment_id
	 * @param int    $width
	 * @param int    $height
	 * @param string $filename
	 * @return string|null
	 */
	protected function find_registered_size_name( int $attachment_id, int $width, int $height, string $filename ): ?string {
		$meta = wp_get_attachment_metadata( $attachment_id );
		if ( ! is_array( $meta ) || empty( $meta['sizes'] ) || ! is_array( $meta['sizes'] ) ) {
			return null;
		}

		foreach ( $meta['sizes'] as $size_name => $size_info ) {
			if ( ! is_array( $size_info ) ) {
				continue;
			}

			if ( ! empty( $size_info['file'] ) && $size_info['file'] === $filename ) {
				return (string) $size_name;
			}

			if ( ! empty( $size_info['width'] ) && ! empty( $size_info['height'] ) &&
				absint( $size_info['width'] ) === $width && absint( $size_info['height'] ) === $height ) {
				return (string) $size_name;
			}
		}

		return null;
	}

	/**
	 * Resolve translated image URL from original image URL.
	 *
	 * @param string          $url
	 * @param string          $target_language
	 * @param Reference_Cache $cache
	 * @return string|null
	 */
	public function resolve_translated_media_url( string $url, string $target_language, Reference_Cache $cache ): ?string {
		$clean_url = preg_replace( '/[?#].*$/', '', trim( $url ) );
		if ( '' === $clean_url ) {
			return null;
		}

		if ( $cache->has_media_url( $clean_url, $target_language ) ) {
			$cached = $cache->get_media_url( $clean_url, $target_language );
			return is_string( $cached ) ? $cached : null;
		}

		$ref = $this->resolve_attachment_from_url( $clean_url );
		if ( ! $ref ) {
			$cache->set_media_url( $clean_url, $target_language, null );
			return null;
		}

		$translated_id = $this->resolve_translated_attachment_id( (int) $ref['attachment_id'], $target_language, $cache );
		if ( $translated_id <= 0 ) {
			$cache->set_media_url( $clean_url, $target_language, null );
			return null;
		}

		$size           = $ref['size'];
		$img_data       = wp_get_attachment_image_src( $translated_id, $size );
		$translated_url = null;

		if ( is_array( $img_data ) && ! empty( $img_data[0] ) ) {
			$translated_url = $img_data[0];
		} else {
			// Fallback to full size
			$full_data = wp_get_attachment_image_src( $translated_id, 'full' );
			if ( is_array( $full_data ) && ! empty( $full_data[0] ) ) {
				$translated_url = $full_data[0];
			}
		}

		$cache->set_media_url( $clean_url, $target_language, $translated_url );
		return $translated_url;
	}

	/**
	 * Get full translated image reference data (id, url, srcset).
	 *
	 * @param int             $source_attachment_id
	 * @param string|array    $size
	 * @param string          $target_language
	 * @param Reference_Cache $cache
	 * @return array|null { 'id' => int, 'url' => string, 'srcset' => string|false }
	 */
	public function get_translated_image_data( int $source_attachment_id, $size, string $target_language, Reference_Cache $cache ): ?array {
		if ( $source_attachment_id <= 0 ) {
			return null;
		}

		if ( $cache->has_image( $source_attachment_id, $size, $target_language ) ) {
			$cached = $cache->get_image( $source_attachment_id, $size, $target_language );
			return is_array( $cached ) ? $cached : null;
		}

		$translated_id = $this->resolve_translated_attachment_id( $source_attachment_id, $target_language, $cache );
		if ( $translated_id <= 0 ) {
			$cache->set_image( $source_attachment_id, $size, $target_language, null );
			return null;
		}

		$src_info = wp_get_attachment_image_src( $translated_id, $size );
		if ( ! is_array( $src_info ) || empty( $src_info[0] ) ) {
			$src_info = wp_get_attachment_image_src( $translated_id, 'full' );
		}

		if ( ! is_array( $src_info ) || empty( $src_info[0] ) ) {
			$cache->set_image( $source_attachment_id, $size, $target_language, null );
			return null;
		}

		$srcset = function_exists( 'wp_get_attachment_image_srcset' )
			? wp_get_attachment_image_srcset( $translated_id, $size )
			: false;

		$data = array(
			'id'     => $translated_id,
			'url'    => $src_info[0],
			'srcset' => $srcset ?: '',
		);

		$cache->set_image( $source_attachment_id, $size, $target_language, $data );
		return $data;
	}
}
