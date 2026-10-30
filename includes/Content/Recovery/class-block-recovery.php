<?php

declare(strict_types=1);

namespace TranslateSense\Includes\Content\Recovery;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gutenberg Block Recovery Handler.
 */
class Block_Recovery {

	const META_FLAG = '_block_repair_pending';

	/**
	 * Check if a post is marked for block repair.
	 *
	 * @param int $post_id Post ID.
	 * @return bool
	 */
	public static function is_repair_pending( int $post_id ): bool {
		return '1' === (string) get_post_meta( $post_id, self::META_FLAG, true );
	}

	/**
	 * Clear repair pending status for a post.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function clear_repair_flag( int $post_id ): void {
		delete_post_meta( $post_id, self::META_FLAG );
	}

	/**
	 * Mark post for block repair check.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function mark_repair_pending( int $post_id ): void {
		update_post_meta( $post_id, self::META_FLAG, '1' );
	}
}
