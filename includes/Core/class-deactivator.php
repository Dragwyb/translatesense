<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Deactivator {

	/**
	 * Run deactivation tasks.
	 */
	public static function deactivate() {
		$timestamp = wp_next_scheduled( 'translatesense_cache_cleanup' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'translatesense_cache_cleanup' );
		}
	}
}
