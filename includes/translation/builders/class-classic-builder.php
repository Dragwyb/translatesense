<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Builders;

use WP_Post;
use TranslateSense\Includes\Translation\Translate;
use TranslateSense\Includes\Content\Parser\Builders\Classic_Builder as Classic_Parser;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classic / Standard Post Content Translation Builder.
 *
 * Coordinates translating individual DOM translation units (block elements,
 * translatable attributes, and standalone text) and reconstructs the post HTML
 * by preserving the original source HTML structure.
 */
class Classic_Builder extends Base_Builder {

	/**
	 * Get builder slug.
	 *
	 * @return string
	 */
	public function get_builder_slug(): string {
		return 'classic';
	}

	/**
	 * Translate classic content string.
	 *
	 * Replaces translatable units at exact source slice boundaries, preserving
	 * all surrounding HTML, non-translatable attributes, formatting, and shortcodes.
	 *
	 * @param WP_Post $source_post Source post object.
	 * @param string  $source_lang Source language code.
	 * @param string  $target_lang Target language code.
	 * @param array   $custom_opts Custom options passed to the translation engine.
	 * @return string Translated HTML content.
	 */
	public function translate_content( WP_Post $source_post, string $source_lang, string $target_lang, array $custom_opts = array() ): string {
		$content = $source_post->post_content;
		if ( empty( trim( $content ) ) ) {
			return $content;
		}

		// Extract translation units with exact source offsets
		$units = class_exists( Classic_Parser::class )
			? Classic_Parser::extract_units_with_offsets( $content )
			: array();

		if ( empty( $units ) ) {
			return $content;
		}

		$replacements = array();

		foreach ( $units as $unit ) {
			$orig_val = $unit['value'];
			if ( '' === trim( (string) $orig_val ) ) {
				continue;
			}

			$res = Translate::translate_string(
				$orig_val,
				$source_lang,
				$target_lang,
				$unit['name'],
				$custom_opts
			);

			$translated = isset( $res['translated'] ) && is_string( $res['translated'] )
				? $res['translated']
				: $orig_val;

			if ( $translated !== $orig_val && '' !== trim( $translated ) ) {
				$replacement_str = 'attribute' === $unit['type']
					? htmlspecialchars( $translated, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' )
					: $translated;

				$replacements[] = array(
					'offset'      => $unit['offset'],
					'length'      => $unit['length'],
					'replacement' => $replacement_str,
				);
			}
		}

		if ( empty( $replacements ) ) {
			return $content;
		}

		// Sort replacements descending by offset so replacements don't shift earlier offsets
		usort(
			$replacements,
			static function ( array $a, array $b ): int {
				if ( $b['offset'] === $a['offset'] ) {
					return $b['length'] <=> $a['length'];
				}
				return $b['offset'] <=> $a['offset'];
			}
		);

		// Apply replacements sequentially from back to front, ensuring non-overlapping ranges
		$translated_content = $content;
		$content_len        = strlen( $content );
		$last_applied_start = PHP_INT_MAX;

		foreach ( $replacements as $r ) {
			$r_start = (int) $r['offset'];
			$r_len   = (int) $r['length'];
			$r_end   = $r_start + $r_len;

			// Skip invalid ranges or overlapping slices
			if ( $r_start < 0 || $r_len <= 0 || $r_end > $content_len || $r_end > $last_applied_start ) {
				continue;
			}

			$translated_content = substr_replace(
				$translated_content,
				$r['replacement'],
				$r_start,
				$r_len
			);

			$last_applied_start = $r_start;
		}

		return $translated_content;
	}
}
