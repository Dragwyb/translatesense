<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Xml_Engine\Builders;

use SimpleXMLElement;
use DOMDocument;
use DOMElement;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Divi_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 *
	 * @var string
	 */
	protected $builder_slug = 'divi';

	/**
	 * Section name.
	 *
	 * @var string
	 */
	protected $section_name = 'divi-modules';

	/**
	 * Get default XML skeleton.
	 *
	 * @return string
	 */
	public function get_default_skeleton(): string {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <divi-modules>\n    </divi-modules>\n</wpml-config>";
	}

	/**
	 * Extract widget snippet.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @return string|null
	 */
	public function extract_widget_snippet( SimpleXMLElement $xml, string $name ) {
		if ( isset( $xml->{'divi-modules'}->module ) ) {
			foreach ( $xml->{'divi-modules'}->module as $mod ) {
				if ( (string) $mod['name'] === $name ) {
					return self::wrap_node_in_config( $mod, $this->section_name );
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
		$mod     = $dom->createElement( 'module' );
		$mod->setAttribute( 'name', $name );
		$fields = $dom->createElement( 'fields' );
		foreach ( $field_details as $field => $info ) {
			$f_node = $dom->createElement( 'field', htmlspecialchars( (string) $field ) );
			$f_node->setAttribute( 'type', $info['type'] ?? 'content' );
			$f_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'VISUAL' );
			$fields->appendChild( $f_node );
		}
		$mod->appendChild( $fields );
		$section->appendChild( $mod );
		$root->appendChild( $section );

		return $dom->saveXML();
	}

	/**
	 * Sync node.
	 *
	 * @param DOMElement       $existing_module
	 * @param SimpleXMLElement $new_module
	 * @return void
	 */
	public function sync_node( DOMElement $existing_module, SimpleXMLElement $new_module ): void {
		$owner_doc = $existing_module->ownerDocument;

		$fields_elem = null;
		$child_nodes = $existing_module->childNodes;
		for ( $i = 0; $i < $child_nodes->length; $i++ ) {
			$child = $child_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'fields' === $child->nodeName ) {
				$fields_elem = $child;
				break;
			}
		}
		if ( ! $fields_elem ) {
			$fields_elem = $existing_module->appendChild( $owner_doc->createElement( 'fields' ) );
		}

		$new_fields = array();
		if ( isset( $new_module->fields->field ) ) {
			foreach ( $new_module->fields->field as $f_node ) {
				$name                = trim( (string) $f_node );
				$new_fields[ $name ] = $f_node;
			}
		}

		$existing_fields = array();
		$f_nodes         = $fields_elem->childNodes;
		for ( $i = 0; $i < $f_nodes->length; $i++ ) {
			$child = $f_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'field' === $child->nodeName ) {
				$name                     = trim( $child->textContent );
				$existing_fields[ $name ] = $child;
			}
		}

		foreach ( $existing_fields as $name => $dom_fld ) {
			if ( isset( $new_fields[ $name ] ) ) {
				$new_f = $new_fields[ $name ];
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

		foreach ( $new_fields as $name => $new_f ) {
			if ( ! isset( $existing_fields[ $name ] ) ) {
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
		$found_module = null;
		foreach ( $xml->{$this->section_name}->module as $mod ) {
			if ( (string) $mod['name'] === $name ) {
				$found_module = $mod;
				break;
			}
		}
		if ( ! $found_module ) {
			$found_module = $xml->{$this->section_name}->addChild( 'module' );
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

	/**
	 * Parse rules.
	 *
	 * @param SimpleXMLElement $xml
	 * @param array            $rules
	 * @param string           $source
	 * @return void
	 */
	public function parse_rules( SimpleXMLElement $xml, array &$rules, string $source = 'core' ): void {
		if ( isset( $xml->{$this->section_name}->module ) ) {
			foreach ( $xml->{$this->section_name}->module as $module ) {
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
						$field_name      = trim( (string) $fld );
						$is_no_translate = isset( $fld['noTranslate'] ) && in_array( strtolower( (string) $fld['noTranslate'] ), array( 'true', '1', 'yes' ), true );
						if ( $is_no_translate ) {
							if ( isset( $rules['divi'][ $name ]['fields'][ $field_name ] ) ) {
								unset( $rules['divi'][ $name ]['fields'][ $field_name ] );
							}
							$rules['divi'][ $name ]['no_translate'][ $field_name ] = true;
							continue;
						}
						$rules['divi'][ $name ]['fields'][ $field_name ] = array(
							'field'       => $field_name,
							'type'        => (string) ( $fld['type'] ?? 'content' ),
							'editor_type' => (string) ( $fld['editor_type'] ?? 'VISUAL' ),
						);
					}
				}
			}
		}
	}
}
