<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\InternalLinks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reference Replacer.
 * Applies verified URL, Media ID, and Media URL replacement maps to HTML, Gutenberg blocks,
 * and Elementor structures while preserving format and unmapped references.
 */
class Reference_Replacer {

	/**
	 * Apply replacement maps across all content items in the batch.
	 *
	 * @param array  $content_batch
	 * @param array  $maps {
	 *     @type array<string, string> $url_map
	 *     @type array<int, int>       $media_id_map
	 *     @type array<string, string> $media_url_map
	 * }
	 * @param string $target_language
	 * @return array Updated content batch preserving original keys and types.
	 */
	public function replace_batch( array $content_batch, array $maps, string $target_language ): array {
		$url_map       = ! empty( $maps['url_map'] ) ? (array) $maps['url_map'] : array();
		$media_id_map  = ! empty( $maps['media_id_map'] ) ? (array) $maps['media_id_map'] : array();
		$media_url_map = ! empty( $maps['media_url_map'] ) ? (array) $maps['media_url_map'] : array();

		// If no replacements were resolved, return input untouched
		if ( empty( $url_map ) && empty( $media_id_map ) && empty( $media_url_map ) ) {
			return $content_batch;
		}

		$result = array();
		foreach ( $content_batch as $key => $content ) {
			$result[ $key ] = $this->replace_content( $content, $url_map, $media_id_map, $media_url_map, $target_language );
		}

		return $result;
	}

	/**
	 * Replace references in a single content item (string or array).
	 *
	 * @param mixed  $content
	 * @param array  $url_map
	 * @param array  $media_id_map
	 * @param array  $media_url_map
	 * @param string $target_language
	 * @return mixed
	 */
	public function replace_content( $content, array $url_map, array $media_id_map, array $media_url_map, string $target_language ) {
		if ( null === $content || '' === $content || is_bool( $content ) || is_int( $content ) || is_float( $content ) ) {
			return $content;
		}

		if ( is_array( $content ) ) {
			return $this->replace_array_references( $content, $url_map, $media_id_map, $media_url_map, '' );
		}

		if ( ! is_string( $content ) ) {
			return $content;
		}

		$trimmed = trim( $content );

		// Check for Elementor JSON string
		if ( ( ( 0 === strpos( $trimmed, '[' ) ) && ( ']' === substr( $trimmed, -1 ) ) ) ||
			( ( 0 === strpos( $trimmed, '{' ) ) && ( '}' === substr( $trimmed, -1 ) ) ) ) {
			$decoded = json_decode( $trimmed, true );
			if ( is_array( $decoded ) && json_last_error() === JSON_ERROR_NONE ) {
				$updated = $this->replace_array_references( $decoded, $url_map, $media_id_map, $media_url_map, '' );
				$encoded = wp_json_encode( $updated );
				return is_string( $encoded ) ? $encoded : $content;
			}
		}

		// Gutenberg blocks and HTML
		return $this->replace_html_and_blocks( $content, $url_map, $media_id_map, $media_url_map );
	}

	/**
	 * Replace references within a structured array (e.g. Elementor settings tree).
	 *
	 * @param array  $data
	 * @param array  $url_map
	 * @param array  $media_id_map
	 * @param array  $media_url_map
	 * @param string $parent_key
	 * @param int    $depth
	 * @return array
	 */
	public function replace_array_references( array $data, array $url_map, array $media_id_map, array $media_url_map, string $parent_key = '', int $depth = 0 ): array {
		if ( $depth > 30 ) {
			return $data;
		}

		$is_media_context = (bool) preg_match( '/image|media|gallery|video|audio|background|poster|attachment|icon|slide/i', $parent_key );
		$is_link_context  = (bool) preg_match( '/link|url|button_link|website_link/i', $parent_key );

		foreach ( $data as $key => &$item ) {
			$key_str = (string) $key;

			// Never modify element IDs like '7a4b8c9' or '_id'
			if ( '_id' === $key_str || 'elType' === $key_str || 'widgetType' === $key_str ) {
				continue;
			}

			// 1. Media attachment ID in media settings
			if ( ( $is_media_context || preg_match( '/image|media|gallery|video|audio|background|poster|attachment/i', $key_str ) )
				&& in_array( $key_str, array( 'id', 'image_id', 'attachment_id' ), true )
				&& is_numeric( $item ) ) {
				$orig_id = absint( $item );
				if ( isset( $media_id_map[ $orig_id ] ) ) {
					$item = $media_id_map[ $orig_id ];
					// If parent array also has 'url' key, update it with translated attachment URL
					if ( isset( $data['url'] ) && is_string( $data['url'] ) && function_exists( 'wp_get_attachment_url' ) ) {
						$new_url = wp_get_attachment_url( $media_id_map[ $orig_id ] );
						if ( $new_url ) {
							$data['url'] = $new_url;
						}
					}
				}
				continue;
			}

			// 2. Media URL in media settings
			if ( ( $is_media_context || preg_match( '/image|media|photo|poster|background/i', $key_str ) )
				&& 'url' === $key_str
				&& is_string( $item ) ) {
				if ( isset( $media_url_map[ $item ] ) ) {
					$item = $media_url_map[ $item ];
				}
				continue;
			}

			// 3. Link URL
			if ( ( $is_link_context || in_array( $key_str, array( 'url', 'link', 'href', 'button_link', 'website_link' ), true ) )
				&& is_string( $item ) ) {
				$target = $url_map[ $item ] ?? $url_map[ rawurldecode( $item ) ] ?? null;
				if ( null !== $target ) {
					$item = $target;
				}
				continue;
			}

			// 4. Recurse into arrays
			if ( is_array( $item ) ) {
				$item = $this->replace_array_references( $item, $url_map, $media_id_map, $media_url_map, $key_str, $depth + 1 );
			} elseif ( is_string( $item ) ) {
				// Inner JSON or HTML content inside an array field
				$item = $this->replace_content( $item, $url_map, $media_id_map, $media_url_map, '' );
			}
		}
		unset( $item );

		return $data;
	}

	/**
	 * Replace references in HTML and Gutenberg blocks.
	 *
	 * @param string $content
	 * @param array  $url_map
	 * @param array  $media_id_map
	 * @param array  $media_url_map
	 * @return string
	 */
	public function replace_html_and_blocks( string $content, array $url_map, array $media_id_map, array $media_url_map ): string {
		// 1. Gutenberg block comments
		if ( false !== strpos( $content, '<!-- wp:' ) ) {
			$content = preg_replace_callback(
				'/<!--\s+wp:([a-z0-9_-]+(?:\/[a-z0-9_-]+)?)\b\s+(\{.*?\})\s*-->/s',
				function ( $matches ) use ( $url_map, $media_id_map, $media_url_map ) {
					$block_name = $matches[1];
					$attrs      = json_decode( $matches[2], true );
					if ( ! is_array( $attrs ) ) {
						return $matches[0];
					}

					$modified = false;

					// Media ID attribute (id / mediaId)
					$media_id_key = ( 'core/media-text' === $block_name ) ? 'mediaId' : 'id';
					if ( isset( $attrs[ $media_id_key ] ) && is_numeric( $attrs[ $media_id_key ] ) ) {
						$source_id = absint( $attrs[ $media_id_key ] );
						if ( isset( $media_id_map[ $source_id ] ) ) {
							$attrs[ $media_id_key ] = $media_id_map[ $source_id ];
							$modified               = true;

							// Synchronize media URL attributes if present
							$new_url = function_exists( 'wp_get_attachment_url' ) ? wp_get_attachment_url( $media_id_map[ $source_id ] ) : null;
							if ( $new_url ) {
								foreach ( array( 'url', 'href', 'mediaUrl' ) as $url_key ) {
									if ( isset( $attrs[ $url_key ] ) ) {
										$attrs[ $url_key ] = $new_url;
									}
								}
							}
						}
					}

					// Gallery block IDs: {"ids":[123,456]}
					if ( 'core/gallery' === $block_name && ! empty( $attrs['ids'] ) && is_array( $attrs['ids'] ) ) {
						foreach ( $attrs['ids'] as &$gid ) {
							$gid_int = absint( $gid );
							if ( isset( $media_id_map[ $gid_int ] ) ) {
								$gid      = $media_id_map[ $gid_int ];
								$modified = true;
							}
						}
						unset( $gid );
					}

					// Media URLs in block attributes
					foreach ( array( 'url', 'href', 'mediaUrl' ) as $m_key ) {
						if ( isset( $attrs[ $m_key ] ) && is_string( $attrs[ $m_key ] ) && isset( $media_url_map[ $attrs[ $m_key ] ] ) ) {
							$attrs[ $m_key ] = $media_url_map[ $attrs[ $m_key ] ];
							$modified        = true;
						}
					}

					// Link URLs in block attributes
					foreach ( array( 'url', 'href', 'link', 'linkUrl' ) as $l_key ) {
						if ( isset( $attrs[ $l_key ] ) && is_string( $attrs[ $l_key ] ) ) {
							$val    = $attrs[ $l_key ];
							$target = $url_map[ $val ] ?? $url_map[ rawurldecode( $val ) ] ?? null;
							if ( null !== $target ) {
								$attrs[ $l_key ] = $target;
								$modified        = true;
							}
						}
					}

					if ( $modified ) {
						$encoded = wp_json_encode( $attrs );
						if ( is_string( $encoded ) ) {
							return '<!-- wp:' . $block_name . ' ' . $encoded . ' -->';
						}
					}

					return $matches[0];
				},
				$content
			);
		}

		// 2. HTML <img> tags
		if ( ! empty( $media_id_map ) || ! empty( $media_url_map ) ) {
			$content = preg_replace_callback(
				'/<img\b[^>]*>/i',
				function ( $matches ) use ( $media_id_map, $media_url_map ) {
					$tag           = $matches[0];
					$source_id     = 0;
					$translated_id = 0;

					// Extract source ID from wp-image-*, data-id, or data-attachment-id
					if ( preg_match( '/\bwp-image-(\d+)\b/', $tag, $class_match ) ) {
						$source_id = absint( $class_match[1] );
					} elseif ( preg_match( '/\bdata-id\s*=\s*(["\'])(\d+)\1/i', $tag, $data_match ) ) {
						$source_id = absint( $data_match[2] );
					} elseif ( preg_match( '/\bdata-attachment-id\s*=\s*(["\'])(\d+)\1/i', $tag, $data_match ) ) {
						$source_id = absint( $data_match[2] );
					}

					if ( $source_id > 0 && isset( $media_id_map[ $source_id ] ) ) {
						$translated_id = $media_id_map[ $source_id ];

						// Update class wp-image-123 -> wp-image-456
						$tag = preg_replace( '/\bwp-image-' . preg_quote( (string) $source_id, '/' ) . '\b/', 'wp-image-' . $translated_id, $tag );

						// Update data-id and data-attachment-id
						$tag = preg_replace_callback(
							'/\bdata-id=(["\'])' . preg_quote( (string) $source_id, '/' ) . '\1/i',
							function ( $m ) use ( $translated_id ) {
								return 'data-id=' . $m[1] . $translated_id . $m[1];
							},
							$tag
						);
						$tag = preg_replace_callback(
							'/\bdata-attachment-id=(["\'])' . preg_quote( (string) $source_id, '/' ) . '\1/i',
							function ( $m ) use ( $translated_id ) {
								return 'data-attachment-id=' . $m[1] . $translated_id . $m[1];
							},
							$tag
						);

						// Update data-link attachment_id=123
						$tag = preg_replace( '/attachment_id=' . preg_quote( (string) $source_id, '/' ) . '\b/', 'attachment_id=' . $translated_id, $tag );
					}

					// Update src attribute
					$tag = preg_replace_callback(
						'/\bsrc\s*=\s*(["\'])(.*?)\1/i',
						function ( $src_match ) use ( $media_url_map, $translated_id ) {
							$src_url = $src_match[2];
							if ( isset( $media_url_map[ $src_url ] ) ) {
								return 'src=' . $src_match[1] . esc_url( $media_url_map[ $src_url ] ) . $src_match[1];
							}

							// If we translated the attachment ID and the src URL was not explicitly mapped
							if ( $translated_id > 0 && function_exists( 'wp_get_attachment_image_src' ) ) {
								$image = wp_get_attachment_image_src( $translated_id, 'full' );
								if ( is_array( $image ) && ! empty( $image[0] ) ) {
									return 'src=' . $src_match[1] . esc_url( $image[0] ) . $src_match[1];
								}
							}

							return $src_match[0];
						},
						$tag
					);

					// Update srcset attribute
					$tag = preg_replace_callback(
						'/\bsrcset\s*=\s*(["\'])(.*?)\1/i',
						function ( $srcset_match ) use ( $media_url_map, $translated_id ) {
							$srcset_content = $srcset_match[2];

							// If we have mapped individual candidate URLs
							if ( ! empty( $media_url_map ) ) {
								foreach ( $media_url_map as $orig_u => $trans_u ) {
									$srcset_content = str_replace( $orig_u, $trans_u, $srcset_content );
								}
							}

							// If attachment ID was translated, regenerate srcset
							if ( $translated_id > 0 && function_exists( 'wp_get_attachment_image_srcset' ) ) {
								$new_srcset = wp_get_attachment_image_srcset( $translated_id, 'full' );
								if ( is_string( $new_srcset ) && '' !== $new_srcset ) {
									return 'srcset=' . $srcset_match[1] . esc_attr( $new_srcset ) . $srcset_match[1];
								}
							}

							return 'srcset=' . $srcset_match[1] . $srcset_content . $srcset_match[1];
						},
						$tag
					);

					return $tag;
				},
				$content
			);
		}

		// 3. HTML <a> tags href replacement
		if ( ! empty( $url_map ) ) {
			$content = preg_replace_callback(
				'/\bhref\s*=\s*(["\'])(.*?)\1/i',
				function ( $matches ) use ( $url_map ) {
					$raw_url = $matches[2];
					$url     = htmlspecialchars_decode( $raw_url );
					$target  = $url_map[ $url ] ?? $url_map[ $raw_url ] ?? null;
					if ( null === $target ) {
						$target = $url_map[ rawurldecode( $url ) ] ?? null;
					}
					if ( null !== $target ) {
						return 'href=' . $matches[1] . esc_url( $target ) . $matches[1];
					}
					return $matches[0];
				},
				$content
			);
		}

		// 4. Shortcodes: [caption id="attachment_123"]
		if ( ! empty( $media_id_map ) ) {
			$content = preg_replace_callback(
				'/\[(?:caption|wp_caption)\b([^\]]*)\bid\s*=\s*(["\'])(?:attachment_)?(\d+)\2([^\]]*)\]/i',
				function ( $matches ) use ( $media_id_map ) {
					$id = absint( $matches[3] );
					if ( isset( $media_id_map[ $id ] ) ) {
						return '[caption' . $matches[1] . 'id=' . $matches[2] . 'attachment_' . $media_id_map[ $id ] . $matches[2] . $matches[4] . ']';
					}
					return $matches[0];
				},
				$content
			);

			// Shortcodes: [gallery ids="123,456"] or [playlist ids="123,456"]
			$content = preg_replace_callback(
				'/\[(gallery|playlist)\b([^\]]*)\bids\s*=\s*(["\'])([\d\s,]+)\3([^\]]*)\]/i',
				function ( $matches ) use ( $media_id_map ) {
					$shortcode_name = $matches[1];
					$before         = $matches[2];
					$quote          = $matches[3];
					$ids_str        = $matches[4];
					$after          = $matches[5];

					$ids     = explode( ',', $ids_str );
					$new_ids = array();
					foreach ( $ids as $id_val ) {
						$id_int    = absint( trim( $id_val ) );
						$new_ids[] = isset( $media_id_map[ $id_int ] ) ? $media_id_map[ $id_int ] : $id_int;
					}

					return '[' . $shortcode_name . $before . 'ids=' . $quote . implode( ',', $new_ids ) . $quote . $after . ']';
				},
				$content
			);

			// Other HTML attributes: attachment_id="123"
			$content = preg_replace_callback(
				'/\battachment_id\s*=\s*(["\'])(\d+)\1/i',
				function ( $matches ) use ( $media_id_map ) {
					$id = absint( $matches[2] );
					if ( isset( $media_id_map[ $id ] ) ) {
						return 'attachment_id=' . $matches[1] . $media_id_map[ $id ] . $matches[1];
					}
					return $matches[0];
				},
				$content
			);
		}

		// 5. Plain text internal URL replacement (e.g. links written as text or link text matching URL)
		if ( ! empty( $url_map ) ) {
			// Sort URLs by length descending to prevent partial URL replacements
			$sorted_url_map = $url_map;
			uksort(
				$sorted_url_map,
				static function ( $a, $b ) {
					return strlen( (string) $b ) <=> strlen( (string) $a );
				}
			);

			foreach ( $sorted_url_map as $orig_url => $trans_url ) {
				if ( '' === $orig_url || $orig_url === $trans_url ) {
					continue;
				}

				// Only replace absolute URLs in plain text to avoid matching relative fragments in text
				if ( 0 !== strpos( $orig_url, 'http://' ) && 0 !== strpos( $orig_url, 'https://' ) ) {
					continue;
				}

				$pattern = '/(?<![a-zA-Z0-9_])' . preg_quote( $orig_url, '/' ) . '(?![a-zA-Z0-9_\-\/?#&=%~+@])/iu';
				$content = preg_replace( $pattern, $trans_url, $content );
			}
		}

		return $content;
	}
}
