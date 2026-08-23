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

    apply(strings) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      // 1. Update Title, Content & Excerpt
      this.updatePostFields(strings);

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
