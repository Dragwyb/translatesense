/**
 * TranslateSense - Universal Meta Fields, SEO & ACF Live Updater
 * File: assets/js/page-editor/meta-fields.js
 * 
 * Provides live synchronization for:
 * - Yoast SEO (_yoast_wpseo_title, _yoast_wpseo_metadesc)
 * - Rank Math (rank_math_title, rank_math_description, rank_math_focus_keyword)
 * - SEOPress (_seopress_titles_title, _seopress_titles_desc)
 * - ACF (Advanced Custom Fields) via window.acf.getFields() & WYSIWYG TinyMCE
 * - Standard WordPress Custom Fields table (#postcustomstuff) & input elements
 */

(function (window, document) {
  'use strict';

  const MetaFieldsUpdater = {
    /**
     * Update DOM element by matching selectors.
     */
    updateDomInput(fieldName, translatedValue, sourceValue = '') {
      if (!fieldName || translatedValue === undefined) return;

      const selectors = [
        `input[name="${fieldName}"]`,
        `textarea[name="${fieldName}"]`,
        `input#${fieldName}`,
        `textarea#${fieldName}`,
        `[data-depend-id="${fieldName}"]`,
      ];

      selectors.forEach((sel) => {
        const els = document.querySelectorAll(sel);
        els.forEach((el) => {
          if (el.type !== 'button' && el.type !== 'checkbox' && el.type !== 'radio') {
            if (!sourceValue || el.value === sourceValue || el.value.trim() === '') {
              el.value = translatedValue;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      });
    },

    /**
     * Update Yoast SEO Fields.
     */
    updateYoastSeo(fieldName, translatedValue) {
      if (!fieldName.startsWith('_yoast_wpseo_')) return;

      this.updateDomInput(fieldName, translatedValue);

      // Gutenberg / React sidebar binding for Yoast if available
      if (fieldName === '_yoast_wpseo_title') {
        const titleInput = document.querySelector('#yoast-google-preview-title-metabox, input[id*="yoast-wpseo-title"]');
        if (titleInput) {
          titleInput.value = translatedValue;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (fieldName === '_yoast_wpseo_metadesc') {
        const descInput = document.querySelector('#yoast-google-preview-description-metabox, textarea[id*="yoast-wpseo-metadesc"]');
        if (descInput) {
          descInput.value = translatedValue;
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },

    /**
     * Update Rank Math SEO Fields.
     */
    updateRankMathSeo(fieldName, translatedValue) {
      if (!fieldName.startsWith('rank_math_')) return;

      this.updateDomInput(fieldName, translatedValue);

      const rankMathInput = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"]`);
      if (rankMathInput) {
        rankMathInput.value = translatedValue;
        rankMathInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },

    /**
     * Update SEOPress Fields.
     */
    updateSeoPress(fieldName, translatedValue) {
      if (!fieldName.startsWith('_seopress_')) return;
      this.updateDomInput(fieldName, translatedValue);
    },

    /**
     * Update ACF (Advanced Custom Fields) in live DOM.
     */
    updateAcfFields(stringMap) {
      if (!window.acf || typeof window.acf.getFields !== 'function') return;

      try {
        const acfFields = window.acf.getFields();
        acfFields.forEach((field) => {
          const fieldName = field.data ? field.data.name : '';
          const fieldType = field.data ? field.data.type : '';
          const fieldId = field.data ? field.data.id : '';

          if (!fieldName) return;

          // Check if we have translation for this field
          if (stringMap[fieldName] !== undefined) {
            const translatedVal = stringMap[fieldName];

            if (fieldType === 'wysiwyg' && window.tinymce) {
              const editorId = fieldId || fieldName;
              const ed = window.tinymce.get(editorId);
              if (ed) {
                ed.setContent(translatedVal);
              }
              const ta = document.querySelector(`textarea#${editorId}`);
              if (ta) ta.value = translatedVal;
            } else if (typeof field.val === 'function') {
              field.val(translatedVal);
            }
          }
        });
      } catch (e) {
        console.warn('[TranslateSense] ACF live sync warning:', e);
      }
    },

    /**
     * Update Classic WordPress Custom Fields Meta Box table (#postcustomstuff).
     */
    updateCustomFieldsTable(stringMap) {
      const customTable = document.querySelector('#postcustomstuff');
      if (!customTable) return;

      const rows = customTable.querySelectorAll('tbody#the-list tr');
      rows.forEach((row) => {
        const keyInput = row.querySelector('input[type="text"][name*="meta_key"]');
        const valTextarea = row.querySelector('textarea[name*="meta_value"]');

        if (keyInput && valTextarea) {
          const key = keyInput.value.trim();
          if (stringMap[key] !== undefined) {
            valTextarea.value = stringMap[key];
            valTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            valTextarea.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    },

    /**
     * Apply all translated meta fields in bulk.
     * @param {Array<Object>} strings Array of { field, widget_id, source, translated }
     */
    apply(strings) {
      if (!Array.isArray(strings)) return;

      const stringMap = {};
      strings.forEach((s) => {
        if (s.field && s.translated) {
          stringMap[s.field] = s.translated;
        }
      });

      strings.forEach((s) => {
        const key = s.field || s.widget_id;
        const val = s.translated;
        const src = s.source;

        if (!key || !val) return;

        if (key.startsWith('_yoast_wpseo_')) {
          this.updateYoastSeo(key, val);
        } else if (key.startsWith('rank_math_')) {
          this.updateRankMathSeo(key, val);
        } else if (key.startsWith('_seopress_')) {
          this.updateSeoPress(key, val);
        } else {
          this.updateDomInput(key, val, src);
        }
      });

      // Update ACF and Custom Fields
      this.updateAcfFields(stringMap);
      this.updateCustomFieldsTable(stringMap);
    },
  };

  window.TranslateSenseMetaUpdater = MetaFieldsUpdater;
})(window, document);
