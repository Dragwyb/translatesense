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

    apply(strings) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      // 1. Update Page Settings
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
