<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Bulk;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bulk Queue management helper.
 */
class Bulk_Queue {

	/**
	 * Check if any bulk jobs are pending or running.
	 *
	 * @return bool
	 */
	public static function has_active_jobs(): bool {
		return Bulk_Process::has_pending_or_running_jobs();
	}

	/**
	 * Trigger queue processing tick.
	 */
	public static function dispatch_tick(): void {
		Bulk_Process::trigger_async_cron();
	}
}
