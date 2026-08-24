<?php

declare(strict_types=1);

namespace TranslateSense\Includes;

use WP_Error;
use SimpleXMLElement;
use DOMDocument;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Xml_Engine {

	/**
	 * Supported builders.
	 */
	const BUILDERS = array( 'gutenberg', 'elementor', 'divi', 'classic' );

	/**
	 * Canonical option key for unified 'all' editor configuration.
	 */
	const OPTION_ALL_XML = 'translatesense_all_xml';

	/**
	 * Cached parsed rules.
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
	 * Get custom XML file path for a specific builder.
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', 'classic', 'all', or 'core'
	 * @return string
	 */
	public static function get_builder_xml_path( $builder = 'all' ) {
		$builder    = ( 'core' === $builder ) ? 'all' : $builder;
		$upload_dir = wp_upload_dir();
		$dir        = trailingslashit( $upload_dir['basedir'] ) . 'translatesense-configs';

		return $dir . '/' . sanitize_key( $builder ) . '-config.xml';
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
	 * @param string $editor 'all', 'gutenberg', 'elementor', 'divi', 'classic', or 'core'
	 * @return string
	 */
	public static function get_config( $editor = 'all' ) {
		$editor = ! empty( $editor ) ? sanitize_key( $editor ) : 'all';
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

		// 2. Specific builder configuration (gutenberg, elementor, divi, classic)
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

		// Extract editor-specific section from the unified 'all' configuration in option table
		$all_xml = self::get_config( 'all' );
		if ( ! empty( $all_xml ) ) {
			$extracted = self::extract_builder_section( $all_xml, $editor );
			if ( ! empty( $extracted ) ) {
				return $extracted;
			}
		}

		return self::get_default_builder_skeleton( $editor );
	}

	/**
	 * Get raw XML string for a specific builder (Backward Compatibility Alias).
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', 'classic', 'all', or 'core'
	 * @return string
	 */
	public static function get_builder_xml_raw( $builder = 'all' ) {
		return self::get_config( $builder );
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
	 */
	public static function get_default_builder_skeleton( $builder ) {
		switch ( $builder ) {
			case 'gutenberg':
				return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n    </gutenberg-blocks>\n</wpml-config>";
			case 'elementor':
				return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <elementor-widgets>\n    </elementor-widgets>\n</wpml-config>";
			case 'divi':
				return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <divi-modules>\n    </divi-modules>\n</wpml-config>";
			case 'classic':
				return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <custom-fields>\n    </custom-fields>\n</wpml-config>";
			default:
				return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n    </gutenberg-blocks>\n    <elementor-widgets>\n    </elementor-widgets>\n    <divi-modules>\n    </divi-modules>\n    <custom-fields>\n    </custom-fields>\n</wpml-config>";
		}
	}

	/**
	 * Extract a specific builder's XML section from a unified XML string.
	 */
	private static function extract_builder_section( $xml_string, $builder ) {
		if ( empty( trim( $xml_string ) ) ) {
			return '';
		}

		libxml_use_internal_errors( true );
		$xml = simplexml_load_string( $xml_string );
		if ( ! $xml ) {
			libxml_clear_errors();
			return '';
		}

		$node_name = '';
		if ( 'gutenberg' === $builder ) {
			$node_name = 'gutenberg-blocks';
		} elseif ( 'elementor' === $builder ) {
			$node_name = 'elementor-widgets';
		} elseif ( 'divi' === $builder ) {
			$node_name = 'divi-modules';
		} elseif ( 'classic' === $builder ) {
			$node_name = 'custom-fields';
		}

		if ( ! $node_name || ! isset( $xml->{$node_name} ) ) {
			return '';
		}

		$wrapper = new SimpleXMLElement( '<?xml version="1.0" encoding="UTF-8"?><wpml-config></wpml-config>' );
		self::simplexml_append_child( $wrapper, $xml->{$node_name} );

		$dom                     = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;
		$dom->loadXML( $wrapper->asXML() );
		return $dom->saveXML();
	}

	/**
	 * Helper to append SimpleXMLElement child recursively.
	 */
	private static function simplexml_append_child( SimpleXMLElement $to, SimpleXMLElement $from ) {
		$to_dom   = dom_import_simplexml( $to );
		$from_dom = dom_import_simplexml( $from );
		$to_dom->appendChild( $to_dom->ownerDocument->importNode( $from_dom, true ) );
	}

	/**
	 * Validate XML syntax.
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
	 * @param string $editor 'all', 'gutenberg', 'elementor', 'divi', 'classic', or 'core'
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_config( $editor, $xml_string ) {
		$editor = ! empty( $editor ) ? sanitize_key( $editor ) : 'all';
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
	 * @param string $builder 'gutenberg', 'elementor', 'divi', 'classic', 'all', or 'core'
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_builder_xml( $builder, $xml_string ) {
		return self::save_config( $builder, $xml_string );
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
	 * @param string $builder 'gutenberg', 'elementor', 'divi', or 'classic'
	 * @param string $name Name/ID of the block/widget
	 * @return string Formatted XML snippet
	 */
	public static function get_widget_xml_snippet( $builder, $name ) {
		// 1. Search in builder custom XML and core/all XML
		$xml_sources = array(
			self::get_config( $builder ),
			self::get_config( 'all' ),
		);

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

			if ( 'gutenberg' === $builder && isset( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
				foreach ( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} as $blk ) {
					if ( (string) $blk['name'] === $name ) {
						return self::wrap_simplexml_in_wpml_config( $blk, 'gutenberg-blocks' );
					}
				}
			} elseif ( 'elementor' === $builder && isset( $xml->{'elementor-widgets'}->widget ) ) {
				foreach ( $xml->{'elementor-widgets'}->widget as $wdg ) {
					if ( (string) $wdg['name'] === $name ) {
						return self::wrap_simplexml_in_wpml_config( $wdg, 'elementor-widgets' );
					}
				}
			} elseif ( 'divi' === $builder && isset( $xml->{'divi-modules'}->module ) ) {
				foreach ( $xml->{'divi-modules'}->module as $mod ) {
					if ( (string) $mod['name'] === $name ) {
						return self::wrap_simplexml_in_wpml_config( $mod, 'divi-modules' );
					}
				}
			} elseif ( 'classic' === $builder && isset( $xml->{'custom-fields'}->{'custom-field'} ) ) {
				foreach ( $xml->{'custom-fields'}->{'custom-field'} as $cf ) {
					if ( trim( (string) $cf ) === $name ) {
						return self::wrap_simplexml_in_wpml_config( $cf, 'custom-fields' );
					}
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
			return self::generate_xml_snippet( 'gutenberg', $name, $keys );
		} elseif ( 'elementor' === $builder ) {
			$widget_rules = $rules['elementor'][ $name ] ?? null;
			$fields       = ( $widget_rules && ! empty( $widget_rules['fields'] ) ) ? $widget_rules['fields'] : array(
				'title' => array(
					'type'        => 'title',
					'editor_type' => 'LINE',
				),
			);
			return self::generate_xml_snippet( 'elementor', $name, $fields );
		} elseif ( 'divi' === $builder ) {
			$module_rules = $rules['divi'][ $name ] ?? null;
			$fields       = ( $module_rules && ! empty( $module_rules['fields'] ) ) ? $module_rules['fields'] : array(
				'content' => array(
					'type'        => 'content',
					'editor_type' => 'VISUAL',
				),
			);
			return self::generate_xml_snippet( 'divi', $name, $fields );
		}

		return self::get_default_builder_skeleton( $builder );
	}

	/**
	 * Save dynamic XML snippet for a specific block or widget.
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', or 'classic'
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
		$raw_xml        = self::get_builder_xml_raw( $target_builder );
		$xml            = simplexml_load_string( $raw_xml );
		if ( ! $xml ) {
			$xml = simplexml_load_string( self::get_default_builder_skeleton( $target_builder ) );
		}

		$section_name = '';
		if ( 'gutenberg' === $target_builder ) {
			$section_name = 'gutenberg-blocks';
		} elseif ( 'elementor' === $target_builder ) {
			$section_name = 'elementor-widgets';
		} elseif ( 'divi' === $target_builder ) {
			$section_name = 'divi-modules';
		} elseif ( 'classic' === $target_builder ) {
			$section_name = 'custom-fields';
		}

		if ( ! isset( $xml->{$section_name} ) ) {
			$xml->addChild( $section_name );
		}

		// Find new node from snippet
		$new_node = null;
		if ( 'gutenberg' === $target_builder && isset( $snippet_doc->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
			$new_node = $snippet_doc->{'gutenberg-blocks'}->{'gutenberg-block'}[0];
		} elseif ( 'elementor' === $target_builder && isset( $snippet_doc->{'elementor-widgets'}->widget ) ) {
			$new_node = $snippet_doc->{'elementor-widgets'}->widget[0];
		} elseif ( 'divi' === $target_builder && isset( $snippet_doc->{'divi-modules'}->module ) ) {
			$new_node = $snippet_doc->{'divi-modules'}->module[0];
		} elseif ( 'classic' === $target_builder && isset( $snippet_doc->{'custom-fields'}->{'custom-field'} ) ) {
			$new_node = $snippet_doc->{'custom-fields'}->{'custom-field'}[0];
		}

		if ( ! $new_node ) {
			return self::save_builder_xml( $target_builder, $snippet_xml );
		}

		// Remove existing node with same name if present in custom XML
		$dom_target = dom_import_simplexml( $xml->{$section_name} );
		$dom_nodes  = $dom_target->childNodes;
		for ( $i = $dom_nodes->length - 1; $i >= 0; $i-- ) {
			$child = $dom_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType ) {
				$child_name = $child->getAttribute( 'name' );
				if ( ! $child_name && 'custom-fields' === $section_name ) {
					$child_name = trim( $child->textContent );
				}
				if ( $child_name === $name ) {
					$dom_target->removeChild( $child );
				}
			}
		}

		// Append new node
		$new_dom = dom_import_simplexml( $new_node );
		$dom_target->appendChild( $dom_target->ownerDocument->importNode( $new_dom, true ) );

		return self::save_builder_xml( $target_builder, $xml->asXML() );
	}

	/**
	 * Helper to wrap a SimpleXMLElement node in full <wpml-config> document.
	 */
	private static function wrap_simplexml_in_wpml_config( SimpleXMLElement $node, $section_name ) {
		$wrapper = new SimpleXMLElement( '<?xml version="1.0" encoding="UTF-8"?><wpml-config><' . $section_name . '></' . $section_name . '></wpml-config>' );
		self::simplexml_append_child( $wrapper->{$section_name}, $node );

		$dom                     = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;
		$dom->loadXML( $wrapper->asXML() );
		return $dom->saveXML();
	}

	/**
	 * Get unified parsed rules for all builders or a specific builder.
	 *
	 * @param string|bool $editor 'all', 'gutenberg', 'elementor', 'divi', 'classic', or boolean $force_reload
	 * @param bool        $force_reload Whether to force reload parsed cache
	 * @return array
	 */
	public static function get_all_rules( $editor = 'all', $force_reload = false ) {
		// Handle legacy call where boolean $force_reload was passed as first argument
		if ( is_bool( $editor ) ) {
			$force_reload = $editor;
			$editor       = 'all';
		}

		$editor = ! empty( $editor ) ? sanitize_key( (string) $editor ) : 'all';
		if ( 'core' === $editor ) {
			$editor = 'all';
		}

		if ( null === self::$parsed_rules || $force_reload ) {
			$rules = array(
				'gutenberg'     => array(),
				'elementor'     => array(),
				'divi'          => array(),
				'custom_fields' => array(),
			);

			// 1. Parse unified 'all' XML configuration from option table
			$all_xml_str = self::get_config( 'all' );
			if ( ! empty( $all_xml_str ) ) {
				self::merge_xml_into_rules( $all_xml_str, $rules, 'all' );
			}

			// 2. Parse builder-specific custom overrides from option table / files
			foreach ( self::BUILDERS as $b ) {
				$b_xml = get_option( 'translatesense_' . $b . '_xml', '' );
				if ( empty( $b_xml ) ) {
					$b_file = self::get_builder_xml_path( $b );
					if ( file_exists( $b_file ) ) {
						$b_xml = file_get_contents( $b_file );
					}
				}
				if ( ! empty( $b_xml ) ) {
					self::merge_xml_into_rules( $b_xml, $rules, 'custom' );
				}
			}

			self::$parsed_rules = $rules;
		}

		if ( 'all' === $editor ) {
			return self::$parsed_rules;
		}

		if ( 'gutenberg' === $editor ) {
			return self::$parsed_rules['gutenberg'] ?? array();
		}
		if ( 'elementor' === $editor ) {
			return self::$parsed_rules['elementor'] ?? array();
		}
		if ( 'divi' === $editor ) {
			return self::$parsed_rules['divi'] ?? array();
		}
		if ( 'classic' === $editor || 'custom_fields' === $editor ) {
			return self::$parsed_rules['custom_fields'] ?? array();
		}

		return self::$parsed_rules;
	}

	/**
	 * Parse XML and populate rules array.
	 */
	private static function merge_xml_into_rules( $xml_string, &$rules, $source = 'core' ) {
		libxml_use_internal_errors( true );
		$xml = simplexml_load_string( $xml_string );
		if ( ! $xml ) {
			libxml_clear_errors();
			return;
		}

		// Gutenberg Blocks
		if ( isset( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
			foreach ( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} as $block ) {
				$name = (string) $block['name'];
				if ( ! isset( $rules['gutenberg'][ $name ] ) ) {
					$rules['gutenberg'][ $name ] = array(
						'name'   => $name,
						'source' => $source,
						'keys'   => array(),
					);
				}
				if ( isset( $block->key ) ) {
					foreach ( $block->key as $key_node ) {
						$key_name = (string) $key_node['name'];
						$rules['gutenberg'][ $name ]['keys'][ $key_name ] = self::parse_gutenberg_key_node( $key_node );
					}
				}
			}
		}

		// Elementor Widgets
		if ( isset( $xml->{'elementor-widgets'}->widget ) ) {
			foreach ( $xml->{'elementor-widgets'}->widget as $widget ) {
				$name = (string) $widget['name'];
				if ( ! isset( $rules['elementor'][ $name ] ) ) {
					$rules['elementor'][ $name ] = array(
						'name'       => $name,
						'source'     => $source,
						'conditions' => array(),
						'fields'     => array(),
					);
				}

				if ( isset( $widget->conditions->condition ) ) {
					foreach ( $widget->conditions->condition as $cond ) {
						$rules['elementor'][ $name ]['conditions'][ (string) $cond['key'] ] = (string) $cond;
					}
				}

				if ( isset( $widget->fields->field ) ) {
					foreach ( $widget->fields->field as $fld ) {
						$field_path = trim( (string) $fld );
						$rules['elementor'][ $name ]['fields'][ $field_path ] = array(
							'path'        => $field_path,
							'type'        => (string) ( $fld['type'] ?? 'title' ),
							'editor_type' => (string) ( $fld['editor_type'] ?? 'LINE' ),
						);
					}
				}
			}
		}

		// Divi Modules
		if ( isset( $xml->{'divi-modules'}->module ) ) {
			foreach ( $xml->{'divi-modules'}->module as $module ) {
				$name = (string) $module['name'];
				if ( ! isset( $rules['divi'][ $name ] ) ) {
					$rules['divi'][ $name ] = array(
						'name'   => $name,
						'source' => $source,
						'fields' => array(),
					);
				}
				if ( isset( $module->fields->field ) ) {
					foreach ( $module->fields->field as $fld ) {
						$field_name                                      = trim( (string) $fld );
						$rules['divi'][ $name ]['fields'][ $field_name ] = array(
							'field'       => $field_name,
							'type'        => (string) ( $fld['type'] ?? 'content' ),
							'editor_type' => (string) ( $fld['editor_type'] ?? 'VISUAL' ),
						);
					}
				}
			}
		}

		// Custom fields
		if ( isset( $xml->{'custom-fields'}->{'custom-field'} ) ) {
			foreach ( $xml->{'custom-fields'}->{'custom-field'} as $cf ) {
				$field_name                            = trim( (string) $cf );
				$rules['custom_fields'][ $field_name ] = array(
					'name'   => $field_name,
					'action' => (string) ( $cf['action'] ?? 'translate' ),
					'source' => $source,
				);
			}
		}
	}

	/**
	 * Helper: Recursively parse Gutenberg block key node.
	 */
	private static function parse_gutenberg_key_node( $key_node ) {
		$key_name = (string) $key_node['name'];
		$data     = array(
			'name'        => $key_name,
			'type'        => (string) ( $key_node['type'] ?? 'text' ),
			'editor_type' => (string) ( $key_node['editor_type'] ?? 'VISUAL' ),
		);

		if ( isset( $key_node->key ) ) {
			$children = array();
			foreach ( $key_node->key as $child_node ) {
				$child_name              = (string) $child_node['name'];
				$children[ $child_name ] = self::parse_gutenberg_key_node( $child_node );
			}
			$data['children'] = $children;
		}

		return $data;
	}

	/**
	 * Append or update a rule dynamically in the builder-specific custom XML.
	 */
	public static function append_custom_rule( $builder, $name, $field_details, $conditions = array() ) {
		$target_builder = in_array( $builder, self::BUILDERS, true ) ? $builder : 'gutenberg';
		$raw_xml        = self::get_builder_xml_raw( $target_builder );

		libxml_use_internal_errors( true );
		$xml = simplexml_load_string( $raw_xml );
		if ( ! $xml ) {
			$xml = simplexml_load_string( self::get_default_builder_skeleton( $target_builder ) );
		}

		if ( 'gutenberg' === $target_builder ) {
			if ( ! isset( $xml->{'gutenberg-blocks'} ) ) {
				$xml->addChild( 'gutenberg-blocks' );
			}
			$found_block = null;
			foreach ( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} as $blk ) {
				if ( (string) $blk['name'] === $name ) {
					$found_block = $blk;
					break;
				}
			}
			if ( ! $found_block ) {
				$found_block = $xml->{'gutenberg-blocks'}->addChild( 'gutenberg-block' );
				$found_block->addAttribute( 'name', $name );
			}

			foreach ( $field_details as $f_key => $f_info ) {
				$key_exists = false;
				if ( isset( $found_block->key ) ) {
					foreach ( $found_block->key as $k ) {
						if ( (string) $k['name'] === $f_key ) {
							$key_exists = true;
							break;
						}
					}
				}
				if ( ! $key_exists ) {
					$k_node = $found_block->addChild( 'key' );
					$k_node->addAttribute( 'name', $f_key );
					$k_node->addAttribute( 'type', $f_info['type'] ?? 'text' );
					$k_node->addAttribute( 'editor_type', $f_info['editor_type'] ?? 'VISUAL' );
				}
			}
		} elseif ( 'elementor' === $target_builder ) {
			if ( ! isset( $xml->{'elementor-widgets'} ) ) {
				$xml->addChild( 'elementor-widgets' );
			}
			$found_widget = null;
			foreach ( $xml->{'elementor-widgets'}->widget as $wdg ) {
				if ( (string) $wdg['name'] === $name ) {
					$found_widget = $wdg;
					break;
				}
			}
			if ( ! $found_widget ) {
				$found_widget = $xml->{'elementor-widgets'}->addChild( 'widget' );
				$found_widget->addAttribute( 'name', $name );

				$conds_node = $found_widget->addChild( 'conditions' );
				$c_node     = $conds_node->addChild( 'condition', $conditions['widgetType'] ?? $name );
				$c_node->addAttribute( 'key', 'widgetType' );
			}

			if ( ! isset( $found_widget->fields ) ) {
				$found_widget->addChild( 'fields' );
			}

			foreach ( $field_details as $f_path => $f_info ) {
				$field_exists = false;
				if ( isset( $found_widget->fields->field ) ) {
					foreach ( $found_widget->fields->field as $fld ) {
						if ( trim( (string) $fld ) === $f_path ) {
							$field_exists = true;
							break;
						}
					}
				}
				if ( ! $field_exists ) {
					$fld_node = $found_widget->fields->addChild( 'field', htmlspecialchars( $f_path ) );
					$fld_node->addAttribute( 'type', $f_info['type'] ?? 'title' );
					$fld_node->addAttribute( 'editor_type', $f_info['editor_type'] ?? 'LINE' );
				}
			}
		} elseif ( 'divi' === $target_builder ) {
			if ( ! isset( $xml->{'divi-modules'} ) ) {
				$xml->addChild( 'divi-modules' );
			}
			$found_module = null;
			foreach ( $xml->{'divi-modules'}->module as $mod ) {
				if ( (string) $mod['name'] === $name ) {
					$found_module = $mod;
					break;
				}
			}
			if ( ! $found_module ) {
				$found_module = $xml->{'divi-modules'}->addChild( 'module' );
				$found_module->addAttribute( 'name', $name );
			}
			if ( ! isset( $found_module->fields ) ) {
				$found_module->addChild( 'fields' );
			}
			foreach ( $field_details as $f_name => $f_info ) {
				$fld_node = $found_module->fields->addChild( 'field', htmlspecialchars( $f_name ) );
				$fld_node->addAttribute( 'type', $f_info['type'] ?? 'content' );
				$fld_node->addAttribute( 'editor_type', $f_info['editor_type'] ?? 'VISUAL' );
			}
		}

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
		$dom               = new DOMDocument( '1.0', 'UTF-8' );
		$dom->formatOutput = true;
		$root              = $dom->createElement( 'wpml-config' );
		$dom->appendChild( $root );

		if ( 'gutenberg' === $builder ) {
			$section = $dom->createElement( 'gutenberg-blocks' );
			$block   = $dom->createElement( 'gutenberg-block' );
			$block->setAttribute( 'name', $name );
			foreach ( $field_details as $key => $info ) {
				$k_node = $dom->createElement( 'key' );
				$k_node->setAttribute( 'name', $key );
				$k_node->setAttribute( 'type', $info['type'] ?? 'text' );
				$k_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'VISUAL' );
				$block->appendChild( $k_node );
			}
			$section->appendChild( $block );
			$root->appendChild( $section );
		} elseif ( 'elementor' === $builder ) {
			$section = $dom->createElement( 'elementor-widgets' );
			$widget  = $dom->createElement( 'widget' );
			$widget->setAttribute( 'name', $name );

			$conditions = $dom->createElement( 'conditions' );
			$cond       = $dom->createElement( 'condition', $name );
			$cond->setAttribute( 'key', 'widgetType' );
			$conditions->appendChild( $cond );
			$widget->appendChild( $conditions );

			$fields = $dom->createElement( 'fields' );
			foreach ( $field_details as $path => $info ) {
				$f_node = $dom->createElement( 'field', $path );
				$f_node->setAttribute( 'type', $info['type'] ?? 'title' );
				$f_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'LINE' );
				$fields->appendChild( $f_node );
			}
			$widget->appendChild( $fields );
			$section->appendChild( $widget );
			$root->appendChild( $section );
		} elseif ( 'divi' === $builder ) {
			$section = $dom->createElement( 'divi-modules' );
			$mod     = $dom->createElement( 'module' );
			$mod->setAttribute( 'name', $name );
			$fields = $dom->createElement( 'fields' );
			foreach ( $field_details as $field => $info ) {
				$f_node = $dom->createElement( 'field', $field );
				$f_node->setAttribute( 'type', $info['type'] ?? 'content' );
				$f_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'VISUAL' );
				$fields->appendChild( $f_node );
			}
			$mod->appendChild( $fields );
			$section->appendChild( $mod );
			$root->appendChild( $section );
		}

		return $dom->saveXML();
	}
}
