<?php
/**
 * Plugin Name:       TranslateSense
 * Description:       A high-performance automatic translation addon for Polylang with Gutenberg & Elementor XML mapping, auto-detection, and DB caching.
 * Version:           0.0.5
 * Author:            aniketji007
 * Author URI:        https://github.com/Aniketji007
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       translatesense
 * Domain Path:       /languages
 */

declare(strict_types=1);

namespace TranslateSense;

use TranslateSense\Includes\Activator;
use TranslateSense\Includes\Deactivator;
use TranslateSense\Includes\Polylang_Bridge;
use TranslateSense\Includes\Xml_Engine\Xml_Engine;
use TranslateSense\Includes\Hashing_Db;
use TranslateSense\Includes\Detector;
use TranslateSense\Includes\Rest_Api;
use TranslateSense\Includes\Admin_Menu;
use TranslateSense\Includes\Bulk_Translate;
use TranslateSense\Includes\Bulk_Process;
use TranslateSense\Includes\Editor_Integration;
use TranslateSense\Includes\Cron;
use TranslateSense\Includes\Content_Parser\Content_Parser;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'TRANSLATESENSE_VERSION', '0.0.5' );
define( 'TRANSLATESENSE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TRANSLATESENSE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'TRANSLATESENSE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'TRANSLATESENSE_ASSETS_EXT', '.min' );

/**
 * Register PSR/WordPress dynamic class autoloader.
 */
require_once TRANSLATESENSE_PLUGIN_DIR . 'class-translatesense-autoload.php';
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
 * Main TranslateSense Plugin Class.
 */
class Plugin {

	/**
	 * Single instance of the plugin.
	 *
	 * @var Plugin
	 */
	protected static $_instance = null;

	/**
	 * Main instance of Plugin.
	 */
	public static function instance() {
		if ( is_null( self::$_instance ) ) {
			self::$_instance = new self();
		}
		return self::$_instance;
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->init_hooks();
	}

	/**
	 * Initialize plugin hooks and subsystems.
	 */
	private function init_hooks() {
		// Initialize Subsystems
		Xml_Engine::init();
		Hashing_Db::init();
		Detector::init();
		Rest_Api::init();
		Admin_Menu::init();
		Bulk_Translate::init();
		Bulk_Process::init();
		Editor_Integration::init();
		Content_Parser::init();
		Cron::init();
	}
}

/**
 * Kick off plugin.
 */
function plugin() {
	return Plugin::instance();
}

plugin();
