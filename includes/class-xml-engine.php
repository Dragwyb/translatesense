<?php
/**
 * XML Engine for TranslateSense
 * Supports separate XML configurations per editor (Gutenberg, Elementor, Divi, Classic)
 * as well as unified rules parsing and dynamic rule generation.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TranslateSense_Xml_Engine {

	/**
	 * Supported builders.
	 */
	const BUILDERS = array( 'gutenberg', 'elementor', 'divi', 'classic' );

	/**
	 * Cached parsed rules.
	 */
	private static $parsed_rules = null;

	/**
	 * Initialize engine and ensure uploads directory exists.
	 */
	public static function init() {
		$upload_dir = wp_upload_dir();
		$dir = trailingslashit( $upload_dir['basedir'] ) . 'translatesense-configs';
		if ( ! file_exists( $dir ) ) {
			wp_mkdir_p( $dir );
		}
	}

	/**
	 * Get custom XML file path for a specific builder.
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', 'classic', or 'all'
	 * @return string
	 */
	public static function get_builder_xml_path( $builder = 'all' ) {
		$upload_dir = wp_upload_dir();
		$dir = trailingslashit( $upload_dir['basedir'] ) . 'translatesense-configs';

		if ( 'all' === $builder ) {
			return $dir . '/custom-config.xml';
		}

		return $dir . '/' . sanitize_key( $builder ) . '-config.xml';
	}

	/**
	 * Get core XML file path.
	 */
	public static function get_core_xml_path() {
		return TRANSLATESENSE_PLUGIN_DIR . 'core-config.xml';
	}

	/**
	 * Get raw XML string for a specific builder.
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', 'classic', or 'all'
	 * @return string
	 */
	public static function get_builder_xml_raw( $builder = 'all' ) {
		$path = self::get_builder_xml_path( $builder );
		if ( file_exists( $path ) ) {
			return file_get_contents( $path );
		}

		// Fallback to option or builder skeleton
		$option_key = 'translatesense_' . $builder . '_xml';
		$saved = get_option( $option_key, '' );
		if ( ! empty( $saved ) ) {
			return $saved;
		}

		// If general custom-config.xml exists, extract relevant section
		if ( 'all' !== $builder ) {
			$all_custom = self::get_builder_xml_raw( 'all' );
			$extracted = self::extract_builder_section( $all_custom, $builder );
			if ( ! empty( $extracted ) ) {
				return $extracted;
			}
		}

		return self::get_default_builder_skeleton( $builder );
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

		$dom = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput = true;
		$dom->loadXML( $wrapper->asXML() );
		return $dom->saveXML();
	}

	/**
	 * Helper to append SimpleXMLElement child recursively.
	 */
	private static function simplexml_append_child( SimpleXMLElement $to, SimpleXMLElement $from ) {
		$to_dom = dom_import_simplexml( $to );
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
		$xml = simplexml_load_string( $xml_string );
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
	 * Save custom XML string for a specific builder.
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', 'classic', or 'all'
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_builder_xml( $builder, $xml_string ) {
		if ( 'core' === $builder ) {
			return self::save_core_xml( $xml_string );
		}

		$validation = self::validate_xml( $xml_string );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$path = self::get_builder_xml_path( $builder );
		$dir = dirname( $path );
		if ( ! file_exists( $dir ) ) {
			wp_mkdir_p( $dir );
		}

		// Format XML
		$dom = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput = true;
		if ( @$dom->loadXML( $xml_string ) ) {
			$formatted_xml = $dom->saveXML();
		} else {
			$formatted_xml = $xml_string;
		}

		file_put_contents( $path, $formatted_xml );
		update_option( 'translatesense_' . $builder . '_xml', $formatted_xml );

		// Reset in-memory cache
		self::$parsed_rules = null;

		return true;
	}

	/**
	 * Save generic custom XML (for backward compatibility).
	 */
	public static function save_custom_xml( $xml_string ) {
		return self::save_builder_xml( 'all', $xml_string );
	}

	/**
	 * Get raw custom XML.
	 */
	public static function get_custom_xml_raw() {
		return self::get_builder_xml_raw( 'all' );
	}

	/**
	 * Get core XML raw string from database option table with file fallback.
	 */
	public static function get_core_xml_raw() {
		$saved = get_option( 'translatesense_core_xml', '' );
		if ( ! empty( $saved ) ) {
			return $saved;
		}

		$path = self::get_core_xml_path();
		if ( file_exists( $path ) ) {
			$content = file_get_contents( $path );
			if ( ! empty( $content ) ) {
				update_option( 'translatesense_core_xml', $content );
				return $content;
			}
		}
		return '';
	}

	/**
	 * Save core XML string into database option table and sync to file.
	 *
	 * @param string $xml_string
	 * @return bool|WP_Error
	 */
	public static function save_core_xml( $xml_string ) {
		$validation = self::validate_xml( $xml_string );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		// Format XML
		$dom = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput = true;
		if ( @$dom->loadXML( $xml_string ) ) {
			$formatted_xml = $dom->saveXML();
		} else {
			$formatted_xml = $xml_string;
		}

		update_option( 'translatesense_core_xml', $formatted_xml );

		$path = self::get_core_xml_path();
		if ( is_writable( dirname( $path ) ) || ( file_exists( $path ) && is_writable( $path ) ) ) {
			@file_put_contents( $path, $formatted_xml );
		}

		self::$parsed_rules = null;
		return true;
	}

	/**
	 * Get exact dynamic XML snippet for a specific block/widget/module.
	 * Searches active XML configuration (custom and core in option table).
	 *
	 * @param string $builder 'gutenberg', 'elementor', 'divi', or 'classic'
	 * @param string $name Name/ID of the block/widget
	 * @return string Formatted XML snippet
	 */
	public static function get_widget_xml_snippet( $builder, $name ) {
		// 1. Search in builder custom XML and core XML
		$xml_sources = array(
			self::get_builder_xml_raw( $builder ),
			self::get_core_xml_raw(),
			self::get_builder_xml_raw( 'all' ),
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
			$keys = ( $block_rules && ! empty( $block_rules['keys'] ) ) ? $block_rules['keys'] : array( 'content' => array( 'name' => 'content', 'type' => 'text', 'editor_type' => 'VISUAL' ) );
			return self::generate_xml_snippet( 'gutenberg', $name, $keys );
		} elseif ( 'elementor' === $builder ) {
			$widget_rules = $rules['elementor'][ $name ] ?? null;
			$fields = ( $widget_rules && ! empty( $widget_rules['fields'] ) ) ? $widget_rules['fields'] : array( 'title' => array( 'type' => 'title', 'editor_type' => 'LINE' ) );
			return self::generate_xml_snippet( 'elementor', $name, $fields );
		} elseif ( 'divi' === $builder ) {
			$module_rules = $rules['divi'][ $name ] ?? null;
			$fields = ( $module_rules && ! empty( $module_rules['fields'] ) ) ? $module_rules['fields'] : array( 'content' => array( 'type' => 'content', 'editor_type' => 'VISUAL' ) );
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
		$raw_xml = self::get_builder_xml_raw( $target_builder );
		$xml = simplexml_load_string( $raw_xml );
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
		$dom_nodes = $dom_target->childNodes;
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

		$dom = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput = true;
		$dom->loadXML( $wrapper->asXML() );
		return $dom->saveXML();
	}

	/**
	 * Get unified parsed rules (Core + Custom for all builders merged).
	 */
	public static function get_all_rules( $force_reload = false ) {
		if ( null !== self::$parsed_rules && ! $force_reload ) {
			return self::$parsed_rules;
		}

		$rules = array(
			'gutenberg'     => array(),
			'elementor'     => array(),
			'divi'          => array(),
			'custom_fields' => array(),
		);

		// 1. Parse Core Base XML
		$core_xml_str = self::get_core_xml_raw();
		if ( ! empty( $core_xml_str ) ) {
			self::merge_xml_into_rules( $core_xml_str, $rules, 'core' );
		}

		// 2. Parse Universal Custom XML
		$custom_xml_str = self::get_builder_xml_raw( 'all' );
		if ( ! empty( $custom_xml_str ) ) {
			self::merge_xml_into_rules( $custom_xml_str, $rules, 'custom' );
		}

		// 3. Parse Builder-Specific Custom XMLs
		foreach ( self::BUILDERS as $b ) {
			$b_xml = self::get_builder_xml_raw( $b );
			if ( ! empty( $b_xml ) ) {
				self::merge_xml_into_rules( $b_xml, $rules, 'custom' );
			}
		}

		self::$parsed_rules = $rules;
		return $rules;
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
						$rules['gutenberg'][ $name ]['keys'][ $key_name ] = array(
							'name'        => $key_name,
							'type'        => (string) ( $key_node['type'] ?? 'text' ),
							'editor_type' => (string) ( $key_node['editor_type'] ?? 'VISUAL' ),
						);
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
						$field_name = trim( (string) $fld );
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
				$field_name = trim( (string) $cf );
				$rules['custom_fields'][ $field_name ] = array(
					'name'   => $field_name,
					'action' => (string) ( $cf['action'] ?? 'translate' ),
					'source' => $source,
				);
			}
		}
	}

	/**
	 * Append or update a rule dynamically in the builder-specific custom XML.
	 */
	public static function append_custom_rule( $builder, $name, $field_details, $conditions = array() ) {
		$target_builder = in_array( $builder, self::BUILDERS, true ) ? $builder : 'gutenberg';
		$raw_xml = self::get_builder_xml_raw( $target_builder );

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
				$c_node = $conds_node->addChild( 'condition', $conditions['widgetType'] ?? $name );
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
	 * @param array $field_details
	 * @return string Formatted XML snippet
	 */
	public static function generate_xml_snippet( $builder, $name, $field_details ) {
		$dom = new DOMDocument( '1.0', 'UTF-8' );
		$dom->formatOutput = true;
		$root = $dom->createElement( 'wpml-config' );
		$dom->appendChild( $root );

		if ( 'gutenberg' === $builder ) {
			$section = $dom->createElement( 'gutenberg-blocks' );
			$block = $dom->createElement( 'gutenberg-block' );
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
			$widget = $dom->createElement( 'widget' );
			$widget->setAttribute( 'name', $name );

			$conditions = $dom->createElement( 'conditions' );
			$cond = $dom->createElement( 'condition', $name );
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
			$mod = $dom->createElement( 'module' );
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
