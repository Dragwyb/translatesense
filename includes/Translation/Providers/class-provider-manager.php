<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Translation\Providers;

use TranslateSense\Includes\AI\Ai_Connector_Bridge;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Translation Provider Manager.
 */
class Provider_Manager {

	/**
	 * Get list of active providers.
	 *
	 * @param bool $force_refresh
	 * @return array
	 */
	public static function get_active_providers( bool $force_refresh = false ): array {
		return Ai_Connector_Bridge::get_instance()->get_active_providers( $force_refresh );
	}
}
