<?php
declare(strict_types=1);

namespace TranslateSense\Includes\XML;

use TranslateSense\Includes\XML\Builders\Base_Builder;
use TranslateSense\Includes\XML\Builders\Gutenberg_Builder;
use TranslateSense\Includes\XML\Builders\Elementor_Builder;

use WP_Error;
use DOMDocument;
use DOMElement;
use DOMNode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Xml_Engine {

	/**
	 * Supported builders.
	 */
	const BUILDERS = array( 'gutenberg', 'elementor' );

	/**
	 * Canonical option key for unified 'all' editor configuration.
	 */
	const OPTION_ALL_XML = 'translatesense_all_xml';

	/**
	 * Transient key for merged XML configuration.
	 */
	const TRANSIENT_MERGED_XML = 'translatesense_merged_xml_config';

	/**
	 * Transient key for active plugins list & fingerprint.
	 */
	const TRANSIENT_ACTIVE_PLUGINS = 'translatesense_active_plugins_list';

	/**
	 * Transient prefix for builder-specific merged XML.
	 */
	const TRANSIENT_MERGED_BUILDER = 'translatesense_merged_xml_';

	/**
	 * Cached builder instances.
	 *
	 * @var array<string, Base_Builder>|null
	 */
	private static $builder_instances = null;

	/**
	 * Cached parsed rules.
	 *
	 * @var array|null
	 */
	private static $parsed_rules = null;

	/**
	 * Initialize engine and hook lifecycle events.
	 */
	public static function init() {
		add_action( 'activated_plugin', array( __CLASS__, 'invalidate_transients' ) );
		add_action( 'deactivated_plugin', array( __CLASS__, 'invalidate_transients' ) );
		add_action( 'switch_theme', array( __CLASS__, 'invalidate_transients' ) );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'invalidate_transients' ) );
	}

	/**
	 * Get builder handler instance by builder slug.
	 *
	 * @param string $builder
	 * @return Base_Builder|null
	 */
	public static function get_builder( $builder ) {
		if ( null === self::$builder_instances ) {
			self::$builder_instances = array(
				'gutenberg' => new Gutenberg_Builder(),
				'elementor' => new Elementor_Builder(),
			);
		}

		$builder = sanitize_key( (string) $builder );
		return self::$builder_instances[ $builder ] ?? null;
	}

	/**
	 * Get all registered builder instances.
	 *
	 * @return array<string, Base_Builder>
	 */
	public static function get_builders() {
		if ( null === self::$builder_instances ) {
			self::get_builder( 'gutenberg' );
		}
		return self::$builder_instances ?? array();
	}

	/**
	 * Get custom XML file path for a specific builder.
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'classic', 'all', or 'core'
	 * @return string
	 */
	public static function get_builder_xml_path( $builder = 'all' ) {
		$builder    = ( 'core' === $builder ) ? 'all' : $builder;
		$upload_dir = wp_upload_dir();
		$dir        = trailingslashit( $upload_dir['basedir'] ) . 'translatesense-configs';

		return $dir . '/' . sanitize_key( (string) $builder ) . '-config.xml';
	}

	/**
	 * Get master XML file path.
	 *
	 * @return string
	 */
	public static function get_master_xml_path() {
		return TRANSLATESENSE_PLUGIN_DIR . 'core-config.xml';
	}

	/**
	 * Get master XML file path (Backward Compatibility Alias).
	 *
	 * @return string
	 */
	public static function get_core_xml_path() {
		return self::get_master_xml_path();
	}

	/**
	 * Invalidate cached transients.
	 */
	public static function invalidate_transients(): void {
		delete_transient( self::TRANSIENT_MERGED_XML );
		delete_transient( self::TRANSIENT_ACTIVE_PLUGINS );
		foreach ( self::BUILDERS as $b ) {
			delete_transient( self::TRANSIENT_MERGED_BUILDER . $b );
		}
		self::$parsed_rules = null;
	}

	/**
	 * Get current list and theme of active plugins.
	 *
	 * @return array{plugins: array, theme: string}
	 */
	public static function get_active_plugins_list(): array {
		$plugins = (array) get_option( 'active_plugins', array() );
		if ( is_multisite() ) {
			$sitewide = (array) get_site_option( 'active_sitewide_plugins', array() );
			$plugins  = array_unique( array_merge( $plugins, array_keys( $sitewide ) ) );
		}
		sort( $plugins );
		$theme = (string) get_stylesheet();

		return array(
			'plugins' => $plugins,
			'theme'   => $theme,
		);
	}

	/**
	 * Generate hash fingerprint of current active plugins and theme.
	 *
	 * @return string
	 */
	public static function get_active_plugins_fingerprint(): string {
		return md5( wp_json_encode( self::get_active_plugins_list() ) );
	}

	/**
	 * Check if active plugins or theme have changed compared to transient.
	 *
	 * @return bool
	 */
	public static function has_active_plugins_changed(): bool {
		$cached = get_transient( self::TRANSIENT_ACTIVE_PLUGINS );
		if ( false === $cached || ! is_array( $cached ) ) {
			return true;
		}
		$current = self::get_active_plugins_list();
		if ( ! isset( $cached['plugins'] ) || ! isset( $cached['theme'] ) ) {
			return true;
		}
		return ( $cached['plugins'] !== $current['plugins'] || $cached['theme'] !== $current['theme'] );
	}

	/**
	 * Retrieve wpml-config.xml content from all active plugins and themes.
	 *
	 * @return array<string, string> Map of plugin/theme identifier to XML content
	 */
	public static function get_active_plugins_wpml_configs(): array {
		$configs     = array();
		$active_info = self::get_active_plugins_list();
		$plugin_base = defined( 'WP_PLUGIN_DIR' ) ? WP_PLUGIN_DIR : WP_CONTENT_DIR . '/plugins';

		foreach ( $active_info['plugins'] as $plugin_file ) {
			$dir_name = dirname( $plugin_file );
			if ( '.' === $dir_name || '' === $dir_name ) {
				$xml_file = trailingslashit( $plugin_base ) . 'wpml-config.xml';
			} else {
				$xml_file = trailingslashit( $plugin_base ) . $dir_name . '/wpml-config.xml';
			}

			if ( file_exists( $xml_file ) && is_readable( $xml_file ) ) {
				$content = file_get_contents( $xml_file );
				if ( ! empty( $content ) ) {
					$configs[ $plugin_file ] = $content;
				}
			}
		}

		// Check active theme/child theme
		$theme_xml = get_stylesheet_directory() . '/wpml-config.xml';
		if ( file_exists( $theme_xml ) && is_readable( $theme_xml ) ) {
			$content = file_get_contents( $theme_xml );
			if ( ! empty( $content ) ) {
				$configs[ 'theme:' . $active_info['theme'] ] = $content;
			}
		}

		// Check parent theme if distinct
		if ( get_template_directory() !== get_stylesheet_directory() ) {
			$parent_xml = get_template_directory() . '/wpml-config.xml';
			if ( file_exists( $parent_xml ) && is_readable( $parent_xml ) ) {
				$content = file_get_contents( $parent_xml );
				if ( ! empty( $content ) ) {
					$configs['parent-theme'] = $content;
				}
			}
		}

		return $configs;
	}

	/**
	 * Find or create child element under parent.
	 *
	 * @param DOMDocument $dom
	 * @param DOMElement  $parent
	 * @param string      $tag_name
	 * @return DOMElement
	 */
	private static function get_or_create_dom_child( DOMDocument $dom, DOMElement $parent, string $tag_name ): DOMElement {
		$nodes = $parent->childNodes;
		for ( $i = 0; $i < $nodes->length; $i++ ) {
			$node = $nodes->item( $i );
			if ( XML_ELEMENT_NODE === $node->nodeType && $node->nodeName === $tag_name ) {
				return $node;
			}
		}
		$new_elem = $dom->createElement( $tag_name );
		return $parent->appendChild( $new_elem );
	}

	/**
	 * Find DOM child element with matching attribute.
	 *
	 * @param DOMElement $parent
	 * @param string     $tag_name
	 * @param string     $attr_name
	 * @param string     $attr_val
	 * @return DOMElement|null
	 */
	private static function find_dom_child_by_attribute( DOMElement $parent, string $tag_name, string $attr_name, string $attr_val ) {
		$nodes = $parent->childNodes;
		for ( $i = 0; $i < $nodes->length; $i++ ) {
			$node = $nodes->item( $i );
			if ( XML_ELEMENT_NODE === $node->nodeType && $node->nodeName === $tag_name ) {
				if ( $node->getAttribute( $attr_name ) === $attr_val ) {
					return $node;
				}
			}
		}
		return null;
	}

	/**
	 * Find DOM child element with matching text content.
	 *
	 * @param DOMElement $parent
	 * @param string     $tag_name
	 * @param string     $text_val
	 * @return DOMElement|null
	 */
	private static function find_dom_child_by_text( DOMElement $parent, string $tag_name, string $text_val ) {
		$nodes = $parent->childNodes;
		for ( $i = 0; $i < $nodes->length; $i++ ) {
			$node = $nodes->item( $i );
			if ( XML_ELEMENT_NODE === $node->nodeType && $node->nodeName === $tag_name ) {
				if ( trim( $node->textContent ) === $text_val ) {
					return $node;
				}
			}
		}
		return null;
	}

	/**
	 * Merge multiple WPML configuration XML strings into a single consolidated XML.
	 *
	 * @param array<string> $xml_strings Array of XML strings to merge.
	 * @return string Consolidated XML string.
	 */
	public static function merge_wpml_xml_documents( array $xml_strings ): string {
		$xml_strings = array_filter( array_map( 'trim', $xml_strings ) );
		if ( empty( $xml_strings ) ) {
			return self::get_default_builder_skeleton( 'all' );
		}

		$dom                     = new DOMDocument( '1.0', 'UTF-8' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;

		// Initialize root skeleton
		$dom->loadXML( self::get_default_builder_skeleton( 'all' ), LIBXML_NONET );
		$root = $dom->documentElement;

		$gb_builder = self::get_builder( 'gutenberg' );
		$ew_builder = self::get_builder( 'elementor' );

		$gb_section = self::get_or_create_dom_child( $dom, $root, 'gutenberg-blocks' );
		$ew_section = self::get_or_create_dom_child( $dom, $root, 'elementor-widgets' );
		$cf_section = self::get_or_create_dom_child( $dom, $root, 'custom-fields' );

		foreach ( $xml_strings as $xml_str ) {
			libxml_use_internal_errors( true );
			if ( false !== stripos( $xml_str, '<!DOCTYPE' ) ) {
				continue;
			}
			$sxml = simplexml_load_string( $xml_str, 'SimpleXMLElement', LIBXML_NONET );
			if ( ! $sxml ) {
				libxml_clear_errors();
				continue;
			}

			foreach ( $sxml->children() as $section ) {
				$section_name = $section->getName();

				if ( 'gutenberg-blocks' === $section_name && isset( $section->{'gutenberg-block'} ) ) {
					foreach ( $section->{'gutenberg-block'} as $block ) {
						$b_type = (string) $block['type'];
						if ( empty( $b_type ) ) {
							continue;
						}
						$existing = self::find_dom_child_by_attribute( $gb_section, 'gutenberg-block', 'type', $b_type );
						if ( $existing && $gb_builder ) {
							$gb_builder->sync_node( $existing, $block );
						} else {
							$node_dom = dom_import_simplexml( $block );
							$gb_section->appendChild( $dom->importNode( $node_dom, true ) );
						}
					}
				} elseif ( 'elementor-widgets' === $section_name && isset( $section->widget ) ) {
					foreach ( $section->widget as $widget ) {
						$w_name = (string) $widget['name'];
						if ( empty( $w_name ) ) {
							continue;
						}
						$existing = self::find_dom_child_by_attribute( $ew_section, 'widget', 'name', $w_name );
						if ( $existing && $ew_builder ) {
							$ew_builder->sync_node( $existing, $widget );
						} else {
							$node_dom = dom_import_simplexml( $widget );
							$ew_section->appendChild( $dom->importNode( $node_dom, true ) );
						}
					}
				} elseif ( 'custom-fields' === $section_name && isset( $section->{'custom-field'} ) ) {
					foreach ( $section->{'custom-field'} as $cf ) {
						$cf_name = trim( (string) $cf );
						if ( empty( $cf_name ) ) {
							continue;
						}
						$existing = self::find_dom_child_by_text( $cf_section, 'custom-field', $cf_name );
						if ( $existing && $cf_builder ) {
							$cf_builder->sync_node( $existing, $cf );
						} else {
							$node_dom = dom_import_simplexml( $cf );
							$cf_section->appendChild( $dom->importNode( $node_dom, true ) );
						}
					}
				} else {
					// Generic WPML sections: <admin-texts>, <taxonomies>, <custom-types>, <shortcodes>, etc.
					$existing_sec = null;
					$root_nodes   = $root->childNodes;
					for ( $j = 0; $j < $root_nodes->length; $j++ ) {
						$r_node = $root_nodes->item( $j );
						if ( XML_ELEMENT_NODE === $r_node->nodeType && $r_node->nodeName === $section_name ) {
							$existing_sec = $r_node;
							break;
						}
					}
					if ( ! $existing_sec ) {
						$sec_dom = dom_import_simplexml( $section );
						$root->appendChild( $dom->importNode( $sec_dom, true ) );
					} else {
						foreach ( $section->children() as $sub_item ) {
							$sub_name  = $sub_item->getName();
							$sub_id    = isset( $sub_item['name'] ) ? (string) $sub_item['name'] : ( isset( $sub_item['type'] ) ? (string) $sub_item['type'] : trim( (string) $sub_item ) );
							$found_sub = null;
							if ( $sub_id ) {
								$found_sub = self::find_dom_child_by_attribute( $existing_sec, $sub_name, 'name', $sub_id )
									?? self::find_dom_child_by_attribute( $existing_sec, $sub_name, 'type', $sub_id )
									?? self::find_dom_child_by_text( $existing_sec, $sub_name, $sub_id );
							}
							if ( ! $found_sub ) {
								$sub_dom = dom_import_simplexml( $sub_item );
								$existing_sec->appendChild( $dom->importNode( $sub_dom, true ) );
							}
						}
					}
				}
			}
		}

		return $dom->saveXML();
	}

	/**
	 * Retrieve consolidated merged XML configuration with active plugin checking and transient caching.
	 *
	 * @param bool $force_refresh Whether to force refresh from files and options.
	 * @return string
	 */
	public static function get_merged_config( bool $force_refresh = false ): string {
		$active_changed = self::has_active_plugins_changed();
		if ( ! $force_refresh && ! $active_changed ) {
			$cached_xml = get_transient( self::TRANSIENT_MERGED_XML );
			if ( ! empty( $cached_xml ) && is_string( $cached_xml ) ) {
				return $cached_xml;
			}
		}

		// 1. Core / Default XML
		$core_xml  = '';
		$core_path = self::get_master_xml_path();
		if ( file_exists( $core_path ) ) {
			$core_xml = (string) file_get_contents( $core_path );
		}

		// 2. Active plugins & theme WPML configs
		$plugin_configs = self::get_active_plugins_wpml_configs();

		// 3. User custom / added XML configs
		$custom_xmls = array();
		$saved_all   = get_option( self::OPTION_ALL_XML, '' );
		if ( ! empty( $saved_all ) && trim( $saved_all ) !== trim( $core_xml ) ) {
			$custom_xmls[] = $saved_all;
		}
		foreach ( self::BUILDERS as $b ) {
			$b_xml = get_option( 'translatesense_' . $b . '_xml', '' );
			if ( ! empty( $b_xml ) ) {
				$custom_xmls[] = $b_xml;
			}
		}

		// Merge order: core -> active plugins -> user custom
		$all_sources = array_merge(
			array( $core_xml ),
			array_values( $plugin_configs ),
			$custom_xmls
		);

		$merged_xml = self::merge_wpml_xml_documents( $all_sources );

		// Format XML
		$dom                     = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;
		if ( false === stripos( $merged_xml, '<!DOCTYPE' ) && @$dom->loadXML( $merged_xml, LIBXML_NONET ) ) {
			$formatted_xml = $dom->saveXML();
		} else {
			$formatted_xml = $merged_xml;
		}

		// Save to transients
		set_transient( self::TRANSIENT_MERGED_XML, $formatted_xml, DAY_IN_SECONDS );
		set_transient( self::TRANSIENT_ACTIVE_PLUGINS, self::get_active_plugins_list(), DAY_IN_SECONDS );

		return $formatted_xml;
	}

	/**
	 * Get XML configuration for a specific editor or all editors combined.
	 * Transparently handles active plugin configs, custom additions, and transients.
	 *
	 * @param string $editor 'all', 'gutenberg', 'elementor', 'classic', or 'core'
	 * @return string
	 */
	public static function get_config( $editor = 'all' ) {
		$editor = ! empty( $editor ) ? sanitize_key( (string) $editor ) : 'all';
		if ( 'core' === $editor ) {
			$editor = 'all';
		}

		// 1. Unified 'all' configuration
		if ( 'all' === $editor ) {
			return self::get_merged_config();
		}

		// 2. Specific builder configuration (gutenberg, elementor, classic)
		if ( self::has_active_plugins_changed() ) {
			self::invalidate_transients();
		}

		$transient_builder_key = self::TRANSIENT_MERGED_BUILDER . $editor;
		$cached_builder_xml    = get_transient( $transient_builder_key );
		if ( ! empty( $cached_builder_xml ) && is_string( $cached_builder_xml ) ) {
			return $cached_builder_xml;
		}

		$option_key = 'translatesense_' . $editor . '_xml';
		$saved      = get_option( $option_key, '' );
		if ( ! empty( $saved ) ) {
			set_transient( $transient_builder_key, $saved, DAY_IN_SECONDS );
			return $saved;
		}

		// Extract editor-specific section from unified merged configuration
		$all_xml = self::get_config( 'all' );
		if ( ! empty( $all_xml ) ) {
			$builder_obj = self::get_builder( $editor );
			if ( $builder_obj ) {
				$extracted = $builder_obj->extract_section( $all_xml );
				if ( ! empty( $extracted ) ) {
					set_transient( $transient_builder_key, $extracted, DAY_IN_SECONDS );
					return $extracted;
				}
			}
		}

		$default_skel = self::get_default_builder_skeleton( $editor );
		set_transient( $transient_builder_key, $default_skel, DAY_IN_SECONDS );
		return $default_skel;
	}

	/**
	 * Get raw XML string for a specific builder (Backward Compatibility Alias).
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'classic', 'all', or 'core'
	 * @return string
	 */
	public static function get_builder_xml_raw( $builder = 'all' ) {
		return self::get_config( (string) $builder );
	}

	/**
	 * Get all XML raw string from database option table (Backward Compatibility Alias).
	 *
	 * @return string
	 */
	public static function get_core_xml_raw() {
		return self::get_config( 'all' );
	}

	/**
	 * Get custom XML raw string (Backward Compatibility Alias).
	 *
	 * @return string
	 */
	public static function get_custom_xml_raw() {
		return self::get_config( 'all' );
	}

	/**
	 * Default XML skeleton per builder.
	 *
	 * @param string $builder
	 * @return string
	 */
	public static function get_default_builder_skeleton( $builder ) {
		$builder_obj = self::get_builder( (string) $builder );
		if ( $builder_obj ) {
			return $builder_obj->get_default_skeleton();
		}

		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n    </gutenberg-blocks>\n    <elementor-widgets>\n    </elementor-widgets>\n</wpml-config>";
	}

	/**
	 * Validate XML syntax.
	 *
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function validate_xml( $xml_string ) {
		if ( empty( trim( $xml_string ) ) ) {
			return new WP_Error( 'empty_xml', __( 'XML content cannot be empty.', 'translatesense' ) );
		}

		libxml_use_internal_errors( true );
		if ( false !== stripos( $xml_string, '<!DOCTYPE' ) ) {
			return new WP_Error( 'xml_doctype_not_allowed', __( 'XML DOCTYPE declarations are not allowed.', 'translatesense' ) );
		}

		$xml    = simplexml_load_string( $xml_string, 'SimpleXMLElement', LIBXML_NONET );
		$errors = libxml_get_errors();
		libxml_clear_errors();

		if ( false === $xml || ! empty( $errors ) ) {
			$error_msgs = array();
			foreach ( $errors as $err ) {
				$error_msgs[] = sprintf( 'Line %d: %s', $err->line, trim( $err->message ) );
			}
			return new WP_Error( 'xml_parse_error', implode( '; ', $error_msgs ) );
		}

		return true;
	}

	/**
	 * Save XML configuration for a specific editor or all editors.
	 * Always persists to the database options table.
	 *
	 * @param string $editor 'all', 'gutenberg', 'elementor', 'classic', or 'core'
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_config( $editor, $xml_string ) {
		$editor = ! empty( $editor ) ? sanitize_key( (string) $editor ) : 'all';
		if ( 'core' === $editor ) {
			$editor = 'all';
		}

		$validation = self::validate_xml( $xml_string );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		// Format XML
		$dom                     = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;
		if ( false === stripos( $xml_string, '<!DOCTYPE' ) && @$dom->loadXML( $xml_string, LIBXML_NONET ) ) {
			$formatted_xml = $dom->saveXML();
		} else {
			$formatted_xml = $xml_string;
		}

		if ( 'all' === $editor ) {
			// Update primary options in database
			update_option( self::OPTION_ALL_XML, $formatted_xml );
		} else {
			$option_key = 'translatesense_' . $editor . '_xml';
			update_option( $option_key, $formatted_xml );
		}

		// Reset in-memory cache and transients
		self::$parsed_rules = null;
		self::invalidate_transients();

		return true;
	}

	/**
	 * Save custom XML string for a specific builder (Backward Compatibility Alias).
	 *
	 * @param string $builder
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_builder_xml( $builder, $xml_string ) {
		return self::save_config( (string) $builder, $xml_string );
	}

	/**
	 * Save generic custom XML (Backward Compatibility Alias).
	 *
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_custom_xml( $xml_string ) {
		return self::save_config( 'all', $xml_string );
	}

	/**
	 * Save core XML string into database option table and sync to file (Backward Compatibility Alias).
	 *
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_core_xml( $xml_string ) {
		return self::save_config( 'all', $xml_string );
	}

	/**
	 * Get exact dynamic XML snippet for a specific block/widget/module.
	 * Searches active XML configuration (custom and all in option table).
	 *
	 * @param string $builder 'gutenberg', 'elementor', or 'classic'
	 * @param string $name Name/ID of the block/widget
	 * @return string Formatted XML snippet
	 */
	public static function get_widget_xml_snippet( $builder, $name ) {
		$builder_obj = self::get_builder( (string) $builder );

		// 1. Search in builder custom XML and core/all XML
		$xml_sources = array(
			self::get_config( (string) $builder ),
			self::get_config( 'all' ),
		);

		if ( $builder_obj ) {
			foreach ( $xml_sources as $xml_str ) {
				if ( empty( trim( $xml_str ) ) ) {
					continue;
				}
				libxml_use_internal_errors( true );
				if ( false !== stripos( $xml_str, '<!DOCTYPE' ) ) {
					continue;
				}
				$xml = simplexml_load_string( $xml_str, 'SimpleXMLElement', LIBXML_NONET );
				if ( ! $xml ) {
					libxml_clear_errors();
					continue;
				}

				$snippet = $builder_obj->extract_widget_snippet( $xml, (string) $name );
				if ( null !== $snippet ) {
					return $snippet;
				}
			}
		}

		// 2. Fallback: generate from parsed rules or default structure
		$rules = self::get_all_rules();
		if ( 'gutenberg' === $builder ) {
			$block_rules = $rules['gutenberg'][ $name ] ?? null;
			$keys        = ( $block_rules && ! empty( $block_rules['keys'] ) ) ? $block_rules['keys'] : array(
				'content' => array(
					'name'        => 'content',
					'type'        => 'text',
					'editor_type' => 'VISUAL',
				),
			);
			return self::generate_xml_snippet( 'gutenberg', (string) $name, $keys );
		} elseif ( 'elementor' === $builder ) {
			$widget_rules = $rules['elementor'][ $name ] ?? null;
			$fields       = ( $widget_rules && ! empty( $widget_rules['fields'] ) ) ? $widget_rules['fields'] : array(
				'title' => array(
					'type'        => 'title',
					'editor_type' => 'LINE',
				),
			);
			return self::generate_xml_snippet( 'elementor', (string) $name, $fields );
		}

		return self::get_default_builder_skeleton( (string) $builder );
	}

	/**
	 * Save dynamic XML snippet for a specific block or widget.
	 * Updates existing child in place (marking removed keys with noTranslate="true") and adding new keys.
	 *
	 * @param string $builder 'gutenberg', 'elementor', or 'classic'
	 * @param string $name
	 * @param string $snippet_xml
	 * @return bool|WP_Error
	 */
	public static function save_widget_xml_snippet( $builder, $name, $snippet_xml ) {
		$validation = self::validate_xml( $snippet_xml );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		libxml_use_internal_errors( true );
		$snippet_doc = simplexml_load_string( $snippet_xml, 'SimpleXMLElement', LIBXML_NONET );
		if ( ! $snippet_doc ) {
			libxml_clear_errors();
			return new WP_Error( 'invalid_snippet', __( 'Invalid XML snippet.', 'translatesense' ) );
		}

		$target_builder = in_array( $builder, self::BUILDERS, true ) ? $builder : 'gutenberg';
		$builder_obj    = self::get_builder( $target_builder );
		if ( ! $builder_obj ) {
			return new WP_Error( 'unsupported_builder', __( 'Unsupported builder.', 'translatesense' ) );
		}

		$raw_xml = self::get_builder_xml_raw( $target_builder );
		$xml     = false !== stripos( $raw_xml, '<!DOCTYPE' ) ? false : simplexml_load_string( $raw_xml, 'SimpleXMLElement', LIBXML_NONET );
		if ( ! $xml ) {
			$xml = simplexml_load_string( self::get_default_builder_skeleton( $target_builder ), 'SimpleXMLElement', LIBXML_NONET );
		}

		$section_name = $builder_obj->get_section_name();
		if ( ! isset( $xml->{$section_name} ) ) {
			$xml->addChild( $section_name );
		}

		// Find new node from snippet
		$new_node = null;
		if ( 'gutenberg' === $target_builder && isset( $snippet_doc->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
			$new_node = $snippet_doc->{'gutenberg-blocks'}->{'gutenberg-block'}[0];
		} elseif ( 'elementor' === $target_builder && isset( $snippet_doc->{'elementor-widgets'}->widget ) ) {
			$new_node = $snippet_doc->{'elementor-widgets'}->widget[0];
		}

		if ( ! $new_node ) {
			return self::save_builder_xml( $target_builder, $snippet_xml );
		}

		$dom_target = dom_import_simplexml( $xml->{$section_name} );

		// Find existing child with matching name in current custom XML
		$existing_child = null;
		$dom_nodes      = $dom_target->childNodes;
		for ( $i = 0; $i < $dom_nodes->length; $i++ ) {
			$child = $dom_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType ) {
				$child_name = $child->getAttribute( 'type' );
				if ( ! $child_name && 'custom-fields' === $section_name ) {
					$child_name = trim( $child->textContent );
				}
				if ( $child_name === $name ) {
					$existing_child = $child;
					break;
				}
			}
		}

		// If not found in custom XML, check if base rule exists in core/all XML to seed existing child
		if ( ! $existing_child ) {
			$base_snippet_raw = self::get_widget_xml_snippet( $target_builder, (string) $name );
			if ( ! empty( $base_snippet_raw ) ) {
				$base_doc = false !== stripos( $base_snippet_raw, '<!DOCTYPE' ) ? false : simplexml_load_string( $base_snippet_raw, 'SimpleXMLElement', LIBXML_NONET );
				if ( $base_doc ) {
					$base_node = null;
					if ( 'gutenberg' === $target_builder && isset( $base_doc->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
						$base_node = $base_doc->{'gutenberg-blocks'}->{'gutenberg-block'}[0];
					} elseif ( 'elementor' === $target_builder && isset( $base_doc->{'elementor-widgets'}->widget ) ) {
						$base_node = $base_doc->{'elementor-widgets'}->widget[0];
					}
					if ( $base_node ) {
						$base_dom       = dom_import_simplexml( $base_node );
						$existing_child = $dom_target->appendChild( $dom_target->ownerDocument->importNode( $base_dom, true ) );
					}
				}
			}
		}

		if ( $existing_child ) {
			// Update existing child in place: preserve keys, mark removed with noTranslate="true", add new keys
			$builder_obj->sync_node( $existing_child, $new_node );
		} else {
			// Append new node if it did not exist
			$new_dom = dom_import_simplexml( $new_node );
			$dom_target->appendChild( $dom_target->ownerDocument->importNode( $new_dom, true ) );
		}

		$dom                     = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;
		$dom->loadXML( $xml->asXML(), LIBXML_NONET );
		$formatted_xml = $dom->saveXML();

		return self::save_builder_xml( $target_builder, $formatted_xml );
	}

	/**
	 * Get unified parsed rules for all builders or a specific builder.
	 *
	 * @param string|bool $editor 'all', 'gutenberg', 'elementor', 'classic', or boolean $force_reload
	 * @param bool        $force_reload Whether to force reload parsed cache
	 * @return array
	 */
	public static function get_all_rules( $editor = 'all', $force_reload = false ) {
		if ( is_bool( $editor ) ) {
			$force_reload = $editor;
			$editor       = 'all';
		}

		$editor = ! empty( $editor ) ? sanitize_key( (string) $editor ) : 'all';

		if ( self::has_active_plugins_changed() ) {
			self::invalidate_transients();
			$force_reload = true;
		}

		if ( null !== self::$parsed_rules && ! $force_reload ) {
			if ( 'all' === $editor || 'core' === $editor ) {
				return self::$parsed_rules;
			}
			if ( 'classic' === $editor ) {
				return array();
			}
			return self::$parsed_rules[ $editor ] ?? array();
		}

		$rules = array(
			'gutenberg'                  => array(),
			'elementor'                  => array(),
			'custom_fields'              => array(),
			'custom_fields_no_translate' => array(),
		);

		// 1. Parse unified / core config from option table (or master XML)
		$all_xml = self::get_config( 'all' );
		if ( ! empty( $all_xml ) ) {
			self::merge_xml_into_rules( $all_xml, $rules, 'core' );
		}

		// 2. Parse builder-specific custom configs
		foreach ( self::BUILDERS as $b ) {
			$custom_xml = get_option( 'translatesense_' . $b . '_xml', '' );
			if ( ! empty( $custom_xml ) ) {
				self::merge_xml_into_rules( $custom_xml, $rules, 'custom' );
			}
		}

		self::$parsed_rules = $rules;

		if ( 'all' === $editor || 'core' === $editor ) {
			return self::$parsed_rules;
		}
		if ( 'classic' === $editor ) {
			return array();
		}
		return self::$parsed_rules[ $editor ] ?? array();
	}

	/**
	 * Parse XML string and populate rules array via builder instances.
	 *
	 * @param string $xml_string
	 * @param array  $rules
	 * @param string $source
	 * @return void
	 */
	private static function merge_xml_into_rules( $xml_string, &$rules, $source = 'core' ) {
		libxml_use_internal_errors( true );
		if ( empty( trim( $xml_string ) ) || false !== stripos( $xml_string, '<!DOCTYPE' ) ) {
			return;
		}
		$xml = simplexml_load_string( $xml_string, 'SimpleXMLElement', LIBXML_NONET );
		if ( ! $xml ) {
			libxml_clear_errors();
			return;
		}

		foreach ( self::get_builders() as $builder_obj ) {
			$builder_obj->parse_rules( $xml, $rules, $source );
		}

		if ( isset( $xml->{'custom-fields'}->{'custom-field'} ) ) {
			foreach ( $xml->{'custom-fields'}->{'custom-field'} as $cf ) {
				$field_name      = trim( (string) $cf );
				$action          = (string) ( $cf['action'] ?? 'translate' );
				$is_no_translate = isset( $cf['noTranslate'] ) && in_array( strtolower( (string) $cf['noTranslate'] ), array( 'true', '1', 'yes' ), true );
				if ( $is_no_translate || 'ignore' === $action ) {
					if ( isset( $rules['custom_fields'][ $field_name ] ) ) {
						unset( $rules['custom_fields'][ $field_name ] );
					}
					$rules['custom_fields_no_translate'][ $field_name ] = true;
					continue;
				}
				$rules['custom_fields'][ $field_name ] = array(
					'name'   => $field_name,
					'action' => $action,
					'source' => $source,
				);
			}
		}
	}

	/**
	 * Append or update a rule dynamically in the builder-specific custom XML.
	 *
	 * @param string $builder
	 * @param string $name
	 * @param array  $field_details
	 * @param array  $conditions
	 * @return bool|WP_Error
	 */
	public static function append_custom_rule( $builder, $name, $field_details, $conditions = array() ) {
		$target_builder = in_array( $builder, self::BUILDERS, true ) ? $builder : 'gutenberg';
		$builder_obj    = self::get_builder( $target_builder );
		if ( ! $builder_obj ) {
			return new WP_Error( 'unsupported_builder', __( 'Unsupported builder.', 'translatesense' ) );
		}

		$raw_xml = self::get_builder_xml_raw( $target_builder );

		libxml_use_internal_errors( true );
		$xml = false !== stripos( $raw_xml, '<!DOCTYPE' ) ? false : simplexml_load_string( $raw_xml, 'SimpleXMLElement', LIBXML_NONET );
		if ( ! $xml ) {
			$xml = simplexml_load_string( self::get_default_builder_skeleton( $target_builder ), 'SimpleXMLElement', LIBXML_NONET );
		}

		$builder_obj->append_rule( $xml, (string) $name, $field_details, $conditions );

		return self::save_builder_xml( $target_builder, $xml->asXML() );
	}

	/**
	 * Build standalone XML string snippet from detected widget details.
	 *
	 * @param string $builder
	 * @param string $name
	 * @param array  $field_details
	 * @return string Formatted XML snippet
	 */
	public static function generate_xml_snippet( $builder, $name, $field_details ) {
		$builder_obj = self::get_builder( (string) $builder );
		if ( $builder_obj ) {
			return $builder_obj->generate_snippet( (string) $name, $field_details );
		}

		return self::get_default_builder_skeleton( (string) $builder );
	}
}
