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
     * Recursively update blocks in the Gutenberg canvas.
     */
    updateBlocks(blocks, strings) {
      const { updateBlockAttributes } = window.wp.data.dispatch('core/block-editor');

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

      const traverse = (blockList) => {
        if (!Array.isArray(blockList)) return;

        blockList.forEach((block) => {
          const clientId = block.clientId;
          const blockName = block.name;
          const attrs = block.attributes || {};
          const updatedAttrs = {};
          let hasChanges = false;

          // Helper to find translation for a string value
          const findTranslation = (strVal, fieldKey = '') => {
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

          // Check direct attributes
          Object.keys(attrs).forEach((attrKey) => {
            const attrVal = attrs[attrKey];

            if (typeof attrVal === 'string' && attrVal.trim() !== '') {
              const transVal = findTranslation(attrVal, attrKey);
              if (transVal) {
                updatedAttrs[attrKey] = transVal;
                hasChanges = true;
              }
            } else if (Array.isArray(attrVal)) {
              // Array attribute (e.g. table rows, gallery items, button lists)
              let arrayChanged = false;
              const newArr = attrVal.map((item) => {
                if (typeof item === 'string') {
                  const transItem = findTranslation(item, attrKey);
                  if (transItem) {
                    arrayChanged = true;
                    return transItem;
                  }
                } else if (typeof item === 'object' && item !== null) {
                  const newItem = { ...item };
                  Object.keys(newItem).forEach((subK) => {
                    if (typeof newItem[subK] === 'string') {
                      const transSub = findTranslation(newItem[subK], subK);
                      if (transSub) {
                        newItem[subK] = transSub;
                        arrayChanged = true;
                      }
                    }
                  });
                  return newItem;
                }
                return item;
              });

              if (arrayChanged) {
                updatedAttrs[attrKey] = newArr;
                hasChanges = true;
              }
            }
          });

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
    apply(strings) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      // 1. Update Post Title, Excerpt & Slug
      this.updatePostAttributes(strings);

      // 2. Update Blocks
      const blocks = window.wp.data.select('core/block-editor').getBlocks();
      this.updateBlocks(blocks, strings);

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
