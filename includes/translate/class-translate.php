<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translate;

use WP_Error;
use TranslateSense\Includes\Translate\Builders\Base_Builder;
use TranslateSense\Includes\Translate\Builders\Gutenberg_Builder;
use TranslateSense\Includes\Translate\Builders\Elementor_Builder;
use TranslateSense\Includes\Translate\Builders\Divi_Builder;
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
		self::register_builder( 'divi', new Divi_Builder() );
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
	public static function translate_post( int $post_id, string $target_lang, string $provider = '', array $in_memory_translations = array() ) {
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

		return $builder->translate_post( $post_id, $target_lang, $provider, $in_memory_translations );
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
				$translated_text = (string) $custom_options['in_memory_translations'][ $hash ];
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
					$translated_text = (string) $custom_options['in_memory_translations'][ $filtered_hash ];
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
				'translated' => Dom_Filter::replace_filtered_content( (string) $source_string, $cached ),
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
					'translated' => Dom_Filter::replace_filtered_content( (string) $source_string, $cached ),
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
	 * Check if a string is an email, URL, or asset path.
	 *
	 * @param string $str
	 * @return bool
	 */
	public static function is_email_or_url( string $str ): bool {
		$trimmed = trim( strip_tags( html_entity_decode( $str, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );

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
	 * @param array  $widget_ids
	 * @param int    $post_id
	 * @param array  $custom_options
	 * @return array
	 */
	public static function translate_batch( $strings_array, $source_lang, $target_lang, $widget_ids = array(), $post_id = 0, $custom_options = array() ) {
		$results = array();
		$hashes  = array();

		foreach ( $strings_array as $idx => $str ) {
			$w_id           = $widget_ids[ $idx ] ?? ( 'batch_' . $idx );
			$hashes[ $idx ] = Hashing_Db::generate_hash( (string) $w_id, (string) $str );
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

		foreach ( $to_translate as $idx => $str ) {
			$h = $hashes[ $idx ];

			$trans = self::execute_provider_translation( (string) $str, $source_lang, $target_lang, $provider, $settings );
			if ( ! empty( $trans ) ) {
				if ( self::should_cache_provider( $provider ) ) {
					Hashing_Db::save_translation_result( $h, $target_lang, $trans );
				}
				$results[ $idx ] = array(
					'translated' => $trans,
					'cached'     => false,
					'hash'       => $h,
				);
			} else {
				$results[ $idx ] = array(
					'translated' => $str,
					'cached'     => false,
					'hash'       => $h,
				);
			}
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
	 * Provider translation dispatcher.
	 */
	private static function execute_provider_translation( $text, $source_lang, $target_lang, $provider, $settings ) {
		switch ( $provider ) {
			case 'openai':
				return self::translate_openai( $text, $source_lang, $target_lang, $settings['openai_api_key'] ?? '', $settings['openai_model'] ?? 'gpt-4o-mini' );

			case 'gemini':
				return self::translate_gemini( $text, $source_lang, $target_lang, $settings['gemini_api_key'] ?? '', $settings['gemini_model'] ?? 'gemini-1.5-flash' );

			case 'chrome_ai':
			case 'chrome_local_ai':
			default:
				// Fallback server translation endpoint using public translation API
				return self::translate_public_engine( $text, $source_lang, $target_lang );
		}
	}

	/**
	 * OpenAI ChatGPT Translation API.
	 */
	private static function translate_openai( $text, $source_lang, $target_lang, $api_key, $model = 'gpt-4o-mini' ) {
		if ( empty( $api_key ) ) {
			return self::translate_public_engine( $text, $source_lang, $target_lang );
		}

		$url      = 'https://api.openai.com/v1/chat/completions';
		$messages = array(
			array(
				'role'    => 'system',
				'content' => sprintf( 'You are a professional HTML-safe translator. Translate the text accurately from %s to %s. Preserve all HTML tags, placeholders, and formatting. Return ONLY the translated string without quotes or commentary.', $source_lang, $target_lang ),
			),
			array(
				'role'    => 'user',
				'content' => $text,
			),
		);

		$body = array(
			'model'       => ! empty( $model ) ? $model : 'gpt-4o-mini',
			'messages'    => $messages,
			'temperature' => 0.2,
		);

		$response = wp_remote_post(
			$url,
			array(
				'body'    => wp_json_encode( $body ),
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type'  => 'application/json',
				),
				'timeout' => 20,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $text;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( isset( $data['choices'][0]['message']['content'] ) ) {
			return trim( $data['choices'][0]['message']['content'] );
		}

		return $text;
	}

	/**
	 * Google Gemini AI Translation API.
	 */
	private static function translate_gemini( $text, $source_lang, $target_lang, $api_key, $model = 'gemini-1.5-flash' ) {
		if ( empty( $api_key ) ) {
			return self::translate_public_engine( $text, $source_lang, $target_lang );
		}

		$model_name = ! empty( $model ) ? $model : 'gemini-1.5-flash';
		$url        = 'https://generativelanguage.googleapis.com/v1beta/models/' . urlencode( $model_name ) . ':generateContent?key=' . urlencode( $api_key );

		$prompt = sprintf( "You are a professional translator. Translate the following text from %s to %s. Preserve all HTML tags, placeholders, and formatting. Output ONLY the translated content without any extra text:\n\n%s", $source_lang, $target_lang, $text );

		$body = array(
			'contents'         => array(
				array(
					'parts' => array(
						array( 'text' => $prompt ),
					),
				),
			),
			'generationConfig' => array(
				'temperature' => 0.2,
			),
		);

		$response = wp_remote_post(
			$url,
			array(
				'body'    => wp_json_encode( $body ),
				'headers' => array( 'Content-Type' => 'application/json' ),
				'timeout' => 20,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $text;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( isset( $data['candidates'][0]['content']['parts'][0]['text'] ) ) {
			return trim( $data['candidates'][0]['content']['parts'][0]['text'] );
		}

		return $text;
	}

	/**
	 * Free/Public Translation Engine fallback.
	 */
	private static function translate_public_engine( $text, $source_lang, $target_lang ) {
		$sl = substr( $source_lang, 0, 2 );
		$tl = substr( $target_lang, 0, 2 );

		$url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' . urlencode( $sl ) . '&tl=' . urlencode( $tl ) . '&dt=t&q=' . urlencode( $text );

		$response = wp_remote_get(
			$url,
			array(
				'timeout'    => 10,
				'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			)
		);

		if ( is_wp_error( $response ) ) {
			return $text;
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( is_array( $data ) && isset( $data[0] ) && is_array( $data[0] ) ) {
			$translated = '';
			foreach ( $data[0] as $segment ) {
				if ( isset( $segment[0] ) ) {
					$translated .= $segment[0];
				}
			}
			return $translated ? $translated : $text;
		}

		return $text;
	}
}
