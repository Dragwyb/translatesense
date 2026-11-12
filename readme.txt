=== TranslateSense – AI Translation for Polylang ===
Contributors: dragwyb
Tags: translation, polylang, multilingual, ai translation, automatic translation
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI translation for WordPress with Polylang. Translate posts, custom post types, taxonomies, ACF, and SEO content via OpenAI, Gemini, or browser AI.

== Description ==

TranslateSense brings AI-powered content translation to WordPress sites running Polylang. Translate directly inside Gutenberg, Elementor, or Classic Editor using Page Editor Translation—reviewing and editing translated strings before saving—or queue multiple posts, pages, custom post types, and taxonomy terms from WordPress list tables using Bulk Translation.

Choose between **OpenAI**, **Google Gemini**, or **Built-in Browser AI** (available in supported Google Chrome and Microsoft Edge browsers). On WordPress 7.0 and newer, TranslateSense also integrates directly with **WordPress AI Connectors**.

== Resources ==

📖[Documentation](https://docs.dragwyb.com/ai-automatic-translation-addon-for-polylang/) | ✨[TranslateSense Pro](https://dragwyb.com/product/ai-automatic-translation-addon-for-polylang/)

**Key Features**

* **Built for Polylang:** Uses Polylang languages, post/taxonomy translation settings, linked translation relationships, and media synchronization settings.
* **Multiple AI Engines:** Translate with OpenAI, Google Gemini (via API key or WordPress AI Connectors), or Built-in Browser AI (Chrome/Edge v131+ without an external API key).
* **Page Editor Translation:** Translate directly inside Gutenberg, Elementor, and Classic Editor. Search, edit inline, reset individual strings, re-translate failed strings with OpenAI/Gemini, and apply changes to the editor before saving.
* **Bulk Translation & Background Processing:** Select multiple posts, pages, or custom post types on list screens to translate into one or more target languages. OpenAI and Google Gemini post batches continue asynchronously in the background via WP-Cron; browser AI and taxonomy term batches run directly in the active browser tab.
* **Taxonomy Translation:** Bulk-translate categories, tags, and Polylang-enabled custom taxonomies from taxonomy list screens, or translate and assign linked terms automatically during bulk post translation.
* **Gutenberg & Elementor Layout Preservation:** Includes built-in XML rules for 225 Gutenberg blocks (Core, Embeds, Spectra, Essential Blocks, Kadence Blocks, Otter Blocks, Stackable, Gutenverse, Ultimate Blocks, Qi Blocks, Rank Math TOC, TinyMCE Advanced) and 8 core Elementor widgets, plus Elementor widget auto-discovery and fallback translation for unconfigured Gutenberg blocks.
* **ACF & Custom Fields:** Supports Advanced Custom Fields (ACF) including text, WYSIWYG, choice/link titles, Repeaters, Flexible Content, Groups, and relational post/term/media ID mapping, as well as custom fields defined via active plugin/theme `wpml-config.xml` files or custom XML rules.
* **SEO Metadata & Slug Translation:** Syncs translated SEO metadata into Yoast SEO, Rank Math, and SEOPress editor fields (with field extraction driven by `wpml-config.xml` or custom XML rules) and supports translated, title-generated, or original post slugs.
* **Internal Links & Media Reference Updates:** Automatically rewrites internal post, category, tag, custom taxonomy, shortcode, and attachment URLs/IDs to point to existing Polylang-translated equivalents.
* **Translation Memory & Cache Controls:** Stores source strings, MD5-hashed translation packages, and translated strings in dedicated database tables to reuse prior translations, paired with manual cache clearing and automatic WP-Cron cleanup.
* **XML Configuration Editor:** View supported, custom, and unsupported Gutenberg blocks and Elementor widgets in the dashboard and edit custom `<wpml-config>` XML rules.

== AI Providers ==

TranslateSense supports three translation engines:

* **OpenAI:** Connect with an OpenAI API key in plugin settings or through a registered WordPress 7.0+ AI Connector. Supports background WP-Cron bulk processing and per-string retry in the Page Editor.
* **Google Gemini:** Connect with a Google Gemini API key in plugin settings or through a registered WordPress 7.0+ AI Connector. Supports background WP-Cron bulk processing and per-string retry in the Page Editor.
* **Built-in Browser AI:** Uses the on-device Translator API in **Google Chrome (v131+)** and **Microsoft Edge (v131+)** over HTTPS or `localhost` across 39 supported language codes. No external API key is required, and translations are processed locally inside the open browser tab.

== Supported Editors and Integrations ==

* **Gutenberg (Block Editor):** Supports 225 preconfigured block rules across WordPress Core blocks, Core Embeds, TinyMCE Advanced (`tadv/classic-paragraph`), Spectra (`uagb/*`), Essential Blocks, Kadence Blocks, Otter Blocks, Stackable, Gutenverse, Ultimate Blocks, Qi Blocks, and Rank Math TOC, plus fallback text extraction for unmapped blocks and automatic block recovery after bulk translation.
* **Elementor:** Supports core Elementor widgets (`heading`, `text-editor`, `button`, `icon-box`, `image-box`, `call-to-action`, `testimonial`, `alert`), nested repeater lists, Elementor v4 atomic controls, Elementor page settings, and automatic schema discovery for unmapped widgets (persisted when edited by an administrator).
* **Classic Editor:** Uses DOM offset mapping to translate text units, standalone accessibility/UI attributes (`alt`, `title`, `aria-label`, `aria-description`, `placeholder`), post titles, slugs, and excerpts while keeping HTML markup intact.
* **Cross-Editor Guard:** When a source post was built in Elementor and the target translation is opened in Gutenberg or Classic Editor, TranslateSense prompts you to switch to Elementor so page builder data is preserved.
* **Advanced Custom Fields (ACF):** Extracts and translates `text`, `textarea`, `wysiwyg`, `select`, `checkbox`, `radio`, `button_group`, `link` titles, `repeater`, `flexible_content`, and `group` fields, and maps translated IDs for `image`, `file`, `gallery`, `relationship`, `post_object`, `page_link`, and `taxonomy` fields. (Skipped automatically when Polylang's Custom Fields synchronization option is active.)
* **SEO Plugins (Yoast SEO, Rank Math, SEOPress):** Updates live editor fields and stores in Page Editor Translation and supports translating SEO post meta when rules are provided by the SEO plugin's `wpml-config.xml` file or custom XML Configuration.
* **WooCommerce:** Compatible with WooCommerce products (`product`) and product taxonomies (`product_cat`, `product_tag`) when enabled for translation in Polylang, including internal product/category link resolution, ACF fields, and custom field rules from `wpml-config.xml` or XML Configuration.
* **Polylang:** Manages site languages, linked translations, taxonomy assignment, sticky post status, media attachment translation (`media_support`), and optional custom field sync detection.

== Translation Tools ==

=== Page Editor Translation ===

Start translation from the TranslateSense metabox or toolbar button inside Gutenberg, Elementor, or Classic Editor:

* Choose an enabled AI provider and monitor progress in real time.
* Filter strings by search text, inspect character/string/time statistics, edit any translated row inline, or reset edited rows back to the AI output.
* Re-translate remaining empty/failed strings when using OpenAI or Google Gemini.
* Click **Apply to Page** to populate the editor without overwriting your post until you review and save it yourself.

=== Bulk Translation ===

Select posts, pages, custom post types, or taxonomy terms from WordPress admin list tables and click **Bulk Translate**:

* Choose one or more target languages and select an AI provider.
* **Background Queue (OpenAI & Gemini posts):** Batches are processed via WP-Cron with memory-limit protection (pausing at 80% PHP memory limit), time budgeting, active batch switching, a live progress modal, status filters (`Show Failed`, `Show Completed`, `Show Skip/Exist`), and confirmation-protected skipping of pending posts.
* **Foreground Execution (Browser AI & Taxonomy Terms):** Runs sequentially in your active browser tab (keep the tab open until completion).

=== Translation Memory & Automatic Cache Cleanup ===

TranslateSense caches source strings, post package mappings, and MD5-hashed translations per language in custom WordPress database tables (`translatesense_strings`, `translatesense_packages`, `translatesense_translations`, `translatesense_queue`). A scheduled WP-Cron task runs every three days to remove unused cached translations older than 30 days and unused package mappings older than 10 days.

== Plugin Settings ==

Manage plugin configuration under **Languages > TranslateSense** (requires `manage_options` capability, filterable via `translatesense_menu_capability`):

* **Home Tab:** Quick-start walkthroughs for Gutenberg, Classic Editor, Elementor, and Bulk Translation, plus a live Translation Overview card tracking total translated posts, strings, characters, elapsed time, cache counts, and per-provider usage.
* **General Settings Tab:**
  * **Default AI Engine (`provider`):** Select the default preselected engine (`chrome_ai`, `openai`, or `gemini`; activation default is `openai`).
  * **Enable / Disable Providers (`enabled_providers`):** Toggle OpenAI, Google Gemini, and Chrome Built-in AI individually (at least one provider must remain enabled; all three enabled by default).
  * **API Keys & WordPress AI Connectors:** Enter `openai_api_key` or `gemini_api_key` (validated remotely against the provider's models endpoint when saved), or connect providers through **Settings > Connectors** on WordPress 7.0+.
  * **Model Selection (`openai_model`, `gemini_model`):** Select from dynamically loaded provider/connector models (default OpenAI model: `gpt-4o-mini`; fallback model lists include `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo` for OpenAI and `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` for Gemini, while initial activation stores `gemini-3.5-flash-lite`).
  * **Batch Size (`batch_size`):** Number of strings sent per AI request (`1–50` in UI slider, clamped `1–500` on server; default `25`).
  * **Response Timeout (`response_timeout`):** Request timeout in seconds (`5–120`s in UI slider, clamped `1–300`s on server; default `30`s; WP AI Client default `60`s).
  * **Max Tokens (`max_tokens`):** Maximum output tokens per request (`512–16384` in UI slider, clamped `1–100000` on server; default `4096`).
  * **Temperature (`temperature`):** Creativity vs determinism (`0–1.0` step `0.05` in UI slider, clamped `0–2.0` on server; default `0.2`).
  * **Bulk Post Status (`post_status`):** Choose `Draft` (default) or `Publish` for newly bulk-translated posts.
  * **Slug Translation (`slug_translation`):** Choose `Translate Slug` (default), `Generate from Translated Title`, or `Keep Original Slug`.
  * **AI Prompt Engineering Studio (`custom_prompt`):** Customize the system translation prompt with `{source_lang}`, `{target_lang}`, `{count}`, and `{json_strings}` tokens, copy the active prompt, or reset to default.
* **Gutenberg Blocks & Elementor Widgets Tabs:** Search, filter (`Supported`, `Custom`, `Unsupported`), sort, and customize `<wpml-config>` XML rules per widget or globally.
* **Cache Tab:** Inspect database counts and clear cached Translations, Source Strings, Package Logs, or All Caches at once.

== External Services ==

When you initiate a translation with an external AI provider, selected source text and language metadata are transmitted to that service under its respective terms and privacy policy:

* **OpenAI (`https://api.openai.com`):** Receives text strings and language/prompt parameters when OpenAI is used for translation, and retrieves available model lists when fetching or validating OpenAI credentials. [Privacy Policy](https://openai.com/policies/privacy-policy) | [Terms of Use](https://openai.com/policies/terms-of-use)
* **Google Gemini (`https://generativelanguage.googleapis.com`):** Receives text strings and language/prompt parameters when Google Gemini is used for translation, and retrieves available model lists when fetching or validating Gemini credentials. [Privacy Policy](https://policies.google.com/privacy) | [Terms of Service](https://policies.google.com/terms)
* **Dragwyb Deactivation Feedback (`https://feedback.dragwyb.com`):** If you voluntarily submit the optional deactivation feedback modal on the WordPress Plugins screen, your selected reason, optional comment, plugin slug/version—and, only if you check the diagnostics option, site admin email, site URL, WordPress version, and PHP version—are sent to Dragwyb. [Privacy Policy](https://dragwyb.com/privacy-policy/) | [Terms](https://dragwyb.com/terms/)
* **Built-in Browser AI (Chrome / Edge):** Processes translations locally through Chromium's browser Translator API without sending translation text to OpenAI or Google Gemini servers.

== Installation ==

1. Install and activate **Polylang** (or Polylang Pro) and configure at least two languages.
2. Upload or install **TranslateSense** and activate it from the Plugins screen.
3. Navigate to **Languages > TranslateSense > General Settings** to select your preferred AI engine and enter an OpenAI/Gemini API key (or configure a WordPress 7.0+ AI Connector, or use Built-in Browser AI in Chrome/Edge v131+).
4. Open any post, page, or supported custom post type in Gutenberg, Elementor, or Classic Editor to use **Page Editor Translation**, or select multiple posts/terms from admin list screens and click **Bulk Translate**.

== Frequently Asked Questions ==

= Do I need Polylang to use TranslateSense? =

Yes. TranslateSense requires Polylang (or Polylang Pro) to manage site languages, post/term language assignments, and translation links.

= Which PHP and WordPress extensions or versions are required? =

TranslateSense declares support for WordPress 5.8+ (tested up to 7.1) and PHP 7.4+. PHP `mbstring` and `DOMDocument` extensions are recommended for string measurement and Classic Editor HTML parsing. WordPress 7.0+ Core AI Connectors are supported natively, while older WordPress versions automatically use direct OpenAI/Gemini REST API calls.

= Do I need an API key? =

You need an API key (or a configured WordPress 7.0+ AI Connector) to use OpenAI or Google Gemini. Built-in Browser AI works without an external API key in Google Chrome 131+ or Microsoft Edge 131+ over HTTPS or `localhost`.

= Why does Bulk Translation keep the window open for Browser AI or Taxonomies? =

Because Chrome and Microsoft Edge built-in AI run inside your browser rather than on the WordPress server, your browser tab must remain open while those jobs run. OpenAI and Google Gemini post batches run asynchronously on your server via WP-Cron so you can leave the page and check progress later. Note that pending background jobs expire if not processed within 24 hours.

= Can I translate WooCommerce products and SEO metadata? =

Yes. Enable your `product` post type and WooCommerce taxonomies (`product_cat`, `product_tag`) in Polylang, and ensure your SEO plugin or WooCommerce custom field rules are available via `wpml-config.xml` or added under XML Configuration. If Polylang's own Custom Fields synchronization option is turned on, TranslateSense defers custom field meta syncing to Polylang.

= Can I customize which Gutenberg blocks, Elementor widgets, or custom fields are translated? =

Yes. TranslateSense automatically merges `wpml-config.xml` files from active plugins and themes, and you can edit custom `<wpml-config>` XML rules directly from the **Gutenberg Blocks** or **Elementor Widgets** tabs in **Languages > TranslateSense**.

= Who can use TranslateSense? =

Dashboard settings, XML configuration, and cache controls require `manage_options` (filterable via `translatesense_menu_capability`). Page Editor and Bulk Translation check WordPress `edit_post`, post-type `create_posts`, `edit_term`, and `manage_terms` capabilities for the specific items being translated.

== Special Thanks ==

Special thanks to the team behind [Polylang](https://wordpress.org/plugins/polylang/) for creating and maintaining a great multilingual foundation for WordPress.

== Source Code and Contributions ==

TranslateSense is open source under the GPLv2 or later license. Explore the source code, report issues, or contribute on GitHub:

[GitHub Repository](https://github.com/Dragwyb/translatesense)

== Changelog ==

= 0.1.0 =
* Added default ACF field translation support in Bulk Translation and the Page Editor.
* Added SEO metadata translation support for Yoast SEO, Rank Math SEO, and SEOPress.
* Added support for custom fields configured through plugin `wpml-config.xml` files.
* Improved post translation completion checks.
* Improved API key validation in TranslateSense dashboard.

= 0.0.9 =
* Initial public release.
* Added OpenAI, Google Gemini, and browser-based AI translation.
* Added Gutenberg, Elementor, and Classic Editor support.
* Added bulk translation and background processing.
* Added slug and internal link translation.
* Added taxonomy, custom field, and media reference synchronization.
* Added ACF repeater and flexible content support.
* Added SEO metadata support.
* Added XML Configuration and Translation Memory.
