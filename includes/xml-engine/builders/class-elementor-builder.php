<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Xml_Engine\Builders;

use SimpleXMLElement;
use DOMDocument;
use DOMElement;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Elementor_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 *
	 * @var string
	 */
	protected $builder_slug = 'elementor';

	/**
	 * Section name.
	 *
	 * @var string
	 */
	protected $section_name = 'elementor-widgets';

	/**
	 * Get default XML skeleton.
	 *
	 * @return string
	 */
	public function get_default_skeleton(): string {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <elementor-widgets>\n    </elementor-widgets>\n</wpml-config>";
	}

	/**
	 * Extract widget snippet.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @return string|null
	 */
	public function extract_widget_snippet( SimpleXMLElement $xml, string $name ) {
		if ( isset( $xml->{'elementor-widgets'}->widget ) ) {
			foreach ( $xml->{'elementor-widgets'}->widget as $wdg ) {
				if ( (string) $wdg['name'] === $name ) {
					return self::wrap_node_in_config( $wdg, $this->section_name );
				}
			}
		}
		return null;
	}

	/**
	 * Convert flat path list into nested tree.
	 *
	 * @param array $field_details
	 * @return array
	 */
	public function build_fields_tree( array $field_details ): array {
		$tree = array();
		foreach ( $field_details as $path => $info ) {
			$delimiter = false !== strpos( (string) $path, '>' ) ? '>' : ( false !== strpos( (string) $path, '.' ) ? '.' : '' );
			$segments  = empty( $delimiter ) ? array( (string) $path ) : explode( $delimiter, (string) $path );
			$cursor    = &$tree;
			$len       = count( $segments );
			foreach ( $segments as $i => $segment ) {
				$segment = trim( $segment );
				if ( '' === $segment ) {
					continue;
				}
				if ( $i === $len - 1 ) {
					if ( ! isset( $cursor[ $segment ] ) || ! is_array( $cursor[ $segment ] ) ) {
						$cursor[ $segment ] = array();
					}
					$cursor[ $segment ]['__leaf__'] = $info;
				} else {
					if ( ! isset( $cursor[ $segment ] ) || ! is_array( $cursor[ $segment ] ) ) {
						$cursor[ $segment ] = array();
					}
					$cursor = &$cursor[ $segment ];
				}
			}
		}
		return $tree;
	}

	/**
	 * Recursively append tree nodes into DOMElement.
	 *
	 * @param DOMDocument $dom
	 * @param DOMElement  $parent_element
	 * @param array       $tree
	 */
	private function append_tree_to_dom( DOMDocument $dom, DOMElement $parent_element, array $tree ): void {
		foreach ( $tree as $key => $sub_tree ) {
			$k_node = $dom->createElement( 'key' );
			$k_node->setAttribute( 'name', (string) $key );

			if ( isset( $sub_tree['__leaf__'] ) ) {
				$info = $sub_tree['__leaf__'];
				$k_node->setAttribute( 'type', $info['type'] ?? 'title' );
				$k_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'LINE' );
				if ( ! empty( $info['noTranslate'] ) ) {
					$k_node->setAttribute( 'noTranslate', 'true' );
				}
			}

			$has_children = false;
			foreach ( $sub_tree as $child_key => $child_val ) {
				if ( '__leaf__' !== $child_key ) {
					$has_children = true;
					break;
				}
			}

			if ( $has_children ) {
				$child_tree = array_filter(
					$sub_tree,
					function ( $k ) {
						return '__leaf__' !== $k;
					},
					ARRAY_FILTER_USE_KEY
				);
				$this->append_tree_to_dom( $dom, $k_node, $child_tree );
			}

			$parent_element->appendChild( $k_node );
		}
	}

	/**
	 * Recursively append tree nodes into SimpleXMLElement.
	 *
	 * @param SimpleXMLElement $parent_node
	 * @param array            $tree
	 */
	private function append_tree_to_simplexml( SimpleXMLElement $parent_node, array $tree ): void {
		foreach ( $tree as $key => $sub_tree ) {
			$target_node = null;
			if ( isset( $parent_node->key ) ) {
				foreach ( $parent_node->key as $k_item ) {
					$k_name = isset( $k_item['name'] ) ? (string) $k_item['name'] : trim( (string) $k_item );
					if ( $k_name === (string) $key ) {
						$target_node = $k_item;
						break;
					}
				}
			}

			if ( ! $target_node ) {
				$target_node = $parent_node->addChild( 'key' );
				$target_node->addAttribute( 'name', (string) $key );
			}

			if ( isset( $sub_tree['__leaf__'] ) ) {
				$info = $sub_tree['__leaf__'];
				if ( ! isset( $target_node['type'] ) ) {
					$target_node->addAttribute( 'type', $info['type'] ?? 'title' );
				}
				if ( ! isset( $target_node['editor_type'] ) ) {
					$target_node->addAttribute( 'editor_type', $info['editor_type'] ?? 'LINE' );
				}
			}

			$has_children = false;
			foreach ( $sub_tree as $child_key => $child_val ) {
				if ( '__leaf__' !== $child_key ) {
					$has_children = true;
					break;
				}
			}

			if ( $has_children ) {
				$child_tree = array_filter(
					$sub_tree,
					function ( $k ) {
						return '__leaf__' !== $k;
					},
					ARRAY_FILTER_USE_KEY
				);
				$this->append_tree_to_simplexml( $target_node, $child_tree );
			}
		}
	}

	/**
	 * Generate snippet XML.
	 *
	 * @param string $name
	 * @param array  $field_details
	 * @return string
	 */
	public function generate_snippet( string $name, array $field_details ): string {
		$dom               = new DOMDocument( '1.0', 'UTF-8' );
		$dom->formatOutput = true;
		$root              = $dom->createElement( 'wpml-config' );
		$dom->appendChild( $root );

		$section = $dom->createElement( $this->section_name );
		$widget  = $dom->createElement( 'widget' );
		$widget->setAttribute( 'name', $name );

		$attributes = $dom->createElement( 'attributes' );
		$tree       = $this->build_fields_tree( $field_details );
		$this->append_tree_to_dom( $dom, $attributes, $tree );

		$widget->appendChild( $attributes );
		$section->appendChild( $widget );
		$root->appendChild( $section );

		return $dom->saveXML();
	}

	/**
	 * Sync node.
	 *
	 * @param DOMElement       $existing_widget
	 * @param SimpleXMLElement $new_widget
	 * @return void
	 */
	public function sync_node( DOMElement $existing_widget, SimpleXMLElement $new_widget ): void {
		$owner_doc = $existing_widget->ownerDocument;

		// 1. Extract existing fields and no-translate fields from existing_widget DOM
		$existing_sxml          = simplexml_import_dom( $existing_widget );
		$existing_fields_map   = array();
		$existing_no_translate = array();

		if ( $existing_sxml ) {
			if ( isset( $existing_sxml->attributes->key ) ) {
				foreach ( $existing_sxml->attributes->key as $k_node ) {
					$this->parse_field_node_recursive( $k_node, '', $existing_fields_map, $existing_no_translate );
				}
			}
			if ( isset( $existing_sxml->key ) ) {
				foreach ( $existing_sxml->key as $k_node ) {
					$this->parse_field_node_recursive( $k_node, '', $existing_fields_map, $existing_no_translate );
				}
			}
			if ( isset( $existing_sxml->fields->field ) ) {
				foreach ( $existing_sxml->fields->field as $f_node ) {
					$this->parse_field_node_recursive( $f_node, '', $existing_fields_map, $existing_no_translate );
				}
			}
		}

		// 2. Extract fields and no-translate fields from new_widget (edited snippet)
		$new_fields_map   = array();
		$new_no_translate = array();
		if ( isset( $new_widget->attributes->key ) ) {
			foreach ( $new_widget->attributes->key as $k_node ) {
				$this->parse_field_node_recursive( $k_node, '', $new_fields_map, $new_no_translate );
			}
		} elseif ( isset( $new_widget->key ) ) {
			foreach ( $new_widget->key as $k_node ) {
				$this->parse_field_node_recursive( $k_node, '', $new_fields_map, $new_no_translate );
			}
		} elseif ( isset( $new_widget->fields->field ) ) {
			foreach ( $new_widget->fields->field as $f_node ) {
				$this->parse_field_node_recursive( $f_node, '', $new_fields_map, $new_no_translate );
			}
		}

		// 3. Build merged specs:
		// - For keys in existing_fields_map: if in new_fields_map, update; if omitted, mark noTranslate="true".
		$all_specs = array();

		foreach ( $existing_fields_map as $path => $info ) {
			if ( isset( $new_fields_map[ $path ] ) ) {
				$all_specs[ $path ] = $new_fields_map[ $path ];
			} elseif ( isset( $new_no_translate[ $path ] ) ) {
				$info['noTranslate'] = true;
				$all_specs[ $path ]  = $info;
			} else {
				// Key was present in existing widget but removed from snippet -> preserve with noTranslate="true"
				$info['noTranslate'] = true;
				$all_specs[ $path ]  = $info;
			}
		}

		// - For keys already in existing_no_translate: if re-added in new_fields_map, restore it; if in new_no_translate, keep it; if removed from snippet, remove it completely.
		foreach ( $existing_no_translate as $path => $val ) {
			if ( isset( $new_fields_map[ $path ] ) ) {
				$all_specs[ $path ] = $new_fields_map[ $path ];
			} elseif ( isset( $new_no_translate[ $path ] ) ) {
				$all_specs[ $path ] = is_array( $val ) ? $val : array(
					'path'        => $path,
					'type'        => 'title',
					'editor_type' => 'LINE',
					'noTranslate' => true,
				);
			}
		}

		// - For brand new keys in new_fields_map:
		foreach ( $new_fields_map as $path => $info ) {
			if ( ! isset( $all_specs[ $path ] ) ) {
				$all_specs[ $path ] = $info;
			}
		}

		// - For explicit no_translate in new_no_translate:
		foreach ( $new_no_translate as $path => $val ) {
			if ( ! isset( $all_specs[ $path ] ) ) {
				$all_specs[ $path ] = is_array( $val ) ? $val : array(
					'path'        => $path,
					'type'        => 'title',
					'editor_type' => 'LINE',
					'noTranslate' => true,
				);
			} else {
				$all_specs[ $path ]['noTranslate'] = true;
			}
		}

		// 4. Clean up existing widget DOM elements (remove legacy <fields> or direct <key> elements)
		$attributes_elem = null;
		$nodes_to_remove = array();
		for ( $i = 0; $i < $existing_widget->childNodes->length; $i++ ) {
			$child = $existing_widget->childNodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType ) {
				if ( 'attributes' === $child->nodeName && ! $attributes_elem ) {
					$attributes_elem = $child;
				} else {
					$nodes_to_remove[] = $child;
				}
			}
		}
		foreach ( $nodes_to_remove as $rem_node ) {
			$existing_widget->removeChild( $rem_node );
		}

		if ( ! $attributes_elem ) {
			$attributes_elem = $existing_widget->appendChild( $owner_doc->createElement( 'attributes' ) );
		}

		while ( $attributes_elem->firstChild ) {
			$attributes_elem->removeChild( $attributes_elem->firstChild );
		}

		$tree = $this->build_fields_tree( $all_specs );
		$this->append_tree_to_dom( $owner_doc, $attributes_elem, $tree );
	}

	/**
	 * Append rule.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @param array            $field_details
	 * @return void
	 */
	public function append_rule( SimpleXMLElement $xml, string $name, array $field_details ): void {
		if ( ! isset( $xml->{$this->section_name} ) ) {
			$xml->addChild( $this->section_name );
		}
		$found_widget = null;
		foreach ( $xml->{$this->section_name}->widget as $wdg ) {
			if ( (string) $wdg['name'] === $name ) {
				$found_widget = $wdg;
				break;
			}
		}
		if ( ! $found_widget ) {
			$found_widget = $xml->{$this->section_name}->addChild( 'widget' );
			$found_widget->addAttribute( 'name', $name );
		}

		if ( ! isset( $found_widget->attributes ) ) {
			$found_widget->addChild( 'attributes' );
		}

		$tree = $this->build_fields_tree( $field_details );
		$this->append_tree_to_simplexml( $found_widget->attributes, $tree );
	}

	/**
	 * Recursively parse <key> or <field> XML nodes into path-mapped rule arrays.
	 *
	 * @param SimpleXMLElement $field_node
	 * @param string           $prefix
	 * @param array            $fields_out
	 * @param array            $no_translate_out
	 */
	public function parse_field_node_recursive( SimpleXMLElement $field_node, string $prefix, array &$fields_out, array &$no_translate_out ): void {
		$key = '';
		if ( isset( $field_node['name'] ) ) {
			$key = trim( (string) $field_node['name'] );
		} elseif ( isset( $field_node['key'] ) ) {
			$key = trim( (string) $field_node['key'] );
		}
		if ( empty( $key ) ) {
			$key = trim( (string) $field_node );
		}

		$current_path = ( '' !== $prefix ) ? ( $prefix . '>' . $key ) : $key;

		$child_nodes = isset( $field_node->key ) ? $field_node->key : ( isset( $field_node->field ) ? $field_node->field : null );
		if ( $child_nodes && count( $child_nodes ) > 0 ) {
			foreach ( $child_nodes as $child_field ) {
				$this->parse_field_node_recursive( $child_field, $current_path, $fields_out, $no_translate_out );
			}
		} else {
			if ( empty( $current_path ) ) {
				return;
			}

			$is_no_translate = isset( $field_node['noTranslate'] ) && in_array( strtolower( (string) $field_node['noTranslate'] ), array( 'true', '1', 'yes' ), true );
			if ( $is_no_translate ) {
				if ( isset( $fields_out[ $current_path ] ) ) {
					unset( $fields_out[ $current_path ] );
				}
				$no_translate_out[ $current_path ] = true;
				return;
			}

			$fields_out[ $current_path ] = array(
				'path'        => $current_path,
				'name'        => $key,
				'type'        => (string) ( $field_node['type'] ?? 'title' ),
				'editor_type' => (string) ( $field_node['editor_type'] ?? 'LINE' ),
			);
		}
	}

	/**
	 * Parse rules.
	 *
	 * @param SimpleXMLElement $xml
	 * @param array            $rules
	 * @param string           $source
	 * @return void
	 */
	public function parse_rules( SimpleXMLElement $xml, array &$rules, string $source = 'core' ): void {
		if ( isset( $xml->{$this->section_name}->widget ) ) {
			foreach ( $xml->{$this->section_name}->widget as $widget ) {
				$name = (string) $widget['name'];
				if ( ! isset( $rules['elementor'][ $name ] ) ) {
					$rules['elementor'][ $name ] = array(
						'name'         => $name,
						'source'       => $source,
						'attributes'   => array(),
						'no_translate' => array(),
					);
				}

				$parsed_items = array();
				$no_translate = array();

				if ( isset( $widget->attributes->key ) ) {
					foreach ( $widget->attributes->key as $k_node ) {
						$this->parse_field_node_recursive( $k_node, '', $parsed_items, $no_translate );
					}
				} elseif ( isset( $widget->key ) ) {
					foreach ( $widget->key as $k_node ) {
						$this->parse_field_node_recursive( $k_node, '', $parsed_items, $no_translate );
					}
				} elseif ( isset( $widget->fields->field ) ) {
					foreach ( $widget->fields->field as $f_node ) {
						$this->parse_field_node_recursive( $f_node, '', $parsed_items, $no_translate );
					}
				}

				if ( ! empty( $parsed_items ) ) {
					foreach ( $parsed_items as $p_path => $p_info ) {
						$rules['elementor'][ $name ]['attributes'][ $p_path ] = $p_info;
					}
				}

				if ( ! empty( $no_translate ) ) {
					foreach ( $no_translate as $nt_path => $nt_val ) {
						if ( isset( $rules['elementor'][ $name ]['attributes'][ $nt_path ] ) ) {
							unset( $rules['elementor'][ $name ]['attributes'][ $nt_path ] );
						}
					}
					$rules['elementor'][ $name ]['no_translate'] = array_merge(
						$rules['elementor'][ $name ]['no_translate'] ?? array(),
						$no_translate
					);
				}
			}
		}
	}
}
