
/**
 * TranslateSense - Universal Meta Fields, SEO & ACF Live Updater
 *
 * File: assets/js/page-editor/meta-fields.js
 *
 * Supports:
 * - XML-based WPML custom-field configuration.
 * - ACF fields, repeaters and nested repeaters.
 * - ACF WYSIWYG / TinyMCE.
 * - Yoast SEO editor data store.
 * - Rank Math editor data store.
 * - SEOPress DOM and Tagify.
 * - Standard WordPress custom fields.
 *
 * No page reload or additional translation request is required.
 */

(function (window, document) {
  'use strict';

  const MetaFieldsUpdater = {

    core: null,
    provider: null,
    currentStrings: [],
    allowedFields: {},
    sourceMetaFields: {},

    /**
     * Register updater with TranslateSenseCore.
     */
    register(core) {
      if (!core || typeof core.registerPageEditor !== 'function') {
        return;
      }

      this.core = core;

      core.registerPageEditor('meta-fields', {
        title: 'Meta Fields & SEO',
        isActive: () => this.isActive(),
        apply: (strings, options) => this.apply(strings, options)
      });
    },

    /**
     * Check whether supported fields are available.
     */
    isActive() {
      return !!(
        window.acf ||
        document.querySelector(
          '#postcustomstuff, #wpseo_meta, #rank-math-metabox, #seopress-metabox'
        )
      );
    },

    /**
     * Set allowed fields from parsed WPML XML configuration.
     *
     * Accepts:
     * [
     *   '_yoast_wpseo_title',
     *   'rank_math_title'
     * ]
     *
     * Or:
     * [
     *   { name: '_yoast_wpseo_title', action: 'translate' }
     * ]
     *
     * Or:
     * {
     *   '_yoast_wpseo_title': true
     * }
     */
    setAllowedFields(fields) {
      const allowed = {};

      if (Array.isArray(fields)) {
        fields.forEach((field) => {
          const name = typeof field === 'string'
            ? field
            : field && (field.name || field.key);

          const action = typeof field === 'string'
            ? 'translate'
            : field && field.action;

          if (name && action === 'translate') {
            allowed[name] = true;
          }
        });
      } else if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([name, value]) => {
          if (value === true || value === 'translate') {
            allowed[name] = true;
          }
        });
      }

      this.allowedFields = allowed;
    },

    /**
     * Check whether a field is allowed.
     *
     * baseName is useful for ACF repeater subfields.
     */
    isAllowedField(fieldName, baseName = '') {
      return !!(
        fieldName &&
        (
          Object.prototype.hasOwnProperty.call(
            this.allowedFields,
            fieldName
          ) ||
          (
            baseName &&
            Object.prototype.hasOwnProperty.call(
              this.allowedFields,
              baseName
            )
          )
        )
      );
    },

    /**
     * Get a matching translation object.
     */
    getStringItem(fieldName, baseName = '') {
      return this.currentStrings.find((item) => {
        const name = item.name || item.field || item.widget_id;

        return name === fieldName ||
          (baseName && name === baseName);
      }) || null;
    },

    /**
     * Get original source value from source metadata.
     */
    getSourceValue(fieldName, baseName = '') {
      let value = this.sourceMetaFields[fieldName];

      if (
        (value === undefined || value === null) &&
        baseName
      ) {
        value = this.sourceMetaFields[baseName];
      }

      // Handle values returned as arrays by the metadata layer.
      if (Array.isArray(value)) {
        value = value.length ? value[0] : '';
      }

      return typeof value === 'string' ? value : null;
    },

    /**
     * Resolve translated value.
     *
     * Priority:
     * 1. Current translation strings.
     * 2. Original source metadata.
     * 3. TranslateSenseCore cache.
     */
    resolveTranslation(fieldName, sourceValue, baseName = '') {
      const item = this.getStringItem(fieldName, baseName);

      if (item && typeof item.translated === 'string' && item.translated !== '') {
        return item.translated;
      }

      if (
        typeof sourceValue !== 'string' ||
        !sourceValue.trim()
      ) {
        return null;
      }

      const core = this.core ||
        (window.TranslateSenseCore || null);

      if (
        !core ||
        typeof core.getTranslatedString !== 'function'
      ) {
        return null;
      }

      try {
        // Follow the same lookup pattern as Elementor.
        const result = core.getTranslatedString(
          'metaFields',
          sourceValue,
          this.provider,
          fieldName
        );

        if (typeof result === 'string' && result !== sourceValue) {
          return result;
        }

        if (
          result &&
          typeof result.translate === 'string' &&
          result.translate !== sourceValue
        ) {
          return result.translate;
        }
      } catch (error) {
        console.warn(
          '[TranslateSense] Meta translation lookup warning:',
          error
        );
      }

      return null;
    },

    /**
     * Get original value for a configured field.
     */
    getFieldTranslation(fieldName, baseName = '') {
      const item = this.getStringItem(fieldName, baseName);

      let sourceValue = item && typeof item.source === 'string'
        ? item.source
        : null;

      if (sourceValue === null) {
        sourceValue = this.getSourceValue(fieldName, baseName);
      }

      // Use the translation object directly when available.
      if (
        item &&
        typeof item.translated === 'string' &&
        item.translated !== ''
      ) {
        return item.translated;
      }

      return this.resolveTranslation(
        fieldName,
        sourceValue,
        baseName
      );
    },

    /**
     * Safely escape a value for a CSS attribute selector.
     */
    escapeAttribute(value) {
      return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    },

    /**
     * Trigger native input events.
     */
    triggerInputEvents(element) {
      if (!element) {
        return;
      }

      element.dispatchEvent(
        new Event('input', { bubbles: true })
      );

      element.dispatchEvent(
        new Event('change', { bubbles: true })
      );
    },

    /**
     * Update regular DOM input fields.
     */
    updateDomInput(fieldName, translatedValue, sourceValue = '') {
      if (!fieldName || translatedValue === undefined) {
        return false;
      }

      const escaped = this.escapeAttribute(fieldName);

      const selectors = [
        `[name="${escaped}"]`,
        `[data-depend-id="${escaped}"]`
      ];

      const elements = new Set();

      const idElement = document.getElementById(fieldName);

      if (idElement) {
        elements.add(idElement);
      }

      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          elements.add(element);
        });
      });

      let updated = false;

      elements.forEach((element) => {
        if (
          element.type === 'button' ||
          element.type === 'checkbox' ||
          element.type === 'radio' ||
          element.disabled
        ) {
          return;
        }

        if (
          sourceValue &&
          element.value !== sourceValue &&
          element.value.trim() !== ''
        ) {
          return;
        }

        element.value = translatedValue;

        this.triggerInputEvents(element);

        updated = true;
      });

      return updated;
    },

    /**
     * Update Yoast SEO editor fields.
     */
    updateYoast(fieldName, value) {
      const wp = window.wp;

      if (!wp || !wp.data) {
        return false;
      }

      const store = wp.data.dispatch('yoast-seo/editor');

      if (!store) {
        return false;
      }

      const methods = {
        '_yoast_wpseo_focuskw': ['setFocusKeyword', value],
        '_yoast_wpseo_title': ['updateData', { title: value }],
        '_yoast_wpseo_metadesc': ['updateData', { description: value }],
        '_yoast_wpseo_bctitle': ['setBreadcrumbsTitle', value],
        '_yoast_wpseo_opengraph-title': ['setFacebookPreviewTitle', value],
        '_yoast_wpseo_opengraph-description': ['setFacebookPreviewDescription', value],
        '_yoast_wpseo_twitter-title': ['setTwitterPreviewTitle', value],
        '_yoast_wpseo_twitter-description': ['setTwitterPreviewDescription', value]
      };

      const config = methods[fieldName];

      if (!config || typeof store[config[0]] !== 'function') {
        return false;
      }

      try {
        store[config[0]](config[1]);
        return true;
      } catch (error) {
        console.warn('[TranslateSense] Yoast update warning:', error);
        return false;
      }
    },

    /**
     * Update Rank Math SEO editor fields.
     */
    updateRankMath(fieldName, value) {
      const wp = window.wp;

      if (!wp || !wp.data) {
        return false;
      }

      const store = wp.data.dispatch('rank-math');

      if (!store) {
        return false;
      }

      const methods = {
        rank_math_focus_keyword: 'updateKeywords',
        rank_math_title: 'updateTitle',
        rank_math_description: 'updateDescription',
        rank_math_breadcrumb_title: 'updateBreadcrumbTitle',
        rank_math_facebook_title: 'updateFacebookTitle',
        rank_math_facebook_description: 'updateFacebookDescription',
        rank_math_twitter_title: 'updateTwitterTitle',
        rank_math_twitter_description: 'updateTwitterDescription'
      };

      const method = methods[fieldName];

      if (!method || typeof store[method] !== 'function') {
        return false;
      }

      try {
        store[method](value);
        return true;
      } catch (error) {
        console.warn('[TranslateSense] Rank Math update warning:', error);
        return false;
      }
    },

    /**
     * Update SEOPress fields.
     */
    updateSeoPress(fieldName, value) {
      const inputId = fieldName.replace(/^_/, '') + '_meta';

      const input = document.getElementById(inputId);

      if (
        fieldName === '_seopress_analysis_target_kw' &&
        window.target_kw &&
        window.Tagify &&
        window.target_kw instanceof window.Tagify &&
        window.target_kw.DOM.originalInput.id === inputId
      ) {
        window.target_kw.removeAllTags();
        window.target_kw.addTags(value);
        return true;
      }

      if (!input) {
        return false;
      }

      input.value = value;

      this.triggerInputEvents(input);

      return true;
    },

    /**
     * Update SEO field using the correct integration.
     */
    updateSeoField(fieldName, translatedValue, sourceValue = '') {
      let updated = false;

      if (fieldName.startsWith('_yoast_wpseo_')) {
        updated = this.updateYoast(fieldName, translatedValue);
      } else if (fieldName.startsWith('rank_math_')) {
        updated = this.updateRankMath(fieldName, translatedValue);
      } else if (fieldName.startsWith('_seopress_')) {
        updated = this.updateSeoPress(fieldName, translatedValue);
      }

      // Fallback for unavailable editor APIs or unsupported fields.
      if (!updated) {
        updated = this.updateDomInput(
          fieldName,
          translatedValue,
          sourceValue
        );
      }

      return updated;
    },

    /**
     * Get complete ACF meta field name.
     *
     * Supports nested repeater rows:
     *
     * company_0_address
     * company_0_social_links_1_url
     */
    getAcfFieldName(field) {
      if (!field || !field.data || !field.data.name) {
        return {
          name: '',
          baseName: ''
        };
      }

      const baseName = field.data.name;
      const element = field.$el && field.$el[0]
        ? field.$el[0]
        : field.$el;

      if (!element || !element.closest) {
        return {
          name: baseName,
          baseName
        };
      }

      const repeaters = Array.from(
        element.querySelectorAll
          ? []
          : []
      );

      // Collect repeater ancestors, from inner to outer.
      let parent = element.parentElement;

      const repeaterPaths = [];

      while (parent) {
        if (parent.matches('.acf-field.acf-field-repeater')) {
          const row = parent.closest('.acf-row');

          const repeaterName = parent.getAttribute('data-name');
          const rowId = row && row.getAttribute('data-id');

          if (
            repeaterName &&
            rowId &&
            rowId.indexOf('row-') === 0
          ) {
            repeaterPaths.unshift(
              `${repeaterName}_${rowId.substring(4)}`
            );
          }
        }

        parent = parent.parentElement;
      }

      return {
        name: repeaterPaths.length
          ? `${repeaterPaths.join('_')}_${baseName}`
          : baseName,
        baseName
      };
    },

    /**
     * Update ACF WYSIWYG field.
     */
    updateAcfWysiwyg(field, value) {
      const editorId = field.data && field.data.id;

      if (!editorId) {
        return false;
      }

      const tinyMce = window.tinymce;

      if (tinyMce) {
        const editor = tinyMce.get(editorId);

        if (editor) {
          editor.setContent(value);
          editor.save();

          if (typeof editor.fire === 'function') {
            editor.fire('change');
          }
        }
      }

      const textarea = document.getElementById(editorId);

      if (textarea) {
        textarea.value = value;
        this.triggerInputEvents(textarea);
      }

      return !!(tinyMce && tinyMce.get(editorId)) || !!textarea;
    },

    /**
     * Update individual ACF field.
     */
    updateAcfField(field, translatedValue) {
      if (!field || typeof field.val !== 'function') {
        return false;
      }

      try {
        if (
          field.data &&
          field.data.type === 'wysiwyg'
        ) {
          this.updateAcfWysiwyg(field, translatedValue);
        }

        // Use the official ACF field setter.
        field.val(translatedValue);

        // Notify the field's DOM controls.
        if (field.$el && field.$el.find) {
          field.$el.find('input, textarea, select').each(function () {
            this.dispatchEvent(
              new Event('change', { bubbles: true })
            );
          });
        }

        return true;
      } catch (error) {
        console.warn('[TranslateSense] ACF field update warning:', error);
        return false;
      }
    },

    /**
     * Update configured ACF fields.
     */
    updateAcfFields() {
      if (
        !window.acf ||
        typeof window.acf.getFields !== 'function'
      ) {
        return;
      }

      try {
        const fields = window.acf.getFields();

        fields.forEach((field) => {
          const fieldNames = this.getAcfFieldName(field);

          const fieldName = fieldNames.name;
          const baseName = fieldNames.baseName;

          if (
            !this.isAllowedField(fieldName, baseName)
          ) {
            return;
          }

          const translatedValue = this.getFieldTranslation(
            fieldName,
            baseName
          );

          if (
            translatedValue === null ||
            translatedValue === undefined
          ) {
            return;
          }

          this.updateAcfField(field, translatedValue);
        });
      } catch (error) {
        console.warn('[TranslateSense] ACF live updater warning:', error);
      }
    },

    /**
     * Update standard WordPress Custom Fields meta box.
     */
    updateCustomFieldsTable() {
      const table = document.querySelector('#postcustomstuff');

      if (!table) {
        return;
      }

      const rows = table.querySelectorAll('tbody#the-list tr');

      rows.forEach((row) => {
        const keyInput = row.querySelector(
          'input[name*="meta_key"]'
        );

        const valueInput = row.querySelector(
          'textarea[name*="meta_value"]'
        );

        if (!keyInput || !valueInput) {
          return;
        }

        const fieldName = keyInput.value.trim();

        if (!this.isAllowedField(fieldName)) {
          return;
        }

        const translatedValue = this.getFieldTranslation(fieldName);

        if (translatedValue === null) {
          return;
        }

        valueInput.value = translatedValue;

        this.triggerInputEvents(valueInput);
      });
    },

    /**
     * Apply configured SEO and custom fields.
     */
    updateConfiguredFields() {
      this.currentStrings.forEach((item) => {
        const fieldName = item.name ||
          item.field ||
          item.widget_id;

        if (!fieldName || !this.isAllowedField(fieldName)) {
          return;
        }

        // ACF fields are updated through ACF API.
        if (
          window.acf &&
          typeof window.acf.getFields === 'function'
        ) {
          const isAcfField = window.acf.getFields().some((field) => {
            const names = this.getAcfFieldName(field);

            return names.name === fieldName ||
              names.baseName === fieldName;
          });

          if (isAcfField) {
            return;
          }
        }

        const sourceValue = typeof item.source === 'string'
          ? item.source
          : this.getSourceValue(fieldName);

        const translatedValue = this.resolveTranslation(
          fieldName,
          sourceValue
        );

        if (
          translatedValue === null ||
          translatedValue === undefined
        ) {
          return;
        }

        this.updateSeoField(
          fieldName,
          translatedValue,
          sourceValue || ''
        );
      });
    },

    /**
     * Apply all live metadata translations.
     */
    apply(strings, options = {}) {
      if (!Array.isArray(strings)) {
        return;
      }

      if (options.core) {
        this.core = options.core;
      } else if (options.options && options.options.core) {
        this.core = options.options.core;
      }

      this.provider =
        options.provider ||
        (options.options && options.options.provider) ||
        this.provider;

      if (options.allowedFields) {
        this.setAllowedFields(options.allowedFields);
      }

      this.sourceMetaFields =
        options.sourceMetaFields ||
        (options.options && options.options.sourceMetaFields) ||
        this.sourceMetaFields ||
        {};

      this.currentStrings = strings;

      // 1. Update SEO and regular custom fields.
      this.updateConfiguredFields();

      // 2. Update ACF fields and repeater fields.
      this.updateAcfFields();

      // 3. Update classic WordPress custom fields table.
      this.updateCustomFieldsTable();
    }
  };

  // Backward-compatible registration.
  if (
    window.TranslateSenseCore &&
    typeof window.TranslateSenseCore.registerPageEditor === 'function'
  ) {
    MetaFieldsUpdater.register(window.TranslateSenseCore);
  }

  window.TranslateSenseMetaUpdater = MetaFieldsUpdater;

})(window, document);