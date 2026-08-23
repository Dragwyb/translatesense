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
		if ( empty( trim( $source_string ) ) || $source_lang === $target_lang ) {
			return array(
				'translated' => $source_string,
				'cached'     => true,
				'hash'       => md5( $widget_id . '_' . $source_string ),
			);
		}

		$hash = Hashing_Db::generate_hash( $widget_id, $source_string );

		// Step 3.3: Check DB Cache first
		$cached = Hashing_Db::get_cached_translation( $hash, $target_lang );
		if ( null !== $cached ) {
			return array(
				'translated' => $cached,
				'cached'     => true,
				'hash'       => $hash,
			);
		}

		// Save package in DB
		if ( $post_id ) {
			Hashing_Db::record_package( $post_id, $target_lang, $hash, $source_string );
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
	 * Translate a batch of strings.
	 */
	public static function translate_batch( $strings_array, $source_lang, $target_lang, $widget_ids = array(), $post_id = 0, $custom_options = array() ) {
		$results = array();
		$hashes = array();

		foreach ( $strings_array as $idx => $str ) {
			$w_id = $widget_ids[ $idx ] ?? ( 'batch_' . $idx );
			$hashes[ $idx ] = Hashing_Db::generate_hash( $w_id, $str );
		}

		// Step 3.3: Batch Cache Lookup
		$cached_map = Hashing_Db::get_cached_translations_batch( array_values( $hashes ), $target_lang );

		$to_translate = array();
		foreach ( $strings_array as $idx => $str ) {
			$h = $hashes[ $idx ];
			if ( isset( $cached_map[ $h ] ) ) {
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
			return $results;
		}

		// Translate uncached strings
		$settings = get_option( 'translatesense_settings', array() );
		$provider = $custom_options['provider'] ?? ( $settings['provider'] ?? 'client_google' );

		foreach ( $to_translate as $idx => $str ) {
			$w_id = $widget_ids[ $idx ] ?? ( 'batch_' . $idx );
			$h = $hashes[ $idx ];

			if ( $post_id ) {
				Hashing_Db::record_package( $post_id, $target_lang, $h, $str );
			}

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
	 * Frontend widget and Chrome built-in local AI are NOT saved to database.
	 *
	 * @param string $provider
	 * @return bool
	 */
	public static function should_cache_provider( $provider ) {
		$no_cache_providers = array( 'client_google', 'google_widget', 'chrome_ai', 'frontend_widget', 'google_frontend' );
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

			case 'google_api':
				return self::translate_google_api( $text, $source_lang, $target_lang, $settings['api_key'] ?? '' );

			case 'deepl':
				return self::translate_deepl( $text, $source_lang, $target_lang, $settings['deepl_api_key'] ?? '' );

			case 'libre':
				return self::translate_libre( $text, $source_lang, $target_lang, $settings['libre_url'] ?? '' );

			case 'google_widget':
			case 'chrome_ai':
			case 'client_google':
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

		$url = 'https://api.openai.com/v1/chat/completions';
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
		$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . urlencode( $model_name ) . ':generateContent?key=' . urlencode( $api_key );

		$prompt = sprintf( "You are a professional translator. Translate the following text from %s to %s. Preserve all HTML tags, placeholders, and formatting. Output ONLY the translated content without any extra text:\n\n%s", $source_lang, $target_lang, $text );

		$body = array(
			'contents' => array(
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
	 * Google Cloud Translation API.
	 */
	private static function translate_google_api( $text, $source_lang, $target_lang, $api_key ) {
		if ( empty( $api_key ) ) {
			return self::translate_public_engine( $text, $source_lang, $target_lang );
		}

		$url = 'https://translation.googleapis.com/language/translate/v2?key=' . urlencode( $api_key );
		$body = array(
			'q'      => $text,
			'source' => substr( $source_lang, 0, 2 ),
			'target' => substr( $target_lang, 0, 2 ),
			'format' => 'html',
		);

		$response = wp_remote_post(
			$url,
			array(
				'body'    => wp_json_encode( $body ),
				'headers' => array( 'Content-Type' => 'application/json' ),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $text;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( isset( $data['data']['translations'][0]['translatedText'] ) ) {
			return html_entity_decode( $data['data']['translations'][0]['translatedText'], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		}

		return $text;
	}

	/**
	 * DeepL Translation API.
	 */
	private static function translate_deepl( $text, $source_lang, $target_lang, $api_key ) {
		if ( empty( $api_key ) ) {
			return self::translate_public_engine( $text, $source_lang, $target_lang );
		}

		$endpoint = ( substr( $api_key, -3 ) === ':fx' ) ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

		$body = array(
			'text'        => array( $text ),
			'source_lang' => strtoupper( substr( $source_lang, 0, 2 ) ),
			'target_lang' => strtoupper( substr( $target_lang, 0, 2 ) ),
			'tag_handling'=> 'html',
		);

		$response = wp_remote_post(
			$endpoint,
			array(
				'body'    => wp_json_encode( $body ),
				'headers' => array(
					'Authorization' => 'DeepL-Auth-Key ' . $api_key,
					'Content-Type'  => 'application/json',
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $text;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( isset( $data['translations'][0]['text'] ) ) {
			return $data['translations'][0]['text'];
		}

		return $text;
	}

	/**
	 * LibreTranslate API.
	 */
	private static function translate_libre( $text, $source_lang, $target_lang, $base_url ) {
		if ( empty( $base_url ) ) {
			return self::translate_public_engine( $text, $source_lang, $target_lang );
		}

		$endpoint = trailingslashit( $base_url ) . 'translate';
		$body = array(
			'q'      => $text,
			'source' => substr( $source_lang, 0, 2 ),
			'target' => substr( $target_lang, 0, 2 ),
			'format' => 'html',
		);

		$response = wp_remote_post(
			$endpoint,
			array(
				'body'    => wp_json_encode( $body ),
				'headers' => array( 'Content-Type' => 'application/json' ),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $text;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( isset( $data['translatedText'] ) ) {
			return $data['translatedText'];
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
