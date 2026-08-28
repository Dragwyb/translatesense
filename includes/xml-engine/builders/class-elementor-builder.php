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

		$conditions = $dom->createElement( 'conditions' );
		$cond       = $dom->createElement( 'condition', $name );
		$cond->setAttribute( 'key', 'widgetType' );
		$conditions->appendChild( $cond );
		$widget->appendChild( $conditions );

		$fields = $dom->createElement( 'fields' );
		foreach ( $field_details as $path => $info ) {
			$f_node = $dom->createElement( 'field', htmlspecialchars( (string) $path ) );
			$f_node->setAttribute( 'type', $info['type'] ?? 'title' );
			$f_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'LINE' );
			$fields->appendChild( $f_node );
		}
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

		// Sync conditions if present
		if ( isset( $new_widget->conditions ) ) {
			$conditions_elem = null;
			$child_nodes     = $existing_widget->childNodes;
			for ( $i = 0; $i < $child_nodes->length; $i++ ) {
				$child = $child_nodes->item( $i );
				if ( XML_ELEMENT_NODE === $child->nodeType && 'conditions' === $child->nodeName ) {
					$conditions_elem = $child;
					break;
				}
			}
			$new_cond_dom = dom_import_simplexml( $new_widget->conditions );
			$imported     = $owner_doc->importNode( $new_cond_dom, true );
			if ( $conditions_elem ) {
				$existing_widget->replaceChild( $imported, $conditions_elem );
			} else {
				$existing_widget->insertBefore( $imported, $existing_widget->firstChild );
			}
		}

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

		$new_fields = array();
		if ( isset( $new_widget->fields->field ) ) {
			foreach ( $new_widget->fields->field as $f_node ) {
				$path                = trim( (string) $f_node );
				$new_fields[ $path ] = $f_node;
			}
		}

		$existing_fields = array();
		$f_nodes         = $fields_elem->childNodes;
		for ( $i = 0; $i < $f_nodes->length; $i++ ) {
			$child = $f_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'field' === $child->nodeName ) {
				$path                     = trim( $child->textContent );
				$existing_fields[ $path ] = $child;
			}
		}

		foreach ( $existing_fields as $path => $dom_fld ) {
			if ( isset( $new_fields[ $path ] ) ) {
				$new_f = $new_fields[ $path ];
				if ( isset( $new_f['type'] ) ) {
					$dom_fld->setAttribute( 'type', (string) $new_f['type'] );
				}
				if ( isset( $new_f['editor_type'] ) ) {
					$dom_fld->setAttribute( 'editor_type', (string) $new_f['editor_type'] );
				}
				if ( isset( $new_f['noTranslate'] ) && in_array( strtolower( (string) $new_f['noTranslate'] ), array( 'true', '1', 'yes' ), true ) ) {
					$dom_fld->setAttribute( 'noTranslate', 'true' );
				} else {
					$dom_fld->removeAttribute( 'noTranslate' );
				}
			} else {
				$dom_fld->setAttribute( 'noTranslate', 'true' );
			}
		}

		foreach ( $new_fields as $path => $new_f ) {
			if ( ! isset( $existing_fields[ $path ] ) ) {
				$f_dom = dom_import_simplexml( $new_f );
				$fields_elem->appendChild( $owner_doc->importNode( $f_dom, true ) );
			}
		}
	}

	/**
	 * Append rule.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @param array            $field_details
	 * @param array            $conditions
	 * @return void
	 */
	public function append_rule( SimpleXMLElement $xml, string $name, array $field_details, array $conditions = array() ): void {
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
						$field_path      = trim( (string) $fld );
						$is_no_translate = isset( $fld['noTranslate'] ) && in_array( strtolower( (string) $fld['noTranslate'] ), array( 'true', '1', 'yes' ), true );
						if ( $is_no_translate ) {
							if ( isset( $rules['elementor'][ $name ]['fields'][ $field_path ] ) ) {
								unset( $rules['elementor'][ $name ]['fields'][ $field_path ] );
							}
							$rules['elementor'][ $name ]['no_translate'][ $field_path ] = true;
							continue;
						}
						$rules['elementor'][ $name ]['fields'][ $field_path ] = array(
							'path'        => $field_path,
							'type'        => (string) ( $fld['type'] ?? 'title' ),
							'editor_type' => (string) ( $fld['editor_type'] ?? 'LINE' ),
						);
					}
				}
			}
		}
	}
}
