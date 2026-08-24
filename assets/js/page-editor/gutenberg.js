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
     * Cache for Gutenberg block rules fetched from REST endpoint.
     */
    blockRulesCache: null,

    /**
     * Fetch block configuration rules parsed from translatesense_all_xml.
     */
    async getBlockRules() {
      if (this.blockRulesCache) {
        return this.blockRulesCache;
      }

      // Check preloaded configuration
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      if (config.gutenbergBlockRules && typeof config.gutenbergBlockRules === 'object') {
        this.blockRulesCache = config.gutenbergBlockRules;
        return this.blockRulesCache;
      }

      // Fetch from REST API endpoint
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      try {
        const response = await fetch(restUrl + 'gutenberg-config', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        });
        const data = await response.json();
        if (data && data.block_rules) {
          this.blockRulesCache = data.block_rules;
          return this.blockRulesCache;
        }
      } catch (err) {
        console.warn('[TranslateSense] Could not fetch /gutenberg-config:', err);
      }

      return {};
    },

    /**
     * Recursively update blocks in the Gutenberg canvas based on XML block configuration.
     */
    async updateBlocks(blocks, strings) {
      const { updateBlockAttributes } = window.wp.data.dispatch('core/block-editor');
      const blockRules = await this.getBlockRules();

      // Populate TranslateSenseCore stores
      if (window.TranslateSenseCore) {
        strings.forEach((s) => {
          const wId = s.widget_id || 'core/paragraph';
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

      // Helper to find translation for a string value
      const findTranslation = (strVal, blockName = '') => {
        if (typeof strVal !== 'string' || strVal.trim() === '') return null;
        const clean = strVal.trim();

        // 1. Check via TranslateSenseCore using block_name + string value hash
        if (window.TranslateSenseCore) {
          const trans = window.TranslateSenseCore.getTranslatedString(blockName, clean, null, blockName);
          if (trans && trans !== clean) return trans;
        }

        // 2. Direct string match
        for (const s of strings) {
          if (s.translated && s.source && s.source.trim() === clean) {
            return s.translated;
          }
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
        if (!Array.isArray(blockList)) return;

        blockList.forEach((block) => {
          const clientId = block.clientId;
          const blockName = block.name;
          const attrs = block.attributes || {};
          let updatedAttrs = {};
          let hasChanges = false;

          // Check if we have XML rules for this block
          const rule = blockRules[blockName];
          console.log(rule)
          if (rule && rule.keys && Object.keys(rule.keys).length > 0) {
            const res = updateAttributeTree(attrs, rule.keys, blockName);
            if (res.changed) {
              updatedAttrs = res.updated;
              hasChanges = true;
            }
          } else {
            // Generic attribute check if block is not in XML rules
            Object.keys(attrs).forEach((attrKey) => {
              const attrVal = attrs[attrKey];
              if (typeof attrVal === 'string' && attrVal.trim() !== '') {
                const transVal = findTranslation(attrVal, blockName);
                if (transVal) {
                  updatedAttrs[attrKey] = transVal;
                  hasChanges = true;
                }
              }
            });
          }

          // Dispatch update for this block if changes were made
          if (hasChanges) {
            updateBlockAttributes(clientId, updatedAttrs);
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
     * Apply all translated strings live to Gutenberg.
     */
    async apply(strings) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      // 1. Update Post Title, Excerpt & Slug
      this.updatePostAttributes(strings);

      // 2. Update Blocks using XML block configuration
      const blocks = window.wp.data.select('core/block-editor').getBlocks();
      await this.updateBlocks(blocks, strings);

      // 3. Update Meta Fields & SEO
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }

      // 4. Create Success Notice
      if (window.wp.data.dispatch('core/notices')) {
        window.wp.data.dispatch('core/notices').createSuccessNotice('✨ Translated content applied to Gutenberg blocks successfully!', {
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
