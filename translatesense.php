<?php
/**
 * Plugin Name:       TranslateSense – AI Translation for Polylang
 * Description:       A high-performance automatic translation addon for Polylang with Gutenberg & Elementor XML mapping, auto-detection, and DB caching.
 * Version:           0.1.0
 * Author:            dragwyb
 * Author URI:        https://dragwyb.com/
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       translatesense
 * Domain Path:       /languages
 */

declare(strict_types=1);

namespace TranslateSense;

use TranslateSense\Includes\Core\Activator;
use TranslateSense\Includes\Core\Deactivator;
use TranslateSense\Includes\Integrations\Polylang\Polylang_Bridge;
use TranslateSense\Includes\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'TRANSLATESENSE_VERSION', '0.1.0' );
define( 'TRANSLATESENSE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TRANSLATESENSE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'TRANSLATESENSE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'TRANSLATESENSE_ASSETS_EXT', '.min' );
define( 'TRANSLATESENSE_DOCS_URL', 'https://docs.dragwyb.com/' );

/**
 * Register PSR/WordPress dynamic class autoloader.
 */
require_once TRANSLATESENSE_PLUGIN_DIR . 'class-autoload.php';
Autoload::instance();

/**
 * The code that runs during plugin activation.
 */
function activates_translatesense() {
	if ( ! Polylang_Bridge::is_polylang_active() ) {
		set_transient( 'translatesense_polylang_missing_notice', true, 30 );
	}
	Activator::activate();
}
register_activation_hook( __FILE__, __NAMESPACE__ . '\\activates_translatesense' );

/**
 * Check if Polylang is active and display admin notice if missing.
 */
add_action( 'admin_notices', __NAMESPACE__ . '\\translatesense_check_polylang_requirement' );
function translatesense_check_polylang_requirement() {
	if ( ! Polylang_Bridge::is_polylang_active() ) {
		?>
		<div class="notice notice-warning is-dismissible">
			<p>
				<strong><?php esc_html_e( 'TranslateSense requires Polylang to be installed and active.', 'translatesense' ); ?></strong>
				<?php esc_html_e( 'Please install and activate Polylang to enable multi-language linking and automatic translations.', 'translatesense' ); ?>
			</p>
		</div>
		<?php
	}
}

/**
 * The code that runs during plugin deactivation.
 */
function deactivates_translatesense() {
	Deactivator::deactivate();
}
register_deactivation_hook( __FILE__, __NAMESPACE__ . '\\deactivates_translatesense' );

/**
 * Kick off plugin.
 */
function plugin() {
	return Plugin::instance();
}

plugin();
