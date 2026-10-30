<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Parser\Builders;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classic Editor & Plain Content Parser.
 */
class Classic_Builder extends Base_Builder {

	/**
	 * Builder slug.
	 */
	public function get_builder_slug(): string {
		return 'classic';
	}

	/**
	 * Parse plain text or classic WordPress content into translatable strings.
	 *
	 * @param mixed  $content
	 * @param int    $post_id
	 * @param string $lang
	 * @param array  $rules
	 * @return array
	 */
	public function parse( $content, int $post_id = 0, string $lang = '', array $rules = array() ): array {
		$extracted = array();

		if ( is_string( $content ) && '' !== trim( $content ) ) {
			$this->record_extracted_string( $post_id, $lang, 'classic_content', 'post_content', $content, $extracted );
		}

		return $extracted;
	}
}
