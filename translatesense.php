<?php
/**
 * Plugin Name:       TranslateSense - Automatic Translation Addon for Polylang
 * Plugin URI:        https://translatesense.local
 * Description:       A high-performance automatic translation addon for Polylang with Gutenberg & Elementor XML mapping, auto-detection, and DB caching.
 * Version:           1.0.0
 * Author:            TranslateSense
 * Author URI:        https://translatesense.local
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       translatesense
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'TRANSLATESENSE_VERSION', '1.0.0' );
define( 'TRANSLATESENSE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TRANSLATESENSE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'TRANSLATESENSE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Autoload includes classes.
 */
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-activator.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-deactivator.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-xml-engine.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-hashing-db.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-translator.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-polylang-bridge.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-detector.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-admin-menu.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-bulk-translate.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-editor-integration.php';
require_once TRANSLATESENSE_PLUGIN_DIR . 'includes/class-cron.php';

/**
 * The code that runs during plugin activation.
 */
function activates_translatesense() {
	if ( ! TranslateSense_Polylang_Bridge::is_polylang_active() ) {
		// Set a transient so we show an admin notice upon activation
		set_transient( 'translatesense_polylang_missing_notice', true, 30 );
	}
	TranslateSense_Activator::activate();
}
register_activation_hook( __FILE__, 'activates_translatesense' );

/**
 * Check if Polylang is active and display admin notice if missing.
 */
add_action( 'admin_notices', 'translatesense_check_polylang_requirement' );
function translatesense_check_polylang_requirement() {
	if ( ! TranslateSense_Polylang_Bridge::is_polylang_active() ) {
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
	TranslateSense_Deactivator::deactivate();
}
register_deactivation_hook( __FILE__, 'deactivates_translatesense' );

/**
 * Main TranslateSense Plugin Class.
 */
class TranslateSense {

	/**
	 * Single instance of the plugin.
	 *
	 * @var TranslateSense
	 */
	protected static $_instance = null;

	/**
	 * Main instance of TranslateSense.
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
		TranslateSense_Xml_Engine::init();
		TranslateSense_Hashing_Db::init();
		TranslateSense_Detector::init();
		TranslateSense_Rest_Api::init();
		TranslateSense_Admin_Menu::init();
		TranslateSense_Bulk_Translate::init();
		TranslateSense_Editor_Integration::init();
		TranslateSense_Cron::init();

		add_action( 'plugins_loaded', array( $this, 'load_textdomain' ) );
	}

	/**
	 * Load plugin textdomain.
	 */
	public function load_textdomain() {
		load_plugin_textdomain(
			'translatesense',
			false,
			dirname( dirname( plugin_basename( __FILE__ ) ) ) . '/languages/'
		);
	}
}

/**
 * Kick off plugin.
 */
function translatesense() {
	return TranslateSense::instance();
}

translatesense();
