<?php
/**
 * AI Connector Bridge Class.
 *
 * Bridges WordPress 7.0 Core AI Connectors with TranslateSense legacy direct API fallbacks (OpenAI, Gemini).
 *
 * @package TranslateSense
 * @subpackage Includes
 */

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_Error;
use WordPress\AiClient\AiClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Ai_Connector_Bridge
 *
 * Abstract all AI API communications for TranslateSense, prioritizing the native
 * WordPress 7.0 AI Client when available, and falling back to direct HTTP requests
 * (OpenAI / Google Gemini) for older WordPress versions or unregistered providers.
 */
class Ai_Connector_Bridge {

	/**
	 * Stores whether the WP 7.0 Core AI Client is active and available.
	 *
	 * @var bool
	 */
	private $has_wp_ai = false;

	/**
	 * Stores custom API keys saved in TranslateSense settings.
	 *
	 * @var array
	 */
	private $legacy_keys = array();

	/**
	 * Cache of currently active/available AI providers.
	 *
	 * @var array|null
	 */
	private $active_providers = null;

	/**
	 * Singleton instance.
	 *
	 * @var Ai_Connector_Bridge|null
	 */
	private static $instance = null;

	/**
	 * Get singleton instance.
	 *
	 * @return Ai_Connector_Bridge
	 */
	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function __construct() {
		$this->detect_wp_ai_capabilities();
		$this->load_saved_settings();
	}

	/**
	 * Detect if WordPress 7.0+ native AI APIs / Connectors are available.
	 *
	 * @return void
	 */
	private function detect_wp_ai_capabilities(): void {
		global $wp_version;
		$is_wp7 = ( isset( $wp_version ) && version_compare( $wp_version, '7.0', '>=' ) )
			|| ( function_exists( 'get_bloginfo' ) && version_compare( get_bloginfo( 'version' ), '7.0', '>=' ) );

		$this->has_wp_ai = ( $is_wp7 || function_exists( 'wp_is_connector_registered' ) )
			&& ( function_exists( 'wp_ai_client_prompt' ) || function_exists( 'wp_is_connector_registered' ) || class_exists( 'WordPress\AiClient\AiClient' ) );
	}

	/**
	 * Load custom saved API keys and provider configurations from WordPress options.
	 *
	 * @return void
	 */
	private function load_saved_settings(): void {
		$main_settings = get_option( 'translatesense_settings', array() );
		$legacy_opt    = get_option( 'translatesense_api_keys', array() );

		$this->legacy_keys = array(
			'openai' => ! empty( $legacy_opt['openai'] ) ? (string) $legacy_opt['openai'] : ( ! empty( $main_settings['openai_api_key'] ) ? (string) $main_settings['openai_api_key'] : '' ),
			'gemini' => ! empty( $legacy_opt['gemini'] ) ? (string) $legacy_opt['gemini'] : ( ! empty( $main_settings['gemini_api_key'] ) ? (string) $main_settings['gemini_api_key'] : '' ),
		);
	}

	/**
	 * Main entry point for initiating a translation.
	 *
	 * @param array  $strings  Array of strings indexed by key/integer [ 0 => '...', 'header' => '...' ].
	 * @param string $prompt   The translation prompt template or instructions.
	 * @param string $model    The model name (e.g. 'gpt-4o-mini', 'gemini-1.5-flash').
	 * @param array  $settings Additional configuration options (temperature, timeout, max_tokens, etc.).
	 * @param string $provider Optional specific provider slug ('openai', 'gemini', etc.).
	 * @return array<string|int, string>|WP_Error Array of translated strings maintaining exact keys, or WP_Error on failure.
	 */
	public function translate_strings( array $strings, string $prompt = '', string $model = '', array $settings = array(), string $provider = '' ) {
		if ( empty( $strings ) ) {
			return array();
		}

		if ( empty( $provider ) ) {
			$provider = ! empty( $settings['provider'] ) ? (string) $settings['provider'] : 'openai';
		}

		$provider = sanitize_key( $provider );

		// Browser on-device AI handles translations on frontend
		if ( 'chrome_ai' === $provider || 'chrome_local_ai' === $provider ) {
			return $strings;
		}

		// Set default prompt if not supplied
		if ( empty( $prompt ) ) {
			$source_lang = $settings['source_lang'] ?? 'en';
			$target_lang = $settings['target_lang'] ?? 'es';
			$prompt      = $this->build_default_prompt( $strings, (string) $source_lang, (string) $target_lang, $settings );
		}

		$active_providers = $this->get_active_providers();
		$provider_info    = $active_providers[ $provider ] ?? null;
		$uses_connector   = $this->has_wp_ai && ! empty( $provider_info['connectors'] );

		// Condition A: If WP 7.0+ and connectors are available for this provider, send request through WP Core Connectors
		if ( $uses_connector && $active_providers[ $provider ]['connectors'] ) {
			$core_result = $this->translate_via_wp_core( $strings, $prompt, $model, $settings, $provider );

			// If Core AI succeeded, return result.
			if ( ! is_wp_error( $core_result ) ) {
				return $core_result;
			}

			// If Core failed and legacy direct API key exists, fallback to legacy
			if ( ! empty( $this->legacy_keys[ $provider ] ) ) {
				if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
					// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
					error_log( sprintf( '[TranslateSense AI Bridge] WP Core Connector error (%s), falling back to direct API key.', $core_result->get_error_message() ) );
				}
				$legacy_result = $this->translate_via_legacy_api( $strings, $prompt, $model, $provider, $settings );
				if ( ! is_wp_error( $legacy_result ) ) {
					return $legacy_result;
				}
			}

			return $this->standardize_error( $core_result, $provider );
		}

		// Condition B: For older WordPress versions or unconfigured connectors, use legacy direct API endpoints
		$legacy_result = $this->translate_via_legacy_api( $strings, $prompt, $model, $provider, $settings );

		if ( is_wp_error( $legacy_result ) ) {
			return $this->standardize_error( $legacy_result, $provider );
		}

		return $legacy_result;
	}

	/**
	 * Check if a provider/model is registered in WordPress 7.0 Core AI Client.
	 *
	 * @param string $provider
	 * @param string $model
	 * @return bool
	 */
	public function is_provider_registered_in_core( string $provider, string $model = '' ): bool {
		if ( ! $this->has_wp_ai ) {
			return false;
		}

		if ( function_exists( 'wp_ai_get_providers' ) ) {
			$core_providers = (array) wp_ai_get_providers();
			if ( isset( $core_providers[ $provider ] ) || in_array( $provider, $core_providers, true ) ) {
				return true;
			}
		}

		if ( function_exists( 'wp_get_ai_client' ) ) {
			$client = wp_get_ai_client();
			if ( is_object( $client ) ) {
				if ( method_exists( $client, 'has_provider' ) && $client->has_provider( $provider ) ) {
					return true;
				}
				if ( method_exists( $client, 'get_available_providers' ) ) {
					$available = (array) $client->get_available_providers();
					if ( isset( $available[ $provider ] ) || in_array( $provider, $available, true ) ) {
						return true;
					}
				}
			}
		}

		// If WP 7.0 general AI is available without provider restrictions
		if ( 'wp_core' === $provider || 'core' === $provider || 'WordPress' === $provider ) {
			return true;
		}

		return false;
	}

	/**
	 * Translate a batch of strings using the WordPress Core AI Client.
	 *
	 * @param array  $strings  Strings to translate.
	 * @param string $prompt   Translation prompt.
	 * @param string $model    AI model ID.
	 * @param array  $settings AI request settings.
	 * @param string $provider AI provider ID.
	 *
	 * @return array|WP_Error Parsed translations or WP_Error on failure.
	 */
	private function translate_via_wp_core(
		array $strings,
		string $prompt,
		string $model = '',
		array $settings = array(),
		string $provider = 'openai'
	) {
		$keys = array_keys( $strings );

		if ( empty( $keys ) ) {
			return new WP_Error(
				'empty_strings',
				__( 'No strings were provided for translation.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$prompt = trim( $prompt );
		if ( '' === $prompt ) {
			return new WP_Error(
				'empty_prompt',
				__( 'No translation prompt was provided.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		$provider = sanitize_key( $provider );
		$model    = is_string( $model ) ? trim( $model ) : '';

		if ( '' === $provider ) {
			return new WP_Error(
				'invalid_provider',
				__( 'Invalid AI provider.', 'translatesense' ),
				array( 'status' => 400 )
			);
		}

		/*
		 * TranslateSense uses "gemini" internally while the WordPress
		 * AI Client registry uses "google".
		 */
		$core_provider = ( 'gemini' === $provider ) ? 'google' : $provider;

		/*
		 * WordPress AI Client is required for Connector-based requests.
		 */
		if ( ! function_exists( 'wp_ai_client_prompt' ) ) {
			return new WP_Error(
				'ai_client_unavailable',
				__( 'The WordPress AI Client is not available.', 'translatesense' ),
				array( 'status' => 503 )
			);
		}

		/*
		 * Validate the request timeout.
		 */
		$timeout = isset( $settings['timeout'] )
		? absint( $settings['timeout'] )
		: 60;

		if ( $timeout <= 0 ) {
			$timeout = 60;
		}

		/*
		 * Apply the timeout only for this request.
		 */
		$timeout_filter = static function ( $current_timeout ) use ( $timeout ) {
			return $timeout;
		};

		add_filter(
			'wp_ai_client_default_request_timeout',
			$timeout_filter,
			10,
			1
		);

		try {
			/*
			 * Get the WordPress AI Client registry.
			 */
			if (
			! class_exists( '\WordPress\AiClient\AiClient' )
			|| ! method_exists( '\WordPress\AiClient\AiClient', 'defaultRegistry' )
			) {
				return new WP_Error(
					'ai_registry_unavailable',
					__( 'The WordPress AI Client registry is not available.', 'translatesense' ),
					array( 'status' => 503 )
				);
			}

			$registry = \WordPress\AiClient\AiClient::defaultRegistry();

			/*
			 * Connector must be configured before making a request.
			 */
			if ( ! $registry->isProviderConfigured( $core_provider ) ) {
				return new WP_Error(
					'provider_not_configured',
					__( 'The selected AI provider is not configured.', 'translatesense' ),
					array( 'status' => 400 )
				);
			}

			/*
			 * Resolve the provider class.
			 */
			$provider_class = $registry->getProviderClassName( $core_provider );

			if (
			! is_string( $provider_class )
			|| '' === $provider_class
			|| ! class_exists( $provider_class )
			) {
				return new WP_Error(
					'invalid_provider',
					__( 'The selected AI provider is invalid.', 'translatesense' ),
					array( 'status' => 400 )
				);
			}

			/*
			 * Create the AI prompt builder.
			 */
			$builder = wp_ai_client_prompt();

			if ( ! is_object( $builder ) ) {
				return new WP_Error(
					'prompt_builder_error',
					__( 'Unable to initialize the WordPress AI Client.', 'translatesense' ),
					array( 'status' => 503 )
				);
			}

			/*
			 * Use explicitly selected model when available.
			 *
			 * When no model is selected, WordPress/provider default
			 * model selection is used.
			 */
			if ( '' !== $model ) {
				try {
					$ai_model = $provider_class::model( $model );
				} catch ( \Throwable $e ) {
					return new WP_Error(
						'invalid_model',
						__( 'The selected AI model is invalid.', 'translatesense' ),
						array(
							'status'    => 400,
							'exception' => $e,
						)
					);
				}

				$builder->using_model( $ai_model );
			}

			/*
			 * Generate the response using the WordPress AI Client Connector.
			 */
			$raw_response = $builder
			->using_provider( $core_provider )
			->with_text( $prompt )
			->generate_text();

			/*
			 * Handle WP_Error returned directly by the AI Client.
			 */
			if ( is_wp_error( $raw_response ) ) {
				return $raw_response;
			}

			if ( ! is_string( $raw_response ) || empty( $raw_response ) ) {
				return new WP_Error(
					'wp_ai_empty_response',
					__( 'Empty response received from the WordPress AI Client.', 'translatesense' ),
					array( 'status' => 502 )
				);
			}

			$response_text = $raw_response;

			/*
			 * Convert the JSON response into the expected translation map.
			 */
			$parsed = $this->parse_batch_json_response(
				$response_text,
				$keys
			);

			if ( null === $parsed ) {
				return new WP_Error(
					'wp_ai_json_parse_error',
					__( 'Failed to parse translations from the WordPress AI response.', 'translatesense' ),
					array( 'status' => 422 )
				);
			}

			return $parsed;

		} catch ( \Throwable $e ) {
			/*
			 * Do not expose the raw provider exception to the user.
			 * Keep it in WP_Error data for optional logging/debugging.
			 */
			return new WP_Error(
				'wp_ai_core_exception',
				__( 'An error occurred while processing the AI translation request.', 'translatesense' ),
				array(
					'status'    => 500,
					'exception' => $e,
				)
			);

		} finally {
			/*
			 * Important: do not leave our timeout filter active for
			 * subsequent AI requests.
			 */
			remove_filter(
				'wp_ai_client_default_request_timeout',
				$timeout_filter,
				10
			);
		}
	}

	/**
	 * Execute translation via legacy direct HTTP API calls (OpenAI, Gemini).
	 *
	 * @param array  $strings  Array of strings to translate.
	 * @param string $prompt   Prompt content.
	 * @param string $model    Model name.
	 * @param string $provider Provider slug ('openai', 'gemini').
	 * @param array  $settings Configuration parameters.
	 * @return array|WP_Error
	 */
	private function translate_via_legacy_api( array $strings, string $prompt, string $model, string $provider, array $settings ) {
		$keys = array_keys( $strings );

		$timeout     = ! empty( $settings['response_timeout'] ) ? (int) $settings['response_timeout'] : 30;
		$max_tokens  = ! empty( $settings['max_tokens'] ) ? (int) $settings['max_tokens'] : 4096;
		$temperature = isset( $settings['temperature'] ) && '' !== $settings['temperature'] ? (float) $settings['temperature'] : 0.2;

		switch ( $provider ) {
			case 'openai':
				$api_key = ! empty( $settings['openai_api_key'] ) ? (string) $settings['openai_api_key'] : ( $this->legacy_keys['openai'] ?? '' );
				$model   = ! empty( $model ) ? $model : ( $settings['openai_model'] ?? 'gpt-4o-mini' );

				if ( empty( $api_key ) ) {
					return new WP_Error( 'missing_api_key', __( 'OpenAI API key is missing. Please configure it in TranslateSense Settings.', 'translatesense' ), array( 'status' => 401 ) );
				}

				$url  = 'https://api.openai.com/v1/chat/completions';
				$body = array(
					'model'           => $model,
					'messages'        => array(
						array(
							'role'    => 'system',
							'content' => 'You are a translation API. You output ONLY valid JSON matching {"translations": ["..."]}.',
						),
						array(
							'role'    => 'user',
							'content' => $prompt,
						),
					),
					'temperature'     => $temperature,
					'max_tokens'      => $max_tokens,
					'response_format' => array( 'type' => 'json_object' ),
				);

				$headers = array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $api_key,
				);

				$response = wp_remote_post(
					$url,
					array(
						'headers'     => $headers,
						'body'        => wp_json_encode( $body ),
						'timeout'     => $timeout,
						'data_format' => 'body',
					)
				);

				if ( is_wp_error( $response ) ) {
					return $response;
				}

				$status_code = (int) wp_remote_retrieve_response_code( $response );
				$raw_body    = wp_remote_retrieve_body( $response );
				$data        = json_decode( $raw_body, true );

				if ( $status_code < 200 || $status_code >= 300 ) {
					$error_msg = $data['error']['message'] ?? sprintf( /* translators: %d: HTTP status code */ __( 'OpenAI HTTP Error %d', 'translatesense' ), $status_code );
					return new WP_Error( 'openai_api_error', $error_msg, array( 'status' => $status_code ) );
				}

				if ( empty( $data['choices'][0]['message']['content'] ) ) {
					return new WP_Error( 'openai_empty_content', __( 'OpenAI returned an empty content choice.', 'translatesense' ), array( 'status' => 502 ) );
				}

				$parsed = $this->parse_batch_json_response( (string) $data['choices'][0]['message']['content'], $keys );
				if ( null === $parsed ) {
					return new WP_Error( 'openai_json_parse_error', __( 'Could not parse JSON translations from OpenAI response.', 'translatesense' ), array( 'status' => 422 ) );
				}

				return $parsed;

			case 'gemini':
				$api_key = ! empty( $settings['gemini_api_key'] ) ? (string) $settings['gemini_api_key'] : ( $this->legacy_keys['gemini'] ?? '' );
				$model   = ! empty( $model ) ? $model : ( $settings['gemini_model'] ?? 'gemini-1.5-flash' );

				if ( empty( $api_key ) ) {
					return new WP_Error( 'missing_api_key', __( 'Google Gemini API key is missing. Please configure it in TranslateSense Settings.', 'translatesense' ), array( 'status' => 401 ) );
				}

				$url  = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode( $model ) . ':generateContent?key=' . rawurlencode( $api_key );
				$body = array(
					'contents'         => array(
						array(
							'parts' => array(
								array( 'text' => $prompt ),
							),
						),
					),
					'generationConfig' => array(
						'temperature'      => $temperature,
						'maxOutputTokens'  => $max_tokens,
						'responseMimeType' => 'application/json',
					),
				);

				$response = wp_remote_post(
					$url,
					array(
						'headers'     => array( 'Content-Type' => 'application/json' ),
						'body'        => wp_json_encode( $body ),
						'timeout'     => $timeout,
						'data_format' => 'body',
					)
				);

				if ( is_wp_error( $response ) ) {
					return $response;
				}

				$status_code = (int) wp_remote_retrieve_response_code( $response );
				$raw_body    = wp_remote_retrieve_body( $response );
				$data        = json_decode( $raw_body, true );

				if ( $status_code < 200 || $status_code >= 300 ) {
					$error_msg = $data['error']['message'] ?? sprintf( /* translators: %d: HTTP status code */ __( 'Gemini HTTP Error %d', 'translatesense' ), $status_code );
					return new WP_Error( 'gemini_api_error', $error_msg, array( 'status' => $status_code ) );
				}

				if ( empty( $data['candidates'][0]['content']['parts'][0]['text'] ) ) {
					return new WP_Error( 'gemini_empty_content', __( 'Gemini returned an empty response candidate.', 'translatesense' ), array( 'status' => 502 ) );
				}

				$parsed = $this->parse_batch_json_response( (string) $data['candidates'][0]['content']['parts'][0]['text'], $keys );
				if ( null === $parsed ) {
					return new WP_Error( 'gemini_json_parse_error', __( 'Could not parse JSON translations from Gemini response.', 'translatesense' ), array( 'status' => 422 ) );
				}

				return $parsed;

			case 'chrome_ai':
			case 'chrome_local_ai':
				// Frontend on-device runner handles this; returns original strings if reached on server.
				return $strings;

			default:
				return new WP_Error(
					'unsupported_provider',
					sprintf( /* translators: %s: Provider slug */ __( 'Translation provider "%s" is not supported by TranslateSense or WordPress Core.', 'translatesense' ), $provider ),
					array( 'status' => 400 )
				);
		}
	}

	/**
	 * Parse batch AI response JSON and map items back to input keys.
	 *
	 * @param string $raw_json
	 * @param array  $keys
	 * @return array<string|int, string>|null
	 */
	private function parse_batch_json_response( string $raw_json, array $keys ): ?array {
		$clean_json = trim( $raw_json );

		// Strip markdown code fences (```json ... ```)
		if ( 0 === strpos( $clean_json, '```' ) ) {
			$clean_json = preg_replace( '/^```(?:json)?\s*/i', '', $clean_json );
			$clean_json = preg_replace( '/\s*```$/', '', $clean_json );
			$clean_json = trim( (string) $clean_json );
		}

		$decoded = json_decode( $clean_json, true );
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
	 * Build default prompt template for batch string translation.
	 *
	 * @param array  $strings
	 * @param string $source_lang
	 * @param string $target_lang
	 * @param array  $settings
	 * @return string
	 */
	private function build_default_prompt( array $strings, string $source_lang, string $target_lang, array $settings = array() ): string {
		$template = ! empty( $settings['custom_prompt'] )
			? (string) $settings['custom_prompt']
			: "You are a professional HTML-safe translator. Translate the JSON array of strings from {source_lang} to {target_lang}.\nPreserve all HTML tags, placeholders, and formatting.\nOutput ONLY a valid JSON object matching this schema: {\"translations\": [\"...\", \"...\"]}\nLength of translations array MUST EXACTLY MATCH input array length ({count} items):\n\n{json_strings}";

		$values_seq = array_values( $strings );
		$json_str   = wp_json_encode( array( 'strings' => $values_seq ) );

		$replacements = array(
			'{source_lang}'  => $source_lang,
			'{target_lang}'  => $target_lang,
			'{count}'        => count( $values_seq ),
			'{json_strings}' => (string) $json_str,
		);

		return str_replace( array_keys( $replacements ), array_values( $replacements ), $template );
	}

	/**
	 * Save or update custom API keys when the user is not relying on site-wide WP AI configuration.
	 *
	 * @param array<string, string> $keys
	 * @return bool
	 */
	public function update_api_keys( array $keys ): bool {
		$sanitized = array();

		foreach ( $keys as $provider => $key_val ) {
			$provider_clean = sanitize_key( (string) $provider );
			if ( ! empty( $provider_clean ) ) {
				$sanitized[ $provider_clean ] = sanitize_text_field( trim( (string) $key_val ) );
			}
		}

		$updated = update_option( 'translatesense_api_keys', $sanitized );

		// Synchronize with main plugin settings for backward compatibility
		$main_settings = get_option( 'translatesense_settings', array() );
		if ( isset( $sanitized['openai'] ) ) {
			$main_settings['openai_api_key'] = $sanitized['openai'];
		}
		if ( isset( $sanitized['gemini'] ) ) {
			$main_settings['gemini_api_key'] = $sanitized['gemini'];
		}
		update_option( 'translatesense_settings', $main_settings );

		$this->legacy_keys      = $sanitized;
		$this->active_providers = null; // Invalidate cached providers

		return $updated;
	}

	/**
	 * Return a unified list of available providers for the TranslateSense settings & editor UI.
	 *
	 * @param bool $refresh Force cache refresh.
	 * @return array
	 */
	public function get_active_providers( bool $refresh = false ): array {
		if ( null !== $this->active_providers && ! $refresh ) {
			return $this->active_providers;
		}

		$this->load_saved_settings();
		$providers = array();

		// 1. If WordPress 7.0+ Core AI is active, query core registry for site-level providers
		if ( $this->has_wp_ai ) {
			if ( function_exists( 'wp_is_connector_registered' ) ) {
				$providers_arr = array( 'openai', 'google' );
				$registry      = class_exists( 'WordPress\AiClient\AiClient' ) ? AiClient::defaultRegistry() : null;

				foreach ( $providers_arr as $id ) {
					$connector_registry = wp_is_connector_registered( $id );
					$key_id             = ( 'google' === $id ) ? 'gemini' : $id;

					if ( $connector_registry ) {
						// var_dump( $id );
						$is_connected = false;
						if ( $registry ) {
							try {
								$is_connected = $registry->hasProvider( $id ) && $registry->isProviderConfigured( $id );
							} catch ( \Throwable $e ) {
								$is_connected = false;
							}
						} else {
							$is_connected = true;
						}

						$providers[ $key_id ] = array(
							'isConnected' => (bool) $is_connected,
							'connectors'  => true,
						);
					}
				}
			}
		}

		// 2. Check legacy / custom configured API keys for providers without registered core connectors
		if ( ! isset( $providers['openai'] ) ) {
			$has_openai          = ! empty( $this->legacy_keys['openai'] );
			$providers['openai'] = array(
				'isConnected' => (bool) $has_openai,
				'connectors'  => false,
			);
		}

		if ( ! isset( $providers['gemini'] ) ) {
			$has_gemini          = ! empty( $this->legacy_keys['gemini'] );
			$providers['gemini'] = array(
				'isConnected' => (bool) $has_gemini,
				'connectors'  => false,
			);
		}

		// 3. Built-in On-Device browser AI
		$providers['chrome_ai'] = array(
			'isConnected' => true,
			'connectors'  => false,
		);

		$this->active_providers = $providers;

		return $this->active_providers;
	}

	/**
	 * Standardize and format WP_Error for consistent UI and REST API output.
	 *
	 * @param WP_Error $error
	 * @param string   $provider
	 * @return WP_Error
	 */
	private function standardize_error( WP_Error $error, string $provider ): WP_Error {
		$code       = $error->get_error_code();
		$msg        = $error->get_error_message();
		$error_data = (array) $error->get_error_data();
		$status     = $error_data['status'] ?? 500;

		if ( 429 === $status || false !== stripos( $msg, 'quota' ) || false !== stripos( $msg, 'rate limit' ) ) {
			/* translators: %s: Provider name in uppercase */
			$msg    = sprintf( __( 'API Quota / Rate Limit reached for %s. Please verify your billing plan or API quota limits.', 'translatesense' ), strtoupper( $provider ) );
			$status = 429;
		} elseif ( 401 === $status || 403 === $status || false !== stripos( $msg, 'unauthorized' ) || false !== stripos( $msg, 'invalid api key' ) ) {
			/* translators: %s: Provider name in uppercase */
			$msg    = sprintf( __( 'Authentication failed for %s. Please verify that your API key is correct in TranslateSense Settings.', 'translatesense' ), strtoupper( $provider ) );
			$status = 401;
		}

		return new WP_Error(
			'translatesense_ai_' . $code,
			$msg,
			array(
				'status'   => $status,
				'provider' => $provider,
				'original' => $error->get_error_message(),
			)
		);
	}

	/**
	 * Check if WP Core AI is active.
	 *
	 * @return bool
	 */
	public function has_wp_ai(): bool {
		return $this->has_wp_ai;
	}

	/**
	 * Get legacy custom API keys.
	 *
	 * @return array<string, string>
	 */
	public function get_legacy_keys(): array {
		return $this->legacy_keys;
	}
}
