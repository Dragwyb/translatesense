<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Xml_Engine;

use WP_Error;
use SimpleXMLElement;
use DOMDocument;
use DOMElement;
use DOMNode;
use TranslateSense\Includes\Xml_Engine\Builders\Base_Builder;
use TranslateSense\Includes\Xml_Engine\Builders\Gutenberg_Builder;
use TranslateSense\Includes\Xml_Engine\Builders\Elementor_Builder;
use TranslateSense\Includes\Xml_Engine\Builders\Classic_Builder;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Xml_Engine {

	/**
	 * Supported builders.
	 */
	const BUILDERS = array( 'gutenberg', 'elementor', 'classic' );

	/**
	 * Canonical option key for unified 'all' editor configuration.
	 */
	const OPTION_ALL_XML = 'translatesense_all_xml';

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
	 * Initialize engine and ensure uploads directory exists.
	 */
	public static function init() {
		$upload_dir = wp_upload_dir();
		$dir        = trailingslashit( $upload_dir['basedir'] ) . 'translatesense-configs';
		if ( ! file_exists( $dir ) ) {
			wp_mkdir_p( $dir );
		}
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
				'classic'   => new Classic_Builder(),
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
	 * Get XML configuration for a specific editor or all editors combined.
	 * Always retrieves configuration from the WordPress options table.
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
			$saved = get_option( self::OPTION_ALL_XML, '' );
			if ( ! empty( $saved ) ) {
				return $saved;
			}

			// Fallback: prime option table from master XML file
			$path = self::get_master_xml_path();
			if ( file_exists( $path ) ) {
				$file_xml = file_get_contents( $path );
				if ( ! empty( $file_xml ) ) {
					update_option( self::OPTION_ALL_XML, $file_xml );
					return $file_xml;
				}
			}

			return self::get_default_builder_skeleton( 'all' );
		}

		// 2. Specific builder configuration (gutenberg, elementor, classic)
		$option_key = 'translatesense_' . $editor . '_xml';
		$saved      = get_option( $option_key, '' );
		if ( ! empty( $saved ) ) {
			return $saved;
		}

		// Check if custom builder XML file exists in uploads
		$custom_file = self::get_builder_xml_path( $editor );
		if ( file_exists( $custom_file ) ) {
			$file_xml = file_get_contents( $custom_file );
			if ( ! empty( $file_xml ) ) {
				update_option( $option_key, $file_xml );
				return $file_xml;
			}
		}

		// Extract editor-specific section from unified 'all' configuration in option table
		$all_xml = self::get_config( 'all' );
		if ( ! empty( $all_xml ) ) {
			$builder_obj = self::get_builder( $editor );
			if ( $builder_obj ) {
				$extracted = $builder_obj->extract_section( $all_xml );
				if ( ! empty( $extracted ) ) {
					return $extracted;
				}
			}
		}

		return self::get_default_builder_skeleton( $editor );
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

		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n    </gutenberg-blocks>\n    <elementor-widgets>\n    </elementor-widgets>\n    <custom-fields>\n    </custom-fields>\n</wpml-config>";
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
		$xml    = simplexml_load_string( $xml_string );
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
		if ( @$dom->loadXML( $xml_string ) ) {
			$formatted_xml = $dom->saveXML();
		} else {
			$formatted_xml = $xml_string;
		}

		if ( 'all' === $editor ) {
			// Update primary options
			update_option( self::OPTION_ALL_XML, $formatted_xml );

			// Sync file if writable
			$path = self::get_master_xml_path();
			if ( is_writable( dirname( $path ) ) || ( file_exists( $path ) && is_writable( $path ) ) ) {
				@file_put_contents( $path, $formatted_xml );
			}
		} else {
			$option_key = 'translatesense_' . $editor . '_xml';
			update_option( $option_key, $formatted_xml );

			// Sync builder custom config file
			$path = self::get_builder_xml_path( $editor );
			$dir  = dirname( $path );
			if ( ! file_exists( $dir ) ) {
				wp_mkdir_p( $dir );
			}
			@file_put_contents( $path, $formatted_xml );
		}

		// Reset in-memory cache
		self::$parsed_rules = null;

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
				$xml = simplexml_load_string( $xml_str );
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
		$snippet_doc = simplexml_load_string( $snippet_xml );
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
		$xml     = simplexml_load_string( $raw_xml );
		if ( ! $xml ) {
			$xml = simplexml_load_string( self::get_default_builder_skeleton( $target_builder ) );
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
		} elseif ( 'classic' === $target_builder && isset( $snippet_doc->{'custom-fields'}->{'custom-field'} ) ) {
			$new_node = $snippet_doc->{'custom-fields'}->{'custom-field'}[0];
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
				$child_name = $child->getAttribute( 'name' );
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
				$base_doc = simplexml_load_string( $base_snippet_raw );
				if ( $base_doc ) {
					$base_node = null;
					if ( 'gutenberg' === $target_builder && isset( $base_doc->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
						$base_node = $base_doc->{'gutenberg-blocks'}->{'gutenberg-block'}[0];
					} elseif ( 'elementor' === $target_builder && isset( $base_doc->{'elementor-widgets'}->widget ) ) {
						$base_node = $base_doc->{'elementor-widgets'}->widget[0];
					} elseif ( 'classic' === $target_builder && isset( $base_doc->{'custom-fields'}->{'custom-field'} ) ) {
						$base_node = $base_doc->{'custom-fields'}->{'custom-field'}[0];
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
		$dom->loadXML( $xml->asXML() );
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

		if ( null !== self::$parsed_rules && ! $force_reload ) {
			if ( 'all' === $editor || 'core' === $editor ) {
				return self::$parsed_rules;
			}
			if ( 'classic' === $editor ) {
				return self::$parsed_rules['custom_fields'] ?? array();
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
			return self::$parsed_rules['custom_fields'] ?? array();
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
		$xml = simplexml_load_string( $xml_string );
		if ( ! $xml ) {
			libxml_clear_errors();
			return;
		}

		foreach ( self::get_builders() as $builder_obj ) {
			$builder_obj->parse_rules( $xml, $rules, $source );
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
		$xml = simplexml_load_string( $raw_xml );
		if ( ! $xml ) {
			$xml = simplexml_load_string( self::get_default_builder_skeleton( $target_builder ) );
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

// Backward-compatible alias for any code using \TranslateSense\Includes\Xml_Engine
if ( ! class_exists( 'TranslateSense\Includes\Xml_Engine', false ) ) {
	class_alias( 'TranslateSense\Includes\Xml_Engine\Xml_Engine', 'TranslateSense\Includes\Xml_Engine' );
}
