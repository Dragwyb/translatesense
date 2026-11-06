<?php

declare(strict_types=1);

namespace TranslateSense\Includes\XML;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves translation rules for custom fields with strict precedence:
 * 1. User XML rules (highest priority)
 * 2. Generated ACF rules (runtime only)
 * 3. Default policy fallback
 */
class Custom_Field_Rule_Resolver {

	const ACTION_TRANSLATE = 'translate';
	const ACTION_COPY      = 'copy';
	const ACTION_COPY_ONCE = 'copy-once';
	const ACTION_IGNORE    = 'ignore';

	/**
	 * Normalize action aliases into standard action names.
	 */
	public static function normalize_action( string $action ): string {
		switch ( strtolower( trim( $action ) ) ) {
			case 'translate':
			case '1':
			case 'true':
				return self::ACTION_TRANSLATE;

			case 'copy-once':
			case 'copy_once':
				return self::ACTION_COPY_ONCE;

			case 'ignore':
			case 'notranslate':
			case 'no_translate':
			case '0':
			case 'false':
				return self::ACTION_IGNORE;

			case 'copy':
			default:
				return self::ACTION_COPY;
		}
	}

	/**
	 * Get default policy action for an ACF field type.
	 */
	public static function get_action( string $field_type ): string {
		switch ( strtolower( trim( $field_type ) ) ) {
			case 'text':
			case 'textarea':
			case 'wysiwyg':
			case 'link':
				return self::ACTION_TRANSLATE;

			case 'group':
			case 'repeater':
			case 'flexible_content':
			case 'clone':
				return 'structural';

			default:
				return self::ACTION_COPY;
		}
	}

	/**
	 * Generate runtime rules for discovered ACF fields.
	 */
	public static function generate_acf_rules( array $fields ): array {
		$rules = array();

		foreach ( $fields as $meta_key => $field_info ) {
			$meta_key   = sanitize_key( (string) $meta_key );
			$field_type = (string) ( $field_info['field_type'] ?? '' );
			$field_key  = (string) ( $field_info['field_key'] ?? '' );

			if ( '' === $meta_key ) {
				continue;
			}

			$action = self::get_action( $field_type );

			$rules[ $meta_key ] = array(
				'meta_key'   => $meta_key,
				'action'     => ( 'structural' === $action ) ? self::ACTION_TRANSLATE : $action,
				'origin'     => 'acf_generated',
				'field_type' => $field_type,
				'field_key'  => $field_key,
			);
		}

		return $rules;
	}

	/**
	 * Check if a field name matches a wildcard pattern (e.g. hero_*).
	 */
	public static function is_wildcard_match( string $pattern, string $subject ): bool {
		$pattern = strtolower( trim( $pattern ) );
		$subject = strtolower( trim( $subject ) );

		if ( '*' === $pattern ) {
			return true;
		}

		if ( function_exists( 'fnmatch' ) ) {
			return fnmatch( $pattern, $subject, FNM_CASEFOLD );
		}

		$regex = '/^' . str_replace( '\*', '.*', preg_quote( $pattern, '/' ) ) . '$/i';
		return (bool) preg_match( $regex, $subject );
	}

	/**
	 * Resolve effective rule for a field: User XML > Generated ACF > Policy.
	 */
	public static function resolve_field_rule(
		string $meta_key,
		array $user_rules,
		array $generated_rules = array(),
		string $fallback_field_type = ''
	): array {
		$meta_key = trim( $meta_key );

		// 1. Exact user XML rule
		if ( isset( $user_rules[ $meta_key ] ) ) {
			return array(
				'meta_key' => $meta_key,
				'action'   => self::normalize_action( (string) $user_rules[ $meta_key ]['action'] ),
				'origin'   => 'user_xml',
			);
		}

		// 2. Wildcard user XML rule
		foreach ( $user_rules as $pattern => $rule ) {
			if ( false !== strpos( (string) $pattern, '*' ) && self::is_wildcard_match( (string) $pattern, $meta_key ) ) {
				return array(
					'meta_key' => $meta_key,
					'action'   => self::normalize_action( (string) $rule['action'] ),
					'origin'   => 'user_xml',
				);
			}
		}

		// 3. Generated ACF rule
		if ( isset( $generated_rules[ $meta_key ] ) ) {
			return array(
				'meta_key' => $meta_key,
				'action'   => self::normalize_action( (string) $generated_rules[ $meta_key ]['action'] ),
				'origin'   => 'acf_generated',
			);
		}

		// 4. Default policy
		return array(
			'meta_key' => $meta_key,
			'action'   => self::normalize_action( self::get_action( $fallback_field_type ) ),
			'origin'   => 'acf_policy_default',
		);
	}

	/**
	 * Resolve effective rules for all discovered fields.
	 */
	public static function resolve_all_rules( array $fields, array $user_rules ): array {
		$generated_rules = self::generate_acf_rules( $fields );
		$resolved_rules  = array();

		foreach ( $fields as $meta_key => $field_info ) {
			$meta_key   = (string) $meta_key;
			$field_type = (string) ( $field_info['field_type'] ?? '' );

			$resolved               = self::resolve_field_rule( $meta_key, $user_rules, $generated_rules, $field_type );
			$resolved['field_type'] = $field_type;

			$resolved_rules[ $meta_key ] = $resolved;
		}

		return $resolved_rules;
	}
}
