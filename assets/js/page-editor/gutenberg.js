/**
 * TranslateSense - Gutenberg Block Editor Live Updater
 * File: assets/js/page-editor/gutenberg.js
 * 
 * Provides live synchronization for WordPress Gutenberg Block Editor:
 * - Traverses block hierarchy recursively
 * - Updates block attributes matching XML rules (including nested objects & RichText)
 * - Updates post title, excerpt, and slug via core/editor
 * - Syncs SEO & ACF meta fields
 * - Emits WordPress success notice
 */

(function (window) {
  'use strict';

  const GutenbergUpdater = {
    /**
     * Current translation provider ID (e.g. 'openai', 'gemini', 'chrome_ai').
     */
    provider: null,

    /**
     * Cache for Gutenberg block rules fetched from REST endpoint.
     */
    blockRulesCache: null,

    /**
     * Check if Gutenberg block editor is active in the current window.
     */
    isActive() {
      return !!(
        window.wp &&
        window.wp.data &&
        window.wp.data.select &&
        window.wp.data.select('core/block-editor') &&
        window.wp.data.dispatch &&
        window.wp.data.dispatch('core/block-editor')
      );
    },


    /**
     * Deep helper: Update nested object property by path array.
     */
    setNestedValue(obj, path, value) {
      if (!obj || !path || path.length === 0) return obj;

      const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
      let current = newObj;

      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (current[key] === undefined || current[key] === null) {
          current[key] = {};
        } else if (Array.isArray(current[key])) {
          current[key] = [...current[key]];
        } else if (typeof current[key] === 'object') {
          current[key] = { ...current[key] };
        }
        current = current[key];
      }

      const finalKey = path[path.length - 1];
      if (current[finalKey] && typeof current[finalKey] === 'object' && current[finalKey].originalHTML !== undefined) {
        // RichTextData object support
        current[finalKey] = value;
      } else {
        current[finalKey] = value;
      }

      return newObj;
    },

    /**
     * Update post title, excerpt, and slug in core/editor.
     */
    updatePostAttributes(strings) {
      if (!window.wp.data.dispatch('core/editor')) return;

      const core = this.core || (typeof window.TranslateSenseCore === 'object' ? window.TranslateSenseCore : null);

      const editData = {};
      strings.forEach((s) => {
        const field = s.name || s.key || s.field || '';
        let isTranslated = null;

        if (['post_title', 'title', 'post_excerpt', 'excerpt', 'post_name', 'slug'].includes(field)) {
          if (s.translated || s.translate) {
            isTranslated = { translate: s.translated || s.translate };
          } else if (core && typeof core.getTranslatedString === 'function') {
            isTranslated = core.getTranslatedString(field, s.source || s.value, this.provider, field);
          }
        }

        if (!isTranslated || !isTranslated.translate) return;

        if (field === 'post_title' || field === 'title') {
          editData.title = isTranslated.translate;
        } else if (field === 'post_excerpt' || field === 'excerpt') {
          editData.excerpt = isTranslated.translate;
        } else if (field === 'post_name' || field === 'slug') {
          editData.slug = isTranslated.translate;
        }
      });

      if (Object.keys(editData).length > 0) {
        window.wp.data.dispatch('core/editor').editPost(editData);
      }
    },

    getHtmlInnerText(html) {
      if (typeof html !== 'string' || !html) return '';
      if (typeof DOMParser !== 'undefined') {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const text = doc.body.textContent || doc.body.innerText || ''
          return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        } catch (e) {
          // Fallback to regex
        }
      }
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
    },

    /**
     * Normalize a string for source-to-translation matching. Original attribute
     * values are preserved unless an unambiguous mapping is found.
     */
    normalizeRepairString(value) {
      return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    },

    /**
     * Recursively translate exact string values using only unambiguous mappings.
     * Objects/arrays are cloned; non-string values remain unchanged.
     */
    translateRepairValue(value, mapping, depth = 0) {
      if (depth > 100) return value;

      if (/^\d+$/.test(value)) {
        return value;
      }

      if (typeof value === 'string') {
        let key = this.normalizeRepairString(value);

        if (!key) {
          return value;
        }

        if (mapping.has(key)) {
          return mapping.get(key);
        }

        if (!mapping.has(key)) {
          if (!/^\s*<[a-z][^>]*>/i.test(key)) {
            return value;
          }

          const innerTexts = key
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<[^>]*>/g, '\n')
            .split('\n')
            .map((text) =>
              text
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
                .replace(/\s+/g, ' ')
                .trim()
            )
            .filter(Boolean);

          let allKeyExist = innerTexts.every((text) => mapping.has(text));

          if (!allKeyExist) {
            return value;
          }

          innerTexts.forEach((text) => {
            const translated = mapping.get(text);
            if (!translated) {
              allKeyExist = false;
            }

            key = key.replace(text, translated);
          })

          if (!allKeyExist) {
            return value;
          }

          return key;
        }

        const translated = mapping.get(key);
        const leading = (value.match(/^\s*/) || [''])[0];
        const trailing = (value.match(/\s*$/) || [''])[0];
        return leading + translated + trailing;
      }

      if (Array.isArray(value)) {
        return value.map((item) => this.translateRepairValue(item, mapping, depth + 1));
      }

      if (value && typeof value === 'object') {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return value;

        const result = {};
        Object.keys(value).forEach((key) => {
          result[key] = this.translateRepairValue(value[key], mapping, depth + 1);
        });

        return result;
      }

      return value;
    },

    /**
       * Compare source HTML and translated HTML node-by-node to produce a mapping of
       * original strings to translated strings (similar to block-recovery.js).
       */
    buildRepairStringMap(sourceHTML, translatedHTML) {
      const mapping = new Map();
      if (typeof sourceHTML !== 'string' || typeof translatedHTML !== 'string' || !sourceHTML || !translatedHTML || typeof DOMParser === 'undefined') {
        return mapping;
      }

      try {
        const parser = new DOMParser();
        const sourceDoc = parser.parseFromString(sourceHTML, 'text/html');
        const translatedDoc = parser.parseFromString(translatedHTML, 'text/html');
        const translatableAttrs = ['alt', 'title', 'aria-label', 'placeholder', 'value', 'summary', 'caption'];

        const compareNodes = (sNode, tNode, nodeDepth = 0) => {
          if (!sNode || !tNode || nodeDepth > 50 || sNode.nodeType !== tNode.nodeType) return;

          if (sNode.nodeType === Node.TEXT_NODE) {
            const sVal = (sNode.nodeValue || '').trim();
            const tVal = (tNode.nodeValue || '').trim();
            if (sVal && tVal && sVal !== tVal) {
              mapping.set(sVal, tVal);
            }
            return;
          }

          if (sNode.nodeType !== Node.ELEMENT_NODE || sNode.tagName !== tNode.tagName) return;

          translatableAttrs.forEach((attr) => {
            if (sNode.hasAttribute(attr) && tNode.hasAttribute(attr)) {
              const sVal = (sNode.getAttribute(attr) || '').trim();
              const tVal = (tNode.getAttribute(attr) || '').trim();
              if (sVal && tVal && sVal !== tVal) {
                mapping.set(sVal, tVal);
              }
            }
          });

          const sChildren = sNode.childNodes;
          const tChildren = tNode.childNodes;
          if (sChildren.length === tChildren.length) {
            for (let i = 0; i < sChildren.length; i++) {
              compareNodes(sChildren[i], tChildren[i], nodeDepth + 1);
            }
          }
        };

        compareNodes(sourceDoc.body, translatedDoc.body, 0);
      } catch (e) { }

      return mapping;
    },

    /**
     * Recursively update blocks in the Gutenberg canvas based on XML block configuration.
     */
    async updateBlocks(blocks, strings) {
      const core = this.core || (typeof window.TranslateSenseCore === 'object' ? window.TranslateSenseCore : null);
      if (!core || typeof core.getEditorConfig !== 'function') return [];

      const blockRules = await core.getEditorConfig(
        'gutenberg',
        this.blockRulesCache
      );
      this.blockRulesCache = blockRules;

      // Helper to find a translation for a string value.
      const findTranslation = (strVal, blockName = '', cacheTranslation) => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;

        if (cacheTranslation && cacheTranslation.size > 0) {
          if (cacheTranslation.has(strVal)) {
            return cacheTranslation.get(strVal);
          }

          return null;
        }

        const clean = strVal.trim();

        // 1. Direct match from strings array (user review edits take priority)
        if (Array.isArray(strings)) {
          const matched = strings.find((s) => (s.source === clean || s.value === clean) && s.translated);
          if (matched && matched.translated) {
            return matched.translated;
          }
        }

        // 2. Core cache fallback
        let trans = null;
        if (core && typeof core.getTranslatedString === 'function') {
          trans = core.getTranslatedString(
            blockName,
            clean,
            this.provider,
            blockName
          );
        }

        if (trans && trans.translate && trans.translate !== clean) {
          return trans.translate;
        }

        return null;
      };

      /**
       * Recursively update attributes matching the configured block schema.
       * Returns a new attribute object without mutating nested source objects.
       */
      const updateAttributeTree = (currentAttrs, keySchema, blockName, missingStrings, tranlsationCache) => {
        if (!currentAttrs || !keySchema) {
          return { updated: currentAttrs, changed: false };
        }

        let hasChanged = false;
        const newAttrs = Array.isArray(currentAttrs)
          ? [...currentAttrs]
          : { ...currentAttrs };

        // If keySchema directly contains a wildcard '*', unwrap it to access item keys
        const effectiveSchema = (keySchema['*'] && keySchema['*'].children)
          ? keySchema['*'].children
          : keySchema;

        Object.keys(effectiveSchema).forEach((kName) => {
          const kInfo = effectiveSchema[kName] || {};
          if (newAttrs[kName] === undefined || newAttrs[kName] === null) return;

          const val = newAttrs[kName];

          if (typeof val === 'string' && val.trim() !== '') {
            const transVal = findTranslation(val, blockName, tranlsationCache);
            if (transVal && transVal !== val) {
              newAttrs[kName] = transVal;
              hasChanged = true;
            } else {
              missingStrings.push(val);
            }
            return;
          }

          // RichTextData support. Check the constructor safely because the
          // RichTextData export may not exist in every WordPress version.
          const RichTextData = window.wp && window.wp.richText
            ? window.wp.richText.RichTextData
            : null;

          if (
            RichTextData &&
            val instanceof RichTextData &&
            typeof val.originalHTML === 'string' &&
            val.originalHTML !== ''
          ) {
            const transVal = findTranslation(val.originalHTML, blockName, tranlsationCache);
            if (transVal && transVal !== val.originalHTML) {
              newAttrs[kName] = transVal;
              hasChanged = true;
            } else {
              missingStrings.push(val.originalHTML);
            }
            return;
          }

          if (Array.isArray(val)) {
            // Determine schema for items inside this array.
            // If kInfo has key="*", use children of "*" as item schema.
            let itemSchema = null;
            if (kInfo && kInfo.children) {
              if (kInfo.children['*'] && kInfo.children['*'].children) {
                itemSchema = kInfo.children['*'].children;
              } else if (kInfo.children['*']) {
                itemSchema = kInfo.children['*'];
              } else {
                itemSchema = kInfo.children;
              }
            } else {
              itemSchema = effectiveSchema;
            }

            let arrayChanged = false;
            const newArr = val.map((arrItem) => {
              if (typeof arrItem === 'string' && arrItem.trim() !== '') {
                const transVal = findTranslation(arrItem, blockName, tranlsationCache);
                if (transVal && transVal !== arrItem) {
                  arrayChanged = true;
                  return transVal;
                }
              } else if (arrItem && typeof arrItem === 'object') {
                const result = updateAttributeTree(arrItem, itemSchema, blockName, missingStrings, tranlsationCache);
                if (result.changed) {
                  arrayChanged = true;
                  return result.updated;
                }
              }
              return arrItem;
            });

            if (arrayChanged) {
              newAttrs[kName] = newArr;
              hasChanged = true;
            }
            return;
          }

          if (val && typeof val === 'object') {
            let childSchema = null;
            if (kInfo && kInfo.children) {
              if (kInfo.children['*'] && kInfo.children['*'].children) {
                childSchema = kInfo.children['*'].children;
              } else if (kInfo.children['*']) {
                childSchema = kInfo.children['*'];
              } else {
                childSchema = kInfo.children;
              }
            } else {
              childSchema = effectiveSchema;
            }

            const result = updateAttributeTree(val, childSchema, blockName, missingStrings, tranlsationCache);
            if (result.changed) {
              newAttrs[kName] = result.updated;
              hasChanged = true;
            }
          }
        });

        return { updated: newAttrs, changed: hasChanged };
      };

      // Store paths for changed blocks. After resetBlocks(), use those paths to
      // locate the inserted blocks and dispatch updateBlockAttributes() against
      // their real clientIds. This mirrors the update path that works when you
      // call updateBlockAttributes() manually in the console.
      const changedBlocks = [];

      const traverse = (blockList, parentPath = [], depth = 0) => {
        if (!Array.isArray(blockList) || depth > 200) return;

        blockList.forEach((block, index) => {
          if (!block || typeof block !== 'object') return;

          const path = [...parentPath, index];
          const blockType = block.name || block.type || '';
          const attrs = block.attributes || {};
          const rule = blockRules && (blockRules[blockType] || blockRules[block.name]);
          const blockOriginalContent = block.originalContent || '';

          if (rule && rule.keys && Object.keys(rule.keys).length > 0) {
            const missingStrings = [];
            let result = updateAttributeTree(attrs, rule.keys, blockType, missingStrings, {});

            if (blockOriginalContent && typeof blockOriginalContent === 'string' && '' !== blockOriginalContent && this.getHtmlInnerText(blockOriginalContent) && missingStrings.length > 0) {
              const regex = new RegExp(missingStrings.join('|'));
              const stringsExist = regex.test(blockOriginalContent);

              let transRecord = {};

              if (stringsExist) {
                for (const [key, data] of core.getTranslatedStrings()) {
                  if (data.source === blockOriginalContent || blockOriginalContent === data.source.trim()) {
                    transRecord = { source: data.filterValue, translated: data.translated };
                    break;
                  }
                }
              }

              if (transRecord.source && transRecord.translated) {
                const repairMap = this.buildRepairStringMap(transRecord.source, transRecord.translated);
                if (repairMap && repairMap.size > 0) {
                  result = updateAttributeTree(result.updated, rule.keys, blockType, missingStrings, repairMap);
                }
              }
            }
            if (result.changed) {
              block.attributes = result.updated;
              changedBlocks.push({ path, attributes: result.updated, name: blockType, type: blockType });
            }
          } else if (blockOriginalContent && typeof blockOriginalContent === 'string' && '' !== blockOriginalContent && this.getHtmlInnerText(blockOriginalContent) && Object.keys(block.attributes).length > 0) {
            let transRecord = {};
            for (const [key, data] of core.getTranslatedStrings()) {
              if (data.source === blockOriginalContent || blockOriginalContent === data.source.trim()) {
                transRecord = { source: data.filterValue, translated: data.translated };
                break;
              }
            }

            if (transRecord.source && transRecord.translated) {
              const mapping = this.buildRepairStringMap(transRecord.source, transRecord.translated);

              if (mapping && mapping.size > 0) {
                const restoredAttrs = block.attributes;
                const mappedAttrs = this.translateRepairValue(restoredAttrs, mapping);
                Object.assign(restoredAttrs, mappedAttrs);
              }
            }

          }

          if (Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
            traverse(block.innerBlocks, path, depth + 1);
          }
        });
      };

      traverse(blocks);
      return changedBlocks;
    },

    /**
     * Re-dispatch translated attributes through Gutenberg's data store after
     * the parsed block tree has been inserted. Some third-party blocks do not
     * visibly refresh from resetBlocks() alone, but do refresh when their
     * attributes are dispatched with updateBlockAttributes().
     */
    applyChangedBlockAttributes(changedBlocks) {
      if (!Array.isArray(changedBlocks) || changedBlocks.length === 0) return;

      const blockEditorSelect = window.wp.data.select('core/block-editor');
      const blockEditorDispatch = window.wp.data.dispatch('core/block-editor');

      if (
        !blockEditorSelect ||
        !blockEditorDispatch ||
        typeof blockEditorSelect.getBlocks !== 'function' ||
        typeof blockEditorDispatch.updateBlockAttributes !== 'function'
      ) {
        return;
      }

      const getBlockAtPath = (rootBlocks, path) => {
        let list = rootBlocks;
        let block = null;

        for (let i = 0; i < path.length; i++) {
          if (!Array.isArray(list) || !list[path[i]]) return null;
          block = list[path[i]];
          list = block.innerBlocks;
        }

        return block;
      };

      const currentBlocks = blockEditorSelect.getBlocks();

      changedBlocks.forEach((change) => {
        const currentBlock = getBlockAtPath(currentBlocks, change.path);
        if (!currentBlock || currentBlock.name !== change.type || !currentBlock.clientId) {
          return;
        }

        blockEditorDispatch.updateBlockAttributes(
          currentBlock.clientId,
          change.attributes
        );
      });
    },

    /**
     * Apply all translated strings live to Gutenberg directly from source post content.
     */
    async apply(strings, options = {}) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      this.provider = options.provider || (options.options && options.options.provider) || this.provider;
      if (options.core) {
        this.core = options.core;
      } else if (options.options && options.options.core) {
        this.core = options.options.core;
      }
      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;

      // 1. Update Post Title, Excerpt & Slug from translated source strings
      this.updatePostAttributes(strings);

      // 2. If source page content is provided, parse into blocks with wp.blocks.parse, translate, and completely reset canvas
      if (sourceData && sourceData.content && window.wp.blocks && typeof window.wp.blocks.parse === 'function') {
        const parsedBlocks = window.wp.blocks.parse(sourceData.content);

        if (parsedBlocks && parsedBlocks.length > 0) {
          const changedBlocks = await this.updateBlocks(parsedBlocks, strings);

          const blockEditorDispatch = window.wp.data.dispatch('core/block-editor');
          const editorDispatch = window.wp.data.dispatch('core/editor');

          if (blockEditorDispatch && typeof blockEditorDispatch.resetBlocks === 'function') {
            // First insert the parsed and translated block tree.
            blockEditorDispatch.resetBlocks(parsedBlocks);

            // Then explicitly dispatch translated attributes through Gutenberg's
            // store so third-party blocks receive normal attribute updates.
            this.applyChangedBlockAttributes(changedBlocks);
          } else if (editorDispatch && typeof editorDispatch.resetEditorBlocks === 'function') {
            editorDispatch.resetEditorBlocks(parsedBlocks);

            // Use the block-editor store if it is available after the fallback.
            this.applyChangedBlockAttributes(changedBlocks);
          }
        }
      } else {
        // Fallback only if no sourceData is available
        const currentBlocks = window.wp.data.select('core/block-editor').getBlocks();
        if (currentBlocks && currentBlocks.length > 0) {
          await this.updateBlocks(currentBlocks, strings);
        }
      }

      // 3. Update Meta Fields & SEO
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }

      // 4. Create Success Notice
      if (window.wp.data.dispatch('core/notices')) {
        window.wp.data.dispatch('core/notices').createSuccessNotice('✨ Source post content translated and inserted into Gutenberg successfully!', {
          type: 'snackbar',
          isDismissible: true,
        });
      }
    },
  };

  // Register Gutenberg on a TranslateSenseCore instance
  GutenbergUpdater.register = function (core) {
    if (!core || typeof core.registerPageEditor !== 'function') return;
    this.core = core;
    core.registerPageEditor('gutenberg', {
      title: 'Gutenberg Block Editor',
      isActive: () => GutenbergUpdater.isActive(),
      apply: (strings, options) => GutenbergUpdater.apply(strings, options),
    });
  };

  // Backward compatibility: If window.TranslateSenseCore is an instantiated object
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    GutenbergUpdater.register(window.TranslateSenseCore);
  }

  window.TranslateSenseGutenbergUpdater = GutenbergUpdater;
})(window);