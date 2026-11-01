<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Processor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gutenberg Block Processor Handler.
 */
class Block_Processor {

	const META_FLAG = '_translatesense_block_state_pending';

	/**
	 * Check if a post is marked for block process.
	 *
	 * @param int $post_id Post ID.
	 * @return bool
	 */
	public static function is_block_state_pending( int $post_id ): bool {
		return '1' === (string) get_post_meta( $post_id, self::META_FLAG, true );
	}

	/**
	 * Clear process pending status for a post.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function clear_process_flag( int $post_id ): void {
		delete_post_meta( $post_id, self::META_FLAG );
	}

	/**
	 * Mark post for block process check.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function mark_process_pending( int $post_id ): void {
		update_post_meta( $post_id, self::META_FLAG, '1' );
	}
}
