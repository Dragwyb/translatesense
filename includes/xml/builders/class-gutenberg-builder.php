<?php

declare(strict_types=1);

namespace TranslateSense\Includes\XML\Builders;

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
				if ( (string) $blk['type'] === $name ) {
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
		$block->setAttribute( 'type', $name );
		$translate = isset( $field_details['translate'] ) ? (string) $field_details['translate'] : '1';
		$block->setAttribute( 'translate', $translate );

		// Append child <xpath> tags
		$xpaths = array();
		if ( ! empty( $field_details['__xpaths__'] ) && is_array( $field_details['__xpaths__'] ) ) {
			$xpaths = $field_details['__xpaths__'];
		} elseif ( ! empty( $field_details['xpaths'] ) && is_array( $field_details['xpaths'] ) ) {
			$xpaths = $field_details['xpaths'];
		} elseif ( ! empty( $field_details['xpath'] ) ) {
			if ( is_array( $field_details['xpath'] ) ) {
				$xpaths = $field_details['xpath'];
			} else {
				$lines = explode( "\n", (string) $field_details['xpath'] );
				foreach ( $lines as $line ) {
					$line = trim( $line );
					if ( '' !== $line ) {
						$xpaths[] = array( 'value' => $line );
					}
				}
			}
		}

		foreach ( $xpaths as $xp ) {
			$xp_val = is_array( $xp ) ? ( $xp['value'] ?? $xp['xpath'] ?? '' ) : (string) $xp;
			$xp_val = trim( $xp_val );
			if ( '' === $xp_val ) {
				continue;
			}
			$xp_node = $dom->createElement( 'xpath', htmlspecialchars( $xp_val ) );
			if ( is_array( $xp ) ) {
				foreach ( $xp as $attr_k => $attr_v ) {
					if ( ! in_array( $attr_k, array( 'value', 'xpath' ), true ) && is_scalar( $attr_v ) && '' !== (string) $attr_v ) {
						$xp_node->setAttribute( (string) $attr_k, (string) $attr_v );
					}
				}
			}
			$block->appendChild( $xp_node );
		}

		$this->append_dom_keys_recursive( $dom, $block, $field_details );
		$section->appendChild( $block );
		$root->appendChild( $section );

		return $dom->saveXML();
	}

	/**
	 * Recursively append DOM key nodes according to field schema.
	 *
	 * @param DOMDocument $dom
	 * @param DOMElement  $parent
	 * @param array       $field_details
	 * @return void
	 */
	private function append_dom_keys_recursive( DOMDocument $dom, DOMElement $parent, array $field_details ): void {
		foreach ( $field_details as $key => $info ) {
			if ( in_array( $key, array( 'xpath', 'xpaths', '__xpaths__', 'translate' ), true ) ) {
				continue;
			}
			$k_node = $dom->createElement( 'key' );
			$k_node->setAttribute( 'name', (string) $key );

			if ( ! empty( $info['type'] ) && 'array' !== $info['type'] && 'object' !== $info['type'] ) {
				$k_node->setAttribute( 'type', (string) $info['type'] );
			}
			if ( ! empty( $info['editor_type'] ) ) {
				$k_node->setAttribute( 'editor_type', (string) $info['editor_type'] );
			}
			if ( ! empty( $info['noTranslate'] ) ) {
				$k_node->setAttribute( 'noTranslate', 'true' );
			}

			if ( isset( $info['children'] ) && is_array( $info['children'] ) && ! empty( $info['children'] ) ) {
				$this->append_dom_keys_recursive( $dom, $k_node, $info['children'] );
			}

			$parent->appendChild( $k_node );
		}
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

		if ( isset( $new_block['translate'] ) ) {
			$existing_block->setAttribute( 'translate', (string) $new_block['translate'] );
		}

		// Remove legacy xpath attribute if present
		if ( $existing_block->hasAttribute( 'xpath' ) ) {
			$existing_block->removeAttribute( 'xpath' );
		}

		// Sync child <xpath> elements
		// 1. Remove existing <xpath> elements
		$nodes_to_remove = array();
		$child_nodes     = $existing_block->childNodes;
		for ( $i = 0; $i < $child_nodes->length; $i++ ) {
			$child = $child_nodes->item( $i );
			if ( XML_ELEMENT_NODE === $child->nodeType && 'xpath' === $child->nodeName ) {
				$nodes_to_remove[] = $child;
			}
		}
		foreach ( $nodes_to_remove as $node ) {
			$existing_block->removeChild( $node );
		}

		// 2. Add new <xpath> elements from $new_block
		if ( isset( $new_block->xpath ) ) {
			// Find first key node to insert xpath elements before it
			$first_key_node     = null;
			$remaining_children = $existing_block->childNodes;
			for ( $i = 0; $i < $remaining_children->length; $i++ ) {
				$child = $remaining_children->item( $i );
				if ( XML_ELEMENT_NODE === $child->nodeType && 'key' === $child->nodeName ) {
					$first_key_node = $child;
					break;
				}
			}

			foreach ( $new_block->xpath as $xp_elem ) {
				$xp_dom = dom_import_simplexml( $xp_elem );
				if ( $xp_dom ) {
					$imported_xp = $owner_doc->importNode( $xp_dom, true );
					if ( $first_key_node ) {
						$existing_block->insertBefore( $imported_xp, $first_key_node );
					} else {
						$existing_block->appendChild( $imported_xp );
					}
				}
			}
		}

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
			if ( (string) $blk['type'] === $name ) {
				$found_block = $blk;
				break;
			}
		}
		if ( ! $found_block ) {
			$found_block = $xml->{$this->section_name}->addChild( 'gutenberg-block' );
			$found_block->addAttribute( 'type', $name );
		}

		$translate = isset( $field_details['translate'] ) ? (string) $field_details['translate'] : '1';
		if ( ! isset( $found_block['translate'] ) ) {
			$found_block->addAttribute( 'translate', $translate );
		}

		$xpaths = array();
		if ( ! empty( $field_details['__xpaths__'] ) && is_array( $field_details['__xpaths__'] ) ) {
			$xpaths = $field_details['__xpaths__'];
		} elseif ( ! empty( $field_details['xpaths'] ) && is_array( $field_details['xpaths'] ) ) {
			$xpaths = $field_details['xpaths'];
		} elseif ( ! empty( $field_details['xpath'] ) ) {
			if ( is_array( $field_details['xpath'] ) ) {
				$xpaths = $field_details['xpath'];
			} else {
				$lines = explode( "\n", (string) $field_details['xpath'] );
				foreach ( $lines as $line ) {
					$line = trim( $line );
					if ( '' !== $line ) {
						$xpaths[] = array( 'value' => $line );
					}
				}
			}
		}

		$existing_xps = array();
		if ( isset( $found_block->xpath ) ) {
			foreach ( $found_block->xpath as $cur_xp ) {
				$existing_xps[] = trim( (string) $cur_xp );
			}
		}

		foreach ( $xpaths as $xp ) {
			$xp_val = is_array( $xp ) ? ( $xp['value'] ?? $xp['xpath'] ?? '' ) : (string) $xp;
			$xp_val = trim( $xp_val );
			if ( '' === $xp_val || in_array( $xp_val, $existing_xps, true ) ) {
				continue;
			}
			$xp_node = $found_block->addChild( 'xpath', htmlspecialchars( $xp_val ) );
			if ( is_array( $xp ) ) {
				foreach ( $xp as $attr_k => $attr_v ) {
					if ( ! in_array( $attr_k, array( 'value', 'xpath' ), true ) && is_scalar( $attr_v ) && '' !== (string) $attr_v ) {
						$xp_node->addAttribute( (string) $attr_k, (string) $attr_v );
					}
				}
			}
			$existing_xps[] = $xp_val;
		}

		$this->append_simplexml_keys_recursive( $found_block, $field_details );
	}

	/**
	 * Recursively append key nodes into SimpleXML parent.
	 *
	 * @param SimpleXMLElement $parent
	 * @param array            $field_details
	 * @return void
	 */
	private function append_simplexml_keys_recursive( SimpleXMLElement $parent, array $field_details ): void {
		foreach ( $field_details as $f_key => $f_info ) {
			if ( in_array( $f_key, array( 'xpath', 'xpaths', '__xpaths__', 'translate' ), true ) ) {
				continue;
			}
			$found_node = null;
			if ( isset( $parent->key ) ) {
				foreach ( $parent->key as $k ) {
					if ( (string) $k['name'] === (string) $f_key ) {
						$found_node = $k;
						break;
					}
				}
			}
			if ( ! $found_node ) {
				$found_node = $parent->addChild( 'key' );
				$found_node->addAttribute( 'name', (string) $f_key );
			}

			if ( ! empty( $f_info['type'] ) && 'array' !== $f_info['type'] && 'object' !== $f_info['type'] && ! isset( $found_node['type'] ) ) {
				$found_node->addAttribute( 'type', (string) $f_info['type'] );
			}
			if ( ! empty( $f_info['editor_type'] ) && ! isset( $found_node['editor_type'] ) ) {
				$found_node->addAttribute( 'editor_type', (string) $f_info['editor_type'] );
			}

			if ( isset( $f_info['children'] ) && is_array( $f_info['children'] ) && ! empty( $f_info['children'] ) ) {
				$this->append_simplexml_keys_recursive( $found_node, $f_info['children'] );
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
				$name = (string) $block['type'];
				if ( empty( $name ) ) {
					continue;
				}

				$xpaths = array();
				if ( isset( $block->xpath ) ) {
					foreach ( $block->xpath as $xpath_node ) {
						$xpath_val = trim( (string) $xpath_node );
						if ( '' === $xpath_val ) {
							continue;
						}
						$entry = array(
							'value' => $xpath_val,
						);
						foreach ( $xpath_node->attributes() as $attr_name => $attr_val ) {
							$entry[ (string) $attr_name ] = (string) $attr_val;
						}
						if ( isset( $entry['type'] ) && 'link' === strtolower( (string) $entry['type'] ) ) {
							$rules['gutenberg'][ $name ]['no_translate'][ $xpath_val ] = true;
							continue;
						}
						$xpaths[] = $entry;
					}
				}

				if ( ! isset( $rules['gutenberg'][ $name ] ) ) {
					$rules['gutenberg'][ $name ] = array(
						'name'         => $name,
						'type'         => $name,
						'source'       => $source,
						'translate'    => isset( $block['translate'] ) ? (string) $block['translate'] : '1',
						'xpaths'       => $xpaths,
						'xpath'        => ! empty( $xpaths ) ? $xpaths[0]['value'] : '',
						'keys'         => array(),
						'no_translate' => array(),
					);
				} else {
					if ( ! empty( $xpaths ) ) {
						$rules['gutenberg'][ $name ]['xpaths'] = $xpaths;
						$rules['gutenberg'][ $name ]['xpath']  = $xpaths[0]['value'];
					}
					if ( isset( $block['translate'] ) ) {
						$rules['gutenberg'][ $name ]['translate'] = (string) $block['translate'];
					}
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
						} elseif ( isset( $rules['gutenberg'][ $name ]['keys'][ $key_name ] ) ) {
							unset( $rules['gutenberg'][ $name ]['keys'][ $key_name ] );
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
		$is_link_type    = isset( $key_node['type'] ) && 'link' === strtolower( (string) $key_node['type'] );
		$is_no_translate = $parent_no_translate || $is_link_type || ( isset( $key_node['noTranslate'] ) && in_array( strtolower( (string) $key_node['noTranslate'] ), array( 'true', '1', 'yes' ), true ) );
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
				++$count;
			}
		}
		return $count;
	}
}
