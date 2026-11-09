=== TranslateSense – AI Translation for Polylang ===
Contributors: dragwyb
Tags: translation, polylang, multilingual, ai translation, automatic translation
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI translation for WordPress with Polylang. Translate posts, pages, WooCommerce products, and custom fields directly in your editor or in bulk.

== Description ==

TranslateSense makes it easier to translate your WordPress website with AI and Polylang. Use Page Editor Translation to translate content directly inside Gutenberg, Elementor, or Classic Editor. Review the translated content, make your own changes, and keep full control before saving it. For larger translation tasks, use Bulk Translation to translate several posts into different languages.

Choose OpenAI, Google Gemini, or built-in AI in supported Chrome and Microsoft Edge browsers. TranslateSense works with Gutenberg, Elementor, and Classic Editor, and supports WooCommerce products, custom fields, SEO details, and more.

**Key Features**

* **AI translation:** Use OpenAI, Google Gemini, Chrome Built-in AI, or Microsoft Edge built-in AI.
* **Bulk translation:** Translate multiple posts into one or more languages in one go.
* **Page Editor Translation:** Translate content directly inside Gutenberg, Elementor, or Classic Editor. Review and edit the translation in the editor, with full control over the final content.
* **WooCommerce products:** Translate product titles, slugs, descriptions, excerpts, ACF fields, and other configured custom fields.
* **Custom fields:** Translate supported custom fields, including ACF repeater and flexible content fields.
* **SEO details:** Translate SEO titles and meta descriptions for Yoast SEO, Rank Math, and SEOPress.
* **Internal links:** Link to the matching translated post when a translation is available.
* **Categories and tags:** Translate and assign categories, tags, and supported custom taxonomy terms.
* **Translation Memory:** Reuse saved translations instead of sending the same text for translation again.
* **Keep your layout:** Preserve supported Gutenberg blocks, Elementor widgets, and custom field structures.
* **Custom translation rules:** Use XML Configuration to add or change rules for supported blocks, widgets, and fields.

== AI Providers ==

TranslateSense supports:

* OpenAI
* Google Gemini
* Chrome Built-in AI
* Microsoft Edge built-in AI

You can connect OpenAI and Google Gemini with your API credentials or through a supported WordPress AI Connector. Chrome and Edge built-in AI can translate without an external AI provider API key when the required browser features are available.

== Supported Editors and Integrations ==

* **Gutenberg:** WordPress blocks and supported block libraries, including Spectra, Essential Blocks, Kadence Blocks, Stackable, Gutenverse, Ultimate Blocks, Qi Blocks, and Rank Math Table of Contents.
* **Elementor:** Supported widgets, widget settings, and repeater fields.
* **Classic Editor:** Post titles, slugs, excerpts, content, and configured custom fields.
* **WooCommerce:** Product titles, slugs, descriptions, excerpts, supported ACF fields, and configured custom fields through the Classic Editor translation workflow.
* **Advanced Custom Fields (ACF):** Supported fields, including repeater and flexible content fields.
* **SEO plugins:** Supported SEO details from Yoast SEO, Rank Math, and SEOPress.
* **Polylang:** Language selection and links between translated content.

You can add or adjust supported block, widget, and custom field rules in XML Configuration.

== Translation Tools ==

=== Page Editor Translation ===

Translate content directly from the editor you already use. Start a translation inside Gutenberg, Elementor, or Classic Editor, then review the result and make changes before saving. You stay in control of the translated content and can work with it in the context of your page or post.

=== Bulk Translation ===

Choose the posts you want to translate, select the target languages and AI provider, then start the translation. Supported API-based translations can continue in the background. You can check progress and skip items that are still waiting to be translated.

=== Translation Memory ===

TranslateSense saves translations in your WordPress database. When the same text is used again, it can reuse the saved translation and help reduce repeat AI requests.

=== SEO and Internal Links ===

Translate supported SEO titles, meta descriptions, and slugs. When a translated version of a linked post is available, TranslateSense can update the link to point to it.

== Support ==

📖[Documentation](https://docs.dragwyb.com/ai-automatic-translation-addon-for-polylang/) | ✨[TranslateSense Pro](https://dragwyb.com/product/ai-automatic-translation-addon-for-polylang/) | 💬[Premium Support](https://dragwyb.com/contact/)

== External Services ==

When you ask TranslateSense to translate content, the text you select is sent to the AI provider you choose. The provider processes that text under its own terms and privacy policy.

**OpenAI**

* **Data sent:** Text for translation and source and target language information.
* **When:** When you request a translation using OpenAI.
[Privacy](https://openai.com/policies/privacy-policy), [Terms](https://openai.com/policies/terms-of-use)

**Google Gemini**

* **Data sent:** Text for translation and source and target language information.
* **When:** When you request a translation using Google Gemini.
[Privacy](https://policies.google.com/privacy), [Terms](https://policies.google.com/terms)

**Dragwyb Feedback**

Feedback is sent to Dragwyb only when you choose to submit it from the plugin.
[Privacy](https://dragwyb.com/privacy-policy/), [Terms](https://dragwyb.com/terms/)

Chrome and Microsoft Edge built-in AI process translation text through the browser's AI features. TranslateSense does not send that text to OpenAI or Google Gemini when you use browser-based AI.

== Installation ==

1. Install and activate Polylang or Polylang Pro.
2. Install and activate TranslateSense.
3. Go to **Languages > TranslateSense** and choose your AI provider.
4. Open a supported editor and use Page Editor Translation to translate and edit content directly, or select posts from the posts list to use Bulk Translation.

== Frequently Asked Questions ==

= Do I need Polylang to use TranslateSense? =

Yes. TranslateSense uses Polylang to manage your website languages and connect translated content.

= Which AI providers can I use? =

You can use OpenAI, Google Gemini, Chrome Built-in AI, or Microsoft Edge built-in AI.

= Do I need an API key? =

You need an API key when connecting directly to OpenAI or Google Gemini. Supported Chrome and Edge built-in AI features can work without an external AI provider API key.

= Can I translate content directly inside the editor? =

Yes. Use Page Editor Translation inside Gutenberg, Elementor, or Classic Editor. You can review and edit the translated content before saving it.

= Which editors does TranslateSense support? =

TranslateSense supports Gutenberg, Elementor, and Classic Editor for Page Editor Translation.

= Can I translate WooCommerce products? =

Yes. You can translate product titles, slugs, descriptions, excerpts, supported ACF fields, and configured custom fields through the Classic Editor translation workflow.

= Can I translate custom fields and SEO details? =

Yes. TranslateSense supports configured custom fields, ACF fields, and supported SEO details from Yoast SEO, Rank Math, and SEOPress.

= What is the difference between Page Editor Translation and Bulk Translation? =

Page Editor Translation lets you translate and edit content directly inside Gutenberg, Elementor, or Classic Editor. Bulk Translation lets you select multiple posts and target languages to translate them in one process.

= Can I translate several posts at once? =

Yes. Use Bulk Translation to choose multiple posts and target languages.

= Can I add support for other blocks or widgets? =

Yes. Use XML Configuration to add or update rules for supported Gutenberg blocks, Elementor widgets, and custom fields.

== Source Code and Contributions ==

TranslateSense is open source. You can explore the source code, report issues, and contribute to its development on GitHub.

[GitHub Repository](https://github.com/Dragwyb/translatesense)

Contributions and community feedback are welcome!

== Screenshots ==

1. TranslateSense dashboard and AI provider settings.
2. Bulk Translation.
3. AI provider selection.
4. Translation progress.
5. Background translation monitor.

== Changelog ==

= 0.1.0 =
* Added default ACF field translation support in Bulk Translation and the Page Editor.
* Added SEO metadata translation support for Yoast SEO, Rank Math SEO, and SEOPress.
* Added support for custom fields configured through plugin `wpml-config.xml` files.
* Improved post translation completion checks.

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