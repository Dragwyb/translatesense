<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runtime In-Memory Cache for Internal Reference Translation.
 * Caches resolved URLs, posts, terms, media IDs, sizes, and negative lookups.
 */
class Reference_Cache {

	/**
	 * Cache of resolved internal URLs: [ normalized_url => translated_url|false ]
	 *
	 * @var array<string, string|false>
	 */
	protected $url_cache = array();

	/**
	 * Cache of translated post IDs: [ "post_id:lang" => translated_id ]
	 *
	 * @var array<string, int>
	 */
	protected $post_cache = array();

	/**
	 * Cache of translated term IDs: [ "term_id:taxonomy:lang" => translated_id ]
	 *
	 * @var array<string, int>
	 */
	protected $term_cache = array();

	/**
	 * Cache of translated media attachment IDs: [ "attachment_id:lang" => translated_id ]
	 *
	 * @var array<string, int>
	 */
	protected $media_cache = array();

	/**
	 * Cache of translated media URLs: [ "normalized_url:lang" => translated_url|false ]
	 *
	 * @var array<string, string|false>
	 */
	protected $media_url_cache = array();

	/**
	 * Cache of image size mappings: [ "attachment_id:size:lang" => array|false ]
	 *
	 * @var array<string, array|false>
	 */
	protected $image_cache = array();

	/**
	 * Check if a URL has been cached (including negative lookups).
	 *
	 * @param string $url
	 * @return bool
	 */
	public function has_url( string $url ): bool {
		return array_key_exists( $url, $this->url_cache );
	}

	/**
	 * Get cached URL translation, or null if not in cache.
	 * Returns string if translated, or false if previously resolved as untranslatable.
	 *
	 * @param string $url
	 * @return string|false|null
	 */
	public function get_url( string $url ) {
		return $this->url_cache[ $url ] ?? null;
	}

	/**
	 * Cache a URL translation result.
	 *
	 * @param string      $url
	 * @param string|null $translated_url
	 */
	public function set_url( string $url, ?string $translated_url ): void {
		$this->url_cache[ $url ] = ( null !== $translated_url && '' !== $translated_url ) ? $translated_url : false;
	}

	/**
	 * Check if a post translation has been cached.
	 *
	 * @param int    $post_id
	 * @param string $lang
	 * @return bool
	 */
	public function has_post( int $post_id, string $lang ): bool {
		return array_key_exists( $post_id . ':' . $lang, $this->post_cache );
	}

	/**
	 * Get cached translated post ID.
	 *
	 * @param int    $post_id
	 * @param string $lang
	 * @return int
	 */
	public function get_post( int $post_id, string $lang ): int {
		return $this->post_cache[ $post_id . ':' . $lang ] ?? 0;
	}

	/**
	 * Set cached translated post ID.
	 *
	 * @param int    $post_id
	 * @param string $lang
	 * @param int    $translated_id
	 */
	public function set_post( int $post_id, string $lang, int $translated_id ): void {
		$this->post_cache[ $post_id . ':' . $lang ] = $translated_id;
	}

	/**
	 * Check if a term translation has been cached.
	 *
	 * @param int    $term_id
	 * @param string $taxonomy
	 * @param string $lang
	 * @return bool
	 */
	public function has_term( int $term_id, string $taxonomy, string $lang ): bool {
		return array_key_exists( $term_id . ':' . $taxonomy . ':' . $lang, $this->term_cache );
	}

	/**
	 * Get cached translated term ID.
	 *
	 * @param int    $term_id
	 * @param string $taxonomy
	 * @param string $lang
	 * @return int
	 */
	public function get_term( int $term_id, string $taxonomy, string $lang ): int {
		return $this->term_cache[ $term_id . ':' . $taxonomy . ':' . $lang ] ?? 0;
	}

	/**
	 * Set cached translated term ID.
	 *
	 * @param int    $term_id
	 * @param string $taxonomy
	 * @param string $lang
	 * @param int    $translated_id
	 */
	public function set_term( int $term_id, string $taxonomy, string $lang, int $translated_id ): void {
		$this->term_cache[ $term_id . ':' . $taxonomy . ':' . $lang ] = $translated_id;
	}

	/**
	 * Check if a media attachment ID translation has been cached.
	 *
	 * @param int    $attachment_id
	 * @param string $lang
	 * @return bool
	 */
	public function has_media( int $attachment_id, string $lang ): bool {
		return array_key_exists( $attachment_id . ':' . $lang, $this->media_cache );
	}

	/**
	 * Get cached translated attachment ID.
	 *
	 * @param int    $attachment_id
	 * @param string $lang
	 * @return int
	 */
	public function get_media( int $attachment_id, string $lang ): int {
		return $this->media_cache[ $attachment_id . ':' . $lang ] ?? 0;
	}

	/**
	 * Set cached translated attachment ID.
	 *
	 * @param int    $attachment_id
	 * @param string $lang
	 * @param int    $translated_id
	 */
	public function set_media( int $attachment_id, string $lang, int $translated_id ): void {
		$this->media_cache[ $attachment_id . ':' . $lang ] = $translated_id;
	}

	/**
	 * Check if a media URL translation has been cached.
	 *
	 * @param string $url
	 * @param string $lang
	 * @return bool
	 */
	public function has_media_url( string $url, string $lang ): bool {
		return array_key_exists( $url . ':' . $lang, $this->media_url_cache );
	}

	/**
	 * Get cached translated media URL.
	 *
	 * @param string $url
	 * @param string $lang
	 * @return string|false|null
	 */
	public function get_media_url( string $url, string $lang ) {
		return $this->media_url_cache[ $url . ':' . $lang ] ?? null;
	}

	/**
	 * Set cached translated media URL.
	 *
	 * @param string      $url
	 * @param string      $lang
	 * @param string|null $translated_url
	 */
	public function set_media_url( string $url, string $lang, ?string $translated_url ): void {
		$this->media_url_cache[ $url . ':' . $lang ] = ( null !== $translated_url && '' !== $translated_url ) ? $translated_url : false;
	}

	/**
	 * Format size key for image cache.
	 *
	 * @param string|array $size
	 * @return string
	 */
	protected function format_size_key( $size ): string {
		if ( is_array( $size ) ) {
			return implode( 'x', $size );
		}
		return (string) $size;
	}

	/**
	 * Check if an image size mapping has been cached.
	 *
	 * @param int          $attachment_id
	 * @param string|array $size
	 * @param string       $lang
	 * @return bool
	 */
	public function has_image( int $attachment_id, $size, string $lang ): bool {
		$key = $attachment_id . ':' . $this->format_size_key( $size ) . ':' . $lang;
		return array_key_exists( $key, $this->image_cache );
	}

	/**
	 * Get cached image data.
	 *
	 * @param int          $attachment_id
	 * @param string|array $size
	 * @param string       $lang
	 * @return array|false|null
	 */
	public function get_image( int $attachment_id, $size, string $lang ) {
		$key = $attachment_id . ':' . $this->format_size_key( $size ) . ':' . $lang;
		return $this->image_cache[ $key ] ?? null;
	}

	/**
	 * Set cached image data.
	 *
	 * @param int          $attachment_id
	 * @param string|array $size
	 * @param string       $lang
	 * @param array|null   $data
	 */
	public function set_image( int $attachment_id, $size, string $lang, ?array $data ): void {
		$key                       = $attachment_id . ':' . $this->format_size_key( $size ) . ':' . $lang;
		$this->image_cache[ $key ] = ( null !== $data && ! empty( $data ) ) ? $data : false;
	}

	/**
	 * Clear all in-memory caches.
	 */
	public function clear(): void {
		$this->url_cache       = array();
		$this->post_cache      = array();
		$this->term_cache      = array();
		$this->media_cache     = array();
		$this->media_url_cache = array();
		$this->image_cache     = array();
	}
}

