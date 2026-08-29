<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Translator {

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
		if ( empty( trim( $source_string ) ) || $source_lang === $target_lang || self::is_email_or_url( $source_string ) ) {
			return array(
				'translated' => $source_string,
				'cached'     => true,
				'hash'       => md5( $widget_id . '_' . $source_string ),
			);
		}

		$hash = Hashing_Db::generate_hash( $widget_id, $source_string );

		// Step 3.2b: Check in-memory translations (used by Chrome Local AI and frontend-provided translation maps)
		if ( ! empty( $custom_options['in_memory_translations'] ) && is_array( $custom_options['in_memory_translations'] ) ) {
			if ( isset( $custom_options['in_memory_translations'][ $hash ] ) && '' !== trim( (string) $custom_options['in_memory_translations'][ $hash ] ) ) {
				return array(
					'translated' => (string) $custom_options['in_memory_translations'][ $hash ],
					'cached'     => false,
					'hash'       => $hash,
				);
			}
			if ( isset( $custom_options['in_memory_translations'][ $source_string ] ) && '' !== trim( (string) $custom_options['in_memory_translations'][ $source_string ] ) ) {
				return array(
					'translated' => (string) $custom_options['in_memory_translations'][ $source_string ],
					'cached'     => false,
					'hash'       => $hash,
				);
			}
		}

		// Step 3.3: Check DB Cache
		$cached = Hashing_Db::get_cached_translation( $hash, $target_lang );
		if ( null !== $cached ) {
			return array(
				'translated' => $cached,
				'cached'     => true,
				'hash'       => $hash,
			);
		}

		// Translate via configured provider
		$settings = get_option( 'translatesense_settings', array() );
		$provider = $custom_options['provider'] ?? ( $settings['provider'] ?? 'client_google' );

		$translated_text = self::execute_provider_translation( $source_string, $source_lang, $target_lang, $provider, $settings );

		// Save to cache ONLY for AI/Backend providers (exclude client-side frontend widget and Chrome built-in local AI)
		if ( ! empty( $translated_text ) && self::should_cache_provider( $provider ) ) {
			Hashing_Db::save_translation_result( $hash, $target_lang, $translated_text );
		} elseif ( empty( $translated_text ) ) {
			$translated_text = $source_string; // fallback
		}

		return array(
			'translated' => $translated_text,
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
	 */
	public static function translate_batch( $strings_array, $source_lang, $target_lang, $widget_ids = array(), $post_id = 0, $custom_options = array() ) {
		$results = array();
		$hashes  = array();

		foreach ( $strings_array as $idx => $str ) {
			$w_id           = $widget_ids[ $idx ] ?? ( 'batch_' . $idx );
			$hashes[ $idx ] = Hashing_Db::generate_hash( $w_id, $str );
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

		// Translate uncached strings via backend AI provider
		$settings = get_option( 'translatesense_settings', array() );
		$provider = $custom_options['provider'] ?? ( $settings['provider'] ?? 'client_google' );

		foreach ( $to_translate as $idx => $str ) {
			$h = $hashes[ $idx ];

			$trans = self::execute_provider_translation( $str, $source_lang, $target_lang, $provider, $settings );
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
	 * Chrome built-in local AI is on-device and NOT saved to database cache.
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
			default:
				// Fallback server translation endpoint using public translation API or echo
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
