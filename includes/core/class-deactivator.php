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
		wp_clear_scheduled_hook( 'translatesense_cache_cleanup' );
		wp_clear_scheduled_hook( 'translatesense_bulk_process_cron' );
		wp_clear_scheduled_hook( 'translatesense_bulk_process_now' );
	}
}
