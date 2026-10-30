<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translate;

use WP_Error;
use TranslateSense\Includes\Translate\Builders\Base_Builder;
use TranslateSense\Includes\Translate\Builders\Gutenberg_Builder;
use TranslateSense\Includes\Translate\Builders\Elementor_Builder;
use TranslateSense\Includes\Translate\Builders\Classic_Builder;
use TranslateSense\Includes\Editor_Integration;
use TranslateSense\Includes\Content_Parser\Content_Parser;
use TranslateSense\Includes\Content_Parser\Dom_Filter;
use TranslateSense\Includes\Hashing_Db;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core Translate Subsystem Class.
 * Coordinates full post translation, builder dispatching, string translation, and provider execution.
 */
class Translate {

	/**
	 * Registered builder instances.
	 *
	 * @var array<string, Base_Builder>
	 */
	private static $builders = array();

	/**
	 * Initialization state.
	 *
	 * @var bool
	 */
	private static $initialized = false;

	/**
	 * Initialize builder instances.
	 */
	public static function init_builders(): void {
		if ( self::$initialized ) {
			return;
		}

		self::register_builder( 'gutenberg', new Gutenberg_Builder() );
		self::register_builder( 'elementor', new Elementor_Builder() );
		self::register_builder( 'classic', new Classic_Builder() );

		self::$initialized = true;
	}

	/**
	 * Register or override a builder instance.
	 *
	 * @param string       $slug
	 * @param Base_Builder $builder
	 */
	public static function register_builder( string $slug, Base_Builder $builder ): void {
		self::$builders[ sanitize_key( $slug ) ] = $builder;
	}

	/**
	 * Get builder instance by slug.
	 *
	 * @param string $slug
	 * @return Base_Builder|null
	 */
	public static function get_builder( string $slug ): ?Base_Builder {
		self::init_builders();
		$slug = sanitize_key( $slug );
		if ( 'core' === $slug ) {
			$slug = 'gutenberg';
		}
		return self::$builders[ $slug ] ?? self::$builders['classic'] ?? null;
	}

	/**
	 * Detect builder type for post.
	 *
	 * @param mixed $content
	 * @param int   $post_id
	 * @return string
	 */
	public static function detect_builder( $content = '', int $post_id = 0 ): string {
		if ( class_exists( Content_Parser::class ) ) {
			return Content_Parser::detect_builder( $content, $post_id );
		}
		if ( $post_id > 0 && class_exists( Editor_Integration::class ) ) {
			return Editor_Integration::get_post_editor_type( $post_id );
		}
		return 'classic';
	}

	/**
	 * Translate a complete post by automatically dispatching to the appropriate builder.
	 *
	 * @param int    $post_id
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $in_memory_translations
	 * @return array|WP_Error
	 */
	public static function translate_post( int $post_id, string $target_lang, string $provider = '', array $in_memory_translations = array(), array $options = array() ) {
		if ( ! $post_id || empty( $target_lang ) ) {
			return new WP_Error( 'invalid_params', __( 'Post ID and Target Language are required.', 'translatesense' ), array( 'status' => 400 ) );
		}

		$source_post = get_post( $post_id );
		if ( ! $source_post ) {
			return new WP_Error( 'post_not_found', __( 'Post not found.', 'translatesense' ), array( 'status' => 404 ) );
		}

		$builder_slug = self::detect_builder( $source_post->post_content, $post_id );
		$builder      = self::get_builder( $builder_slug );

		if ( ! $builder ) {
			$builder = self::get_builder( 'classic' );
		}

		return $builder->translate_post( $post_id, $target_lang, $provider, $in_memory_translations, $options );
	}

	/**
	 * Translate a single string.
	 *
	 * @param string $source_string
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param string $widget_id
	 * @param int    $post_id
	 * @param array  $custom_options
	 * @return array array( 'translated' => string, 'cached' => bool, 'hash' => string )
	 */
	public static function translate_string( $source_string, $source_lang, $target_lang, $widget_id = 'generic', $post_id = 0, $custom_options = array() ) {
		if ( empty( trim( (string) $source_string ) ) || $source_lang === $target_lang || self::is_email_or_url( (string) $source_string ) ) {
			return array(
				'translated' => $source_string,
				'cached'     => true,
				'hash'       => md5( (string) $widget_id . '_' . (string) $source_string ),
			);
		}

		// Filter DOM content to extract translatable substring (matching Content_Parser extraction)
		$filtered_string = $source_string;

		$hash = Hashing_Db::generate_hash( (string) $widget_id, (string) $filtered_string );

		// Step 3.2b: Check in-memory translations (Chrome Local AI / custom maps)
		if ( ! empty( $custom_options['in_memory_translations'] ) && is_array( $custom_options['in_memory_translations'] ) ) {
			if ( isset( $custom_options['in_memory_translations'][ $hash ] ) && '' !== trim( (string) $custom_options['in_memory_translations'][ $hash ] ) ) {
				$translated_text = self::sanitize_string( $source_string, $custom_options['in_memory_translations'][ $hash ] );

				return array(
					'translated' => Dom_Filter::replace_filtered_content( (string) $source_string, $translated_text ),
					'cached'     => false,
					'hash'       => $hash,
				);
			}

			$filtered_string = Dom_Filter::filter_dom_content( (string) $source_string );

			if ( ! empty( $filtered_string ) && $filtered_string !== $source_string ) {
				$filtered_hash = Hashing_Db::generate_hash( (string) $widget_id, (string) $filtered_string );

				if ( isset( $custom_options['in_memory_translations'][ $filtered_hash ] ) && '' !== trim( (string) $custom_options['in_memory_translations'][ $filtered_hash ] ) ) {
					$translated_text = self::sanitize_string( $filtered_string, $custom_options['in_memory_translations'][ $filtered_hash ] );

					return array(
						'translated' => Dom_Filter::replace_filtered_content( (string) $source_string, $translated_text ),
						'cached'     => false,
						'hash'       => $filtered_hash,
					);
				}
			}
		}

		// Step 3.3: Check DB Cache
		$cached = Hashing_Db::get_cached_translation( $hash, $target_lang );
		if ( null !== $cached ) {
			return array(
				'translated' => Dom_Filter::replace_filtered_content( (string) $source_string, self::sanitize_string( $source_string, $cached ) ),
				'cached'     => true,
				'hash'       => $hash,
			);
		}

		if ( $filtered_string === $source_string ) {
			$filtered_string = Dom_Filter::filter_dom_content( (string) $source_string );
			$filtered_hash   = Hashing_Db::generate_hash( (string) $widget_id, (string) $filtered_string );

			// Step 3.3: Check DB Cache
			$cached = Hashing_Db::get_cached_translation( $filtered_hash, $target_lang );
			if ( null !== $cached ) {
				return array(
					'translated' => Dom_Filter::replace_filtered_content( (string) $source_string, self::sanitize_string( $source_string, $cached ) ),
					'cached'     => true,
					'hash'       => $filtered_hash,
				);
			}
		}

		return array(
			'translated' => $source_string,
			'cached'     => false,
			'hash'       => $hash,
		);
	}

	/**
	 * Sanitize translated text.
	 *
	 * @param string $text
	 * @return string
	 */

	/**
	 * Sanitize translated text nodes and replace them in the original HTML.
	 *
	 * Original HTML tags and attributes are preserved.
	 *
	 * @param string $source_string     Original HTML.
	 * @param string $translated_string Translated HTML with matching structure.
	 * @return string
	 */
	private static function sanitize_string(
		string $source_string,
		string $translated_string
	): string {
		if ( '' === $translated_string || $source_string === $translated_string ) {
			return $source_string;
		}

		$filtered_string = wp_kses_post( $translated_string );

		if ( $filtered_string === $translated_string ) {
			return $filtered_string;
		}

		$source_tokens     = self::tokenize_html( $source_string );
		$translated_tokens = self::tokenize_html( $translated_string );

		// Do not apply translations if the token structures differ.
		if ( count( $source_tokens ) !== count( $translated_tokens ) ) {
			return $source_string;
		}

		$replacements = array();
		$count        = count( $source_tokens );

		for ( $i = 0; $i < $count; $i++ ) {
			$source_token     = $source_tokens[ $i ];
			$translated_token = $translated_tokens[ $i ];

			if ( $source_token['type'] !== $translated_token['type'] ) {
				return $source_string;
			}

			// Keep original tags and attributes unchanged.
			if ( 'tag' === $source_token['type'] ) {
				if (
				self::get_tag_signature( $source_token['value'] )
				!== self::get_tag_signature( $translated_token['value'] )
				) {
					return $source_string;
				}

				continue;
			}

			$source_value     = $source_token['value'];
			$translated_value = $translated_token['value'];

			// Preserve whitespace-only nodes exactly.
			if ( '' === trim( $source_value ) ) {
				continue;
			}

			if ( $source_value === $translated_value ) {
				continue;
			}

			// Decode existing HTML entities, then safely escape text content.
			$decoded_value = html_entity_decode(
				$translated_value,
				ENT_QUOTES | ENT_HTML5,
				'UTF-8'
			);

			$safe_value = wp_kses_post( $decoded_value );

			$replacements[] = array(
				'start'            => $source_token['start'],
				'length'           => strlen( $source_value ),
				'original_value'   => $source_value,
				'translated_value' => $safe_value,
			);
		}

		// Replace from right to left so earlier byte offsets remain valid.
		usort(
			$replacements,
			static function ( $a, $b ) {
				return $b['start'] <=> $a['start'];
			}
		);

		foreach ( $replacements as $replacement ) {
			$source_string = substr_replace(
				$source_string,
				$replacement['translated_value'],
				$replacement['start'],
				$replacement['length']
			);
		}

		return $source_string === $translated_string ? $translated_string : $source_string;
	}

	/**
	 * Split HTML into tags and text nodes while recording byte offsets.
	 *
	 * This scanner recognizes quoted attributes containing ">" characters.
	 *
	 * @param string $html HTML fragment.
	 * @return array
	 */
	private static function tokenize_html( string $html ): array {
		$tokens = array();
		$length = strlen( $html );
		$offset = 0;
		$depth  = 0;

		while ( $offset < $length ) {
			if ( $depth > 200 ) {
				return array();
			}

			if ( '<' !== $html[ $offset ] ) {
				$next_tag = strpos( $html, '<', $offset );

				if ( false === $next_tag ) {
					$next_tag = $length;
				}

				$tokens[] = array(
					'type'  => 'text',
					'value' => substr( $html, $offset, $next_tag - $offset ),
					'start' => $offset,
				);

				$offset = $next_tag;
				continue;
			}

			// Handle HTML comments as indivisible tokens.
			if ( substr( $html, $offset, 4 ) === '<!--' ) {
				$comment_end = strpos( $html, '-->', $offset + 4 );

				if ( false === $comment_end ) {
					return array();
				}

				$end = $comment_end + 3;
			} else {
				$quote = null;
				$end   = null;

				for ( $i = $offset + 1; $i < $length; $i++ ) {
					$char = $html[ $i ];

					if ( null !== $quote ) {
						if ( $char === $quote ) {
							$quote = null;
						}
						continue;
					}

					if ( '"' === $char || "'" === $char ) {
						$quote = $char;
						continue;
					}

					if ( '>' === $char ) {
						$end = $i + 1;
						break;
					}
				}

				if ( null === $end ) {
					return array();
				}
			}

			$tokens[] = array(
				'type'  => 'tag',
				'value' => substr( $html, $offset, $end - $offset ),
				'start' => $offset,
			);

			$offset = $end;
			++$depth;
		}

		return $tokens;
	}

	/**
	 * Identify a tag's structural signature, ignoring its attributes.
	 *
	 * @param string $tag HTML tag token.
	 * @return string
	 */
	private static function get_tag_signature( string $tag ): string {
		if ( preg_match( '~^<\s*!\s*~', $tag ) ) {
			return strtolower( $tag );
		}

		if (
		! preg_match(
			'~^<\s*(/?)\s*([a-z][a-z0-9:-]*)\b~i',
			$tag,
			$matches
		)
		) {
			return $tag;
		}

		return strtolower( $matches[1] . $matches[2] );
	}



	/**
	 * Check if a string is an email, URL, or asset path.
	 *
	 * @param string $str
	 * @return bool
	 */
	public static function is_email_or_url( string $str ): bool {
		$trimmed = trim( wp_strip_all_tags( html_entity_decode( $str, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );

		if ( '' === $trimmed ) {
			return false;
		}

		if ( filter_var( $trimmed, FILTER_VALIDATE_EMAIL ) || 0 === stripos( $trimmed, 'mailto:' ) ) {
			return true;
		}
		if ( preg_match( '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $trimmed ) ) {
			return true;
		}
		if ( filter_var( $trimmed, FILTER_VALIDATE_URL ) ) {
			return true;
		}
		if ( preg_match( '/^(https?:\/\/|ftp:\/\/|\/\/|www\.|tel:|sms:|javascript:|callto:|whatsapp:)/i', $trimmed ) ) {
			return true;
		}
		if ( preg_match( '/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i', $trimmed ) ) {
			return true;
		}
		if ( preg_match( '/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]*$/i', $trimmed ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Translate a batch of strings.
	 *
	 * @param array  $strings_array
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param array  $custom_options
	 * @return array
	 */
	public static function translate_batch( $strings_array, $source_lang, $target_lang, $custom_options = array() ) {
		$results = array();
		$hashes  = array();

		if ( ! isset( $custom_options['provider'] ) || ! in_array( $custom_options['provider'], array( 'openai', 'google', 'gemini' ) ) ) {
			wp_send_json_error( 'Invalid provider' );
			return;
		}

		foreach ( $strings_array as $idx => $str ) {
			$hashes[ $idx ] = md5( $str );
		}

		// Step 3.2b: Check in-memory translations batch
		if ( ! empty( $custom_options['in_memory_translations'] ) && is_array( $custom_options['in_memory_translations'] ) ) {
			$in_memory = $custom_options['in_memory_translations'];
			foreach ( $strings_array as $idx => $str ) {
				$h = $hashes[ $idx ];
				if ( isset( $in_memory[ $h ] ) && '' !== trim( (string) $in_memory[ $h ] ) ) {
					$results[ $idx ] = array(
						'translated' => (string) $in_memory[ $h ],
						'cached'     => false,
						'hash'       => $h,
					);
				} elseif ( isset( $in_memory[ $str ] ) && '' !== trim( (string) $in_memory[ $str ] ) ) {
					$results[ $idx ] = array(
						'translated' => (string) $in_memory[ $str ],
						'cached'     => false,
						'hash'       => $h,
					);
				}
			}
		}

		// Step 3.3: Batch Cache Lookup for remaining uncached strings
		$remaining_hashes = array();
		foreach ( $hashes as $idx => $h ) {
			if ( ! isset( $results[ $idx ] ) ) {
				$remaining_hashes[ $idx ] = $h;
			}
		}

		$cached_map = ! empty( $remaining_hashes ) ? Hashing_Db::get_cached_translations_batch( array_values( $remaining_hashes ), $target_lang ) : array();

		$to_translate = array();
		foreach ( $strings_array as $idx => $str ) {
			if ( isset( $results[ $idx ] ) ) {
				continue;
			}

			$h = $hashes[ $idx ];
			if ( self::is_email_or_url( (string) $str ) ) {
				$results[ $idx ] = array(
					'translated' => $str,
					'cached'     => true,
					'hash'       => $h,
				);
			} elseif ( isset( $cached_map[ $h ] ) ) {
				$results[ $idx ] = array(
					'translated' => $cached_map[ $h ],
					'cached'     => true,
					'hash'       => $h,
				);
			} else {
				$to_translate[ $idx ] = $str;
			}
		}

		if ( empty( $to_translate ) ) {
			ksort( $results );
			return $results;
		}

		// Translate uncached strings via provider
		$settings = get_option( 'translatesense_settings', array() );
		$provider = $custom_options['provider'] ?? ( $settings['provider'] ?? 'openai' );

		// Execute provider batch translation preserving array keys / indices
		$translated_batch = self::execute_provider_batch_translation( $to_translate, $source_lang, $target_lang, $provider, $settings );

		if ( is_wp_error( $translated_batch ) ) {
			return $translated_batch;
		}

		foreach ( $to_translate as $idx => $str ) {
			$h     = $hashes[ $idx ];
			$trans = isset( $translated_batch[ $idx ] ) && '' !== trim( (string) $translated_batch[ $idx ] ) ? (string) $translated_batch[ $idx ] : (string) $str;

			if ( ! empty( $trans ) && self::should_cache_provider( $provider ) ) {
				Hashing_Db::save_translation_result( $h, $target_lang, $trans );
			}

			$results[ $idx ] = array(
				'translated' => $trans,
				'cached'     => false,
				'hash'       => $h,
			);
		}

		// Maintain original order
		ksort( $results );
		return $results;
	}

	/**
	 * Determine if provider results should be cached in translations table.
	 *
	 * @param string $provider
	 * @return bool
	 */
	public static function should_cache_provider( $provider ) {
		$no_cache_providers = array( 'chrome_ai', 'chrome_local_ai' );
		return ! in_array( $provider, $no_cache_providers, true );
	}

	/**
	 * Default prompt template for AI batch translation.
	 */
	public const DEFAULT_PROMPT = "You are a professional HTML-safe translator. Translate the JSON array of strings from {source_lang} to {target_lang}.\nPreserve all HTML tags, placeholders, and formatting.\nOutput ONLY a valid JSON object matching this schema: {\"translations\": [\"...\", \"...\"]}\nLength of translations array MUST EXACTLY MATCH input array length ({count} items):\n\n{json_strings}";

	/**
	 * Provider batch translation dispatcher preserving array indices.
	 *
	 * @param array  $texts Array of string indexed by key/integer [ 0 => '...', 1 => '...' ]
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param string $provider
	 * @param array  $settings
	 * @return array|WP_Error Array of translated strings with identical keys [ 0 => '...', 1 => '...' ]
	 */
	public static function execute_provider_batch_translation( array $texts, string $source_lang, string $target_lang, string $provider, array $settings ) {
		if ( empty( $texts ) ) {
			return array();
		}

		$bridge_settings                = $settings;
		$bridge_settings['source_lang'] = $source_lang;
		$bridge_settings['target_lang'] = $target_lang;
		$model                          = '';
		if ( 'openai' === $provider ) {
			$model = $settings['openai_model'] ?? 'gpt-4o-mini';
		} elseif ( 'gemini' === $provider ) {
			$model = $settings['gemini_model'] ?? 'gemini-1.5-flash';
		}

			$batch_size  = ! empty( $settings['batch_size'] ) ? max( 1, (int) $settings['batch_size'] ) : 25;
			$chunks      = array_chunk( $texts, $batch_size, true );
			$all_results = array();

		foreach ( $chunks as $chunk ) {
			$prompt = self::build_batch_translation_prompt( $source_lang, $target_lang, array_values( $chunk ), $settings );
			$res    = \TranslateSense\Includes\Ai_Connector_Bridge::get_instance()->translate_strings(
				$chunk,
				$prompt,
				$model,
				$bridge_settings,
				$provider
			);

			if ( is_wp_error( $res ) ) {
				return $res;
			}

			foreach ( $res as $idx => $val ) {
				$all_results[ $idx ] = $val;
			}
		}

		return $all_results;
	}

	/**
	 * Build standardized prompt for batch string translation.
	 *
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param array  $values_seq
	 * @param array  $settings
	 * @return string
	 */
	public static function build_batch_translation_prompt( string $source_lang, string $target_lang, array $values_seq, array $settings = array() ): string {
		$template = ! empty( $settings['custom_prompt'] ) ? (string) $settings['custom_prompt'] : self::DEFAULT_PROMPT;
		$json_str = wp_json_encode( array( 'strings' => $values_seq ) );

		$replacements = array(
			'{source_lang}'  => $source_lang,
			'{target_lang}'  => $target_lang,
			'{count}'        => count( $values_seq ),
			'{json_strings}' => $json_str,
		);

		return str_replace( array_keys( $replacements ), array_values( $replacements ), $template );
	}

	/**
	 * Parse batch AI response JSON and map back to original keys.
	 *
	 * @param string $raw_json
	 * @param array  $keys
	 * @return array|null
	 */
	public static function parse_batch_translation_json( string $raw_json, array $keys ): ?array {
		$raw_json = trim( $raw_json );
		// Strip markdown code fences if model returned them
		if ( 0 === strpos( $raw_json, '```' ) ) {
			$raw_json = preg_replace( '/^```(?:json)?\s*/i', '', $raw_json );
			$raw_json = preg_replace( '/\s*```$/', '', $raw_json );
			$raw_json = trim( $raw_json );
		}

		$decoded = json_decode( $raw_json, true );
		if ( ! is_array( $decoded ) || ! isset( $decoded['translations'] ) || ! is_array( $decoded['translations'] ) ) {
			return null;
		}

		$translations_seq = array_values( $decoded['translations'] );
		$mapped           = array();

		foreach ( $keys as $i => $orig_key ) {
			if ( isset( $translations_seq[ $i ] ) ) {
				$mapped[ $orig_key ] = (string) $translations_seq[ $i ];
			}
		}

		return ! empty( $mapped ) ? $mapped : null;
	}

	/**
	 * Send HTTP request to external AI API endpoint with error logging.
	 *
	 * @param string $url
	 * @param array  $body
	 * @param array  $headers
	 * @param int    $timeout
	 * @return string|null Response body or null on failure
	 */
	public static function send_ai_http_request( string $url, array $body, array $headers = array(), int $timeout = 30 ): ?string {
		$default_headers = array(
			'Content-Type' => 'application/json',
		);

		$request_args = array(
			'headers'     => array_merge( $default_headers, $headers ),
			'body'        => wp_json_encode( $body ),
			'timeout'     => $timeout,
			'data_format' => 'body',
		);

		$response = wp_remote_post( $url, $request_args );

		if ( is_wp_error( $response ) ) {
			return null;
		}

		$status = wp_remote_retrieve_response_code( $response );
		if ( $status < 200 || $status >= 300 ) {
			return null;
		}

		return wp_remote_retrieve_body( $response );
	}
}
