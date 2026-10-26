/**
 * TranslateSense - Universal Live Editor Update Manager
 * File: assets/js/page-editor/index.js
 * 
 * Central coordinator for registering, initializing, and applying translated content
 * to live page editors (Classic, Gutenberg, Elementor, Meta Fields) via TranslateSenseCore.
 */

(function (window) {
  'use strict';

  class PageEditorManager {
    constructor(core) {
      this.core = core || null;
      if (this.core) {
        this.register(this.core);
      }
    }

    /**
     * Register and initialize all page editors on the provided TranslateSenseCore instance.
     * 
     * @param {TranslateSenseCore} core
     * @returns {PageEditorManager}
     */
    register(core) {
      this.core = core;
      if (!core || typeof core.registerPageEditor !== 'function') {
        console.warn('[TranslateSense] Invalid TranslateSenseCore instance passed to PageEditorManager.register().');
        return this;
      }

      // 1. Classic WordPress Editor
      if (window.TranslateSenseClassicUpdater && typeof window.TranslateSenseClassicUpdater.register === 'function') {
        window.TranslateSenseClassicUpdater.register(core);
      }

      // 2. Gutenberg Block Editor
      if (window.TranslateSenseGutenbergUpdater && typeof window.TranslateSenseGutenbergUpdater.register === 'function') {
        window.TranslateSenseGutenbergUpdater.register(core);
      }

      // 3. Elementor Visual Builder
      if (window.TranslateSenseElementorUpdater && typeof window.TranslateSenseElementorUpdater.register === 'function') {
        window.TranslateSenseElementorUpdater.register(core);
      }

      return this;
    }

    /**
     * Get registered page editor from core.
     * @param {string} id
     */
    getEditor(id) {
      if (this.core && typeof this.core.getPageEditor === 'function') {
        return this.core.getPageEditor(id);
      }
      return null;
    }

    /**
     * Get active page editor from core.
     */
    getActiveEditor() {
      if (this.core && typeof this.core.getActivePageEditor === 'function') {
        return this.core.getActivePageEditor();
      }
      return null;
    }

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
      if (this.core && typeof this.core.applyToPageEditor === 'function') {
        return await this.core.applyToPageEditor(editorType, { strings, options, core: this.core });
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
    }
  }

  // Export module for editor registration and live updating
  window.TranslateSensePageEditors = {
    init(core) {
      return new PageEditorManager(core);
    },
    register(core) {
      return new PageEditorManager(core);
    },
    PageEditorManager: PageEditorManager,
  };

  // Backward-compatible global updater
  window.TranslateSenseLiveUpdater = {
    manager: null,
    init(core) {
      this.manager = new PageEditorManager(core);
      return this.manager;
    },
    getEditor(id) {
      return this.manager ? this.manager.getEditor(id) : null;
    },
    getActiveEditor() {
      return this.manager ? this.manager.getActiveEditor() : null;
    },
    async apply({ strings, editorType, options = {} }) {
      if (this.manager) {
        return await this.manager.apply({ strings, editorType, options });
      }
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }
      return {
        success: true,
        editor: editorType || 'generic',
        count: Array.isArray(strings) ? strings.length : 0,
      };
    }
  };
})(window);
