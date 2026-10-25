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

      const editData = {};
      strings.forEach((s) => {
        const field = s.name || '';
        let isTranslated = null;

        if (['post_title', 'post_excerpt', 'post_name'].includes(field)) {
          isTranslated = window.TranslateSenseCore.getTranslatedString(field, s.source, this.provider, field);
        }

        if (!isTranslated || !isTranslated.translate) return;

        if (field === 'post_title') {
          editData.title = isTranslated.translate;
        } else if (field === 'post_excerpt') {
          editData.excerpt = isTranslated.translate;
        } else if (field === 'post_name') {
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
      if (!window.TranslateSenseCore) return [];

      const blockRules = await window.TranslateSenseCore.getEditorConfig(
        'gutenberg',
        this.blockRulesCache
      );
      this.blockRulesCache = blockRules;

      // Helper to find a translation for a string value.
      const findTranslation = (strVal, blockName = '') => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;

        const clean = strVal.trim();
        const trans = window.TranslateSenseCore.getTranslatedString(
          blockName,
          clean,
          this.provider,
          blockName
        );

        return trans && trans.translate && trans.translate !== clean
          ? trans.translate
          : null;
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

        Object.keys(keySchema).forEach((kName) => {
          const kInfo = keySchema[kName] || {};
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
            const childSchema = kInfo.children || keySchema;
            let arrayChanged = false;
            const newArr = val.map((arrItem) => {
              if (arrItem && typeof arrItem === 'object') {
                const result = updateAttributeTree(arrItem, childSchema, blockName);
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
            const childSchema = kInfo.children || keySchema;
            const result = updateAttributeTree(val, childSchema, blockName);
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

      const traverse = (blockList, parentPath = []) => {
        if (!Array.isArray(blockList)) return;

        blockList.forEach((block, index) => {
          const path = [...parentPath, index];
          const blockName = block.name;
          const attrs = block.attributes || {};
          const rule = blockRules && blockRules[blockName];

          if (rule && rule.keys && Object.keys(rule.keys).length > 0) {
            const result = updateAttributeTree(attrs, rule.keys, blockName);
            if (result.changed) {
              block.attributes = result.updated;
              changedBlocks.push({ path, attributes: result.updated, name: blockName });
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
        if (!currentBlock || currentBlock.name !== change.name || !currentBlock.clientId) {
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

      this.provider = options.provider;
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

  // Register Gutenberg on TranslateSenseCore
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    window.TranslateSenseCore.registerPageEditor('gutenberg', {
      title: 'Gutenberg Block Editor',
      isActive: () => GutenbergUpdater.isActive(),
      apply: (strings, options) => GutenbergUpdater.apply(strings, options),
    });
  }

  window.TranslateSenseGutenbergUpdater = GutenbergUpdater;
})(window);