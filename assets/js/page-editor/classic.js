/**
 * TranslateSense - Classic WordPress Editor Live Updater
 * File: assets/js/page-editor/classic.js
 * 
 * Provides live synchronization for Classic Editor:
 * - Updates post title input (#title)
 * - Updates post excerpt textarea (#excerpt)
 * - Injects translated content into TinyMCE (#content)
 * - Syncs custom fields table (#postcustomstuff) & SEO metaboxes
 */

(function (window, document) {
  'use strict';

  const ClassicUpdater = {
    fieldRulesCache: null,

    /**
     * Fetch custom field configuration rules parsed from editor-xml-config REST endpoint.
     */
    async getFieldRules() {
      if (this.fieldRulesCache) {
        return this.fieldRulesCache;
      }

      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      try {
        const response = await fetch(restUrl + 'editor-xml-config?editor=classic', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        });
        const data = await response.json();
        if (data && (data.field_rules || data.rules)) {
          this.fieldRulesCache = data.field_rules || data.rules;
          return this.fieldRulesCache;
        }
      } catch (err) {
        console.warn('[TranslateSense] Could not fetch /editor-xml-config?editor=classic:', err);
      }

      return {};
    },

    isActive() {
      return !!document.getElementById('postdivrich') || (!!document.getElementById('title') && !!document.getElementById('content'));
    },

    updatePostFields(strings) {
      strings.forEach((s) => {
        const field = s.field || '';
        const translated = s.translated || '';
        if (!translated) return;

        if (field === 'post_title' || field === 'title') {
          const titleInput = document.querySelector('input#title[name="post_title"], input#title');
          if (titleInput) {
            titleInput.value = translated;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (field === 'post_excerpt' || field === 'excerpt') {
          const excerptEl = document.querySelector('textarea#excerpt');
          if (excerptEl) {
            excerptEl.value = translated;
            excerptEl.dispatchEvent(new Event('input', { bubbles: true }));
            excerptEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (window.tinymce && window.tinymce.get('excerpt')) {
            window.tinymce.get('excerpt').setContent(translated);
          }
        } else if (field === 'post_content' || field === 'content') {
          const contentArea = document.querySelector('textarea#content');
          if (contentArea) {
            contentArea.value = translated;
            contentArea.dispatchEvent(new Event('input', { bubbles: true }));
            contentArea.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (window.tinymce && window.tinymce.get('content')) {
            window.tinymce.get('content').setContent(translated);
          }
        }
      });
    },

    apply(strings, options = {}) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;

      // 1. Update Title, Content & Excerpt completely from source post if available
      if (sourceData) {
        let content = sourceData.content || '';
        let title = sourceData.title || '';
        let excerpt = sourceData.excerpt || '';

        // Replace translatable strings in source content
        strings.forEach((s) => {
          if (s.value && s.translated) {
            if (content.includes(s.value)) {
              content = content.split(s.value).join(s.translated);
            }
            if (s.field === 'post_title' || s.field === 'title') {
              title = s.translated;
            } else if (s.field === 'post_excerpt' || s.field === 'excerpt') {
              excerpt = s.translated;
            }
          }
        });

        // Set Title
        const titleInput = document.querySelector('input#title[name="post_title"], input#title');
        if (titleInput && title) {
          titleInput.value = title;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Set Excerpt
        const excerptEl = document.querySelector('textarea#excerpt');
        if (excerptEl && excerpt) {
          excerptEl.value = excerpt;
          excerptEl.dispatchEvent(new Event('input', { bubbles: true }));
          excerptEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.tinymce && window.tinymce.get('excerpt') && excerpt) {
          window.tinymce.get('excerpt').setContent(excerpt);
        }

        // Set Content
        const contentArea = document.querySelector('textarea#content');
        if (contentArea && content) {
          contentArea.value = content;
          contentArea.dispatchEvent(new Event('input', { bubbles: true }));
          contentArea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.tinymce && window.tinymce.get('content') && content) {
          window.tinymce.get('content').setContent(content);
        }
      } else {
        this.updatePostFields(strings);
      }

      // 2. Update Custom Fields & Meta Box inputs
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }
    },
  };

  // Register Classic Editor on TranslateSenseCore
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    window.TranslateSenseCore.registerPageEditor('classic', {
      title: 'Classic WordPress Editor',
      isActive: () => ClassicUpdater.isActive(),
      apply: (strings, options) => ClassicUpdater.apply(strings, options),
    });
  }

  window.TranslateSenseClassicUpdater = ClassicUpdater;
})(window, document);
