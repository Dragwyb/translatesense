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
          if (core && typeof core.getTranslatedString === 'function') {
            isTranslated = core.getTranslatedString(field, s.source || s.value, this.provider, field);
          }
          if ((!isTranslated || !isTranslated.translate) && (s.translated || s.translate)) {
            isTranslated = { translate: s.translated || s.translate };
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
      const findTranslation = (strVal, blockName = '') => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;

        const clean = strVal.trim();
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

        // Direct fallback from strings array if present
        if (Array.isArray(strings)) {
          const matched = strings.find((s) => (s.source === clean || s.value === clean) && s.translated && s.translated !== clean);
          if (matched) {
            return matched.translated;
          }
        }

        return null;
      };

      /**
       * Recursively update attributes matching the configured block schema.
       * Returns a new attribute object without mutating nested source objects.
       */
      const updateAttributeTree = (currentAttrs, keySchema, blockName) => {
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
            const transVal = findTranslation(val, blockName);
            if (transVal && transVal !== val) {
              newAttrs[kName] = transVal;
              hasChanged = true;
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
            const transVal = findTranslation(val.originalHTML, blockName);
            if (transVal && transVal !== val.originalHTML) {
              newAttrs[kName] = transVal;
              hasChanged = true;
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
                const transVal = findTranslation(arrItem, blockName);
                if (transVal && transVal !== arrItem) {
                  arrayChanged = true;
                  return transVal;
                }
              } else if (arrItem && typeof arrItem === 'object') {
                const result = updateAttributeTree(arrItem, itemSchema, blockName);
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

            const result = updateAttributeTree(val, childSchema, blockName);
            if (result.changed) {
              newAttrs[kName] = result.updated;
              hasChanged = true;
            }
          }
        });

        return { updated: newAttrs, changed: hasChanged };
      };

      /**
       * Evaluate configured XPath expressions against an HTML string of innerContent
       * and replace target element/attribute contents with their translations.
       */
      const updateInnerContentWithXPath = (htmlStr, xpaths, blockName) => {
        if (typeof htmlStr !== 'string' || !htmlStr.trim() || !Array.isArray(xpaths) || xpaths.length === 0) {
          return htmlStr;
        }

        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlStr, 'text/html');
          let changed = false;
          const processedNodes = new Set();

          xpaths.forEach((xp) => {
            const query = typeof xp === 'object' && xp !== null ? (xp.value || xp.xpath || '') : String(xp);
            if (!query || !query.trim()) return;

            try {
              const result = doc.evaluate(query, doc.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
              for (let i = 0; i < result.snapshotLength; i++) {
                const node = result.snapshotItem(i);
                if (!node || processedNodes.has(node)) continue;
                processedNodes.add(node);

                if (node.nodeType === Node.ATTRIBUTE_NODE) {
                  const origVal = node.value;
                  const transVal = findTranslation(origVal, blockName);
                  if (transVal && transVal !== origVal) {
                    node.value = transVal;
                    changed = true;
                  }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                  const origHtml = node.innerHTML;
                  const transVal = findTranslation(origHtml, blockName) || findTranslation(node.textContent, blockName);
                  if (transVal && transVal !== origHtml && transVal !== node.textContent) {
                    node.innerHTML = transVal;
                    changed = true;
                  }
                }
              }
            } catch (evalErr) {
              // Silently ignore unsupported or malformed xpath queries in DOMParser
            }
          });

          return changed ? doc.body.innerHTML : htmlStr;
        } catch (e) {
          return htmlStr;
        }
      };

      // Store paths for changed blocks. After resetBlocks(), use those paths to
      // locate the inserted blocks and dispatch updateBlockAttributes() against
      // their real clientIds. This mirrors the update path that works when you
      // call updateBlockAttributes() manually in the console.
      const changedBlocks = [];

      const traverse = (blockList, parentPath = []) => {
        if (!Array.isArray(blockList)) return;

        blockList.forEach((block, index) => {
          const path = [...parentPath, index];
          const blockType = block.name || block.type || '';
          const attrs = block.attributes || {};
          const rule = blockRules && (blockRules[blockType] || blockRules[block.name]);

          if (rule && rule.keys && Object.keys(rule.keys).length > 0) {
            const result = updateAttributeTree(attrs, rule.keys, blockType);
            if (result.changed) {
              block.attributes = result.updated;
              changedBlocks.push({ path, attributes: result.updated, name: blockType, type: blockType });
            }
          }

          // Check XPath rules for innerContent
          const xpaths = (rule && (rule.xpaths || (rule.xpath ? [{ value: rule.xpath }] : []))) || [];
          if (xpaths.length > 0 && Array.isArray(block.innerContent) && block.innerContent.length > 0) {
            let innerChanged = false;
            block.innerContent = block.innerContent.map((chunk) => {
              if (typeof chunk === 'string' && chunk.trim() !== '') {
                const updated = updateInnerContentWithXPath(chunk, xpaths, blockType);
                if (updated !== chunk) {
                  innerChanged = true;
                  return updated;
                }
              }
              return chunk;
            });

            if (innerChanged) {
              const joined = block.innerContent.filter((c) => typeof c === 'string').join('');
              block.innerHTML = joined;
              if (typeof block.originalContent !== 'undefined') {
                block.originalContent = joined;
              }
            }
          }

          if (Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
            traverse(block.innerBlocks, path);
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