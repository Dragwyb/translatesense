/**
 * TranslateSense - Google Frontend & Widget Translation Provider
 * File: assets/js/providers/google/google-translate.js
 * 
 * Registers "google_widget" on window.TranslateSenseCore.
 * Supports both client-side Google widget / translation elements and secure backend REST proxy fallback.
 */

(function (window) {
  'use strict';

  if (!window.TranslateSenseCore) {
    console.error('[TranslateSense] core-translate.js must be loaded before google-translate.js');
    return;
  }

  const GoogleLangHelper = window.TranslateSenseGoogleLanguages || {
    isSupported: () => true,
    formatCode: (code) => (code ? code.toLowerCase().replace('_', '-') : 'en')
  };

  window.TranslateSenseCore.registerProvider('google_widget', {
    title: 'Google Translate',
    icon: '🚀',
    desc: 'Instant translation powered by Google Frontend Engine. No API key required.',
    category: 'free',
    savesToDb: false,
    requiresApiKey: false,

    /**
     * Check if provider is available and supports target language.
     */
    checkAvailability: function (sourceLang, targetLang) {
      if (targetLang && !GoogleLangHelper.isSupported(targetLang)) {
        return {
          available: false,
          reason: `Target language (${targetLang}) is not supported by Google Translate.`,
          noticeType: 'warning'
        };
      }
      return { available: true };
    },

    /**
     * Check if language pair is supported.
     */
    isLanguageSupported: function (sourceLang, targetLang) {
      return GoogleLangHelper.isSupported(sourceLang) && GoogleLangHelper.isSupported(targetLang);
    },

    /**
     * Translate items using Google Frontend Engine with batching & progress callbacks.
     * 
     * @param {Object} params
     * @param {Array<Object>} params.items Array of { hash, content/source, widget_id, field }
     * @param {string} params.sourceLang Source language code (e.g. 'en')
     * @param {string} params.targetLang Target language code (e.g. 'es')
     * @param {number} [params.postId] Current post ID
     * @param {AbortSignal} [params.signal] Optional abort signal
     * @param {Function} onProgressCallback Callback returning { hash, source, translated, status, error }
     * @returns {Promise<Array<Object>>}
     */
    translate: async function ({ items, sourceLang, targetLang, postId, signal }, onProgressCallback) {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const results = [];
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      const srcCode = GoogleLangHelper.formatCode(sourceLang);
      const tgtCode = GoogleLangHelper.formatCode(targetLang);

      // Process in batches of 15 strings for optimal network throughput
      const BATCH_SIZE = 15;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        if (signal && signal.aborted) {
          throw new Error('Translation cancelled');
        }

        const batchItems = items.slice(i, i + BATCH_SIZE);
        const stringContents = batchItems.map((item) => item.content || item.source || '');
        const widgetIds = batchItems.map((item) => item.widget_id || 'generic');

        try {
          const response = await fetch(restUrl + 'translate-batch', {
            method: 'POST',
            signal: signal,
            headers: {
              'Content-Type': 'application/json',
              'X-WP-Nonce': nonce,
            },
            body: JSON.stringify({
              strings: stringContents,
              widget_ids: widgetIds,
              source_lang: srcCode,
              target_lang: tgtCode,
              provider: 'google_widget',
              post_id: postId || config.postId || 0,
            }),
          });

          if (!response.ok) {
            throw new Error(`Google Translate HTTP ${response.status} (${response.statusText})`);
          }

          const data = await response.json();
          const translatedList = data.results || [];

          for (let j = 0; j < batchItems.length; j++) {
            const item = batchItems[j];
            const sourceText = item.content || item.source || '';
            const transResult = translatedList[j];
            const translatedText = transResult && transResult.translated ? transResult.translated : sourceText;

            const itemResult = {
              hash: item.hash || '',
              source: sourceText,
              translated: translatedText,
              status: 'Google Completed',
            };

            results.push(itemResult);

            if (typeof onProgressCallback === 'function') {
              onProgressCallback(itemResult);
            }
          }
        } catch (error) {
          if (error.name === 'AbortError' || (signal && signal.aborted)) {
            throw error;
          }

          console.warn('[TranslateSense] Google Translate batch error, marking fallback:', error.message);

          // Fallback: return source text with error status
          for (let j = 0; j < batchItems.length; j++) {
            const item = batchItems[j];
            const sourceText = item.content || item.source || '';
            const fallbackResult = {
              hash: item.hash || '',
              source: sourceText,
              translated: sourceText,
              status: 'Failed',
              error: error.message,
            };

            results.push(fallbackResult);

            if (typeof onProgressCallback === 'function') {
              onProgressCallback(fallbackResult);
            }
          }
        }
      }

      return results;
    },
  });
})(window);
