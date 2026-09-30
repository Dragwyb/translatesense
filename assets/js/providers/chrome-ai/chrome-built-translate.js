/**
 * TranslateSense - Built-in AI Translation Provider
 *
 * File:
 * assets/js/providers/chrome-ai/chrome-built-translate.js
 *
 * Provides client-side translation through supported Chromium
 * on-device translation APIs in Google Chrome and Microsoft Edge.
 *
 * Supported API implementations:
 * - window.translation
 * - window.ai.translator
 * - window.Translator
 */

(function (window) {
  'use strict';

  /**
   * TranslateSense core must be available before registering this provider.
   */
  if (!window.TranslateSenseCore) {
    console.error(
      '[TranslateSense] TranslateSenseCore must be loaded before chrome-built-translate.js.'
    );

    return;
  }

  /**
   * TranslateSense language helper.
   *
   * The provider only relies on these two methods:
   * - isSupported()
   * - formatCode()
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
   * Detect the browser supported by TranslateSense Built-in AI.
   *
   * @returns {string} Chrome|Edge|Other
   */
  function detectTranslateSenseAiBrowser() {
    const navigatorObject = window.navigator;

    /**
     * Prefer User-Agent Client Hints when available.
     */
    if (
      navigatorObject.userAgentData &&
      Array.isArray(navigatorObject.userAgentData.brands)
    ) {
      const brands = navigatorObject.userAgentData.brands;

      if (
        brands.some(function (brand) {
          return brand.brand === 'Microsoft Edge';
        })
      ) {
        return 'Edge';
      }

      if (
        brands.some(function (brand) {
          return brand.brand === 'Google Chrome';
        })
      ) {
        return 'Chrome';
      }
    }

    /**
     * Fall back to User-Agent detection.
     */
    const userAgent = navigatorObject.userAgent || '';

    if (userAgent.indexOf('Edg/') !== -1) {
      return 'Edge';
    }

    if (
      userAgent.indexOf('Chrome/') !== -1 &&
      userAgent.indexOf('Edg/') === -1
    ) {
      return 'Chrome';
    }

    return 'Other';
  }

  /**
   * Get the browser-specific flags URL used by TranslateSense.
   *
   * @param {string} browserType
   * @param {string} flag
   * @returns {string}
   */
  function getTranslateSenseBrowserFlagUrl(browserType, flag) {
    const browserUrl =
      browserType === 'Edge'
        ? 'edge://flags/'
        : 'chrome://flags/';

    return `${browserUrl}#${flag}`;
  }

  /**
   * Detect the available Translator API implementation.
   *
   * This keeps API detection in one place so the capability check
   * and translation process use the same API selection logic.
   *
   * @returns {Object|null}
   */
  function getTranslateSenseTranslatorApi() {
    /**
     * Current/experimental Translation API implementation.
     */
    if (
      window.translation &&
      typeof window.translation.createTranslator === 'function'
    ) {
      return {
        type: 'translation',
        create: function (options) {
          return window.translation.createTranslator(options);
        }
      };
    }

    /**
     * Older/experimental AI Translator implementation.
     */
    if (
      window.ai &&
      window.ai.translator &&
      typeof window.ai.translator.create === 'function'
    ) {
      return {
        type: 'ai-translator',
        create: function (options) {
          return window.ai.translator.create(options);
        }
      };
    }

    /**
     * Translator API implementation.
     */
    if (
      window.Translator &&
      typeof window.Translator.create === 'function'
    ) {
      return {
        type: 'translator',
        create: function (options) {
          return window.Translator.create(options);
        }
      };
    }

    return null;
  }

  /**
   * Check whether the selected language is supported by
   * TranslateSense's built-in AI language mapping.
   *
   * @param {string} language
   * @returns {boolean}
   */
  function isTranslateSenseLanguageSupported(language) {
    const formattedLanguage =
      TranslateSenseLanguageHelper.formatCode(language);

    return TranslateSenseLanguageHelper.isSupported(
      formattedLanguage
    );
  }

  /**
   * Check Built-in AI translation capability for a language pair.
   *
   * The result intentionally keeps the same structure used by
   * the existing TranslateSense provider integration:
   *
   * {
   *     available: Boolean,
   *     reason: String,
   *     noticeType: String,
   *     type: String
   * }
   *
   * @param {string} sourceLang
   * @param {string} targetLang
   * @returns {Promise<Object>}
   */
  async function checkTranslateSenseAiAvailability(
    sourceLang,
    targetLang
  ) {
    const browserType = detectTranslateSenseAiBrowser();

    /**
     * ---------------------------------------------------------
     * Browser support
     * ---------------------------------------------------------
     */
    if (browserType === 'Other') {
      return {
        available: false,
        reason:
          'TranslateSense Built-in AI translation requires Google Chrome or Microsoft Edge.',
        noticeType: 'info',
        type: 'browser'
      };
    }

    /**
     * ---------------------------------------------------------
     * Secure context
     * ---------------------------------------------------------
     *
     * Use the browser-provided secure-context state instead of
     * manually checking the protocol or hostname.
     */
    if (!window.isSecureContext) {
      const browserUrl =
        browserType === 'Edge' ? 'edge' : 'chrome';

      return {
        available: false,
        reason:
          `${browserType} Built-in AI translation requires a secure connection (HTTPS) or localhost. ` +
          `For local development, configure ${browserUrl}://flags/#unsafely-treat-insecure-origin-as-secure.`,
        noticeType: 'warning',
        type: 'notSecure'
      };
    }

    const sourceLanguage =
      TranslateSenseLanguageHelper.formatCode(sourceLang);

    const targetLanguage =
      TranslateSenseLanguageHelper.formatCode(targetLang);

    /**
     * ---------------------------------------------------------
     * Source language
     * ---------------------------------------------------------
     */
    if (!isTranslateSenseLanguageSupported(sourceLanguage)) {
      return {
        available: false,
        reason:
          `Language ${sourceLang} is not supported by ${browserType} Built-in AI translation.`,
        noticeType: 'warning',
        type: 'sourceLangNotSupported'
      };
    }

    /**
     * ---------------------------------------------------------
     * Target language
     * ---------------------------------------------------------
     */
    if (!isTranslateSenseLanguageSupported(targetLanguage)) {
      return {
        available: false,
        reason:
          `Language ${targetLang} is not supported by ${browserType} Built-in AI translation.`,
        noticeType: 'warning',
        type: 'targetLangNotSupported'
      };
    }

    /**
     * ---------------------------------------------------------
     * Translator API detection
     * ---------------------------------------------------------
     */
    const translatorApi = getTranslateSenseTranslatorApi();

    /**
     * ---------------------------------------------------------
     * Translation API availability
     * ---------------------------------------------------------
     *
     * The current window.translation API exposes canTranslate().
     * When available, use it to determine the language-pair state.
     */
    if (
      window.translation &&
      typeof window.translation.canTranslate === 'function'
    ) {
      try {
        const status =
          await window.translation.canTranslate({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage
          });

        /**
         * Translation model is already available.
         */
        if (status === 'readily') {
          return {
            available: true
          };
        }

        /**
         * Translation is supported but the model/language
         * pack needs to be downloaded.
         */
        if (
          status === 'after-download' ||
          status === 'downloadable'
        ) {
          return {
            available: true,
            reason:
              `${browserType} is downloading the required language pack in the background. ` +
              'The first translation might take a few seconds.',
            noticeType: 'info',
            type: 'downloadable'
          };
        }

        /**
         * The requested language pair is not supported.
         */
        if (status === 'no') {
          return {
            available: false,
            reason:
              `Language pair (${sourceLanguage} → ${targetLanguage}) cannot be translated by the current ${browserType} on-device model.`,
            noticeType: 'warning',
            type: 'languagePairNotSupported'
          };
        }

        /**
         * Language model is currently downloading.
         */
        if (status === 'downloading') {
          return {
            available: false,
            reason:
              `The required ${browserType} translation language pack is currently downloading. Please wait for the download to complete.`,
            noticeType: 'info',
            type: 'downloading'
          };
        }

        /**
         * Browser requires a user gesture before the model
         * can be downloaded.
         */
        if (status === 'requires-user-gesture') {
          return {
            available: false,
            reason:
              `${browserType} requires a user action before the translation model can be downloaded.`,
            noticeType: 'info',
            type: 'requires-user-gesture'
          };
        }

        /**
         * Model download did not finish.
         */
        if (status === 'download-timeout') {
          return {
            available: false,
            reason:
              `The ${browserType} translation model could not be loaded completely. Please check the browser's language model status and try again.`,
            noticeType: 'warning',
            type: 'download-timeout'
          };
        }

        /**
         * Keep the existing fallback behavior for an
         * unavailable/unknown language model state.
         */
        if (status === 'unavailable') {
          return {
            available: false,
            reason:
              `The required ${browserType} translation language pack is not currently available.`,
            noticeType: 'warning',
            type: 'language-pack-not-installed'
          };
        }
      } catch (error) {
        console.warn(
          `[TranslateSense] ${browserType} Translator API capability check failed:`,
          error
        );

        /**
         * Do not immediately fail here.
         *
         * Another supported Translator API implementation
         * may still be available below.
         */
      }
    }

    /**
     * ---------------------------------------------------------
     * Translator API exists but does not expose canTranslate()
     * ---------------------------------------------------------
     *
     * This preserves compatibility with the other Translator API
     * implementations already supported by TranslateSense.
     */
    if (translatorApi) {
      return {
        available: true
      };
    }

    /**
     * ---------------------------------------------------------
     * Prompt API capability
     * ---------------------------------------------------------
     *
     * This is only a fallback capability signal.
     *
     * Prompt API availability does NOT prove that the Translator
     * API is available. Therefore this should not be used as the
     * translation API's primary availability result.
     */
    if (
      window.ai &&
      window.ai.languageModel &&
      typeof window.ai.languageModel.capabilities ===
      'function'
    ) {
      try {
        const capabilities =
          await window.ai.languageModel.capabilities();

        if (
          capabilities &&
          capabilities.available !== 'no'
        ) {
          return {
            available: false,
            reason:
              `${browserType} on-device AI is available, but the Built-in Translator API is not currently available.`,
            noticeType: 'info',
            type: 'translation-api-not-available'
          };
        }
      } catch (error) {
        console.warn(
          `[TranslateSense] ${browserType} LanguageModel capability check failed:`,
          error
        );
      }
    }

    /**
     * ---------------------------------------------------------
     * Translator API unavailable
     * ---------------------------------------------------------
     */
    const translationFlagUrl =
      getTranslateSenseBrowserFlagUrl(
        browserType,
        'translation-api'
      );

    return {
      available: false,
      reason:
        `${browserType} Built-in AI translation API is not available in this browser. ` +
        `If you are using an experimental browser build, enable the Experimental translation API at ${translationFlagUrl}.`,
      noticeType: 'warning',
      type: 'translation-api-not-available'
    };
  }

  /**
   * Translate one piece of text using the available
   * TranslateSense Built-in AI Translator API.
   *
   * @param {string} text
   * @param {string} sourceLang
   * @param {string} targetLang
   * @returns {Promise<string>}
   */
  async function translateSingleWithTranslateSenseAi(
    text,
    sourceLang,
    targetLang
  ) {
    if (
      typeof text !== 'string' ||
      text.trim() === ''
    ) {
      return text;
    }

    const sourceLanguage =
      TranslateSenseLanguageHelper.formatCode(sourceLang);

    const targetLanguage =
      TranslateSenseLanguageHelper.formatCode(targetLang);

    const translatorApi =
      getTranslateSenseTranslatorApi();

    if (!translatorApi) {
      throw new Error(
        'The TranslateSense Built-in AI translation engine is not available in this browser.'
      );
    }

    try {
      const translator = await translatorApi.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      });

      if (
        !translator ||
        typeof translator.translate !== 'function'
      ) {
        throw new Error(
          'The Built-in AI translation engine could not create a valid translator.'
        );
      }

      return await translator.translate(text);
    } catch (error) {
      /**
       * Preserve AbortError so the caller can cancel the
       * complete translation operation correctly.
       */
      if (error && error.name === 'AbortError') {
        throw error;
      }

      const browserType =
        detectTranslateSenseAiBrowser();

      console.warn(
        `[TranslateSense] ${browserType} Built-in AI translation failed:`,
        error
      );

      throw new Error(
        error && error.message
          ? error.message
          : 'The Built-in AI translation failed.'
      );
    }
  }

  /**
   * Translate text while preserving the HTML structure handled
   * by TranslateSenseCore.
   *
   * @param {string} sourceText
   * @param {string} sourceLang
   * @param {string} targetLang
   * @returns {Promise<string>}
   */
  async function translateTranslateSenseHtml(
    sourceText,
    sourceLang,
    targetLang
  ) {
    if (
      window.TranslateSenseCore &&
      typeof window.TranslateSenseCore
        .translateTextPreservingHtml === 'function'
    ) {
      return window.TranslateSenseCore.translateTextPreservingHtml(
        sourceText,
        function (cleanText) {
          return translateSingleWithTranslateSenseAi(
            cleanText,
            sourceLang,
            targetLang
          );
        }
      );
    }

    return translateSingleWithTranslateSenseAi(
      sourceText,
      sourceLang,
      targetLang
    );
  }

  /**
   * Get the TranslateSense Built-in AI provider logo.
   *
   * @returns {string}
   */
  function getTranslateSenseAiLogo() {
    const editorData =
      window.TranslateSenseEditorData ||
      window.TranslateSenseBulkData ||
      {};

    const pluginUrl = editorData.pluginUrl || '';

    return pluginUrl
      ? `${pluginUrl}assets/img/chrome_ai.png`
      : '';
  }

  /**
   * Register TranslateSense Built-in AI provider.
   */
  window.TranslateSenseCore.registerProvider('chrome_ai', {
    title: 'Built-in AI',
    icon: '🤖',
    logo: getTranslateSenseAiLogo(),

    desc:
      'Private on-device translation powered by Google Chrome and Microsoft Edge Built-in AI.',

    category: 'browser',

    savesToDb: false,
    requiresApiKey: false,

    /**
     * Check whether Built-in AI translation is available.
     */
    checkAvailability: function (
      sourceLang,
      targetLang
    ) {
      return checkTranslateSenseAiAvailability(
        sourceLang,
        targetLang
      );
    },

    /**
     * Check whether both languages are supported by
     * TranslateSense's Built-in AI language mapping.
     */
    isLanguageSupported: function (
      sourceLang,
      targetLang
    ) {
      return (
        isTranslateSenseLanguageSupported(
          sourceLang
        ) &&
        isTranslateSenseLanguageSupported(
          targetLang
        )
      );
    },

    /**
     * Translate items using browser-based on-device AI.
     *
     * Translation is performed locally in the user's browser.
     *
     * @param {Object} params
     * @param {Array<Object>} params.items
     * @param {string} params.sourceLang
     * @param {string} params.targetLang
     * @param {number} [params.postId]
     * @param {Function} onProgressCallback
     * @returns {Promise<Array<Object>>}
     */
    translate: async function (
      { items, sourceLang, targetLang },
      onProgressCallback
    ) {
      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return [];
      }

      const results = [];

      for (
        let index = 0;
        index < items.length;
        index++
      ) {
        const item = items[index] || {};

        const sourceText =
          item.content ||
          item.source ||
          '';

        try {
          const translatedText =
            await translateTranslateSenseHtml(
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

          if (
            typeof onProgressCallback ===
            'function'
          ) {
            onProgressCallback(result);
          }
        } catch (error) {
          /**
           * AbortError means the user cancelled the
           * operation. Do not convert it into a normal
           * failed translation result.
           */
          if (
            error &&
            error.name === 'AbortError'
          ) {
            throw error;
          }

          const errorMessage =
            error && error.message
              ? error.message
              : 'Translation failed.';

          console.warn(
            `[TranslateSense] Built-in AI translation failed for item #${index}:`,
            error
          );

          const failedResult = {
            hash: item.hash || '',
            source: sourceText,
            translated: sourceText,
            status: 'Failed',
            error: errorMessage
          };

          results.push(failedResult);

          if (
            typeof onProgressCallback ===
            'function'
          ) {
            onProgressCallback(failedResult);
          }
        }
      }

      return results;
    }
  });
})(window);