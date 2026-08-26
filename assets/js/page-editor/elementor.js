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
    widgetRulesCache: null,

    /**
     * Fetch widget configuration rules parsed from editor-xml-config REST endpoint.
     */
    async getWidgetRules() {
      if (this.widgetRulesCache) {
        return this.widgetRulesCache;
      }

      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      try {
        const response = await fetch(restUrl + 'editor-xml-config?editor=elementor', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        });
        const data = await response.json();
        if (data && (data.widget_rules || data.rules)) {
          this.widgetRulesCache = data.widget_rules || data.rules;
          return this.widgetRulesCache;
        }
      } catch (err) {
        console.warn('[TranslateSense] Could not fetch /editor-xml-config?editor=elementor:', err);
      }

      return {};
    },

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
      console.log(strings)
      const el = this.getElementorScope();
      if (!el || !el.elements || !el.elements.models) return;

      // Save strings to TranslateSenseCore
      if (window.TranslateSenseCore) {
        strings.forEach((s) => {
          const wId = s.widget_id || 'elementor_widget';
          const src = s.value || '';
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
          if (s.translated && s.value && s.value.trim() === clean) {
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
     * Replace translated strings in Elementor JSON elements structure.
     */
    replaceInElementorJson(elements, strings) {
      if (!Array.isArray(elements)) return elements;

      const findTranslation = (strVal, widgetType = '') => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;
        const clean = strVal.trim();

        if (window.TranslateSenseCore) {
          const trans = window.TranslateSenseCore.getTranslatedString(widgetType, clean, null, widgetType);
          if (trans && trans !== clean) return trans;
        }

        for (const s of strings) {
          if (s.translated && s.value && s.value.trim() === clean) {
            return s.translated;
          }
        }
        return null;
      };

      const traverse = (list) => {
        if (!Array.isArray(list)) return;

        list.forEach((item) => {
          const widgetType = item.widgetType || item.elType || 'widget';
          if (item.settings && typeof item.settings === 'object') {
            Object.keys(item.settings).forEach((key) => {
              const val = item.settings[key];
              if (typeof val === 'string' && val.trim() !== '') {
                const transVal = findTranslation(val, widgetType);
                if (transVal) {
                  item.settings[key] = transVal;
                }
              } else if (Array.isArray(val)) {
                val.forEach((subItem) => {
                  if (typeof subItem === 'object' && subItem !== null) {
                    Object.keys(subItem).forEach((subKey) => {
                      const subVal = subItem[subKey];
                      if (typeof subVal === 'string' && subVal.trim() !== '') {
                        const transSub = findTranslation(subVal, widgetType);
                        if (transSub) {
                          subItem[subKey] = transSub;
                        }
                      }
                    });
                  }
                });
              }
            });
          }

          if (item.elements && Array.isArray(item.elements)) {
            traverse(item.elements);
          }
        });
      };

      traverse(elements);
      return elements;
    },

    /**
     * Apply all translated strings live to Elementor purely from source post content.
     */
    apply(strings, options = {}) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;
      const el = this.getElementorScope();

      // 1. Update Page Title from translated source
      const titleItem = strings.find((s) => s.field === 'post_title' || s.field === 'title');
      const translatedTitle = titleItem ? titleItem.translated : (sourceData ? sourceData.title : '');
      if (translatedTitle) {
        this.updatePageTitle(translatedTitle);
      }

      // 2. Completely translate and reset/insert data from source post elementor JSON
      let sourceElementorData = null;
      if (sourceData) {
        if (sourceData.content && Array.isArray(sourceData.content)) {
          sourceElementorData = sourceData.content;
        } else if (sourceData.content) {
          try {
            sourceElementorData = typeof sourceData.content === 'string' ? JSON.parse(sourceData.content) : sourceData.content;
          } catch (e) {
            console.warn('[TranslateSense] Error parsing elementor content JSON:', e);
          }
        }
      }

      if (sourceElementorData && Array.isArray(sourceElementorData) && sourceElementorData.length > 0) {
        // Replace translated strings inside source JSON structure
        const updatedJson = this.replaceInElementorJson(JSON.parse(JSON.stringify(sourceElementorData)), strings);

        // Completely reset/replace Elementor canvas elements with updated source JSON data
        if (el && el.elements && typeof el.elements.reset === 'function') {
          try {
            el.elements.reset(updatedJson);
          } catch (e) {
            console.warn('[TranslateSense] Elementor elements.reset warning:', e);
          }
        }

        // Trigger remote server rendering on all models
        if (el && el.elements && el.elements.models) {
          el.elements.models.forEach((model) => {
            try {
              if (typeof model.renderRemoteServer === 'function') {
                model.renderRemoteServer();
              }
            } catch (err) {
              // ignore
            }
          });
        }

        // Mark document as modified
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
      } else {
        // Fallback if no source elementor data is available
        this.updateWidgets(strings);
      }

      // 3. Update Meta Fields & SEO
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
