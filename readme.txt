
=== TranslateSense ===
Contributors: dragwyb
Tags: translation, polylang, multilingual, translate, ai translation
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.0.9
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Translate WordPress content with AI using Polylang. Supports Gutenberg, Elementor, Classic Editor, WooCommerce, and translation memory.

== Description ==

TranslateSense is an AI-powered translation plugin for WordPress that works with Polylang and Polylang Pro.

Translate posts, pages, custom post types, and WooCommerce products using OpenAI, Google Gemini, Chrome Built-in AI, or Edge Built-in AI.

TranslateSense integrates with popular WordPress editors and page builders while preserving supported content structures and layouts.

Key capabilities include bulk translation, background processing, internal link translation, SEO metadata translation, taxonomy synchronization, and database-based translation memory.

== Features ==

* Polylang integration: Connect translated posts, pages, taxonomies, and terms across languages.
* Multiple AI providers: Use OpenAI, Google Gemini, Chrome Built-in AI, or Edge Built-in AI.
* Browser-based AI: Use supported browser AI features for on-device translation without an external API key.
* Bulk translation: Select multiple posts and target languages using a multi-step translation wizard.
* Background processing: OpenAI and Gemini bulk translation jobs can continue through background WP-Cron processing.
* Live progress monitoring: Track translation progress, completed items, and failed translations.
* Translation controls: Skip pending translations for individual posts.
* Editor integration: Translate content from Gutenberg, Elementor, and Classic Editor.
* Content structure preservation: Translate supported blocks, widgets, fields, and content while preserving their structure.
* SEO translation: Translate slugs, SEO titles, and meta descriptions for Yoast SEO and Rank Math.
* Internal link translation: Update internal links to corresponding translated posts when translations are available.
* Media synchronization: Support featured images and inline media references.
* Taxonomy synchronization: Translate and assign categories, tags, and custom taxonomy terms.
* Custom field translation: Support custom fields and preserve ACF repeater and flexible content structures.
* Translation memory: Store and reuse translated strings to reduce repeated provider requests.
* XML configuration: Customize rules for unsupported blocks, widgets, and fields.

== Supported Editors and Integrations ==

=== WordPress Block Editor (Gutenberg) ===

Supports WordPress core blocks and configured third-party block libraries, including:

* Spectra (Ultimate Addons for Gutenberg)
* Essential Blocks
* Kadence Blocks
* Stackable
* Gutenverse
* Ultimate Blocks
* Qi Blocks
* Rank Math Table of Contents block

Custom XML rules can be used to configure additional blocks and attributes.

=== Elementor ===

Supports Elementor widgets and structured Elementor data, including widget settings and repeater fields.

Translation can be started directly from the Elementor editor panel.

=== Classic Editor ===

Supports post titles, excerpts, content, and configured custom fields.

A Translate button is available above the editor toolbar.

=== Post Types and Taxonomies ===

* Posts and pages
* Custom post types
* WooCommerce products
* Categories and tags
* Custom taxonomies

=== SEO and Custom Fields ===

* Yoast SEO: SEO titles and meta descriptions.
* Rank Math: SEO titles and meta descriptions, plus supported Table of Contents blocks.
* Advanced Custom Fields (ACF): Preserves repeater and flexible content structures.

== AI Providers ==

TranslateSense supports the following AI translation providers:

* OpenAI: GPT-4o, GPT-4o-mini, GPT-4-turbo, and GPT-3.5-turbo.
* Google Gemini: Gemini 1.5 Flash, Gemini 1.5 Pro, Gemini 2.0 Flash, and Gemini 2.5 Flash Lite.
* Chrome Built-in AI: Browser-based, on-device AI where supported.
* Edge Built-in AI: Browser-based, on-device AI where supported.

Browser-based AI availability depends on browser compatibility and configuration.

API-based providers require their own API credentials.

== Bulk Translation ==

Translate multiple posts into multiple languages using the Bulk Translation wizard.

1. Select the posts you want to translate.
2. Choose the target languages.
3. Select an available AI provider.
4. Start the translation process.
5. Monitor progress and review translation results.

For supported API providers, bulk translation jobs can run through background WP-Cron processing. You can leave the administration page while these jobs continue.

The background monitor displays translation progress and allows you to skip pending translations for individual posts.

== Translation Memory ==

TranslateSense stores translated strings in dedicated database tables and uses string hashes to identify reusable translations.

When the same source text is encountered again, TranslateSense can reuse the previously stored translation instead of requesting another translation from the provider.

This helps reduce repeated API requests and translation costs.

Expired translation data can be removed through scheduled cleanup.

== Browser-based AI ==

TranslateSense supports Chrome and Edge Built-in AI where the required browser features are available.

* Processing: Translation uses supported browser AI APIs.
* Data handling: TranslateSense does not send the selected text to an external AI translation provider when using this browser-based translation method.
* Requirements: A compatible browser with the required AI features available and enabled.

== XML Configuration ==

Use the XML Configuration section to customize how TranslateSense handles content that is not covered by built-in mappings.

You can configure XML rules for:

* Gutenberg block attributes.
* Elementor widget settings.
* Content fields.
* Other supported structured data.

The editor provides visual and raw XML editing options, along with a rule detection tool.

== External Services ==

TranslateSense integrates with external AI providers for translation and the Dragwyb Feedback API for voluntary feedback and diagnostics.

External AI services receive selected website content when you use the corresponding provider. The information transmitted depends on the selected provider and translation operation.

=== OpenAI API ===

* Purpose: Translate selected text, post titles, excerpts, and slugs.
* Data sent: Selected text and source and target language codes.
* When data is sent: When an OpenAI translation request is initiated.
* API endpoint: https://api.openai.com/v1/chat/completions
* API key: https://platform.openai.com/api-keys
* Terms: https://openai.com/policies/terms-of-use
* Privacy: https://openai.com/policies/privacy-policy

=== Google Gemini API ===

* Purpose: Translate selected website content.
* Data sent: Selected text and source and target language codes.
* When data is sent: When a Gemini translation request is initiated.
* API: Google Generative Language API.
* API key: https://aistudio.google.com/app/apikey
* Terms: https://policies.google.com/terms
* Privacy: https://policies.google.com/privacy

=== Dragwyb Feedback API ===

* Purpose: Receive voluntary feedback, diagnostic reports, and error telemetry to help improve plugin quality.
* Data sent: Feedback and diagnostic information included in a report submitted through the plugin administration dashboard.
* When data is sent: When the user voluntarily submits feedback or a diagnostic report.
* Service endpoint: https://feedback.dragwyb.com
* Privacy: https://dragwyb.com/privacy-policy/

=== Chrome and Edge Built-in AI ===

TranslateSense uses supported browser AI APIs for on-device translation.

* Purpose: Translate selected website content.
* Data handling: Selected translation text is processed using the browser's built-in AI features rather than being sent by TranslateSense to an external AI translation provider.
* Requirements: Compatible browser and enabled AI features.

== Installation ==

1. Install and activate Polylang or Polylang Pro.
2. Install TranslateSense from the WordPress Plugins screen or upload the plugin ZIP file.
3. Activate TranslateSense.
4. Navigate to Languages > TranslateSense.
5. Configure your preferred AI provider and API credentials, if required.
6. Configure your translation preferences.
7. Start translating from the post list or a supported editor.

== Frequently Asked Questions ==

= Does TranslateSense require Polylang? =

Yes. TranslateSense uses Polylang to manage languages and connect translated content.

= Which AI providers are supported? =

TranslateSense supports OpenAI, Google Gemini, Chrome Built-in AI, and Edge Built-in AI. Available providers and models depend on the selected integration and environment.

= Can I translate without an API key? =

Yes. Chrome Built-in AI and Edge Built-in AI can be used without an external AI provider API key when the required browser features are supported and enabled.

= Which editors and page builders are supported? =

TranslateSense supports Gutenberg, Elementor, and Classic Editor. It also includes mappings for several popular Gutenberg block libraries.

= Can I translate multiple posts at once? =

Yes. Use the Bulk Translation wizard to select multiple posts and target languages.

= Do bulk translations continue if I leave the page? =

Supported API-based bulk translation jobs use background WP-Cron processing. You can monitor their progress through the background translation monitor.

= Does TranslateSense translate SEO metadata? =

Yes. TranslateSense supports SEO titles and meta descriptions for Yoast SEO and Rank Math.

= Does TranslateSense translate internal links? =

Yes. TranslateSense can update internal links to their corresponding translated posts when those translations are available.

= Can I add support for custom blocks or widgets? =

Yes. Navigate to Languages > TranslateSense > XML Configuration to add or customize XML mapping rules.

= How does Translation Memory work? =

TranslateSense stores translations of source strings in its database. When the same source text is encountered again, it can reuse the saved translation instead of requesting another translation from the provider.

== Source Code and Contributions ==

TranslateSense is open source. You can explore the source code, report issues, and contribute to its development on GitHub.

[GitHub Repository](https://github.com/Dragwyb/translatesense)

Contributions and community feedback are welcome!

== Screenshots ==

1. Dashboard and settings for AI providers, models, and translation options.
2. Bulk Translation wizard for selecting target languages.
3. Provider selection and API credential checks.
4. Live translation progress and results.
5. Background translation monitor with per-post skip actions.

== Changelog ==

= 0.1.0 =
* Added default ACF field translation support in Bulk Translation and the Page Editor.
* Added default translation support for Yoast SEO, Rank Math SEO, and SEOPress fields in Bulk Translation and the Page Editor.
* Added support for translating plugin-configured custom fields defined in wpml-config.xml.
* Improved the post translation completion check.

= 0.0.9 =

* Initial public release.
* Added OpenAI, Google Gemini, Chrome Built-in AI, and Edge Built-in AI support.
* Added Gutenberg, Elementor, and Classic Editor translation.
* Added bulk translation with multiple posts and target languages.
* Added background bulk translation processing and progress monitoring.
* Added in-editor translation controls.
* Added slug translation options.
* Added internal link translation.
* Added featured image and inline media synchronization.
* Added taxonomy translation and synchronization.
* Added ACF repeater and flexible content structure preservation.
* Added Yoast SEO and Rank Math metadata support.
* Added WooCommerce product and custom post type support.
* Added XML configuration for Gutenberg blocks and Elementor widgets.
* Added database-based Translation Memory and scheduled cleanup.