<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reference Collector.
 * Extracts and deduplicates unique internal URLs, attachment IDs, and media URLs across content batches.
 * Pure extractor: does not perform any database lookups.
 */
class Reference_Collector {

	/**
	 * Collect all unique references from a content batch.
	 *
	 * @param array $content_batch Associative array of content strings or structures.
	 * @return array {
	 *     @type string[] $urls           Unique internal candidate URLs.
	 *     @type int[]    $attachment_ids Unique attachment IDs.
	 *     @type string[] $media_urls     Unique media/image URLs.
	 * }
	 */
	public function collect( array $content_batch ): array {
		$urls           = array();
		$attachment_ids = array();
		$media_urls     = array();

		foreach ( $content_batch as $content ) {
			$this->extract_from_value( $content, $urls, $attachment_ids, $media_urls );
		}

		return array(
			'urls'           => array_values( array_unique( array_filter( $urls, 'is_string' ) ) ),
			'attachment_ids' => array_values( array_unique( array_filter( array_map( 'absint', $attachment_ids ) ) ) ),
			'media_urls'     => array_values( array_unique( array_filter( $media_urls, 'is_string' ) ) ),
		);
	}

	/**
	 * Recursively extract references from arbitrary value.
	 *
	 * @param mixed    $value
	 * @param string[] $urls
	 * @param int[]    $attachment_ids
	 * @param string[] $media_urls
	 * @param string   $parent_key
	 * @param int      $depth
	 */
	protected function extract_from_value( $value, array &$urls, array &$attachment_ids, array &$media_urls, string $parent_key = '', int $depth = 0 ): void {
		if ( $depth > 30 || null === $value ) {
			return;
		}

		if ( is_string( $value ) ) {
			$trimmed = trim( $value );
			if ( '' === $trimmed ) {
				return;
			}

			// Check if string is JSON data (e.g. Elementor data)
			if ( ( ( 0 === strpos( $trimmed, '[' ) ) && ( ']' === substr( $trimmed, -1 ) ) ) ||
				( ( 0 === strpos( $trimmed, '{' ) ) && ( '}' === substr( $trimmed, -1 ) ) ) ) {
				$decoded = json_decode( $trimmed, true );
				if ( is_array( $decoded ) && json_last_error() === JSON_ERROR_NONE ) {
					$this->extract_from_array( $decoded, $urls, $attachment_ids, $media_urls, $parent_key, $depth + 1 );
					return;
				}
			}

			// Standard text / HTML / Gutenberg content
			$this->extract_from_html_and_blocks( $trimmed, $urls, $attachment_ids, $media_urls );
			return;
		}

		if ( is_array( $value ) ) {
			$this->extract_from_array( $value, $urls, $attachment_ids, $media_urls, $parent_key, $depth + 1 );
		}
	}

	/**
	 * Extract references from structured array (e.g. Elementor or block trees).
	 *
	 * @param array    $data
	 * @param string[] $urls
	 * @param int[]    $attachment_ids
	 * @param string[] $media_urls
	 * @param string   $parent_key
	 * @param int      $depth
	 */
	protected function extract_from_array( array $data, array &$urls, array &$attachment_ids, array &$media_urls, string $parent_key = '', int $depth = 0 ): void {
		$is_media_context = (bool) preg_match( '/image|media|gallery|video|audio|background|poster|attachment|icon|slide/i', $parent_key );

		foreach ( $data as $key => $item ) {
			$key_str = (string) $key;

			// Check media IDs in media contexts
			if ( ( $is_media_context || preg_match( '/image|media|gallery|video|audio|background|poster|attachment/i', $key_str ) )
				&& in_array( $key_str, array( 'id', 'image_id', 'attachment_id' ), true )
				&& is_numeric( $item ) ) {
				$id = absint( $item );
				if ( $id > 0 ) {
					$attachment_ids[] = $id;
				}
				continue;
			}

			// Check media URLs in media contexts
			if ( ( $is_media_context || preg_match( '/image|media|photo|poster|background/i', $key_str ) )
				&& 'url' === $key_str
				&& is_string( $item ) && '' !== trim( $item ) ) {
				$media_urls[] = trim( $item );
				continue;
			}

			// Check link URLs
			if ( in_array( $key_str, array( 'url', 'link', 'href', 'button_link', 'website_link' ), true )
				&& is_string( $item ) && '' !== trim( $item ) ) {
				$urls[] = trim( $item );
				continue;
			}

			// Recurse into arrays
			if ( is_array( $item ) ) {
				$this->extract_from_array( $item, $urls, $attachment_ids, $media_urls, $key_str, $depth + 1 );
			} elseif ( is_string( $item ) ) {
				$this->extract_from_value( $item, $urls, $attachment_ids, $media_urls, $key_str, $depth + 1 );
			}
		}
	}

	/**
	 * Extract references from HTML content and Gutenberg blocks.
	 *
	 * @param string   $content
	 * @param string[] $urls
	 * @param int[]    $attachment_ids
	 * @param string[] $media_urls
	 */
	protected function extract_from_html_and_blocks( string $content, array &$urls, array &$attachment_ids, array &$media_urls ): void {
		// 1. Gutenberg block comment attributes
		if ( false !== strpos( $content, '<!-- wp:' ) ) {
			// Image block: <!-- wp:image {"id":123,...} -->
			if ( preg_match_all( '/<!--\s+wp:(?:image|cover|video|audio|file)\b\s+(\{.*?\})\s*-->/s', $content, $block_matches ) ) {
				foreach ( $block_matches[1] as $json_str ) {
					$attrs = json_decode( $json_str, true );
					if ( is_array( $attrs ) ) {
						if ( ! empty( $attrs['id'] ) && is_numeric( $attrs['id'] ) ) {
							$attachment_ids[] = absint( $attrs['id'] );
						}
						foreach ( array( 'url', 'href', 'mediaUrl' ) as $url_attr ) {
							if ( ! empty( $attrs[ $url_attr ] ) && is_string( $attrs[ $url_attr ] ) ) {
								$media_urls[] = trim( $attrs[ $url_attr ] );
							}
						}
						if ( ! empty( $attrs['link'] ) && is_string( $attrs['link'] ) ) {
							$urls[] = trim( $attrs['link'] );
						}
					}
				}
			}

			// Media-text block: <!-- wp:media-text {"mediaId":123,...} -->
			if ( preg_match_all( '/<!--\s+wp:media-text\b\s+(\{.*?\})\s*-->/s', $content, $media_text_matches ) ) {
				foreach ( $media_text_matches[1] as $json_str ) {
					$attrs = json_decode( $json_str, true );
					if ( is_array( $attrs ) ) {
						if ( ! empty( $attrs['mediaId'] ) && is_numeric( $attrs['mediaId'] ) ) {
							$attachment_ids[] = absint( $attrs['mediaId'] );
						}
						if ( ! empty( $attrs['mediaUrl'] ) && is_string( $attrs['mediaUrl'] ) ) {
							$media_urls[] = trim( $attrs['mediaUrl'] );
						}
					}
				}
			}

			// Gallery block: <!-- wp:gallery {"ids":[123,456],...} -->
			if ( preg_match_all( '/<!--\s+wp:gallery\b\s+(\{.*?\})\s*-->/s', $content, $gallery_matches ) ) {
				foreach ( $gallery_matches[1] as $json_str ) {
					$attrs = json_decode( $json_str, true );
					if ( is_array( $attrs ) && ! empty( $attrs['ids'] ) && is_array( $attrs['ids'] ) ) {
						foreach ( $attrs['ids'] as $gid ) {
							if ( is_numeric( $gid ) ) {
								$attachment_ids[] = absint( $gid );
							}
						}
					}
				}
			}

			// Block link attributes: <!-- wp:button {"url":"..."} --> or others
			if ( preg_match_all( '/<!--\s+wp:[a-z0-9_-]+\b\s+(\{.*?\})\s*-->/s', $content, $all_block_matches ) ) {
				foreach ( $all_block_matches[1] as $json_str ) {
					$attrs = json_decode( $json_str, true );
					if ( is_array( $attrs ) ) {
						foreach ( array( 'url', 'href', 'linkUrl' ) as $link_key ) {
							if ( ! empty( $attrs[ $link_key ] ) && is_string( $attrs[ $link_key ] ) ) {
								$urls[] = trim( $attrs[ $link_key ] );
							}
						}
					}
				}
			}
		}

		// 2. HTML href attributes: <a href="...">
		if ( preg_match_all( '/\bhref\s*=\s*(["\'])(.*?)\1/i', $content, $href_matches ) ) {
			foreach ( $href_matches[2] as $href ) {
				$href = trim( $href );
				if ( '' !== $href && 0 !== strpos( $href, '#' ) && 0 !== strpos( $href, 'javascript:' ) && 0 !== strpos( $href, 'mailto:' ) && 0 !== strpos( $href, 'tel:' ) ) {
					$urls[] = $href;
				}
			}
		}

		// 3. HTML img tags: wp-image-*, data-id, data-attachment-id, attachment_id, src, srcset
		if ( preg_match_all( '/<img\b[^>]*>/i', $content, $img_matches ) ) {
			foreach ( $img_matches[0] as $img_tag ) {
				// Attachment ID from wp-image-123 class
				if ( preg_match( '/\bwp-image-(\d+)\b/', $img_tag, $class_match ) ) {
					$attachment_ids[] = absint( $class_match[1] );
				}

				// data-id="123"
				if ( preg_match( '/\bdata-id\s*=\s*(["\'])(\d+)\1/i', $img_tag, $data_match ) ) {
					$attachment_ids[] = absint( $data_match[2] );
				}

				// data-attachment-id="123"
				if ( preg_match( '/\bdata-attachment-id\s*=\s*(["\'])(\d+)\1/i', $img_tag, $data_match ) ) {
					$attachment_ids[] = absint( $data_match[2] );
				}

				// src="..."
				if ( preg_match( '/\bsrc\s*=\s*(["\'])(.*?)\1/i', $img_tag, $src_match ) ) {
					$src = trim( $src_match[2] );
					if ( '' !== $src && 0 !== strpos( $src, 'data:' ) ) {
						$media_urls[] = $src;
					}
				}

				// srcset="..."
				if ( preg_match( '/\bsrcset\s*=\s*(["\'])(.*?)\1/i', $img_tag, $srcset_match ) ) {
					$candidates = explode( ',', $srcset_match[2] );
					foreach ( $candidates as $candidate ) {
						$parts = preg_split( '/\s+/', trim( $candidate ) );
						if ( ! empty( $parts[0] ) && 0 !== strpos( $parts[0], 'data:' ) ) {
							$media_urls[] = $parts[0];
						}
					}
				}
			}
		}

		// 4. Other HTML elements with attachment_id or data-link
		if ( preg_match_all( '/\battachment_id\s*=\s*(["\'])(\d+)\1/i', $content, $att_matches ) ) {
			foreach ( $att_matches[2] as $aid ) {
				$attachment_ids[] = absint( $aid );
			}
		}

		if ( preg_match_all( '/\bdata-link\s*=\s*(["\'])(.*?)\1/i', $content, $link_matches ) ) {
			foreach ( $link_matches[2] as $link_val ) {
				if ( preg_match( '/attachment_id=(\d+)/', $link_val, $link_aid ) ) {
					$attachment_ids[] = absint( $link_aid[1] );
				}
			}
		}

		// 5. Shortcodes
		// [caption id="attachment_123"]
		if ( preg_match_all( '/\[(?:caption|wp_caption)\b[^\]]*\bid\s*=\s*(["\'])(?:attachment_)?(\d+)\1[^\]]*\]/i', $content, $caption_matches ) ) {
			foreach ( $caption_matches[2] as $cid ) {
				$attachment_ids[] = absint( $cid );
			}
		}

		// [gallery ids="123,456"] or [playlist ids="123,456"]
		if ( preg_match_all( '/\[(?:gallery|playlist)\b[^\]]*\bids\s*=\s*(["\'])([\d\s,]+)\1[^\]]*\]/i', $content, $gallery_sc_matches ) ) {
			foreach ( $gallery_sc_matches[2] as $ids_str ) {
				$raw_ids = explode( ',', $ids_str );
				foreach ( $raw_ids as $rid ) {
					$rid = absint( trim( $rid ) );
					if ( $rid > 0 ) {
						$attachment_ids[] = $rid;
					}
				}
			}
		}

		// 6. Plain text URLs in content (e.g. user added a link as text in content)
		if ( preg_match_all( '/(?:\bhttps?:\/\/|\bwww\.)[^\s<>"\'{}|\\\\^`]+[^\s<>"\'{}|\\\\^`.,;:?!)\'"]/iu', $content, $text_url_matches ) ) {
			foreach ( $text_url_matches[0] as $t_url ) {
				$t_url = trim( $t_url );
				if ( '' !== $t_url ) {
					$urls[] = $t_url;
				}
			}
		}
	}
}

