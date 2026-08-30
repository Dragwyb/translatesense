<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Xml_Engine\Builders;

use SimpleXMLElement;
use DOMDocument;
use DOMElement;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Classic_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 *
	 * @var string
	 */
	protected $builder_slug = 'classic';

	/**
	 * Section name.
	 *
	 * @var string
	 */
	protected $section_name = 'custom-fields';

	/**
	 * Get default XML skeleton.
	 *
	 * @return string
	 */
	public function get_default_skeleton(): string {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <custom-fields>\n    </custom-fields>\n</wpml-config>";
	}

	/**
	 * Extract widget snippet.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @return string|null
	 */
	public function extract_widget_snippet( SimpleXMLElement $xml, string $name ) {
		if ( isset( $xml->{'custom-fields'}->{'custom-field'} ) ) {
			foreach ( $xml->{'custom-fields'}->{'custom-field'} as $cf ) {
				if ( trim( (string) $cf ) === $name ) {
					return self::wrap_node_in_config( $cf, $this->section_name );
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
		$cf      = $dom->createElement( 'custom-field', htmlspecialchars( $name ) );
		$cf->setAttribute( 'action', 'translate' );
		$section->appendChild( $cf );
		$root->appendChild( $section );

		return $dom->saveXML();
	}

	/**
	 * Sync node.
	 *
	 * @param DOMElement       $existing_cf
	 * @param SimpleXMLElement $new_cf
	 * @return void
	 */
	public function sync_node( DOMElement $existing_cf, SimpleXMLElement $new_cf ): void {
		if ( isset( $new_cf['action'] ) ) {
			$existing_cf->setAttribute( 'action', (string) $new_cf['action'] );
		}
		if ( isset( $new_cf['noTranslate'] ) && in_array( strtolower( (string) $new_cf['noTranslate'] ), array( 'true', '1', 'yes' ), true ) ) {
			$existing_cf->setAttribute( 'noTranslate', 'true' );
		} else {
			$existing_cf->removeAttribute( 'noTranslate' );
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
		$cf_exists = false;
		foreach ( $xml->{$this->section_name}->{'custom-field'} as $cf ) {
			if ( trim( (string) $cf ) === $name ) {
				$cf_exists = true;
				break;
			}
		}
		if ( ! $cf_exists ) {
			$cf_node = $xml->{$this->section_name}->addChild( 'custom-field', htmlspecialchars( $name ) );
			$cf_node->addAttribute( 'action', 'translate' );
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
		if ( isset( $xml->{$this->section_name}->{'custom-field'} ) ) {
			foreach ( $xml->{$this->section_name}->{'custom-field'} as $cf ) {
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
}
