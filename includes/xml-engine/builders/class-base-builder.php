<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Xml_Engine\Builders;

use SimpleXMLElement;
use DOMDocument;
use DOMElement;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

abstract class Base_Builder {

	/**
	 * Builder slug identifier.
	 *
	 * @var string
	 */
	protected $builder_slug = '';

	/**
	 * Section tag name in WPML XML.
	 *
	 * @var string
	 */
	protected $section_name = '';

	/**
	 * Get builder slug.
	 *
	 * @return string
	 */
	public function get_slug(): string {
		return $this->builder_slug;
	}

	/**
	 * Get section tag name.
	 *
	 * @return string
	 */
	public function get_section_name(): string {
		return $this->section_name;
	}

	/**
	 * Extract builder section from full XML document.
	 *
	 * @param string $xml_string
	 * @return string
	 */
	public function extract_section( string $xml_string ): string {
		if ( empty( trim( $xml_string ) ) ) {
			return '';
		}

		libxml_use_internal_errors( true );
		$xml = simplexml_load_string( $xml_string );
		if ( ! $xml || ! isset( $xml->{$this->section_name} ) ) {
			libxml_clear_errors();
			return '';
		}

		$wrapper = new SimpleXMLElement( '<?xml version="1.0" encoding="UTF-8"?><wpml-config></wpml-config>' );
		self::simplexml_append_child( $wrapper, $xml->{$this->section_name} );

		return self::format_simplexml_to_string( $wrapper );
	}

	/**
	 * Get default XML skeleton for this builder.
	 *
	 * @return string
	 */
	abstract public function get_default_skeleton(): string;

	/**
	 * Extract exact widget/block snippet from an XML document.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @return string|null
	 */
	abstract public function extract_widget_snippet( SimpleXMLElement $xml, string $name );

	/**
	 * Build a standalone XML snippet from fields array.
	 *
	 * @param string $name
	 * @param array  $field_details
	 * @return string
	 */
	abstract public function generate_snippet( string $name, array $field_details ): string;

	/**
	 * Sync an existing DOM element with a new SimpleXMLElement definition.
	 * Preserves removed keys/fields by setting noTranslate="true".
	 *
	 * @param DOMElement       $existing_elem
	 * @param SimpleXMLElement $new_elem
	 * @return void
	 */
	abstract public function sync_node( DOMElement $existing_elem, SimpleXMLElement $new_elem ): void;

	/**
	 * Append or update a rule in the builder XML.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @param array            $field_details
	 * @return void
	 */
	abstract public function append_rule( SimpleXMLElement $xml, string $name, array $field_details ): void;

	/**
	 * Parse rules from SimpleXMLElement into the rules array.
	 *
	 * @param SimpleXMLElement $xml
	 * @param array            $rules
	 * @param string           $source
	 * @return void
	 */
	abstract public function parse_rules( SimpleXMLElement $xml, array &$rules, string $source = 'core' ): void;

	/**
	 * Helper: Wrap SimpleXMLElement node in <wpml-config><section-name>...</section-name></wpml-config>.
	 *
	 * @param SimpleXMLElement $node
	 * @param string           $section_name
	 * @return string
	 */
	public static function wrap_node_in_config( SimpleXMLElement $node, string $section_name ): string {
		$wrapper = new SimpleXMLElement( '<?xml version="1.0" encoding="UTF-8"?><wpml-config><' . $section_name . '></' . $section_name . '></wpml-config>' );
		self::simplexml_append_child( $wrapper->{$section_name}, $node );

		return self::format_simplexml_to_string( $wrapper );
	}

	/**
	 * Helper: Format SimpleXMLElement into pretty printed XML string.
	 *
	 * @param SimpleXMLElement $xml
	 * @return string
	 */
	public static function format_simplexml_to_string( SimpleXMLElement $xml ): string {
		$dom                     = new DOMDocument( '1.0' );
		$dom->preserveWhiteSpace = false;
		$dom->formatOutput       = true;
		$dom->loadXML( $xml->asXML() );
		return $dom->saveXML();
	}

	/**
	 * Helper: Append SimpleXMLElement child recursively.
	 *
	 * @param SimpleXMLElement $to
	 * @param SimpleXMLElement $from
	 * @return void
	 */
	public static function simplexml_append_child( SimpleXMLElement $to, SimpleXMLElement $from ): void {
		$to_dom   = dom_import_simplexml( $to );
		$from_dom = dom_import_simplexml( $from );
		$to_dom->appendChild( $to_dom->ownerDocument->importNode( $from_dom, true ) );
	}
}
