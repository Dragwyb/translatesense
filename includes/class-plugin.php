<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\Database\Hashing_Db;
use TranslateSense\Includes\Core\Activator;
use TranslateSense\Includes\Core\Detector;
use TranslateSense\Includes\REST\Rest_Api;
use TranslateSense\Includes\Admin\Admin_Menu;
use TranslateSense\Includes\Bulk\Bulk_Translate;
use TranslateSense\Includes\Bulk\Bulk_Process;
use TranslateSense\Includes\Admin\Editor_Integration;
use TranslateSense\Includes\Content\Parser\Content_Parser;
use TranslateSense\Includes\Cron\Cron;
use TranslateSense\Includes\Admin\Feedback\Feedback_Form;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main TranslateSense Plugin Class.
 */
class Plugin {

	/**
	 * Single instance of the plugin.
	 *
	 * @var Plugin|null
	 */
	protected static $_instance = null;

	/**
	 * Main instance of Plugin.
	 *
	 * @return Plugin
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
		// Plugin activate redirect
		add_action( 'admin_init', array( $this, 'handle_activation_redirect' ) );
	}

	/**
	 * Initialize plugin hooks and subsystems.
	 */
	private function init_hooks() {
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

		if ( is_admin() ) {
			Activator::maybe_upgrade_db();
			Feedback_Form::get_instance();
		}
	}

	public function handle_activation_redirect() {
		global $pagenow;

		if ( ! isset( $pagenow ) || 'plugins.php' !== $pagenow ) {
			return;
		}

		if ( get_transient( 'translatesense_activation_redirect' ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( ! isset( $_GET['activate-multi'] ) && current_user_can( 'manage_options' ) ) {
				delete_transient( 'translatesense_activation_redirect' );
				wp_safe_redirect( admin_url( 'admin.php?page=translatesense&welcome=1' ) );
				exit;
			}
		}
	}
}
