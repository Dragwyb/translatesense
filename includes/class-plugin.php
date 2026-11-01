<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use TranslateSense\Includes\XML\Xml_Engine;
use TranslateSense\Includes\Database\Hashing_Db;
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
			Feedback_Form::get_instance();
		}
	}
}
