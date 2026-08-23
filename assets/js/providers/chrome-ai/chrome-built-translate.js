/**
 * TranslateSense - Chrome Built-in Local AI Provider
 * File: assets/js/providers/chrome-ai/chrome-built-translate.js
 * 
 * Registers "chrome_ai" on window.TranslateSenseCore.
 * Leverages on-device Chromium Translation API (window.translation) & Prompt API (window.ai)
 * with robust security checks, language pair validation, and seamless fallback handling.
 */

(function (window) {
  'use strict';

  if (!window.TranslateSenseCore) {
    console.error('[TranslateSense] core-translate.js must be loaded before chrome-built-translate.js');
    return;
  }

  const ChromeLangHelper = window.TranslateSenseChromeLanguages || {
    isSupported: () => true,
    formatCode: (code) => (code ? code.toLowerCase().split('-')[0] : 'en')
  };

  /**
   * Helper: Check if browser environment is Chrome / Chromium.
   */
  function isChromeBrowser() {
    const isChromium = !!window.chrome;
    const winNav = window.navigator;
    const vendorName = winNav.vendor;
    const isOpera = typeof window.opr !== 'undefined';
    const isIEorEdge = winNav.userAgent.indexOf('Edg') > -1;
    const isIOSChrome = winNav.userAgent.match('CriOS');

    if (isIOSChrome) return true;
    return isChromium && vendorName === 'Google Inc.' && !isOpera && !isIEorEdge;
  }

  /**
   * Helper: Check if translation API is available on-device.
   */
  async function checkChromeAiAvailability(sourceLang, targetLang) {
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isChromeBrowser()) {
      return {
        available: false,
        reason: 'Chrome Local AI requires Google Chrome (version 128+). Other browsers are not yet supported for on-device AI.',
        noticeType: 'info'
      };
    }

    if (!isSecure) {
      return {
        available: false,
        reason: 'Chrome AI requires a secure connection (HTTPS) or localhost. Please enable HTTPS or visit chrome://flags/#unsafely-treat-insecure-origin-as-secure.',
        noticeType: 'warning'
      };
    }

    const src = ChromeLangHelper.formatCode(sourceLang);
    const tgt = ChromeLangHelper.formatCode(targetLang);

    if (!ChromeLangHelper.isSupported(src) || !ChromeLangHelper.isSupported(tgt)) {
      return {
        available: false,
        reason: `Language pair (${sourceLang} → ${targetLang}) is not supported by Chrome Local AI models.`,
        noticeType: 'warning'
      };
    }

    // 1. Check window.translation API (Chrome 128+)
    if (window.translation && typeof window.translation.canTranslate === 'function') {
      try {
        const can = await window.translation.canTranslate({
          sourceLanguage: src,
          targetLanguage: tgt,
        });

        if (can === 'readily') {
          return { available: true };
        } else if (can === 'after-download' || can === 'downloadable') {
          return {
            available: true,
            reason: 'Chrome is downloading the required language pack in the background. First translation might take a few seconds.',
            noticeType: 'info'
          };
        } else if (can === 'no') {
          return {
            available: false,
            reason: `Language pair (${src} → ${tgt}) cannot be translated by the current on-device model.`,
            noticeType: 'warning'
          };
        }
      } catch (e) {
        console.warn('[TranslateSense] canTranslate error:', e);
      }
    }

    // 2. Check window.ai.languageModel (Prompt API)
    if (window.ai && window.ai.languageModel && typeof window.ai.languageModel.capabilities === 'function') {
      try {
        const caps = await window.ai.languageModel.capabilities();
        if (caps && caps.available !== 'no') {
          return { available: true };
        }
      } catch (e) {
        console.warn('[TranslateSense] languageModel.capabilities error:', e);
      }
    }

    // If neither is detected, inform user how to enable experimental flags
    return {
      available: false,
      reason: 'Chrome AI translation API is not enabled in your browser. Enable "Experimental translation API" at chrome://flags/#translation-api.',
      noticeType: 'warning'
    };
  }

  /**
   * Internal worker: Translate a single string using available Chrome On-Device APIs.
   */
  async function translateSingleWithChromeAi(text, sourceLang, targetLang, signal) {
    if (!text || text.trim() === '') {
      return text;
    }

    const src2 = ChromeLangHelper.formatCode(sourceLang);
    const tgt2 = ChromeLangHelper.formatCode(targetLang);

    // 1. Check Translation API (window.translation / window.ai.translator)
    if (window.translation && typeof window.translation.createTranslator === 'function') {
      const translator = await window.translation.createTranslator({
        sourceLanguage: src2,
        targetLanguage: tgt2,
        signal: signal,
      });
      return await translator.translate(text);
    }

    if (window.ai && window.ai.translator && typeof window.ai.translator.create === 'function') {
      const translator = await window.ai.translator.create({
        sourceLanguage: src2,
        targetLanguage: tgt2,
        signal: signal,
      });
      return await translator.translate(text);
    }

    // 2. Fallback to Prompt API (window.ai.languageModel)
    if (window.ai && window.ai.languageModel && typeof window.ai.languageModel.create === 'function') {
      const session = await window.ai.languageModel.create({ signal });
      const promptText = `Translate the following text accurately from ${sourceLang} to ${targetLang}. Preserve all HTML tags, placeholders, and formatting. Return ONLY the translated string without quotes or commentary:\n\n${text}`;
      const result = await session.prompt(promptText, { signal });
      return result ? result.trim() : text;
    }

    throw new Error('On-device Chrome AI engine is not available on this browser.');
  }

  // Register provider on TranslateSenseCore
  window.TranslateSenseCore.registerProvider('chrome_ai', {
    title: 'Chrome Local AI',
    icon: '🤖',
    desc: 'Private on-device translation powered by Chrome built-in Gemini Nano / Translation API.',
    category: 'browser',
    savesToDb: false,
    requiresApiKey: false,

    checkAvailability: function (sourceLang, targetLang) {
      return checkChromeAiAvailability(sourceLang, targetLang);
    },

    isLanguageSupported: function (sourceLang, targetLang) {
      return ChromeLangHelper.isSupported(sourceLang) && ChromeLangHelper.isSupported(targetLang);
    },

    /**
     * Translate items using on-device Chrome Local AI (100% Client-side).
     * 
     * @param {Object} params
     * @param {Array<Object>} params.items Array of { hash, content/source, widget_id, field }
     * @param {string} params.sourceLang Source language code
     * @param {string} params.targetLang Target language code
     * @param {number} [params.postId] Current post ID
     * @param {AbortSignal} [params.signal] Cancellation signal
     * @param {Function} onProgressCallback Callback returning { hash, source, translated, status, error }
     * @returns {Promise<Array<Object>>}
     */
    translate: async function ({ items, sourceLang, targetLang, signal }, onProgressCallback) {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const results = [];

      for (let i = 0; i < items.length; i++) {
        if (signal && signal.aborted) {
          throw new Error('Translation cancelled');
        }

        const item = items[i];
        const sourceText = item.content || item.source || '';

        try {
          // 100% On-device Chrome AI translation
          const translatedText = await translateSingleWithChromeAi(sourceText, sourceLang, targetLang, signal);

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
          if (localError.name === 'AbortError' || (signal && signal.aborted)) {
            throw localError;
          }

          console.warn(`[TranslateSense] Chrome AI local translation error for item #${i}:`, localError.message);

          const errorResult = {
            hash: item.hash || '',
            source: sourceText,
            translated: sourceText,
            status: 'Failed',
            error: localError.message,
          };

          results.push(errorResult);

          if (typeof onProgressCallback === 'function') {
            onProgressCallback(errorResult);
          }
        }
      }

      return results;
    },
  });
})(window);
