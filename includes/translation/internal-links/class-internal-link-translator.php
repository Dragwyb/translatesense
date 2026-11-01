<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main Controller for Internal Link & Media Reference Translation.
 * Coordinates batch extraction, deduplication, resolution with Polylang APIs,
 * format-aware replacements, and runtime caching.
 */
class Internal_Link_Translator {

	/**
	 * Reference cache instance.
	 *
	 * @var Reference_Cache
	 */
	protected $cache;

	/**
	 * Reference collector instance.
	 *
	 * @var Reference_Collector
	 */
	protected $collector;

	/**
	 * Media reference translator instance.
	 *
	 * @var Media_Reference_Translator
	 */
	protected $media_translator;

	/**
	 * URL resolver instance.
	 *
	 * @var URL_Resolver
	 */
	protected $url_resolver;

	/**
	 * Reference resolver instance.
	 *
	 * @var Reference_Resolver
	 */
	protected $resolver;

	/**
	 * Reference replacer instance.
	 *
	 * @var Reference_Replacer
	 */
	protected $replacer;

	/**
	 * Most recent replacement maps generated during translate_batch().
	 *
	 * @var array
	 */
	protected $last_replacement_maps = array();

	/**
	 * Constructor.
	 *
	 * @param Reference_Cache|null $cache Optional cache instance to share across batches.
	 */
	public function __construct( $cache = null ) {
		$this->cache            = ( $cache instanceof Reference_Cache ) ? $cache : new Reference_Cache();
		$this->collector        = new Reference_Collector();
		$this->media_translator = new Media_Reference_Translator();
		$this->url_resolver     = new URL_Resolver();
		$this->resolver         = new Reference_Resolver( $this->url_resolver, $this->media_translator );
		$this->replacer         = new Reference_Replacer();
	}

	/**
	 * Translate internal references across a batch of content items.
	 *
	 * Pipeline:
	 * 1. Collect and deduplicate unique references across the entire content batch.
	 * 2. Resolve URLs and media references once per unique item using Polylang APIs and runtime cache.
	 * 3. Build verified replacement maps.
	 * 4. Apply format-aware replacements across all content strings in the batch.
	 * 5. Return updated content structure preserving original keys and types.
	 *
	 * @param array  $content_batch   Associative array of content items (e.g. ['post_content' => ..., 'elementor' => ...]).
	 * @param string $target_language Polylang target language slug.
	 * @return array Updated content array. Original values preserved if untranslated.
	 */
	public function translate_batch( array $content_batch, string $target_language ): array {
		if ( empty( $content_batch ) ) {
			return $content_batch;
		}

		$target_language = sanitize_key( $target_language );
		if ( '' === $target_language ) {
			return $content_batch;
		}

		// 1. Collect references from the complete content batch
		$references = $this->collector->collect( $content_batch );

		$has_refs = ! empty( $references['urls'] ) || ! empty( $references['attachment_ids'] ) || ! empty( $references['media_urls'] );
		if ( ! $has_refs ) {
			$this->last_replacement_maps = array(
				'url_map'       => array(),
				'media_id_map'  => array(),
				'media_url_map' => array(),
			);
			return $content_batch;
		}

		// 2. Resolve unique references and build verified replacement maps
		if ( ! $this->cache instanceof Reference_Cache ) {
			$this->cache = new Reference_Cache();
		}
		$maps                        = $this->resolver->resolve( $references, $target_language, $this->cache );
		$this->last_replacement_maps = $maps;

		$has_replacements = ! empty( $maps['url_map'] ) || ! empty( $maps['media_id_map'] ) || ! empty( $maps['media_url_map'] );
		if ( ! $has_replacements ) {
			return $content_batch;
		}

		// 3. Apply replacement maps across all content items
		return $this->replacer->replace_batch( $content_batch, $maps, $target_language );
	}

	/**
	 * Clean all in-memory caches and stored replacement maps on this object.
	 */
	public function clean_cache(): void {
		if ( $this->cache instanceof Reference_Cache ) {
			$this->cache->clear();
		} else {
			$this->cache = new Reference_Cache();
		}
		$this->last_replacement_maps = array();
	}

	/**
	 * Get the active runtime cache instance.
	 *
	 * @return Reference_Cache
	 */
	public function get_cache(): Reference_Cache {
		if ( ! $this->cache instanceof Reference_Cache ) {
			$this->cache = new Reference_Cache();
		}
		return $this->cache;
	}

	/**
	 * Get the replacement maps generated during the last batch translation.
	 *
	 * @return array {
	 *     @type array<string, string> $url_map
	 *     @type array<int, int>       $media_id_map
	 *     @type array<string, string> $media_url_map
	 * }
	 */
	public function get_last_replacement_maps(): array {
		return $this->last_replacement_maps;
	}
}
