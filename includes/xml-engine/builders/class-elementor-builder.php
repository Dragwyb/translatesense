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
			$f_node = $dom->createElement( 'field' );
			$f_node->setAttribute( 'key', (string) $key );

			if ( isset( $sub_tree['__leaf__'] ) ) {
				$info = $sub_tree['__leaf__'];
				$f_node->setAttribute( 'type', $info['type'] ?? 'title' );
				$f_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'LINE' );
				if ( ! empty( $info['noTranslate'] ) ) {
					$f_node->setAttribute( 'noTranslate', 'true' );
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
				$this->append_tree_to_dom( $dom, $f_node, $child_tree );
			}

			$parent_element->appendChild( $f_node );
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
			if ( isset( $parent_node->field ) ) {
				foreach ( $parent_node->field as $fld ) {
					$fld_key = isset( $fld['key'] ) ? (string) $fld['key'] : trim( (string) $fld );
					if ( $fld_key === (string) $key ) {
						$target_node = $fld;
						break;
					}
				}
			}

			if ( ! $target_node ) {
				$target_node = $parent_node->addChild( 'field' );
				$target_node->addAttribute( 'key', (string) $key );
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

		$fields = $dom->createElement( 'fields' );
		$tree   = $this->build_fields_tree( $field_details );
		$this->append_tree_to_dom( $dom, $fields, $tree );

		$widget->appendChild( $fields );
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

		// Find or create <fields> element
		$fields_elem = null;
		$child_nodes = $existing_widget->childNodes;
		for ( $i = 0; $i < $child_nodes->length; $i++ ) {
			$child = $child_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'fields' === $child->nodeName ) {
				$fields_elem = $child;
				break;
			}
		}
		if ( ! $fields_elem ) {
			$fields_elem = $existing_widget->appendChild( $owner_doc->createElement( 'fields' ) );
		}

		// Extract fields map from new_widget
		$new_fields_map   = array();
		$new_no_translate = array();
		if ( isset( $new_widget->fields->field ) ) {
			foreach ( $new_widget->fields->field as $f_node ) {
				$this->parse_field_node_recursive( $f_node, '', $new_fields_map, $new_no_translate );
			}
		}

		// Rebuild fields DOM from new fields map and no-translate fields
		while ( $fields_elem->firstChild ) {
			$fields_elem->removeChild( $fields_elem->firstChild );
		}

		$all_specs = $new_fields_map;
		foreach ( $new_no_translate as $no_tr_path => $val ) {
			if ( ! isset( $all_specs[ $no_tr_path ] ) ) {
				$all_specs[ $no_tr_path ] = array(
					'path'        => $no_tr_path,
					'type'        => 'title',
					'editor_type' => 'LINE',
					'noTranslate' => true,
				);
			} else {
				$all_specs[ $no_tr_path ]['noTranslate'] = true;
			}
		}

		$tree = $this->build_fields_tree( $all_specs );
		$this->append_tree_to_dom( $owner_doc, $fields_elem, $tree );
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

		if ( ! isset( $found_widget->fields ) ) {
			$found_widget->addChild( 'fields' );
		}

		$tree = $this->build_fields_tree( $field_details );
		$this->append_tree_to_simplexml( $found_widget->fields, $tree );
	}

	/**
	 * Recursively parse <field> XML nodes into path-mapped rule arrays.
	 *
	 * @param SimpleXMLElement $field_node
	 * @param string           $prefix
	 * @param array            $fields_out
	 * @param array            $no_translate_out
	 */
	public function parse_field_node_recursive( SimpleXMLElement $field_node, string $prefix, array &$fields_out, array &$no_translate_out ): void {
		$key = '';
		if ( isset( $field_node['key'] ) ) {
			$key = trim( (string) $field_node['key'] );
		}
		if ( empty( $key ) ) {
			$key = trim( (string) $field_node );
		}

		$current_path = ( '' !== $prefix ) ? ( $prefix . '>' . $key ) : $key;

		if ( isset( $field_node->field ) && count( $field_node->field ) > 0 ) {
			foreach ( $field_node->field as $child_field ) {
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
						'name'   => $name,
						'source' => $source,
						'fields' => array(),
					);
				}

				if ( isset( $widget->fields->field ) ) {
					$no_translate = array();
					foreach ( $widget->fields->field as $fld ) {
						$this->parse_field_node_recursive( $fld, '', $rules['elementor'][ $name ]['fields'], $no_translate );
					}
					if ( ! empty( $no_translate ) ) {
						$rules['elementor'][ $name ]['no_translate'] = $no_translate;
					}
				}
			}
		}
	}
}
