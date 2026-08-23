<?php
/**
 * Fired during plugin deactivation.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TranslateSense_Deactivator {

	/**
	 * Run deactivation tasks.
	 */
	public static function deactivate() {
		// Clear cron hooks
		$timestamp = wp_next_scheduled( 'translatesense_cache_cleanup' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'translatesense_cache_cleanup' );
		}
	}
}
