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
        const field = s.field || '';
        const translated = s.translated || '';

        if (!translated) return;

        if (field === 'post_title' || field === 'title') {
          editData.title = translated;
        } else if (field === 'post_excerpt' || field === 'excerpt') {
          editData.excerpt = translated;
        } else if (field === 'post_name' || field === 'slug') {
          editData.slug = translated;
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

      if (!window.TranslateSenseCore) return;

      const blockRules = await window.TranslateSenseCore.getEditorConfig('gutenberg', this.blockRulesCache);

      // Helper to find translation for a string value
      const findTranslation = (strVal, blockName = '') => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;
        const clean = strVal.trim();

        // 1. Check via TranslateSenseCore using block_name + string value hash
        if (window.TranslateSenseCore) {
          const trans = window.TranslateSenseCore.getTranslatedString(blockName, clean, this.provider, blockName);
          if (trans && trans.translate && trans.translate !== clean) return trans.translate;
        }

        return null;
      };

      /**
       * Recursively update block attributes matching XML key schema.
       */
      const updateAttributeTree = (currentAttrs, keySchema, blockName) => {
        if (!currentAttrs || !keySchema) return { updated: currentAttrs, changed: false };
        let hasChanged = false;
        let newAttrs = Array.isArray(currentAttrs) ? [...currentAttrs] : { ...currentAttrs };

        Object.keys(keySchema).forEach((kName) => {
          const kInfo = keySchema[kName];
          if (newAttrs[kName] === undefined || newAttrs[kName] === null) return;

          const val = newAttrs[kName];

          if (typeof val === 'string' && val.trim() !== '') {
            const transVal = findTranslation(val, blockName);
            if (transVal && transVal !== val) {
              newAttrs[kName] = transVal;
              hasChanged = true;
            }
          } else if (val instanceof wp.richText.RichTextData) {
            const originalHTML = val.originalHTML;

            if (originalHTML && '' !== originalHTML) {
              const transVal = findTranslation(originalHTML, blockName);
              if (transVal && transVal !== originalHTML) {
                newAttrs[kName] = transVal;
                hasChanged = true;
              }
            }

          } else if (Array.isArray(val)) {
            // Nested array structure
            const childSchema = kInfo.children || keySchema;
            let arrayChanged = false;

            const newArr = val.map((arrItem) => {
              if (typeof arrItem === 'string') {
                const transItem = findTranslation(arrItem, blockName);
                if (transItem) {
                  arrayChanged = true;
                  return transItem;
                }
              } else if (typeof arrItem === 'object' && arrItem !== null) {
                const res = updateAttributeTree(arrItem, childSchema, blockName);
                if (res.changed) {
                  arrayChanged = true;
                  return res.updated;
                }
              }
              return arrItem;
            });

            if (arrayChanged) {
              newAttrs[kName] = newArr;
              hasChanged = true;
            }
          } else if (typeof val === 'object') {
            // Nested object structure
            const childSchema = kInfo.children || keySchema;
            const res = updateAttributeTree(val, childSchema, blockName);
            if (res.changed) {
              newAttrs[kName] = res.updated;
              hasChanged = true;
            }
          }
        });

        return { updated: newAttrs, changed: hasChanged };
      };

      const traverse = (blockList) => {
        if (!Array.isArray(blockList)) return blockList;

        blockList.forEach((block) => {
          const blockName = block.name;
          const attrs = block.attributes || {};

          // Check if we have XML rules for this block
          const rule = blockRules[blockName];
          const keys = rule ? (rule.attributes || rule) : null;
          if (keys && Object.keys(keys).length > 0) {
            const res = updateAttributeTree(attrs, keys, blockName);
            if (res.changed) {
              block.attributes = res.updated;
            }
          }

          // Traverse inner blocks
          if (block.innerBlocks && block.innerBlocks.length > 0) {
            traverse(block.innerBlocks);
          }
        });
      };

      traverse(blocks);
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
          await this.updateBlocks(parsedBlocks, strings);

          if (window.wp.data.dispatch('core/block-editor') && typeof window.wp.data.dispatch('core/block-editor').resetBlocks === 'function') {
            window.wp.data.dispatch('core/block-editor').resetBlocks(parsedBlocks);
          } else if (window.wp.data.dispatch('core/editor') && typeof window.wp.data.dispatch('core/editor').resetEditorBlocks === 'function') {
            window.wp.data.dispatch('core/editor').resetEditorBlocks(parsedBlocks);
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
