/**
 * TranslateSense - Chrome Built-in Local AI Provider (chrome-built-translate-.js)
 * 
 * Registers "chrome_ai" on window.TranslateSenseCore.
 * Leverages on-device Chrome AI (window.translation / window.ai) with robust fallback handling.
 */

(function (window) {
  'use strict';

  if (!window.TranslateSenseCore) {
    console.error('[TranslateSense] core-translate.js must be loaded before chrome-built-translate-.js');
    return;
  }

  // Internal helper for on-device translation
  async function translateSingleWithChromeAi(text, sourceLang, targetLang) {
    const src2 = (sourceLang || 'en').substring(0, 2).toLowerCase();
    const tgt2 = (targetLang || 'es').substring(0, 2).toLowerCase();

    // 1. Check Chrome Translation API (window.translation)
    if (window.translation && typeof window.translation.canTranslate === 'function') {
      const can = await window.translation.canTranslate({
        sourceLanguage: src2,
        targetLanguage: tgt2,
      });

      if (can !== 'no') {
        const translator = await window.translation.createTranslator({
          sourceLanguage: src2,
          targetLanguage: tgt2,
        });
        return await translator.translate(text);
      }
    }

    // 2. Check Prompt API (window.ai.languageModel)
    if (window.ai && window.ai.languageModel && typeof window.ai.languageModel.create === 'function') {
      const session = await window.ai.languageModel.create();
      const promptText = `Translate the following text accurately from ${sourceLang} to ${targetLang}. Preserve any HTML tags and formatting. Return ONLY the translated string without commentary:\n\n${text}`;
      return await session.prompt(promptText);
    }

    throw new Error('Chrome Built-in Local AI is not supported or not enabled on this browser. (Requires Chrome 128+ with Prompt/Translation API flags).');
  }

  window.TranslateSenseCore.registerProvider('chrome_ai', {
    title: 'Chrome Local AI',
    icon: '🤖',
    desc: 'On-device translation powered by Chrome built-in AI (window.ai).',
    savesToDb: false,

    /**
     * Translate items using Chrome Built-in AI on-device.
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

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sourceText = item.content || item.source || '';

        try {
          // Attempt on-device Chrome AI translation
          const translatedText = await translateSingleWithChromeAi(sourceText, sourceLang, targetLang);

          const itemResult = {
            hash: item.hash || '',
            source: sourceText,
            translated: translatedText,
            status: 'Local AI Completed',
          };

          results.push(itemResult);

          if (typeof onProgressCallback === 'function') {
            onProgressCallback(itemResult);
          }
        } catch (localError) {
          console.warn(`[TranslateSense] Chrome AI failed for item #${i} ("${sourceText.substring(0, 30)}..."), falling back:`, localError.message);

          // Graceful fallback to client_google server translation
          try {
            const fallbackResponse = await fetch(restUrl + 'translate-batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
              },
              body: JSON.stringify({
                strings: [sourceText],
                source_lang: sourceLang,
                target_lang: targetLang,
                provider: 'client_google',
                post_id: postId || config.postId || 0,
              }),
            });

            const fallbackData = await fallbackResponse.json();
            const fallbackText = fallbackData.results && fallbackData.results[0] && fallbackData.results[0].translated
              ? fallbackData.results[0].translated
              : sourceText;

            const fallbackResult = {
              hash: item.hash || '',
              source: sourceText,
              translated: fallbackText,
              status: 'Local AI (Fallback)',
            };

            results.push(fallbackResult);

            if (typeof onProgressCallback === 'function') {
              onProgressCallback(fallbackResult);
            }
          } catch (serverFallbackError) {
            const errorResult = {
              hash: item.hash || '',
              source: sourceText,
              translated: sourceText,
              status: 'Failed',
            };

            results.push(errorResult);

            if (typeof onProgressCallback === 'function') {
              onProgressCallback(errorResult);
            }
          }
        }
      }

      return results;
    },
  });
})(window);
