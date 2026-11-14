# TranslateSense – AI Translation for Polylang

Translate your WordPress website with AI and Polylang. **TranslateSense** makes it easier to translate multiple posts, pages, custom post types, WooCommerce products, and taxonomy terms into different languages.

Its powerful **Bulk Translation** feature lets you translate multiple items in one workflow using your preferred AI provider. You can also use Page Editor Translation to translate and review individual strings directly inside Gutenberg, Elementor, or Classic Editor.

Choose from OpenAI, Google Gemini, or Built-in Browser AI, and manage your translations while keeping control over your content.

[Documentation](https://docs.dragwyb.com/ai-automatic-translation-addon-for-polylang/?utm_source=wpplugin&utm_medium=readme&utm_campaign=translatesense) | [TranslateSense Pro](https://dragwyb.com/product/ai-automatic-translation-addon-for-polylang/?utm_source=wpplugin&utm_medium=readme&utm_campaign=translatesense)

---

## Table of Contents

- [Key Features](#key-features)
- [AI Providers](#ai-providers)
- [Supported Editors and Integrations](#supported-editors-and-integrations)
- [Translation Tools](#translation-tools)
  - [Bulk Translation](#bulk-translation)
  - [Page Editor Translation](#page-editor-translation)
  - [Translation Memory and Automatic Cache Cleanup](#translation-memory-and-automatic-cache-cleanup)
- [Plugin Settings](#plugin-settings)
- [Requirements](#requirements)
- [Installation](#installation)
- [Frequently Asked Questions](#frequently-asked-questions)
- [External Services](#external-services)
- [Special Thanks](#special-thanks)
- [Source Code and Contributions](#source-code-and-contributions)
- [License](#license)
- [Changelog](#changelog)

## Key Features

- **Bulk Translation:** Translate multiple WordPress posts, pages, custom post types, and taxonomy terms into one or more languages in a single workflow.
- **Background Translation:** Process OpenAI and Google Gemini post translation batches in the background using WP-Cron, with progress monitoring, batch management, and pending job controls.
- **Multiple AI Providers:** Choose OpenAI, Google Gemini, or Built-in Browser AI. WordPress 7.0+ users can also connect supported providers through WordPress AI Connectors.
- **Automatic Taxonomy Translation:** Translate categories, tags, and supported custom taxonomy terms. Translate and assign related terms automatically during supported post translation workflows.
- **Page Editor Translation:** Translate individual posts directly inside Gutenberg, Elementor, and Classic Editor. Search, edit, reset, and retry individual translated strings before applying them.
- **Gutenberg and Elementor Support:** Translate supported blocks and widgets while preserving their content structure and layout.
- **ACF and Custom Fields:** Translate supported Advanced Custom Fields (ACF), including Repeater, Flexible Content, Group, and supported relationship fields.
- **WooCommerce Translation:** Translate supported product content, product taxonomies, and configured custom fields.
- **SEO Metadata and Slugs:** Translate supported SEO titles, meta descriptions, and post slugs for Yoast SEO, Rank Math, and SEOPress.
- **Internal Links and Media:** Update supported internal links and media references to use existing Polylang translations.
- **Translation Memory:** Reuse saved translations to reduce repeated AI requests.
- **XML Configuration:** Customize translation rules for additional Gutenberg blocks, Elementor widgets, and custom fields.

## AI Providers

TranslateSense supports the following AI translation providers:

### OpenAI

- Connect using an OpenAI API key or a supported WordPress AI Connector.
- Supports background WP-Cron bulk translation.
- Supports retrying individual failed strings in Page Editor Translation.

### Google Gemini

- Connect using a Google Gemini API key or a supported WordPress AI Connector.
- Supports background WP-Cron bulk translation.
- Supports retrying individual failed strings in Page Editor Translation.

### Built-in Browser AI

- Uses the browser's on-device Translator API.
- Supported in Google Chrome and Microsoft Edge (version 131+).
- Does not require an external AI provider API key.
- Processes translations locally inside the active browser tab.

Built-in Browser AI supports 39 language codes through Chromium's Translator API, depending on browser availability and the selected language pair.

## Supported Editors and Integrations

### Gutenberg (Block Editor)

Includes 225 preconfigured block rules covering:

- WordPress Core blocks and Core Embeds.
- TinyMCE Advanced.
- Spectra.
- Essential Blocks.
- Kadence Blocks.
- Otter Blocks.
- Stackable.
- Gutenverse.
- Ultimate Blocks.
- Qi Blocks.
- Rank Math Table of Contents.

Also includes fallback text extraction for supported unmapped blocks and automatic block recovery after bulk translation.

### Elementor

- Supports 8 core Elementor widgets.
- Supports nested repeater lists.
- Supports Elementor v4 atomic controls.
- Supports page settings.
- Includes automatic schema discovery for unmapped widgets.

### Classic Editor

- Translates post titles, slugs, excerpts, content, and supported accessibility and UI attributes.
- Preserves HTML markup during translation.

### Cross-Editor Protection

Detects when a post was built with Elementor and prompts you to open the translation in Elementor if you try to use Gutenberg or Classic Editor.

### Advanced Custom Fields (ACF)

Supports:

- Text and Textarea.
- WYSIWYG.
- Select, Checkbox, Radio, and Button Group.
- Link titles.
- Repeater.
- Flexible Content.
- Group fields.

Also supports translated ID mapping for supported image, file, gallery, relationship, post object, page link, and taxonomy fields.

### SEO Plugins

Supports SEO metadata from:

- Yoast SEO.
- Rank Math.
- SEOPress.

Additional field extraction can be configured through XML rules.

### WooCommerce

Supports WooCommerce products and product taxonomies when enabled for translation in Polylang, including internal product and category link resolution.

### Polylang

Uses Polylang for:

- Language management.
- Linked translations.
- Taxonomy assignments.
- Sticky post status.
- Media synchronization.
- Custom field synchronization detection.

Additional Gutenberg block, Elementor widget, and custom field rules can be configured using XML Configuration.

## Translation Tools

### Bulk Translation

Translate multiple WordPress posts, pages, custom post types, or taxonomy terms into different languages directly from your WordPress admin list screens.

Select the content you want to translate, choose your target languages, select an AI provider, and start the translation process.

**Bulk Translation features:**

- Select multiple posts, pages, custom post types, or taxonomy terms.
- Choose one or more target languages.
- Select your preferred AI provider.
- Start translation and monitor progress through the progress modal.
- Review completed, failed, skipped, and existing translation results.
- Manage pending translations and skip items that are waiting in the queue.

#### Background Processing (OpenAI and Google Gemini)

Post translation batches run through WP-Cron.

Background processing includes:

- Memory-limit protection to help prevent server memory issues.
- Time budgeting for translation batches.
- Active batch switching and queue management.
- Live translation progress monitoring.
- Status filters for completed, failed, and skipped or existing translations.
- Options to skip pending translations.

#### Browser Processing (Built-in Browser AI and Taxonomy Terms)

Browser AI and taxonomy term translation run sequentially in the active browser tab.

**Keep the browser tab open until the process is complete.**

### Page Editor Translation

Translate individual posts directly inside Gutenberg, Elementor, or Classic Editor using the TranslateSense metabox or toolbar button.

Features include:

- Choose an enabled AI provider and monitor translation progress.
- Search and filter strings to find the content you want to review.
- View translation statistics, including character, string, and processing time information.
- Edit translated strings directly in the translation list.
- Reset edited strings to their original AI-generated translations.
- Retry empty or failed strings using OpenAI or Google Gemini.
- Click **Apply to Page** to add translations to your editor.

Your content is not saved until you review and save the post yourself.

### Translation Memory and Automatic Cache Cleanup

TranslateSense stores source strings, translation packages, and translated strings in custom WordPress database tables.

When the same source text is encountered again, TranslateSense can reuse a previously saved translation instead of sending another request to the AI provider.

A scheduled WP-Cron task:

- Runs every three days.
- Removes unused cached translations older than 30 days.
- Removes unused package mappings older than 10 days.

You can also clear cached data manually from the Cache tab.

## Plugin Settings

Manage TranslateSense from **Languages → TranslateSense** in your WordPress dashboard.

### Home Tab

- View quick-start guides for supported editors and Bulk Translation.
- View translation statistics and provider usage.

### General Settings Tab

| Setting                     | Description                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default AI Engine           | Choose the AI provider selected by default.                                                                          |
| Enable or Disable Providers | Enable or disable OpenAI, Google Gemini, and Chrome Built-in AI.                                                     |
| API Keys and AI Connectors  | Configure provider API credentials or connect supported providers through WordPress AI Connectors on WordPress 7.0+. |
| Model Selection             | Choose from the available models provided by your connected AI provider.                                             |
| Batch Size                  | Configure how many strings are sent in each AI request.                                                              |
| Response Timeout            | Set the maximum time allowed for an AI request.                                                                      |
| Max Tokens                  | Configure the maximum output tokens for AI responses.                                                                |
| Temperature                 | Adjust how consistent or creative AI-generated translations should be.                                               |
| Bulk Post Status            | Choose whether newly created bulk translations are saved as Draft or Publish.                                        |
| Slug Translation            | Translate slugs, generate slugs from translated titles, or keep original slugs.                                      |
| Custom AI Prompt            | Customize the translation prompt using the available language and content placeholders.                              |

### Gutenberg Blocks and Elementor Widgets Tabs

- Search and filter supported, custom, and unsupported block or widget XML rules.
- Customize translation rules for supported blocks and widgets.

### Cache Tab

- View database cache counts.
- Clear translated strings.
- Clear source strings.
- Clear package logs.
- Clear all cached data.

## Requirements

| Requirement       | Minimum Version |
| ----------------- | --------------- |
| WordPress         | 5.8 or later    |
| PHP               | 7.4 or later    |
| Polylang          | Required        |
| PHP `mbstring`    | Recommended     |
| PHP `DOMDocument` | Recommended     |

Configure at least two languages in Polylang before starting translations.

## Installation

1. Install and activate **Polylang** or **Polylang Pro**.
2. Configure at least two languages in Polylang.
3. Install and activate **TranslateSense**.
4. Go to **Languages → TranslateSense → General Settings** to choose your AI provider.
5. Configure an OpenAI or Google Gemini API key, connect a supported WordPress AI Connector, or use Built-in Browser AI in a compatible browser.
6. Open a supported editor to translate an individual post, or select multiple posts or terms from the WordPress admin list screens and click **Bulk Translate**.

## Frequently Asked Questions

<details>
<summary>What is TranslateSense?</summary>

TranslateSense is an AI translation plugin for WordPress that works with Polylang. Its Bulk Translation feature helps you translate multiple posts, pages, custom post types, and taxonomy terms into different languages using AI.

</details>

<details>
<summary>Do I need Polylang to use TranslateSense?</summary>

Yes. TranslateSense uses Polylang to manage site languages, assign languages to posts and taxonomy terms, and connect translated content.

</details>

<details>
<summary>How can I bulk translate WordPress posts with Polylang?</summary>

Open a supported WordPress admin list screen, select the posts you want to translate, and click **Bulk Translate**.

Choose one or more target languages and an AI provider to start translating multiple posts in one workflow.

</details>

<details>
<summary>Can I translate multiple posts into different languages at once?</summary>

Yes. Bulk Translation lets you select multiple posts, pages, or supported custom post types and choose one or more target languages.

</details>

<details>
<summary>Does Bulk Translation run in the background?</summary>

OpenAI and Google Gemini post translation batches can run in the background through WP-Cron. You can leave the page and check translation progress later.

Built-in Browser AI and taxonomy term translation run in the active browser tab, which must remain open until processing is complete.

</details>

<details>
<summary>Which AI providers does TranslateSense support?</summary>

TranslateSense supports:

- OpenAI.
- Google Gemini.
- Built-in Browser AI in compatible Google Chrome and Microsoft Edge browsers.

WordPress 7.0+ users can also connect supported AI providers through WordPress AI Connectors.

</details>

<details>
<summary>Can I translate WordPress content without an API key?</summary>

Yes. You can use supported Chrome or Microsoft Edge Built-in Browser AI features without an external AI provider API key.

Availability depends on your browser, configuration, and selected language pair.

</details>

<details>
<summary>What is Page Editor Translation?</summary>

Page Editor Translation lets you translate individual posts directly inside Gutenberg, Elementor, or Classic Editor.

You can review, search, and edit translated strings before applying them to your content.

</details>

<details>
<summary>Can I review translations before publishing?</summary>

Yes. Page Editor Translation applies the translated content to your editor only after you click **Apply to Page**. You can review and save it yourself.

Bulk Translation creates translated posts as Draft by default, unless you choose Publish in the plugin settings.

</details>

<details>
<summary>Does TranslateSense support Gutenberg and Elementor?</summary>

Yes. TranslateSense supports Gutenberg, Elementor, and Classic Editor.

It includes built-in rules for supported blocks and widgets and allows you to configure additional mappings through XML Configuration.

</details>

<details>
<summary>Can I translate WooCommerce products?</summary>

Yes. TranslateSense supports WooCommerce products and product taxonomies when they are enabled for translation in Polylang.

Product content and supported custom fields can be translated through the supported editor workflow.

</details>

<details>
<summary>Does TranslateSense support Advanced Custom Fields (ACF)?</summary>

Yes. TranslateSense supports configured ACF fields, including Repeater, Flexible Content, and Group fields, along with supported relationship and media ID mapping.

</details>

<details>
<summary>Can I translate SEO titles and meta descriptions?</summary>

Yes. TranslateSense supports SEO metadata from Yoast SEO, Rank Math, and SEOPress.

Additional metadata fields can be configured through XML rules.

</details>

<details>
<summary>Can TranslateSense translate categories and tags?</summary>

Yes. You can translate categories, tags, and supported custom taxonomy terms from taxonomy list screens.

TranslateSense can also translate and assign related terms during supported post translation workflows.

</details>

<details>
<summary>Does TranslateSense update internal links?</summary>

Yes. When a corresponding translated post, page, taxonomy term, or supported media item is available, TranslateSense can update internal references to point to the translated version.

</details>

<details>
<summary>Why does the browser tab need to stay open for some translations?</summary>

Built-in Browser AI runs inside your browser rather than on the WordPress server.

Taxonomy term translation also runs in the active browser tab. Keep the tab open until these operations finish.

OpenAI and Google Gemini post batches use background processing.

</details>

<details>
<summary>Can I customize the translation rules?</summary>

Yes. TranslateSense supports XML Configuration for Gutenberg blocks, Elementor widgets, and custom fields.

It can also use supported `wpml-config.xml` files from active plugins and themes.

</details>

<details>
<summary>How does Translation Memory work?</summary>

TranslateSense saves translated strings and package mappings in your WordPress database.

When the same source text is encountered again, it can reuse a saved translation instead of sending another request to the AI provider.

</details>

<details>
<summary>Which languages work with Built-in Browser AI?</summary>

Built-in Browser AI supports 39 language codes through Chromium's on-device Translator API when the browser supports the selected language pair.

If a language pair is unavailable, you can use OpenAI or Google Gemini instead.

</details>

<details>
<summary>Which WordPress and PHP versions are required?</summary>

TranslateSense requires:

- WordPress 5.8 or later.
- PHP 7.4 or later.

PHP `mbstring` and `DOMDocument` extensions are recommended for string measurement and Classic Editor HTML parsing.

</details>

<details>
<summary>Who can access TranslateSense settings?</summary>

Dashboard settings, XML configuration, and cache controls require the `manage_options` capability by default.

Translation actions also check the relevant WordPress post and taxonomy capabilities.

</details>

## External Services

TranslateSense connects to external services when you choose an AI provider or voluntarily submit feedback and diagnostic information.

When you request an AI translation, the selected source text and relevant language or prompt information are sent to the provider you choose.

### OpenAI

- **Service:** https://api.openai.com
- **Purpose:** AI translation and model information retrieval.
- **Data sent:** Text submitted for translation and related language and prompt information.
- **When:** When you use OpenAI for translation or validate credentials and load available models.
- [Privacy Policy](https://openai.com/policies/privacy-policy)
- [Terms of Use](https://openai.com/policies/terms-of-use)

### Google Gemini

- **Service:** https://generativelanguage.googleapis.com
- **Purpose:** AI translation and model information retrieval.
- **Data sent:** Text submitted for translation and related language and prompt information.
- **When:** When you use Google Gemini for translation or validate credentials and load available models.
- [Privacy Policy](https://policies.google.com/privacy)
- [Terms of Service](https://policies.google.com/terms)

### Dragwyb Deactivation Feedback

- **Service:** https://feedback.dragwyb.com
- **Purpose:** Receive optional plugin deactivation feedback and diagnostic information.
- **Data sent:** Selected reason, optional comment, and plugin information. Additional site and environment information may be included if diagnostics are enabled.
- **When:** When you voluntarily submit the optional deactivation feedback form.
- [Privacy Policy](https://dragwyb.com/privacy-policy/?utm_source=wpplugin&utm_medium=readme&utm_campaign=translatesense)
- [Terms](https://dragwyb.com/terms/?utm_source=wpplugin&utm_medium=readme&utm_campaign=translatesense)

### Built-in Browser AI (Chrome / Microsoft Edge)

- **Purpose:** Translate selected website content using the browser's Translator API.
- **Data handling:** Translation text is processed locally using the browser's built-in AI features.
- **External AI providers:** TranslateSense does not send that text to OpenAI or Google Gemini when you use this option.

## Special Thanks

Special thanks to the team behind [Polylang](https://wordpress.org/plugins/polylang/) for creating and maintaining a great multilingual foundation for WordPress.

## Source Code and Contributions

TranslateSense is open source under the GPLv2 or later license.

Contributions, suggestions, and bug reports are welcome. You can open an issue or submit a pull request directly in this repository.

## License

TranslateSense is licensed under the [GNU General Public License v2.0 or later](https://www.gnu.org/licenses/gpl-2.0.html).

## Changelog

### 0.2.0

- Added a Bulk Translate button to Polylang-supported taxonomy pages so you can translate taxonomy terms directly.
- Added automatic translation of taxonomy terms linked to posts during posts bulk translation.
- Added Failed, Completed, and Skipped filters to the Bulk Translation progress modal.
- Added a Translate Again button to retry posts that failed during bulk translation.
- Added review notices to the TranslateSense dashboard, Bulk Translation progress modal, and Editor String Translation modal.
- Fixed an issue that created duplicate translated posts when an existing translation was in the trash.
- Fixed an issue that prevented Elementor pages from translating correctly during bulk translation.
- Fixed an issue where posts without an assigned language were translated but not linked to their translations. Added a notice with a direct Edit link so you can assign a language to the post or term.
- Improved error handling and messages to make bulk translation issues easier to understand.

### 0.1.0

- Added default ACF field translation support in Bulk Translation and the Page Editor.
- Added SEO metadata translation support for Yoast SEO, Rank Math SEO, and SEOPress.
- Added support for custom fields configured through plugin `wpml-config.xml` files.
- Improved post translation completion checks.
- Improved API key validation in the TranslateSense dashboard.

### 0.0.9

- Initial public release.
- Added OpenAI, Google Gemini, and browser-based AI translation.
- Added Gutenberg, Elementor, and Classic Editor support.
- Added bulk translation and background processing.
- Added slug and internal link translation.
- Added taxonomy, custom field, and media reference synchronization.
- Added ACF repeater and flexible content support.
- Added SEO metadata support.
- Added XML Configuration and Translation Memory.
