=== TranslateSense ===
Contributors: aniketji007
Tags: translation, polylang, multilingual, translate, ai translation
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.0.8
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Translate WordPress content with AI using Polylang. Supports Gutenberg, Elementor, Classic Editor, WooCommerce, and translation memory.

== Description ==

TranslateSense is an AI-powered translation plugin for WordPress websites using Polylang or Polylang Pro.

Translate posts, pages, custom post types, and WooCommerce products with OpenAI, Google Gemini, or supported browser-based AI. TranslateSense works with popular WordPress editors and page builders while preserving content structure and layout.

It also includes bulk translation, internal link translation, SEO metadata translation, taxonomy synchronization, and database-based translation memory to reuse previously translated text.

== Features ==

* **Polylang integration:** Connect translated posts, pages, taxonomies, and terms across languages.
* **Multiple AI providers:** Use OpenAI, Google Gemini, Chrome Built-in AI, or Edge Built-in AI.
* **Browser-based AI:** Use supported browser AI features for on-device translation without an external API key.
* **Bulk translation:** Select multiple posts and target languages from a multi-step translation wizard.
* **Background processing:** OpenAI and Gemini bulk translation jobs can continue through background WP-Cron processing.
* **Live progress:** Monitor translation progress, results, and failed items. Skip pending translations for individual posts.
* **Editor integration:** Translate content from Gutenberg, Elementor, and Classic Editor.
* **Content structure:** Translate supported blocks, widgets, fields, and content while preserving their structure.
* **SEO support:** Translate slugs, SEO titles, and descriptions for Yoast SEO and Rank Math.
* **Internal links:** Update internal links to point to translated posts when corresponding translations are available.
* **Media synchronization:** Support featured images and inline media references.
* **Taxonomy synchronization:** Translate and assign categories, tags, and custom taxonomy terms.
* **Custom fields:** Support custom field translation and preserve ACF repeater and flexible content structures.
* **Translation memory:** Store and reuse translated strings to reduce repeated provider requests.
* **XML configuration:** Add or customize rules for unsupported blocks, widgets, and fields.
* **Safe retranslation:** Update existing translations without resetting their custom slugs or post statuses.

== Supported Editors and Integrations ==

=== WordPress Block Editor (Gutenberg) ===

Supports WordPress core blocks and configured third-party block libraries, including:

-   Spectra (Ultimate Addons for Gutenberg)
-   Essential Blocks
-   Kadence Blocks
-   Stackable
-   Gutenverse
-   Ultimate Blocks
-   Qi Blocks
-   Rank Math Table of Contents block

Custom XML rules can be used to configure additional blocks and attributes.

=== Elementor ===

Supports Elementor widgets and structured Elementor data, including widget settings and repeater fields. Translation can be started from the Elementor editor panel.

=== Classic Editor ===

Supports post titles, excerpts, content, and configured custom fields. A Translate button is available above the editor toolbar.

=== Post Types and Taxonomies ===

* Posts and pages
* Custom post types
* WooCommerce products
* Categories, tags, and custom taxonomies

=== SEO and Custom Fields ===

* Yoast SEO: SEO titles and meta descriptions.
* Rank Math: SEO titles and meta descriptions, plus supported Table of Contents blocks.
* Advanced Custom Fields (ACF): Preserves repeater and flexible content structures.

== AI Providers ==

TranslateSense supports the following translation providers:

* OpenAI: GPT-4o, GPT-4o-mini, GPT-4-turbo, and GPT-3.5-turbo.
* Google Gemini: Gemini 1.5 Flash, Gemini 1.5 Pro, Gemini 2.0 Flash, and Gemini 2.5 Flash Lite.
* Chrome Built-in AI: Browser-based, on-device AI where supported.
* Edge Built-in AI: Browser-based, on-device AI where supported.

Availability of browser-based AI depends on browser support and configuration. API-based providers require their own API credentials.

== Bulk Translation ==

Translate multiple posts into multiple languages using the bulk translation wizard.

1.  Select the posts you want to translate.
2.  Choose the target languages.
3.  Select an available AI provider.
4.  Start the translation process.
5.  Monitor progress and review the translated posts.

For supported API providers, bulk jobs can run through background WP-Cron processing. You can leave the page while the jobs continue. The background monitor shows progress and allows you to skip pending translations for individual posts.

== Translation Memory ==

TranslateSense stores translated strings in dedicated database tables and uses string hashes to find reusable translations.

When the same source text is used again, the saved translation can be reused instead of requesting another translation from the provider. This helps reduce repeated API requests and translation costs.

Expired translation data can be removed through scheduled cleanup.

=== Chrome and Edge Built-in AI ===

* Purpose: Translate content using supported browser AI APIs.
* Data sent: Translation is processed locally by the browser’s built-in AI features. TranslateSense does not send the selected text to an external AI provider for this translation method.
* Requirements: A compatible browser with the required AI features available and enabled.

== XML Configuration ==

Use the XML Configuration section to customize how TranslateSense handles content that is not covered by the built-in mappings.

You can configure XML rules for block attributes, widget settings, content fields, and other supported data. The editor includes visual and raw XML editing options, along with a rule detection tool.

== External Services ==

TranslateSense can send selected website content to an external AI provider when you use that provider for translation. The data sent depends on the provider and the content you choose to translate.

* **OpenAI API**
Purpose: Translate selected text, post titles, excerpts, and slugs.
Data sent: Selected text and source and target language codes.
API: https://api.openai.com/v1/chat/completions
API key: https://platform.openai.com/api-keys
Terms: https://openai.com/policies/terms-of-use
Privacy: https://openai.com/policies/privacy-policy

* **Google Gemini API**
Purpose: Translate selected website content.
Data sent: Selected text and source and target language codes.
API: Google Generative Language API.
API key: https://aistudio.google.com/app/apikey
Terms: https://policies.google.com/terms
Privacy: https://policies.google.com/privacy

* **Dragwyb Feedback API:**
Allows voluntary submission of feedback, diagnostic reports, and error telemetry from the admin dashboard to improve plugin quality. [Service Endpoint](https://feedback.dragwyb.com) | [Privacy Policy](https://dragwyb.com/privacy-policy/)

== Installation ==

1.  Install and activate Polylang or Polylang Pro.
2.  Upload the TranslateSense plugin to your WordPress site, or install it from the Plugins screen.
3.  Activate TranslateSense.
4.  Go to Languages > TranslateSense.
5.  Configure your preferred AI provider and its credentials, if required.
6.  Choose your translation preferences.
7.  Start translating from a post list or a supported editor.

== Frequently Asked Questions ==

= Does TranslateSense require Polylang? =
Yes. TranslateSense uses Polylang to manage languages and connect translated content.

= Which AI providers are supported? =
TranslateSense supports OpenAI, Google Gemini, Chrome Built-in AI, and Edge Built-in AI. Provider and model availability depends on the selected integration and environment.

= Can I translate without an API key? =
Yes. You can use Chrome Built-in AI or Edge Built-in AI when the required browser features are supported and enabled. These options process translation on the device.

= Which editors and page builders are supported? =
TranslateSense supports Gutenberg, Elementor, and Classic Editor. It also includes mappings for several popular Gutenberg block libraries.

= Can I translate multiple posts at once? =
Yes. Use the Bulk Translation wizard to select multiple posts and target languages.

= Do bulk translations continue if I leave the page? =
Supported API-based bulk translation jobs use background WP-Cron processing. The background monitor lets you check their progress.

= Does TranslateSense translate SEO metadata? =
Yes. It supports SEO titles and meta descriptions for Yoast SEO and Rank Math.

= Does it translate internal links? =
TranslateSense can update internal links to their corresponding translated posts when those translations are available.

= Can I add support for custom blocks or widgets? =
Yes. Use Languages > TranslateSense > XML Configuration to add or customize XML mapping rules.

= How does Translation Memory work? =
TranslateSense stores translations of source strings in its database. When the same text is encountered again, it can reuse the saved translation and avoid another provider request.

== Screenshots ==

1.  Dashboard and settings for AI providers, models, and translation options.
2.  Bulk Translation wizard for selecting target languages.
3.  Provider selection and API credential checks.
4.  Live translation progress and results.
5.  Background translation monitor with per-post skip actions.

== Changelog ==

= 0.0.8 = 

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