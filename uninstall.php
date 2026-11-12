<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package TranslateSense
 */

declare(strict_types=1);

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Remove plugin options
delete_option( 'translatesense_settings' );
delete_option( 'translatesense_all_xml' );
delete_option( 'translatesense_gutenberg_xml' );
delete_option( 'translatesense_elementor_xml' );
delete_option( 'translatesense_classic_xml' );
delete_option( 'translatesense_db_version' );
delete_option( 'translatesense_statics' );
delete_option( 'translatesense_hide_review' );
delete_option( 'translatesense_install_date' );

// Clear transients
delete_transient( 'translatesense_polylang_missing_notice' );

// Clear scheduled cron events
wp_clear_scheduled_hook( 'translatesense_cache_cleanup' );
wp_clear_scheduled_hook( 'translatesense_bulk_process_cron' );
wp_clear_scheduled_hook( 'translatesense_bulk_cron_tick' );
