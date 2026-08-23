/**
 * TranslateSense - DeepL Supported Languages Dataset & Utility
 * File: assets/js/providers/ai-services/deepl-languages.js
 */

(function (window) {
  'use strict';

  const DEEPL_SOURCE_LANGUAGES = [
    'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi',
    'fr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl',
    'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'zh'
  ];

  const DEEPL_TARGET_LANGUAGES = [
    'ar', 'bg', 'cs', 'da', 'de', 'el', 'en-gb', 'en-us', 'en', 'es',
    'et', 'fi', 'fr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv',
    'nb', 'nl', 'pl', 'pt-br', 'pt-pt', 'pt', 'ro', 'ru', 'sk', 'sl',
    'sv', 'tr', 'uk', 'zh', 'zh-hans'
  ];

  const DeepLLanguages = {
    getAllSources() {
      return DEEPL_SOURCE_LANGUAGES;
    },

    getAllTargets() {
      return DEEPL_TARGET_LANGUAGES;
    },

    /**
     * Normalize language code for DeepL.
     */
    formatCode(langCode, isTarget = false) {
      if (!langCode || typeof langCode !== 'string') return 'EN';
      const clean = langCode.trim().toLowerCase().replace('_', '-');
      if (isTarget) {
        if (clean === 'en' || clean === 'en-us') return 'EN-US';
        if (clean === 'en-gb') return 'EN-GB';
        if (clean === 'pt' || clean === 'pt-br') return 'PT-BR';
        if (clean === 'pt-pt') return 'PT-PT';
        if (clean === 'zh' || clean === 'zh-cn' || clean === 'zh-hans') return 'ZH';
        return clean.toUpperCase();
      }
      // Source languages are 2-letter
      return clean.split('-')[0].toUpperCase();
    },

    /**
     * Check if DeepL supports given language pair.
     */
    isSupported(sourceLang, targetLang) {
      if (!sourceLang || !targetLang) return false;
      const src = sourceLang.toLowerCase().split('-')[0];
      const tgt = targetLang.toLowerCase();
      const tgtBase = tgt.split('-')[0];

      const srcValid = DEEPL_SOURCE_LANGUAGES.includes(src);
      const tgtValid = DEEPL_TARGET_LANGUAGES.includes(tgt) || DEEPL_TARGET_LANGUAGES.includes(tgtBase);

      return srcValid && tgtValid;
    }
  };

  window.TranslateSenseDeepLLanguages = DeepLLanguages;
})(window);
