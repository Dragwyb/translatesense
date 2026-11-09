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
    /**
   * Current translation provider ID (e.g. 'openai', 'gemini', 'chrome_ai').
   */
    provider: null,

    /**
    * Cache for Elementor Widget  rules fetched from REST endpoint.
    */
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
    resolveTranslation(strVal, widgetType = '') {
      if (typeof strVal !== 'string' || !strVal.trim()) return null;
      const clean = strVal.trim();

      // 1. Direct match from currentStrings (user review edits take priority)
      if (Array.isArray(this.currentStrings)) {
        const matched = this.currentStrings.find((s) => (s.source === clean || s.value === clean) && s.translated);
        if (matched && matched.translated) return matched.translated;
      }

      // 2. Core cache fallback
      const core = this.core || (typeof window.TranslateSenseCore === 'object' ? window.TranslateSenseCore : null);
      if (core && typeof core.getTranslatedString === 'function') {
        const trans = core.getTranslatedString(widgetType, clean, this.provider, widgetType);
        if (trans && trans.translate && trans.translate !== clean) return trans.translate;
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
     * Deeply translates all translatable strings in source Elementor elements JSON tree.
     *
     * @param {Array} elements - Raw Elementor elements tree array.
     * @param {Array} strings  - Array of translation objects { value, translated, field, widget_id }.
     * @returns {Array} Translated elements tree.
     */
    async translateElementTree(elements) {
      if (!Array.isArray(elements)) return elements;

      const core = this.core || (typeof window.TranslateSenseCore === 'object' ? window.TranslateSenseCore : null);
      const widgetRules = (core && typeof core.getEditorConfig === 'function')
        ? await core.getEditorConfig('elementor', this.widgetRulesCache)
        : (this.widgetRulesCache || {});

      const clonedTree = JSON.parse(JSON.stringify(elements));

      const translatePathRecursive = (data, segments, index, widgetType, rules) => {
        if (!data || typeof data !== 'object' || !segments || index >= segments.length) return;

        const currentKey = segments[index];
        const isLast = (index === segments.length - 1);

        if (Array.isArray(data)) {
          data.forEach((item) => {
            translatePathRecursive(item, segments, index, widgetType, rules);
          });
          return;
        }

        if (data.hasOwnProperty(currentKey)) {
          if (isLast) {
            const val = data[currentKey];
            if (typeof val === 'string' && val.trim() !== '') {
              const transVal = this.resolveTranslation(val, widgetType);
              if (transVal) {
                data[currentKey] = transVal;
              }
            }
          } else if (typeof data[currentKey] === 'object' && data[currentKey] !== null) {
            translatePathRecursive(data[currentKey], segments, index + 1, widgetType, rules);
          }
        }
      };

      const translateSettingsObject = (settings, widgetType, rules) => {
        if (!settings || typeof settings !== 'object') return;

        const attrRules = (rules && (rules.attributes || rules.fields || rules.keys)) || rules || {};

        if (Object.keys(attrRules).length > 0) {
          Object.keys(attrRules).forEach((path) => {
            const delimiter = path.includes('>') ? '>' : (path.includes('.') ? '.' : '');
            const segments = delimiter ? path.split(delimiter) : [path];
            translatePathRecursive(settings, segments, 0, widgetType, rules);
          });
        }
      };

      const traverseNodes = (nodes) => {
        if (!Array.isArray(nodes)) return;

        nodes.forEach((node) => {
          if (!node || typeof node !== 'object') return;

          const widgetType = node.widgetType || node.elType || 'widget';

          if (node.settings && typeof node.settings === 'object') {
            const rules = widgetRules[widgetType];
            if (rules) {
              translateSettingsObject(node.settings, widgetType, rules);
            }
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
            if (createdInstance && createdInstance.settings && createdInstance.settings.setExternalChange) {
              createdInstance.settings.setExternalChange(settingKey, settingCache[settingKey]);
            }
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
    async apply(strings, options = {}) {
      if (options.core) {
        this.core = options.core;
      } else if (options.options && options.options.core) {
        this.core = options.options.core;
      }
      this.currentStrings = strings;
      const core = this.core || (typeof window.TranslateSenseCore === 'object' ? window.TranslateSenseCore : null);
      if (!core) return;

      if (!this.isActive() || !Array.isArray(strings)) return;

      const el = this.getElementorScope();
      const $e = this.getCommandEngine();
      this.provider = options.provider || (options.options && options.options.provider) || this.provider;
      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;

      // 1. Update Page Title from translated strings or source
      const titleItem = strings.find((s) => s.name === 'post_title');
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

        const translatedTree = await this.translateElementTree(sourceElementorData);

        // Step B: Purge old elements and insert translated element tree
        this.reconstructElementTree(translatedTree, el, $e);
      }

      // 4. Mark document as modified
      this.markDocumentModified(el, $e);

      // 5. Update Meta Fields & SEO
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings, options);
      }
    },
  };

  // Register Elementor on a TranslateSenseCore instance
  ElementorUpdater.register = function (core) {
    if (!core || typeof core.registerPageEditor !== 'function') return;
    this.core = core;
    core.registerPageEditor('elementor', {
      title: 'Elementor Visual Builder',
      isActive: () => ElementorUpdater.isActive(),
      apply: (strings, options) => ElementorUpdater.apply(strings, options),
    });
  };

  // Backward compatibility: If window.TranslateSenseCore is an instantiated object
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    ElementorUpdater.register(window.TranslateSenseCore);
  }

  window.TranslateSenseElementorUpdater = ElementorUpdater;
})(window);
