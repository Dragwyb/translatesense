# TranslateSense

Translate WordPress content with AI using Polylang.

TranslateSense supports Gutenberg, Elementor, Classic Editor,
WooCommerce, and translation memory. It works with Polylang and Polylang
Pro.

## Features

- **AI translation:** Use OpenAI, Google Gemini, Chrome Built-in AI,
  or Edge Built-in AI.
- **Bulk translation:** Translate multiple posts into multiple target
  languages.
- **Background processing:** Run supported OpenAI and Gemini bulk
  translation jobs through WP-Cron.
- **Translation progress:** Monitor completed and failed translations,
  and skip pending posts.
- **Editor integration:** Translate content from Gutenberg, Elementor,
  and Classic Editor.
- **Content preservation:** Preserve supported block, widget,
  custom-field, and page-builder structures.
- **SEO translation:** Translate slugs, SEO titles, and meta
  descriptions for Yoast SEO and Rank Math.
- **Internal links:** Update links to corresponding translated posts
  when available.
- **Media and taxonomy synchronization:** Support featured images,
  inline media references, categories, tags, and custom taxonomies.
- **Custom fields:** Preserve supported ACF repeater and flexible
  content structures.
- **Translation memory:** Reuse previously stored translations to
  reduce repeated provider requests.
- **XML configuration:** Customize mappings for supported blocks,
  widgets, and fields.

## Supported Editors and Integrations

### Gutenberg

Supports WordPress core blocks and configured third-party block
libraries, including:

- Spectra
- Essential Blocks
- Kadence Blocks
- Stackable
- Gutenverse
- Ultimate Blocks
- Qi Blocks
- Rank Math Table of Contents block

Additional blocks and attributes can be configured using XML rules.

### Elementor

Supports Elementor widgets and structured Elementor data, including
widget settings and repeater fields. Translation can be started from the
Elementor editor panel.

### Classic Editor

Supports post titles, excerpts, content, and configured custom fields.

### WordPress Content

- Posts and pages
- Custom post types
- WooCommerce products
- Categories, tags, and custom taxonomies

### SEO and Custom Fields

- **Yoast SEO:** SEO titles and meta descriptions.
- **Rank Math:** SEO titles and meta descriptions, plus supported
  Table of Contents blocks.
- **Advanced Custom Fields (ACF):** Repeater and flexible content
  structures.

## AI Providers

- **OpenAI:** GPT-4o, GPT-4o-mini, GPT-4-turbo, and GPT-3.5-turbo.
- **Google Gemini:** Gemini 1.5 Flash, Gemini 1.5 Pro, Gemini 2.0
  Flash, and Gemini 2.5 Flash Lite.
- **Chrome Built-in AI:** Browser-based, on-device AI where supported.
- **Edge Built-in AI:** Browser-based, on-device AI where supported.

Browser-based AI availability depends on browser compatibility and
configuration. OpenAI and Gemini require their respective API
credentials.

## Installation

1.  Install and activate
    [Polylang](https://wordpress.org/plugins/polylang/) or Polylang Pro.
2.  Install and activate TranslateSense.
3.  Go to **Languages → TranslateSense** in your WordPress dashboard.
4.  Configure an AI provider and its credentials, if required.
5.  Start translating from the post list or a supported editor.

## Contributing

Contributions and community feedback are welcome. You can report issues, suggest improvements, and contribute on
GitHub.

- [Report an issue](https://github.com/Dragwyb/translatesense/issues)
