/**
 * TranslateSense - Built-in AI Translation Provider
 *
 * File: assets/js/providers/chrome-ai/chrome-built-translate.js
 *
 * Provides client-side translation through supported Chromium
 * on-device translation APIs in Google Chrome and Microsoft Edge.
 *
 * Supported API implementations:
 * - window.translation
 * - window.Translator
 * - window.ai.translator
 */

(function (window) {
  'use strict';

  if (!window.TranslateSenseCore) {
    console.error(
      '[TranslateSense] TranslateSenseCore must be loaded before chrome-built-translate.js.'
    );
    return;
  }

  /**
   * TranslateSense language helper.
   */
  const TranslateSenseLanguageHelper =
    window.TranslateSenseChromeLanguages || {
      isSupported: function () {
        return true;
      },
      formatCode: function (code) {
        return code
          ? String(code).toLowerCase().split('-')[0]
          : 'en';
      }
    };

  /**
   * Internal cache for language-pair availability checks in Chrome AI.
   */
  const languageAvailabilityCache = new Map();

  /**
   * Queue of languages that require a user gesture or model download.
   */
  let unavailableLanguage = [];
  let isListeningGestures = false;
  let isProcessingUnavailableQueue = false;

  /**
   * Cache of active translator instances per language pair.
   */
  const activeTranslators = new Map();

  /**
   * Detect the browser supported by TranslateSense Built-in AI.
   *
   * @returns {string} Chrome|Edge|Other
   */
  function detectTranslateSenseAiBrowser() {
    const navigatorObject = window.navigator;

    if (
      navigatorObject.userAgentData &&
      Array.isArray(navigatorObject.userAgentData.brands)
    ) {
      const brands = navigatorObject.userAgentData.brands;
      if (brands.some((b) => b.brand === 'Microsoft Edge')) return 'Edge';
      if (brands.some((b) => b.brand === 'Google Chrome')) return 'Chrome';
    }

    const userAgent = navigatorObject.userAgent || '';
    if (userAgent.indexOf('Edg/') !== -1) return 'Edge';
    if (userAgent.indexOf('Chrome/') !== -1 && userAgent.indexOf('Edg/') === -1) {
      return 'Chrome';
    }

    return 'Other';
  }

  /**
   * Helper to generate a normalized language-pair cache key.
   */
  function getLanguagePairCacheKey(sourceLang, targetLang) {
    const s = TranslateSenseLanguageHelper.formatCode(sourceLang || 'en');
    const t = TranslateSenseLanguageHelper.formatCode(targetLang || '');
    return `${s}->${t}`;
  }

  /**
   * Detect the available Translator API factory.
   *
   * @returns {Object|null}
   */
  function getTranslateSenseTranslatorApi() {
    if (
      window.Translator &&
      typeof window.Translator.create === 'function'
    ) {
      return {
        type: 'translator',
        create: (opts) => window.Translator.create(opts)
      };
    }

    if (
      window.translation &&
      typeof window.translation.createTranslator === 'function'
    ) {
      return {
        type: 'translation',
        create: (opts) => window.translation.createTranslator(opts)
      };
    }

    if (
      window.ai &&
      window.ai.translator &&
      typeof window.ai.translator.create === 'function'
    ) {
      return {
        type: 'ai-translator',
        create: (opts) => window.ai.translator.create(opts)
      };
    }

    return null;
  }

  /**
   * Query the browser for translation availability for a language pair.
   * Checks window.Translator.availability, window.translation.canTranslate,
   * window.Translator.canTranslate, and window.ai.translator.availability.
   *
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @returns {Promise<string|null>}
   */
  async function queryTranslatorAvailability(sourceLanguage, targetLanguage) {
    const pair = { sourceLanguage, targetLanguage };

    if (window.Translator && typeof window.Translator.availability === 'function') {
      try {
        let status = await window.Translator.availability(pair);

        if (!status || status !== 'available') {
          await window.Translator.create({
            sourceLanguage: pair.sourceLanguage,
            targetLanguage: pair.targetLanguage,
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => {
                console.log('downloadprogress', e.loaded * 100);
              });
            }
          });

          status = await window.Translator.availability(pair);
        }

        return status;
      } catch (e) {
        if (e.message.includes('user gesture')) {
          return "downloadable";
        }
      }
    }

    if (window.translation && typeof window.translation.canTranslate === 'function') {
      try {
        return await window.translation.canTranslate(pair);
      } catch (e) { }
    }

    if (
      window.ai &&
      window.ai.translator &&
      typeof window.ai.translator.capabilities === 'function'
    ) {
      try {
        const caps = await window.ai.translator.capabilities();
        return await caps.languagePairAvailable(pair);
      } catch (e) { }
    }

    return null;
  }

  /**
   * Normalize availability status response into standard TranslateSense result object.
   */
  function normalizeAvailabilityStatus(status, browserType, sourceLanguage, targetLanguage) {
    if (!status) return null;

    if (status === 'readily' || status === 'available' || status === 'yes') {
      return { available: true, status: 'readily' };
    }

    if (status === 'after-download' || status === 'downloadable') {
      return {
        available: true,
        status: 'downloadable',
        type: 'downloadable',
        reason: `${browserType} is downloading the required language pack in the background. The first translation might take a few seconds.`,
        noticeType: 'info'
      };
    }

    if (status === 'downloading') {
      return {
        available: false,
        status: 'downloading',
        type: 'downloading',
        reason: `The required ${browserType} translation language pack is currently downloading. Please wait for the download to complete.`,
        noticeType: 'info'
      };
    }

    if (status === 'requires-user-gesture') {
      return {
        available: false,
        status: 'requires-user-gesture',
        type: 'requires-user-gesture',
        reason: `${browserType} requires a user action before the translation model can be downloaded.`,
        noticeType: 'info'
      };
    }

    if (status === 'no' || status === 'unsupported') {
      return {
        available: false,
        reason: `Language pair (${sourceLanguage} → ${targetLanguage}) cannot be translated by the current ${browserType} on-device model.`,
        noticeType: 'warning',
        type: 'languagePairNotSupported'
      };
    }

    if (status === 'download-timeout') {
      return {
        available: false,
        reason: `The ${browserType} translation model could not be loaded completely. Please check the browser's language model status and try again.`,
        noticeType: 'warning',
        type: 'download-timeout'
      };
    }

    if (status === 'unavailable' || status === 'no-download') {
      return {
        available: false,
        reason: `The required ${browserType} translation language pack is not currently available.`,
        noticeType: 'warning',
        type: 'language-pack-not-installed'
      };
    }

    return null;
  }

  /**
   * Check Built-in AI translation capability for a language pair.
   *
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {boolean} [bypassCache=false]
   * @returns {Promise<Object>}
   */
  async function checkTranslateSenseAiAvailability(
    sourceLang,
    targetLang,
    bypassCache = false
  ) {
    const cacheKey = getLanguagePairCacheKey(sourceLang, targetLang);

    if (!bypassCache && languageAvailabilityCache.has(cacheKey)) {
      return languageAvailabilityCache.get(cacheKey);
    }

    function returnWithCache(result) {
      languageAvailabilityCache.set(cacheKey, result);
      return result;
    }

    const browserType = detectTranslateSenseAiBrowser();

    if (browserType === 'Other') {
      return returnWithCache({
        available: false,
        reason: 'TranslateSense Built-in AI translation requires Google Chrome or Microsoft Edge.',
        noticeType: 'info',
        type: 'browser'
      });
    }

    if (!window.isSecureContext) {
      const browserUrl = browserType === 'Edge' ? 'edge' : 'chrome';
      return returnWithCache({
        available: false,
        reason:
          `${browserType} Built-in AI translation requires a secure connection (HTTPS) or localhost. ` +
          `For local development, configure ${browserUrl}://flags/#unsafely-treat-insecure-origin-as-secure.`,
        noticeType: 'warning',
        type: 'notSecure'
      });
    }

    const sourceLanguage = TranslateSenseLanguageHelper.formatCode(sourceLang);
    const targetLanguage = TranslateSenseLanguageHelper.formatCode(targetLang);

    if (!TranslateSenseLanguageHelper.isSupported(sourceLanguage)) {
      return returnWithCache({
        available: false,
        reason: `Language ${sourceLang} is not supported by ${browserType} Built-in AI translation.`,
        noticeType: 'warning',
        type: 'sourceLangNotSupported'
      });
    }

    if (!TranslateSenseLanguageHelper.isSupported(targetLanguage)) {
      return returnWithCache({
        available: false,
        reason: `Language ${targetLang} is not supported by ${browserType} Built-in AI translation.`,
        noticeType: 'warning',
        type: 'targetLangNotSupported'
      });
    }

    // Query availability status through available API implementations
    const rawStatus = await queryTranslatorAvailability(sourceLanguage, targetLanguage);

    if (rawStatus) {
      const normalized = normalizeAvailabilityStatus(rawStatus, browserType, sourceLanguage, targetLanguage);
      if (normalized) {
        return returnWithCache(normalized);
      }
    }

    // If Translator API exists without availability method, treat as available
    const translatorApi = getTranslateSenseTranslatorApi();
    if (translatorApi) {
      return returnWithCache({ available: true });
    }

    const flagUrl = browserType === 'Edge' ? 'edge://flags/#translation-api' : 'chrome://flags/#translation-api';
    return returnWithCache({
      available: false,
      reason:
        `${browserType} Built-in AI translation API is not available in this browser. ` +
        `If you are using an experimental browser build, enable the Experimental translation API at ${flagUrl}.`,
      noticeType: 'warning',
      type: 'translation-api-not-available'
    });
  }

  /**
   * Get or create a translator instance for a language pair.
   */
  async function getOrCreateTranslateSenseTranslator(sourceLanguage, targetLanguage) {
    const key = `${sourceLanguage}->${targetLanguage}`;
    if (activeTranslators.has(key)) {
      return activeTranslators.get(key);
    }

    const translatorApi = getTranslateSenseTranslatorApi();
    if (!translatorApi) {
      throw new Error(
        'The TranslateSense Built-in AI translation engine is not available in this browser.'
      );
    }

    const translator = await translatorApi.create({
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage
    });

    if (!translator || typeof translator.translate !== 'function') {
      throw new Error(
        'The Built-in AI translation engine could not create a valid translator.'
      );
    }

    activeTranslators.set(key, translator);
    return translator;
  }

  /**
   * Warmup translation for a language pair using a sample word.
   */
  async function warmupTranslateSenseAi(sourceLang, targetLang, sampleText = 'Hello') {
    const sourceLanguage = TranslateSenseLanguageHelper.formatCode(sourceLang);
    const targetLanguage = TranslateSenseLanguageHelper.formatCode(targetLang);

    const translator = await getOrCreateTranslateSenseTranslator(
      sourceLanguage,
      targetLanguage
    );

    return await translator.translate(sampleText);
  }

  /**
   * Translate one piece of text using the available Built-in AI Translator.
   */
  async function translateSingleWithTranslateSenseAi(text, sourceLang, targetLang) {
    if (typeof text !== 'string' || text.trim() === '') {
      return text;
    }

    const sourceLanguage = TranslateSenseLanguageHelper.formatCode(sourceLang);
    const targetLanguage = TranslateSenseLanguageHelper.formatCode(targetLang);

    try {
      const translator = await getOrCreateTranslateSenseTranslator(
        sourceLanguage,
        targetLanguage
      );

      return await translator.translate(text);
    } catch (error) {
      activeTranslators.delete(`${sourceLanguage}->${targetLanguage}`);

      if (error && error.name === 'AbortError') {
        throw error;
      }

      console.warn('[TranslateSense] Built-in AI translation error:', error);
      throw new Error(
        error && error.message ? error.message : 'The Built-in AI translation failed.'
      );
    }
  }

  /**
   * Translate text while preserving HTML structure.
   */
  async function translateTranslateSenseHtml(sourceText, sourceLang, targetLang) {
    if (
      window.TranslateSenseCore &&
      typeof window.TranslateSenseCore.translateTextPreservingHtml === 'function'
    ) {
      return window.TranslateSenseCore.translateTextPreservingHtml(
        sourceText,
        (cleanText) => translateSingleWithTranslateSenseAi(cleanText, sourceLang, targetLang)
      );
    }

    return translateSingleWithTranslateSenseAi(sourceText, sourceLang, targetLang);
  }

  const browserType = detectTranslateSenseAiBrowser();

  /**
   * Get provider logo.
   */
  function getTranslateSenseAiLogo() {
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    const pluginUrl = config.pluginUrl || '';
    return pluginUrl ? `${pluginUrl}assets/img/${browserType === 'Edge' ? 'edge_ai' : 'chrome_ai'}.png` : '';
  }

  /**
   * Register TranslateSense Built-in AI provider.
   */
  window.TranslateSenseCore.registerProvider('chrome_ai', {
    title: 'Built-in AI',
    icon: '🤖',
    logo: getTranslateSenseAiLogo(),
    desc: `Private on-device translation powered by ${browserType === 'Edge' ? 'Microsoft Edge' : 'Google Chrome'} Built-in AI.`,
    category: 'browser',
    browserType: browserType.toLowerCase(),
    savesToDb: false,
    requiresApiKey: false,

    checkAvailability: function (sourceLang, targetLang, bypassCache = false) {
      return checkTranslateSenseAiAvailability(sourceLang, targetLang, bypassCache);
    },

    isLanguageSupported: function (sourceLang, targetLang) {
      return (
        TranslateSenseLanguageHelper.isSupported(sourceLang) &&
        TranslateSenseLanguageHelper.isSupported(targetLang)
      );
    },

    translate: async function ({ items, sourceLang, targetLang }, onProgressCallback) {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const results = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index] || {};
        const sourceText = item.content || item.source || '';

        try {
          const translatedText = await translateTranslateSenseHtml(
            sourceText,
            sourceLang,
            targetLang
          );

          const result = {
            hash: item.hash || '',
            source: sourceText,
            translated: translatedText,
            status: 'Local AI Completed'
          };

          results.push(result);
          if (typeof onProgressCallback === 'function') {
            onProgressCallback(result);
          }
        } catch (error) {
          if (error && error.name === 'AbortError') {
            throw error;
          }

          const errorMessage =
            error && error.message ? error.message : 'Translation failed.';

          const failedResult = {
            hash: item.hash || '',
            source: sourceText,
            translated: sourceText,
            status: 'Failed',
            error: errorMessage
          };

          results.push(failedResult);
          if (typeof onProgressCallback === 'function') {
            onProgressCallback(failedResult);
          }
        }
      }

      return results;
    }
  });

  /**
   * Gesture event types for model download & warmup.
   */
  const GESTURE_EVENTS = ['mouseup', 'mousedown', 'click', 'keydown', 'touchstart'];

  function removeGestureListeners() {
    if (!isListeningGestures) return;
    GESTURE_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, handleGestureWarmup);
      document.removeEventListener(eventName, handleGestureWarmup);
    });
    isListeningGestures = false;
  }

  function addGestureListeners() {
    if (isListeningGestures || unavailableLanguage.length === 0) return;
    GESTURE_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleGestureWarmup, { passive: true });
      document.addEventListener(eventName, handleGestureWarmup, { passive: true });
    });
    isListeningGestures = true;
  }

  async function handleGestureWarmup() {
    if (unavailableLanguage.length === 0) {
      removeGestureListeners();
      return;
    }

    if (isProcessingUnavailableQueue) return;
    isProcessingUnavailableQueue = true;

    try {
      const remainingLanguages = [];

      for (let i = 0; i < unavailableLanguage.length; i++) {
        const targetLang = unavailableLanguage[i];
        const cacheKey = getLanguagePairCacheKey('en', targetLang);

        try {
          await warmupTranslateSenseAi('en', targetLang, 'Hello');

          const checkResult = await checkTranslateSenseAiAvailability('en', targetLang, false);

          if (checkResult.available === true && checkResult.status === 'readily') {
            languageAvailabilityCache.set(cacheKey, {
              available: true,
              status: 'readily'
            });
          }
        } catch (err) {
          const errMsg = String(err && err.message ? err.message : err);
          const isGestureOrDownload =
            errMsg.toLowerCase().includes('user gesture') ||
            errMsg.toLowerCase().includes('download');

          if (isGestureOrDownload) {
            remainingLanguages.push(targetLang);
          } else {
            languageAvailabilityCache.set(cacheKey, {
              available: false,
              reason: errMsg,
              noticeType: 'error'
            });
          }
        }
      }

      unavailableLanguage = remainingLanguages;

      if (unavailableLanguage.length === 0) {
        removeGestureListeners();
      }
    } finally {
      isProcessingUnavailableQueue = false;
    }
  }

  /**
   * Pre-check languages on script load when Chrome AI provider is enabled.
   */
  async function initChromeAiLanguagePrecheck() {
    const bulkData = window.TranslateSenseBulkData || {};
    const languages = bulkData.languages || [];

    if (!Array.isArray(languages) || languages.length === 0) {
      return;
    }

    const enabledProviders = bulkData.enabledProviders;
    const isChromeAiEnabled =
      !enabledProviders ||
      (Array.isArray(enabledProviders) &&
        (enabledProviders.includes('chrome_ai') ||
          enabledProviders.includes('chrome_local_ai'))) ||
      (typeof enabledProviders === 'object' &&
        (enabledProviders.chrome_ai || enabledProviders.chrome_local_ai));

    if (!isChromeAiEnabled) {
      return;
    }

    for (let i = 0; i < languages.length; i++) {
      const item = languages[i];
      const langSlug =
        typeof item === 'object' && item !== null ? item.slug : String(item);

      if (!langSlug || langSlug.toLowerCase() === 'en') continue;

      try {
        const checkResult = await checkTranslateSenseAiAvailability('en', langSlug, false);

        const isDownloadable =
          checkResult &&
          (checkResult.status === 'downloadable');

        if (isDownloadable) {
          if (!unavailableLanguage.includes(langSlug)) {
            unavailableLanguage.push(langSlug);
          }
        }
      } catch (err) {
        console.warn(
          `[TranslateSense] Initial Chrome AI availability check failed for "${langSlug}":`,
          err
        );
      }
    }

    if (unavailableLanguage.length > 0) {
      addGestureListeners();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChromeAiLanguagePrecheck);
  } else {
    initChromeAiLanguagePrecheck();
  }
})(window);