<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Xml_Engine\Builders;

use SimpleXMLElement;
use DOMDocument;
use DOMElement;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Gutenberg_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 *
	 * @var string
	 */
	protected $builder_slug = 'gutenberg';

	/**
	 * Section name.
	 *
	 * @var string
	 */
	protected $section_name = 'gutenberg-blocks';

	/**
	 * Get default XML skeleton.
	 *
	 * @return string
	 */
	public function get_default_skeleton(): string {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wpml-config>\n    <gutenberg-blocks>\n    </gutenberg-blocks>\n</wpml-config>";
	}

	/**
	 * Extract widget snippet.
	 *
	 * @param SimpleXMLElement $xml
	 * @param string           $name
	 * @return string|null
	 */
	public function extract_widget_snippet( SimpleXMLElement $xml, string $name ) {
		if ( isset( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} ) ) {
			foreach ( $xml->{'gutenberg-blocks'}->{'gutenberg-block'} as $blk ) {
				if ( (string) $blk['name'] === $name ) {
					return self::wrap_node_in_config( $blk, $this->section_name );
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
		$block   = $dom->createElement( 'gutenberg-block' );
		$block->setAttribute( 'name', $name );

		$attributes = $dom->createElement( 'attributes' );
		foreach ( $field_details as $key => $info ) {
			$k_node = $dom->createElement( 'key' );
			$k_node->setAttribute( 'name', (string) $key );
			$k_node->setAttribute( 'type', $info['type'] ?? 'text' );
			$k_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'VISUAL' );
			if ( ! empty( $info['noTranslate'] ) ) {
				$k_node->setAttribute( 'noTranslate', 'true' );
			}
			$attributes->appendChild( $k_node );
		}
		$block->appendChild( $attributes );
		$section->appendChild( $block );
		$root->appendChild( $section );

		return $dom->saveXML();
	}

	/**
	 * Sync node.
	 *
	 * @param DOMElement       $existing_block
	 * @param SimpleXMLElement $new_block
	 * @return void
	 */
	public function sync_node( DOMElement $existing_block, SimpleXMLElement $new_block ): void {
		$owner_doc = $existing_block->ownerDocument;

		// Find or create <attributes> element
		$attributes_elem = null;
		$child_nodes     = $existing_block->childNodes;
		for ( $i = 0; $i < $child_nodes->length; $i++ ) {
			$child = $child_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'attributes' === $child->nodeName ) {
				$attributes_elem = $child;
				break;
			}
		}
		if ( ! $attributes_elem ) {
			$attributes_elem = $existing_block->appendChild( $owner_doc->createElement( 'attributes' ) );
		}

		$new_keys       = array();
		$new_key_source = null;
		if ( isset( $new_block->attributes->key ) ) {
			$new_key_source = $new_block->attributes->key;
		}
		if ( $new_key_source ) {
			foreach ( $new_key_source as $k_node ) {
				$k_name              = (string) $k_node['name'];
				$new_keys[ $k_name ] = $k_node;
			}
		}

		$existing_keys = array();
		$attr_children = $attributes_elem->childNodes;
		for ( $i = 0; $i < $attr_children->length; $i++ ) {
			$child = $attr_children->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'key' === $child->nodeName ) {
				$k_name                   = $child->getAttribute( 'name' );
				$existing_keys[ $k_name ] = $child;
			}
		}

		foreach ( $existing_keys as $k_name => $dom_key ) {
			if ( isset( $new_keys[ $k_name ] ) ) {
				$new_k = $new_keys[ $k_name ];
				if ( isset( $new_k['type'] ) ) {
					$dom_key->setAttribute( 'type', (string) $new_k['type'] );
				}
				if ( isset( $new_k['editor_type'] ) ) {
					$dom_key->setAttribute( 'editor_type', (string) $new_k['editor_type'] );
				}
				if ( isset( $new_k['noTranslate'] ) && in_array( strtolower( (string) $new_k['noTranslate'] ), array( 'true', '1', 'yes' ), true ) ) {
					$dom_key->setAttribute( 'noTranslate', 'true' );
				} else {
					$dom_key->removeAttribute( 'noTranslate' );
				}
			} else {
				$dom_key->setAttribute( 'noTranslate', 'true' );
			}
		}

		foreach ( $new_keys as $k_name => $new_k ) {
			if ( ! isset( $existing_keys[ $k_name ] ) ) {
				$k_dom = dom_import_simplexml( $new_k );
				$attributes_elem->appendChild( $owner_doc->importNode( $k_dom, true ) );
			}
		}
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
		$found_block = null;
		foreach ( $xml->{$this->section_name}->{'gutenberg-block'} as $blk ) {
			if ( (string) $blk['name'] === $name ) {
				$found_block = $blk;
				break;
			}
		}
		if ( ! $found_block ) {
			$found_block = $xml->{$this->section_name}->addChild( 'gutenberg-block' );
			$found_block->addAttribute( 'name', $name );
		}

		if ( ! isset( $found_block->attributes ) ) {
			$found_block->addChild( 'attributes' );
		}

		foreach ( $field_details as $f_key => $f_info ) {
			$key_exists = false;
			if ( isset( $found_block->attributes->key ) ) {
				foreach ( $found_block->attributes->key as $k ) {
					if ( (string) $k['name'] === $f_key ) {
						$key_exists = true;
						break;
					}
				}
			}
			if ( ! $key_exists ) {
				$k_node = $found_block->attributes->addChild( 'key' );
				$k_node->addAttribute( 'name', $f_key );
				$k_node->addAttribute( 'type', $f_info['type'] ?? 'text' );
				$k_node->addAttribute( 'editor_type', $f_info['editor_type'] ?? 'VISUAL' );
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
		if ( isset( $xml->{$this->section_name}->{'gutenberg-block'} ) ) {
			foreach ( $xml->{$this->section_name}->{'gutenberg-block'} as $block ) {
				$name = (string) $block['name'];
				if ( ! isset( $rules['gutenberg'][ $name ] ) ) {
					$rules['gutenberg'][ $name ] = array(
						'name'         => $name,
						'source'       => $source,
						'attributes'   => array(),
						'keys'         => array(),
						'no_translate' => array(),
					);
				}

				$key_nodes = null;
				if ( isset( $block->attributes->key ) ) {
					$key_nodes = $block->attributes->key;
				} elseif ( isset( $block->key ) ) {
					$key_nodes = $block->key;
				}

				if ( $key_nodes ) {
					foreach ( $key_nodes as $key_node ) {
						$key_name        = (string) $key_node['name'];
						$is_no_translate = isset( $key_node['noTranslate'] ) && in_array( strtolower( (string) $key_node['noTranslate'] ), array( 'true', '1', 'yes' ), true );
						if ( $is_no_translate ) {
							if ( isset( $rules['gutenberg'][ $name ]['attributes'][ $key_name ] ) ) {
								unset( $rules['gutenberg'][ $name ]['attributes'][ $key_name ] );
							}
							$rules['gutenberg'][ $name ]['no_translate'][ $key_name ] = true;
							continue;
						}
						$parsed_key = self::parse_key_node( $key_node );
						$rules['gutenberg'][ $name ]['attributes'][ $key_name ] = $parsed_key;
					}
				}
			}
		}
	}

	/**
	 * Helper: parse key node.
	 *
	 * @param SimpleXMLElement $key_node
	 * @return array
	 */
	private static function parse_key_node( SimpleXMLElement $key_node ): array {
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
				$children[ $child_name ] = self::parse_key_node( $child_node );
			}
			$data['children'] = $children;
		}

		return $data;
	}
}
