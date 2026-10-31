<?php
/**
 * Helper utilities.
 *
 * @package TranslateSense
 * @subpackage Includes\Helper
 */

declare(strict_types=1);

namespace TranslateSense\Includes\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helper
 */
class Helper {

	/**
	 * Default documentation base URL.
	 *
	 * @var string
	 */
	const DEFAULT_BASE_URL = 'https://docs.dragwyb.com/';

	/**
	 * Generate a documentation link with UTM tracking parameters.
	 *
	 * @param string $page_name Page name or slug (e.g., 'openai-setup', 'chrome-ai').
	 * @param string $medium    UTM medium (e.g., 'bulk-translate', 'editor', 'dashboard').
	 * @param string $campaign  UTM campaign (e.g., 'help', 'docs', 'settings').
	 * @return string Full URL with UTM parameters.
	 */
	public static function generate_utm_link( string $page_name = '', string $medium = '', string $campaign = '' ): string {
		$base_url = defined( 'TRANSLATESENSE_DOCS_URL' ) ? (string) TRANSLATESENSE_DOCS_URL : self::DEFAULT_BASE_URL;

		$url       = rtrim( $base_url, '/' ) . '/';
		$page_name = trim( $page_name );
		if ( '' !== $page_name ) {
			$url .= ltrim( $page_name, '/' );
		}

		$params = array(
			'utm_source' => 'wpplugin',
		);

		$medium = trim( $medium );
		if ( '' !== $medium ) {
			$params['utm_medium'] = $medium;
		}

		$campaign = trim( $campaign );
		if ( '' !== $campaign ) {
			$params['utm_campaign'] = $campaign;
		}

		if ( function_exists( 'add_query_arg' ) ) {
			return add_query_arg( $params, $url );
		}

		$query = http_build_query( $params );
		return $url . ( false !== strpos( $url, '?' ) ? '&' : '?' ) . $query;
	}
}

if ( ! function_exists( 'TranslateSense\Includes\Helper\generate_utm_link' ) ) {
	/**
	 * Wrapper function for generating documentation links with UTM tracking parameters.
	 *
	 * @param string $page_name Page name or slug.
	 * @param string $medium    UTM medium.
	 * @param string $campaign  UTM campaign.
	 * @return string
	 */
	function generate_utm_link( string $page_name = '', string $medium = '', string $campaign = '' ): string {
		return Helper::generate_utm_link( $page_name, $medium, $campaign );
	}
}
