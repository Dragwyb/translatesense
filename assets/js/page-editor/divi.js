/**
 * TranslateSense - Divi Visual Builder Live Updater
 * File: assets/js/page-editor/divi.js
 * 
 * Provides live synchronization for Divi Visual Builder:
 * - Updates page settings (title, excerpt) via divi.data.dispatch
 * - Updates Divi module content on the visual canvas
 * - Syncs SEO and custom fields
 */

(function (window) {
  'use strict';

  const DiviUpdater = {
    moduleRulesCache: null,

    /**
     * Fetch module configuration rules parsed from editor-xml-config REST endpoint.
     */
    async getModuleRules() {
      if (this.moduleRulesCache) {
        return this.moduleRulesCache;
      }

      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      try {
        const response = await fetch(restUrl + 'editor-xml-config?editor=divi', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        });
        const data = await response.json();
        if (data && (data.module_rules || data.rules)) {
          this.moduleRulesCache = data.module_rules || data.rules;
          return this.moduleRulesCache;
        }
      } catch (err) {
        console.warn('[TranslateSense] Could not fetch /editor-xml-config?editor=divi:', err);
      }

      return {};
    },

    getDiviScope() {
      if (window.divi && window.divi.data) return window.divi;
      if (window.top && window.top.divi && window.top.divi.data) return window.top.divi;
      return null;
    },

    isActive() {
      return !!this.getDiviScope() || !!document.querySelector('.et-fb-page-settings-bar, #et-fb-app');
    },

    updatePageSettings(strings) {
      const divi = this.getDiviScope();
      if (!divi || !divi.data || !divi.data.dispatch) return;

      try {
        const pageSettingsDispatch = divi.data.dispatch('divi/page-settings');
        if (pageSettingsDispatch && typeof pageSettingsDispatch.update === 'function') {
          strings.forEach((s) => {
            const field = s.field || '';
            const translated = s.translated || '';
            if (!translated) return;

            if (field === 'post_title' || field === 'title') {
              pageSettingsDispatch.update('postTitle', translated);
            } else if (field === 'post_excerpt' || field === 'excerpt') {
              pageSettingsDispatch.update('postExcerpt', translated);
            }
          });
        }
      } catch (e) {
        console.warn('[TranslateSense] Divi page settings update warning:', e);
      }
    },

    apply(strings, options = {}) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;

      // 1. Update Page Settings (Title, Excerpt) from source
      this.updatePageSettings(strings);

      // 2. Update Meta Fields & SEO
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }
    },
  };

  // Register Divi on TranslateSenseCore
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    window.TranslateSenseCore.registerPageEditor('divi', {
      title: 'Divi Visual Builder',
      isActive: () => DiviUpdater.isActive(),
      apply: (strings, options) => DiviUpdater.apply(strings, options),
    });
  }

  window.TranslateSenseDiviUpdater = DiviUpdater;
})(window);
