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
		foreach ( $field_details as $key => $info ) {
			$k_node = $dom->createElement( 'key' );
			$k_node->setAttribute( 'name', (string) $key );
			$k_node->setAttribute( 'type', $info['type'] ?? 'text' );
			$k_node->setAttribute( 'editor_type', $info['editor_type'] ?? 'VISUAL' );
			$block->appendChild( $k_node );
		}
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
		$this->sync_keys_recursive( $existing_block, $new_block, $owner_doc );
	}

	/**
	 * Recursively sync key elements between DOM and SimpleXML.
	 *
	 * @param DOMElement       $existing_parent
	 * @param SimpleXMLElement $new_parent
	 * @param DOMDocument      $owner_doc
	 * @return void
	 */
	public function sync_keys_recursive( DOMElement $existing_parent, SimpleXMLElement $new_parent, DOMDocument $owner_doc ): void {
		$new_keys = array();
		if ( isset( $new_parent->key ) ) {
			foreach ( $new_parent->key as $k_node ) {
				$k_name              = (string) $k_node['name'];
				$new_keys[ $k_name ] = $k_node;
			}
		}

		$existing_keys = array();
		$child_nodes   = $existing_parent->childNodes;
		for ( $i = 0; $i < $child_nodes->length; $i++ ) {
			$child = $child_nodes->item( $i );
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

				// Recursively sync nested child keys
				$this->sync_keys_recursive( $dom_key, $new_k, $owner_doc );
			} else {
				$already_no_translate = $dom_key->hasAttribute( 'noTranslate' ) && in_array( strtolower( (string) $dom_key->getAttribute( 'noTranslate' ) ), array( 'true', '1', 'yes' ), true );
				if ( $already_no_translate ) {
					$existing_parent->removeChild( $dom_key );
				} else {
					$dom_key->setAttribute( 'noTranslate', 'true' );
				}
			}
		}

		foreach ( $new_keys as $k_name => $new_k ) {
			if ( ! isset( $existing_keys[ $k_name ] ) ) {
				$k_dom = dom_import_simplexml( $new_k );
				$existing_parent->appendChild( $owner_doc->importNode( $k_dom, true ) );
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
						'keys'         => array(),
						'no_translate' => array(),
					);
				}
				if ( ! isset( $rules['gutenberg'][ $name ]['no_translate'] ) ) {
					$rules['gutenberg'][ $name ]['no_translate'] = array();
				}
				if ( isset( $block->key ) ) {
					foreach ( $block->key as $key_node ) {
						$key_name = (string) $key_node['name'];
						if ( empty( $key_name ) ) {
							continue;
						}
						$key_data = self::parse_key_node_recursive( $key_node, '', $rules['gutenberg'][ $name ]['no_translate'] );
						if ( null !== $key_data ) {
							$rules['gutenberg'][ $name ]['keys'][ $key_name ] = $key_data;
						} else {
							if ( isset( $rules['gutenberg'][ $name ]['keys'][ $key_name ] ) ) {
								unset( $rules['gutenberg'][ $name ]['keys'][ $key_name ] );
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Helper: Recursively parse key node and record leaf noTranslate paths.
	 *
	 * @param SimpleXMLElement $key_node
	 * @param string           $prefix
	 * @param array            $no_translate_out
	 * @param bool             $parent_no_translate
	 * @return array|null
	 */
	private static function parse_key_node_recursive( SimpleXMLElement $key_node, string $prefix, array &$no_translate_out, bool $parent_no_translate = false ): ?array {
		$key_name = (string) $key_node['name'];
		if ( empty( $key_name ) ) {
			return null;
		}

		$current_path    = '' !== $prefix ? ( $prefix . '>' . $key_name ) : $key_name;
		$is_no_translate = $parent_no_translate || ( isset( $key_node['noTranslate'] ) && in_array( strtolower( (string) $key_node['noTranslate'] ), array( 'true', '1', 'yes' ), true ) );
		$has_children    = isset( $key_node->key ) && count( $key_node->key ) > 0;

		if ( $has_children ) {
			$children = array();
			foreach ( $key_node->key as $child_node ) {
				$child_name = (string) $child_node['name'];
				$child_data = self::parse_key_node_recursive( $child_node, $current_path, $no_translate_out, $is_no_translate );
				if ( null !== $child_data ) {
					$children[ $child_name ] = $child_data;
				}
			}

			if ( $is_no_translate || empty( $children ) ) {
				return null;
			}

			return array(
				'name'        => $key_name,
				'type'        => (string) ( $key_node['type'] ?? 'text' ),
				'editor_type' => (string) ( $key_node['editor_type'] ?? 'VISUAL' ),
				'children'    => $children,
			);
		} else {
			if ( $is_no_translate ) {
				$no_translate_out[ $current_path ] = true;
				return null;
			}

			return array(
				'name'        => $key_name,
				'type'        => (string) ( $key_node['type'] ?? 'text' ),
				'editor_type' => (string) ( $key_node['editor_type'] ?? 'VISUAL' ),
			);
		}
	}

	/**
	 * Count actual leaf translatable keys in a structured key tree.
	 *
	 * @param array $keys
	 * @return int
	 */
	public static function count_leaf_keys( array $keys ): int {
		$count = 0;
		foreach ( $keys as $k => $info ) {
			if ( isset( $info['children'] ) && is_array( $info['children'] ) ) {
				if ( ! empty( $info['children'] ) ) {
					$count += self::count_leaf_keys( $info['children'] );
				}
			} else {
				$count++;
			}
		}
		return $count;
	}
}
