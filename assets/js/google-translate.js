/**
 * TranslateSense - Google Widget Translation Provider (google-translate.js)
 * 
 * Registers "google_widget" on window.TranslateSenseCore.
 * Translates content items and invokes progress callback({ hash, source, translated, status }).
 */

(function (window) {
  'use strict';

  if (!window.TranslateSenseCore) {
    console.error('[TranslateSense] core-translate.js must be loaded before google-translate.js');
    return;
  }

  window.TranslateSenseCore.registerProvider('google_widget', {
    title: 'Google Widget',
    icon: '🚀',
    desc: 'Instant frontend translation widget. No API key required.',
    savesToDb: false,

    /**
     * Translate items using Google Frontend / Client Engine.
     * 
     * @param {Object} params
     * @param {Array<Object>} params.items Array of { hash, content/source, widget_id, field }
     * @param {string} params.sourceLang Source language code (e.g. 'en')
     * @param {string} params.targetLang Target language code (e.g. 'es')
     * @param {number} [params.postId] Current post ID
     * @param {Function} onProgressCallback Callback returning { hash, source, translated, status }
     * @returns {Promise<Array<Object>>}
     */
    translate: async function ({ items, sourceLang, targetLang, postId }, onProgressCallback) {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const results = [];
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      const stringContents = items.map((item) => item.content || item.source || '');

      try {
        // Send batch request to backend with provider: 'google_widget'
        const response = await fetch(restUrl + 'translate-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
          body: JSON.stringify({
            strings: stringContents,
            source_lang: sourceLang,
            target_lang: targetLang,
            provider: 'google_widget',
            post_id: postId || config.postId || 0,
          }),
        });

        if (!response.ok) {
          throw new Error(`Google Widget HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const translatedList = data.results || [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const sourceText = item.content || item.source || '';
          const transResult = translatedList[i];
          const translatedText = transResult && transResult.translated ? transResult.translated : sourceText;

          const itemResult = {
            hash: item.hash || '',
            source: sourceText,
            translated: translatedText,
            status: 'Frontend Completed',
          };

          results.push(itemResult);

          if (typeof onProgressCallback === 'function') {
            onProgressCallback(itemResult);
          }
        }

        return results;
      } catch (error) {
        console.warn('[TranslateSense] Google Widget fallback activated:', error);

        // Fallback: return source items with error status
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const sourceText = item.content || item.source || '';
          const fallbackResult = {
            hash: item.hash || '',
            source: sourceText,
            translated: sourceText,
            status: 'Failed (Fallback)',
          };

          results.push(fallbackResult);

          if (typeof onProgressCallback === 'function') {
            onProgressCallback(fallbackResult);
          }
        }

        return results;
      }
    },
  });
})(window);
