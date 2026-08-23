/**
 * TranslateSense - Elementor Visual Builder Live Updater
 * File: assets/js/page-editor/elementor.js
 * 
 * Provides live synchronization for Elementor:
 * - Traverses element models recursively
 * - Updates widget settings, atomic paths, and repeater rows
 * - Triggers live widget re-rendering on canvas (renderRemoteServer)
 * - Updates page title and SEO meta fields
 * - Marks Elementor document as modified
 */

(function (window) {
  'use strict';

  const ElementorUpdater = {
    /**
     * Get active Elementor instance (current frame or top frame).
     */
    getElementorScope() {
      if (window.elementor && window.elementor.elements) return window.elementor;
      if (window.top && window.top.elementor && window.top.elementor.elements) return window.top.elementor;
      return null;
    },

    /**
     * Check if Elementor is active.
     */
    isActive() {
      return !!this.getElementorScope();
    },

    /**
     * Recursively find model by element ID in Elementor elements tree.
     */
    findModelById(models, id) {
      if (!Array.isArray(models) && !models.models) return null;
      const list = Array.isArray(models) ? models : models.models;

      for (const model of list) {
        if (model.get('id') === id) {
          return model;
        }
        const nested = model.get('elements');
        if (nested) {
          const found = this.findModelById(nested, id);
          if (found) return found;
        }
      }
      return null;
    },

    /**
     * Update Elementor Page Title.
     */
    updatePageTitle(translatedTitle) {
      const el = this.getElementorScope();
      if (!el || !translatedTitle) return;

      try {
        if (el.settings && el.settings.page && el.settings.page.model) {
          el.settings.page.model.setExternalChange('post_title', translatedTitle);
        }
      } catch (e) {
        console.warn('[TranslateSense] Elementor page title update warning:', e);
      }
    },

    /**
     * Update Elementor Widgets and Models.
     */
    updateWidgets(strings) {
      const el = this.getElementorScope();
      if (!el || !el.elements || !el.elements.models) return;

      // Save strings to TranslateSenseCore
      if (window.TranslateSenseCore) {
        strings.forEach((s) => {
          const wId = s.widget_id || 'elementor_widget';
          const src = s.source || '';
          const trans = s.translated || '';
          if (src) {
            window.TranslateSenseCore.saveSourceString(s.field || wId, src, wId);
            if (trans) {
              window.TranslateSenseCore.saveTranslatedString(s.field || wId, src, trans, s.provider || 'default', wId);
            }
          }
        });
      }

      const updatedModels = new Set();

      const findTranslation = (strVal, widgetType = '') => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;
        const clean = strVal.trim();

        if (window.TranslateSenseCore) {
          const trans = window.TranslateSenseCore.getTranslatedString(widgetType, clean, null, widgetType);
          if (trans && trans !== clean) return trans;
        }

        for (const s of strings) {
          if (s.translated && s.source && s.source.trim() === clean) {
            return s.translated;
          }
        }
        return null;
      };

      const traverseAndPatch = (models) => {
        const list = Array.isArray(models) ? models : models.models;
        if (!list) return;

        list.forEach((model) => {
          const widgetType = model.get('widgetType') || model.get('elType') || 'widget';
          const settings = model.get('settings');
          if (settings && typeof settings.get === 'function' && typeof settings.set === 'function') {
            const attrs = settings.attributes || {};

            Object.keys(attrs).forEach((key) => {
              const val = attrs[key];

              // 1. Direct text setting
              if (typeof val === 'string' && val.trim() !== '') {
                const transVal = findTranslation(val, widgetType);
                if (transVal) {
                  settings.set(key, transVal);
                  updatedModels.add(model);
                }
              }

              // 2. Repeater collections
              if (val && typeof val === 'object' && val.models && Array.isArray(val.models)) {
                let repeaterChanged = false;
                val.models.forEach((itemModel) => {
                  const itemAttrs = itemModel.attributes || {};
                  Object.keys(itemAttrs).forEach((subKey) => {
                    const subVal = itemAttrs[subKey];
                    if (typeof subVal === 'string' && subVal.trim() !== '') {
                      const transSub = findTranslation(subVal, widgetType);
                      if (transSub) {
                        itemAttrs[subKey] = transSub;
                        repeaterChanged = true;
                      }
                    }
                  });
                });

                if (repeaterChanged) {
                  settings.set(key, val);
                  updatedModels.add(model);
                }
              }
            });
          }

          // Traverse child elements (sections, columns, inner widgets)
          const nested = model.get('elements');
          if (nested) {
            traverseAndPatch(nested);
          }
        });
      };

      traverseAndPatch(el.elements.models);

      // Trigger remote render on modified models to refresh canvas visually
      updatedModels.forEach((model) => {
        try {
          if (typeof model.renderRemoteServer === 'function') {
            model.renderRemoteServer();
          }
        } catch (e) {
          console.warn('[TranslateSense] Elementor renderRemoteServer warning:', e);
        }
      });

      // Mark document as modified so changes can be saved
      try {
        const topWindow = window.top || window;
        if (topWindow.$e && topWindow.$e.internal) {
          topWindow.$e.internal('document/save/set-is-modified', { status: true });
        } else if (el.saver && typeof el.saver.setFlagEditorChange === 'function') {
          el.saver.setFlagEditorChange(true);
        }
      } catch (e) {
        console.warn('[TranslateSense] Elementor mark modified warning:', e);
      }
    },

    /**
     * Apply all translated strings live to Elementor.
     */
    apply(strings) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      // Find translated title
      const titleItem = strings.find((s) => s.field === 'post_title' || s.field === 'title');
      if (titleItem && titleItem.translated) {
        this.updatePageTitle(titleItem.translated);
      }

      // Update widget models and canvas
      this.updateWidgets(strings);

      // Update Meta Fields & SEO
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }
    },
  };

  // Register Elementor on TranslateSenseCore
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    window.TranslateSenseCore.registerPageEditor('elementor', {
      title: 'Elementor Visual Builder',
      isActive: () => ElementorUpdater.isActive(),
      apply: (strings, options) => ElementorUpdater.apply(strings, options),
    });
  }

  window.TranslateSenseElementorUpdater = ElementorUpdater;
})(window);
