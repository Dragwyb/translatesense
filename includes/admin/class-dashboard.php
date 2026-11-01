<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin Dashboard view and rendering helper.
 */
class Dashboard {

	/**
	 * Render admin dashboard container root.
	 */
	public static function render(): void {
		?>
		<div class="wrap">
			<div id="translatesense-admin-root"></div>
		</div>
		<?php
	}
}
