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

// Remove plugin options.
delete_option( 'translatesense_settings' );
delete_option( 'translatesense_api_keys' );
delete_option( 'translatesense_config_posts' );
delete_option( 'translatesense_all_xml' );
delete_option( 'translatesense_gutenberg_xml' );
delete_option( 'translatesense_elementor_xml' );
delete_option( 'translatesense_classic_xml' );
delete_option( 'translatesense_db_version' );
delete_option( 'translatesense_statics' );
delete_option( 'translatesense_hide_review' );
delete_option( 'translatesense_activation_date' );
delete_option( 'translatesense_activation_version' );

// Clear transients.
delete_transient( 'translatesense_polylang_missing_notice' );
delete_transient( 'translatesense_activation_redirect' );
delete_transient( 'translatesense_provider_activated_openai' );
delete_transient( 'translatesense_provider_activated_google' );
delete_transient( 'translatesense_connector_models_openai' );
delete_transient( 'translatesense_connector_models_gemini' );
delete_transient( 'translatesense_models_openai' );
delete_transient( 'translatesense_models_gemini' );
delete_transient( 'translatesense_merged_xml_config' );
delete_transient( 'translatesense_active_plugins_list' );
delete_transient( 'translatesense_merged_xml_gutenberg' );
delete_transient( 'translatesense_merged_xml_elementor' );

// Clear scheduled cron events.
wp_clear_scheduled_hook( 'translatesense_cache_cleanup' );
wp_clear_scheduled_hook( 'translatesense_bulk_process_cron' );
wp_clear_scheduled_hook( 'translatesense_bulk_process_now' );

// Drop plugin database tables.
global $wpdb;
$translatesense_tables = array(
	$wpdb->prefix . 'translatesense_strings',
	$wpdb->prefix . 'translatesense_packages',
	$wpdb->prefix . 'translatesense_translations',
	$wpdb->prefix . 'translatesense_queue',
);
foreach ( $translatesense_tables as $translatesense_table ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$wpdb->query( "DROP TABLE IF EXISTS `{$translatesense_table}`" );
}
