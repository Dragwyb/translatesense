/**
 * TranslateSense - AI Translation Provider (ai-translate.js)
 * 
 * Registers "openai" and "gemini" AI providers on window.TranslateSenseCore.
 * Dispatches provider name and content to backend REST API with robust error handling.
 */

(function (window) {
  'use strict';

  if (!window.TranslateSenseCore) {
    console.error('[TranslateSense] core-translate.js must be loaded before ai-translate.js');
    return;
  }

  /**
   * Helper function for executing backend AI translations.
   * 
   * @param {string} providerName 'openai' | 'gemini' | string
   * @param {Object} params { items, sourceLang, targetLang, postId }
   * @param {Function} onProgressCallback Callback returning { hash, source, translated, status }
   * @returns {Promise<Array<Object>>}
   */
  async function executeBackendAiTranslate(providerName, { items, sourceLang, targetLang, postId }, onProgressCallback) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const results = [];
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
    const nonce = config.nonce || '';

    const stringContents = items.map((item) => item.content || item.source || '');

    try {
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
          provider: providerName,
          post_id: postId || config.postId || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`AI Translation (${providerName}) failed: ${message}`);
      }

      const data = await response.json();
      const translatedList = data.results || [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sourceText = item.content || item.source || '';
        const transResult = translatedList[i];
        const translatedText = transResult && transResult.translated ? transResult.translated : sourceText;
        const isCached = transResult && transResult.cached;

        const itemResult = {
          hash: item.hash || '',
          source: sourceText,
          translated: translatedText,
          status: isCached ? 'Cached' : 'AI Completed',
        };

        results.push(itemResult);

        if (typeof onProgressCallback === 'function') {
          onProgressCallback(itemResult);
        }
      }

      return results;
    } catch (error) {
      console.error(`[TranslateSense] AI Translation (${providerName}) error:`, error);

      // Fallback: return source items with failure status
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sourceText = item.content || item.source || '';
        const fallbackResult = {
          hash: item.hash || '',
          source: sourceText,
          translated: sourceText,
          status: 'AI Failed',
          error: error.message,
        };

        results.push(fallbackResult);

        if (typeof onProgressCallback === 'function') {
          onProgressCallback(fallbackResult);
        }
      }

      throw error;
    }
  }

  // 1. Register OpenAI Provider
  window.TranslateSenseCore.registerProvider('openai', {
    title: 'OpenAI (GPT-4o)',
    icon: '🧠',
    desc: 'High-accuracy neural AI translation via OpenAI ChatGPT API.',
    savesToDb: true,
    translate: function (params, onProgressCallback) {
      return executeBackendAiTranslate('openai', params, onProgressCallback);
    },
  });

  // 2. Register Gemini AI Provider
  window.TranslateSenseCore.registerProvider('gemini', {
    title: 'Gemini AI',
    icon: '✨',
    desc: 'Next-gen multilingual translation via Google Gemini AI.',
    savesToDb: true,
    translate: function (params, onProgressCallback) {
      return executeBackendAiTranslate('gemini', params, onProgressCallback);
    },
  });
})(window);
