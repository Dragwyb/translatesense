<?php

declare(strict_types=1);

namespace TranslateSense;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'TranslateSense\Autoload' ) ) {
	class Autoload {

		private static $instance;

		public static function instance() {
			if ( ! isset( self::$instance ) ) {
				self::$instance = new self();
			}
			return self::$instance;
		}

		public function __construct() {
			static $autoload_status = false;

			if ( ! $autoload_status ) {
				$autoload_status = spl_autoload_register( array( $this, 'autoload' ) );
			}
		}

		public function autoload( $class_name ) {
			if ( 0 !== strpos( $class_name, __NAMESPACE__ ) ) {
				return;
			}

			if ( ! class_exists( $class_name, false ) ) {
				$filename = strtolower(
					preg_replace(
						array(
							'/^' . preg_quote( __NAMESPACE__ . '\\', '/' ) . '/',
							'/([a-z])([A-Z])/',
							'/_/',
							'/\\\/',
						),
						array(
							'',
							'$1-$2',
							'-',
							DIRECTORY_SEPARATOR,
						),
						$class_name
					)
				);

				$slash = preg_match( '/\//', $filename ) ? '/' : '\\';

				$parts = explode( $slash, $filename );

				if ( count( $parts ) > 1 ) {
					$last_index           = count( $parts ) - 1;
					$parts[ $last_index ] = 'class-' . $parts[ $last_index ];
				} else {
					$parts[0] = 'class-' . $parts[0];
				}

				$filename = implode( $slash, $parts );

				$base_dir = function_exists( 'trailingslashit' ) ? trailingslashit( TRANSLATESENSE_PLUGIN_DIR ) : rtrim( TRANSLATESENSE_PLUGIN_DIR, '/\\' ) . DIRECTORY_SEPARATOR;
				$filename = $base_dir . $filename . '.php';

				if ( is_readable( $filename ) ) {
					require_once $filename;
				}
			}
		}
	}
}
