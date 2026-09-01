/**
 * TranslateSense - Elementor Visual Builder Live Updater
 * File: assets/js/page-editor/elementor.js
 * 
 * Provides live translation for Elementor visual editor:
 * 1. Resolves sourceElementorData (from source post data or current canvas structure)
 * 2. Deeply translates all translatable string fields in sourceElementorData
 * 3. Completely purges all existing canvas elements via Elementor Command API ($e.run)
 * 4. Inserts new translated elements (containers, sections, columns, widgets) recursively
 * 5. Updates page title and SEO meta fields
 * 6. Marks the Elementor document as modified for saving
 */

(function (window) {
  'use strict';

  const ElementorUpdater = {
    widgetRulesCache: null,

    /**
     * Get active Elementor instance (current frame or top frame).
     */
    getElementorScope() {
      if (window.elementor && window.elementor.elements) return window.elementor;
      if (window.top && window.top.elementor && window.top.elementor.elements) return window.top.elementor;
      return null;
    },

    /**
     * Get Elementor command engine ($e) instance.
     */
    getCommandEngine() {
      if (window.$e && typeof window.$e.run === 'function') return window.$e;
      if (window.top && window.top.$e && typeof window.top.$e.run === 'function') return window.top.$e;
      const el = this.getElementorScope();
      if (el && el.$e && typeof el.$e.run === 'function') return el.$e;
      return null;
    },

    /**
     * Check if Elementor is active.
     */
    isActive() {
      return !!this.getElementorScope();
    },

    /**
     * Resolve translated string for a given text value.
     */
    resolveTranslation(strVal, widgetType = '', strings = []) {
      if (typeof strVal !== 'string' || !strVal.trim()) return null;
      const clean = strVal.trim();

      if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getTranslatedString === 'function') {
        const trans = window.TranslateSenseCore.getTranslatedString(widgetType, clean, null, widgetType);
        if (trans && trans !== clean) return trans;
      }

      for (const s of strings) {
        if (s.translated && s.value && s.value.trim() === clean) {
          return s.translated;
        }
      }
      return null;
    },

    /**
     * Update Elementor Page Title in document model.
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
     * Save strings to TranslateSenseCore cache.
     */
    cacheStrings(strings) {
      if (!window.TranslateSenseCore || !Array.isArray(strings)) return;

      strings.forEach((s) => {
        const wId = s.widget_id || 'elementor_widget';
        const src = s.value || '';
        const trans = s.translated || '';
        if (src) {
          window.TranslateSenseCore.saveSourceString(s.field || wId, src, src, wId);
          if (trans) {
            window.TranslateSenseCore.saveTranslatedString(s.field || wId, src, src, trans, s.provider || 'default', wId);
          }
        }
      });
    },

    /**
     * Deeply translates all translatable strings in source Elementor elements JSON tree.
     *
     * @param {Array} elements - Raw Elementor elements tree array.
     * @param {Array} strings  - Array of translation objects { value, translated, field, widget_id }.
     * @returns {Array} Translated elements tree.
     */
    translateElementTree(elements, strings) {
      if (!Array.isArray(elements)) return elements;

      const clonedTree = JSON.parse(JSON.stringify(elements));

      const translateSettingsObject = (settings, widgetType) => {
        if (!settings || typeof settings !== 'object') return;

        Object.keys(settings).forEach((key) => {
          const val = settings[key];

          if (typeof val === 'string' && val.trim() !== '') {
            const transVal = this.resolveTranslation(val, widgetType, strings);
            if (transVal) {
              settings[key] = transVal;
            }
          } else if (Array.isArray(val)) {
            val.forEach((item) => {
              if (item && typeof item === 'object') {
                translateSettingsObject(item, widgetType);
              }
            });
          } else if (val && typeof val === 'object') {
            translateSettingsObject(val, widgetType);
          }
        });
      };

      const traverseNodes = (nodes) => {
        if (!Array.isArray(nodes)) return;

        nodes.forEach((node) => {
          if (!node || typeof node !== 'object') return;

          const widgetType = node.widgetType || node.elType || 'widget';

          if (node.settings && typeof node.settings === 'object') {
            translateSettingsObject(node.settings, widgetType);
          }

          if (Array.isArray(node.elements) && node.elements.length > 0) {
            traverseNodes(node.elements);
          }
        });
      };

      traverseNodes(clonedTree);
      return clonedTree;
    },

    /**
     * Purge all old elements from Elementor canvas using Command API.
     *
     * @param {Object} el - Elementor instance.
     * @param {Object} $e - Command engine instance.
     */
    clearCanvasElements(el, $e) {
      if (!el || !el.elements) return;

      const modelsList = el.elements.models || [];
      const rootIds = [];

      modelsList.forEach((model) => {
        const id = model.id || (typeof model.get === 'function' ? model.get('id') : null);
        if (id) {
          rootIds.push(id);
        }
      });

      if (rootIds.length > 0 && $e) {
        rootIds.forEach((id) => {
          try {
            const container = typeof el.getContainer === 'function' ? el.getContainer(id) : null;
            if (container) {
              $e.run('document/elements/delete', {
                container,
              });
            }
          } catch (err) {
            console.warn(`[TranslateSense] Failed deleting Elementor element [${id}]:`, err);
          }
        });
      }
    },

    /**
     * Recursively inserts element nodes (containers/sections/columns/widgets) into Elementor canvas.
     *
     * @param {Object} node            - Element node data.
     * @param {Object|null} parentNode - Parent container instance or null for root.
     * @param {number} position        - Child index position.
     * @param {Object} el              - Elementor instance.
     * @param {Object} $e              - Command engine instance.
     * @returns {Object|null} Created container instance.
     */
    insertElementRecursive(node, parentNode = null, position = 0, el, $e) {
      if (!node || typeof node !== 'object' || !$e) return null;

      // Extract child elements from model payload
      const { elements: childNodes, ...modelData } = node;

      let settingCache = false;

      if (modelData.settings && Object.keys(modelData.settings).length > 0) {
        settingCache = { ...modelData.settings };
      }

      let targetContainer = null;
      if (parentNode) {
        targetContainer = parentNode;
      } else if (typeof el.getPreviewContainer === 'function') {
        targetContainer = el.getPreviewContainer();
      }

      const options = {
        at: position,
        edit: false,
      };

      let createdInstance = true;
      try {
        createdInstance = $e.run('document/elements/create', {
          model: modelData,
          container: targetContainer,
          options,
        });
      } catch (err) {
        console.warn('[TranslateSense] Error creating element via $e.run:', err, modelData);
      }

      if (settingCache && !modelData.settings.hasOwnProperty('attributes')) {
        if (Object.keys(settingCache).length > 0) {
          Object.keys(settingCache).forEach(settingKey => {
            createdInstance.settings.setExternalChange(settingKey, settingCache[settingKey]);
          })
        }
      }

      // Recursively construct child elements
      if (Array.isArray(childNodes) && childNodes.length > 0 && createdInstance) {
        const insertedModal = el.elements.get(modelData.id);
        let removeEle = false;

        if (insertedModal && insertedModal.attributes && insertedModal.attributes.elements && insertedModal.attributes.elements.models && insertedModal.attributes.elements.models[0] && insertedModal.attributes.elements.models[0].id) {
          removeEle = insertedModal.attributes.elements.models[0].id;
        }

        childNodes.forEach((childNode, childIdx) => {
          this.insertElementRecursive(childNode, createdInstance, childIdx, el, $e);
        });

        if (removeEle && removeEle !== '') {
          const removeWidget = elementor.getContainer(removeEle);

          if (removeWidget) {
            $e.run('document/elements/delete', {
              container: removeWidget,
            });
          }
        }
      }

      return createdInstance;
    },

    /**
     * Reconstructs the entire translated elements tree on the Elementor canvas.
     *
     * @param {Array} tree - Translated elements tree array.
     * @param {Object} el  - Elementor instance.
     * @param {Object} $e  - Command engine instance.
     */
    reconstructElementTree(tree, el, $e) {
      if (!Array.isArray(tree) || !el) return;

      // Step 1: Remove all existing elements from canvas
      this.clearCanvasElements(el, $e);

      // Step 2: Insert new translated elements recursively
      if ($e) {
        tree.forEach((item, index) => {
          this.insertElementRecursive(item, null, index, el, $e);
        });
      }

      try {
        el.elements.reset(tree);
        if (el.elements.models) {
          el.elements.models.forEach((model) => {
            if (typeof model.renderRemoteServer === 'function') {
              model.renderRemoteServer();
            }
          });
        }
      } catch (e) {
        console.warn('[TranslateSense] Elementor elements.reset fallback warning:', e);
      }
    },

    /**
     * Mark Elementor document as modified for saving.
     */
    markDocumentModified(el, $e) {
      try {
        if ($e && typeof $e.internal === 'function') {
          $e.internal('document/save/set-is-modified', { status: true });
        } else if (el && el.saver && typeof el.saver.setFlagEditorChange === 'function') {
          el.saver.setFlagEditorChange(true);
        }
      } catch (e) {
        console.warn('[TranslateSense] Elementor mark modified warning:', e);
      }
    },

    /**
     * Apply all translated strings live to Elementor:
     * 1. Translates page title.
     * 2. Retrieves sourceElementorData (from source post data or current elements tree).
     * 3. First translates all strings in sourceElementorData.
     * 4. Removes existing elements from canvas.
     * 5. Inserts newly translated elements into canvas via Command API ($e.run).
     * 6. Marks document modified and updates metadata.
     */
    apply(strings, options = {}) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      const el = this.getElementorScope();
      const $e = this.getCommandEngine();
      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;

      // Cache strings for fast retrieval
      this.cacheStrings(strings);

      // 1. Update Page Title from translated strings or source
      const titleItem = strings.find((s) => s.field === 'post_title' || s.field === 'title');
      const translatedTitle = titleItem ? titleItem.translated : (sourceData ? sourceData.title : '');
      if (translatedTitle) {
        this.updatePageTitle(translatedTitle);
      }

      // 2. Resolve source Elementor JSON content
      let sourceElementorData = null;
      if (sourceData) {
        if (sourceData.content && Array.isArray(sourceData.content)) {
          sourceElementorData = sourceData.content;
        } else if (sourceData.content) {
          try {
            sourceElementorData = typeof sourceData.content === 'string' ? JSON.parse(sourceData.content) : sourceData.content;
          } catch (e) {
            console.warn('[TranslateSense] Error parsing elementor content JSON from source:', e);
          }
        }
      }

      // If no external source post data, serialize current elements as base source
      if (!sourceElementorData && el && el.elements && typeof el.elements.toJSON === 'function') {
        try {
          sourceElementorData = el.elements.toJSON();
        } catch (e) {
          console.warn('[TranslateSense] Error extracting current elements JSON:', e);
        }
      }

      // 3. Process complete translation: Translate data -> Purge canvas -> Insert new translated elements
      if (Array.isArray(sourceElementorData) && sourceElementorData.length > 0) {
        // Step A: Translate the source element tree first
        const translatedTree = this.translateElementTree(sourceElementorData, strings);

        // Step B: Purge old elements and insert translated element tree
        this.reconstructElementTree(translatedTree, el, $e);
      }

      // 4. Mark document as modified
      this.markDocumentModified(el, $e);

      // 5. Update Meta Fields & SEO
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
