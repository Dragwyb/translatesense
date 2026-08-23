/**
 * TranslateSense - Universal Live Editor Update Manager
 * File: assets/js/page-editor/index.js
 * 
 * Central coordinator for applying translated content to live editors in memory
 * when user clicks "Apply to Page".
 */

(function (window) {
  'use strict';

  const LiveUpdaterManager = {
    /**
     * Get registered page editor from TranslateSenseCore.
     * @param {string} id
     */
    getEditor(id) {
      if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getPageEditor === 'function') {
        return window.TranslateSenseCore.getPageEditor(id);
      }
      return null;
    },

    /**
     * Get active page editor from TranslateSenseCore.
     */
    getActiveEditor() {
      if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getActivePageEditor === 'function') {
        return window.TranslateSenseCore.getActivePageEditor();
      }
      return null;
    },

    /**
     * Apply translations live to active editor via TranslateSenseCore.
     * 
     * @param {Object} params
     * @param {Array<Object>} params.strings Array of { field, widget_id, source, translated, hash }
     * @param {string} [params.editorType] Optional explicit editor type
     * @param {Object} [params.options] Optional additional options
     * @returns {Promise<Object>} Result summary
     */
    async apply({ strings, editorType, options = {} }) {
      if (window.TranslateSenseCore && typeof window.TranslateSenseCore.applyToPageEditor === 'function') {
        return await window.TranslateSenseCore.applyToPageEditor(editorType, { strings, options });
      }

      // Fallback if core is somehow missing
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }

      return {
        success: true,
        editor: editorType || 'generic',
        count: Array.isArray(strings) ? strings.length : 0,
      };
    },
  };

  window.TranslateSenseLiveUpdater = LiveUpdaterManager;
})(window);
