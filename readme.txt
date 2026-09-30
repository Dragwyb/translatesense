=== TranslateSense ===
Contributors: aniketji007
Tags: translation, polylang, multilingual, translate, ai translation
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.0.5
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

A high-performance automatic translation addon for Polylang with Gutenberg & Elementor XML mapping, auto-detection, and DB caching.

== Description ==

Translate Sense is a high-performance multilingual translation plugin seamlessly integrated with Polylang. It automates page and post translations across popular page builders such as Gutenberg and Elementor using advanced XML rule mapping, AI-powered providers, and intelligent database-level translation memory caching.

= Key Features =
* Seamless Polylang integration for full multilingual workflow.
* Deep integration with WordPress Block Editor (Gutenberg) and Elementor page builder.
* Smart XML configuration engine for fine-grained widget and block translation control.
* Fast database-level translation memory caching to avoid redundant API queries.
* Background batch processing with asynchronous cron workers.
* Zero external bloat and lightweight footprint.

== External Services Disclosure ==

This plugin relies on third-party AI services to automatically translate your website content. To function, it makes secure outbound API requests to either OpenAI or Google Gemini, depending on the provider you select in the plugin settings. 

Please note that this plugin requires you to create your own account with these providers and generate your own API key. 

Below are the details of the external services used:

1. OpenAI API
* Purpose: Used to process and translate your website's strings and text content via the `api.openai.com/v1/chat/completions` endpoint.
* Data Shared: Only the specific text/strings you select for translation are sent to OpenAI. No other website data, user data, or personal information is transmitted.
* Get an API Key: https://platform.openai.com/api-keys
* Terms of Service: https://openai.com/policies/terms-of-use
* Privacy Policy: https://openai.com/policies/privacy-policy

2. Google Gemini API (Generative Language)
* Purpose: Used to process and translate your website's strings and text content via the `generativelanguage.googleapis.com/v1beta/models/` endpoint.
* Data Shared: Only the specific text/strings you select for translation are sent to Google. No other website data, user data, or personal information is transmitted.
* Get an API Key: https://aistudio.google.com/app/apikey
* Terms of Service: https://policies.google.com/terms
* Privacy Policy: https://policies.google.com/privacy

== Installation ==

1. Upload the `translatesense` folder to the `/wp-content/plugins/` directory, or install the plugin directly through the WordPress plugins screen.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Ensure the Polylang plugin is installed and activated.
4. Navigate to 'Languages > TranslateSense' to configure your translation preferences.

== Frequently Asked Questions ==

= Does Translate Sense require Polylang? =
Yes, Translate Sense is designed to work in synergy with the Polylang multilingual plugin.

= Which page builders are supported? =
Currently, Gutenberg (WordPress Block Editor) and Elementor are fully supported with custom XML rule generators.

== Changelog ==

= 0.0.5 =
* Improve bulk translation rest route permission check.
* Improve bulk translation chrome built in ai language available check.
* Improve bulk translation modal styling.
* Improve editor page transaltion provider modal stylig.
* Improve page editor progress overlay visibility.

= 0.0.4 =
* Improve rest route permission callback checks.
* Fixed PHP error method not found.

= 0.0.3 =
* Improve rest route permission callback checks.

= 0.0.2 =
* Update permission callback in bulk status route.
* Added nonce verification in save_post hook callback.
* Use provider isProviderConfigured methods with transient instead of get option.

= 0.0.1 =
* Added WordPress 7.0 connectors provider support If provider install.
* Dynamic provider models showing.
* Added Redirect and Manage API key and Provider Activate button for WP 7.0 connectors.
* Remove creating and update config in upload directory.
* Update permission check in routes.
* Added depth check in array recursive.
* Improve error handling.
* Removed unused code.
* Dashboard style improvement.
* Fixed translate string save issue and AI provider translation issues.
* Prevent saving translate posts in package.

= 0.0.0 =
* Initial release.
