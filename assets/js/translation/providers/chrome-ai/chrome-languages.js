/**
 * TranslateSense - Chrome Built-in Local AI Supported Languages Dataset
 * File: assets/js/providers/chrome-ai/chrome-languages.js
 */

(function (window) {
  'use strict';

  // Standard on-device language codes supported by Chromium Translation API (Chrome 128+)
  const CHROME_AI_SUPPORTED_LANGUAGES = [
    'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi',
    'fr', 'hi', 'hr', 'hu', 'id', 'it', 'iw', 'ja', 'kn', 'ko',
    'lt', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl',
    'sv', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh', 'zh-hant'
  ];

  const ChromeLanguages = {
    /**
     * Get list of supported language codes.
     * @returns {Array<string>}
     */
    getAll() {
      return CHROME_AI_SUPPORTED_LANGUAGES;
    },

    /**
     * Normalize language code for Chrome AI (e.g., 'he' -> 'iw', 'zh-cn' -> 'zh').
     * @param {string} langCode
     * @returns {string}
     */
    formatCode(langCode) {
      if (!langCode || typeof langCode !== 'string') return 'en';
      const clean = langCode.trim().toLowerCase().replace('_', '-');
      if (clean === 'he') return 'iw';
      if (clean === 'nb' || clean === 'nn') return 'no';
      if (clean === 'zh-cn' || clean === 'zh-hans') return 'zh';
      return clean.split('-')[0];
    },

    /**
     * Check if a language code is supported by Chrome Local AI.
     * @param {string} langCode
     * @returns {boolean}
     */
    isSupported(langCode) {
      if (!langCode) return false;
      const formatted = this.formatCode(langCode);
      return CHROME_AI_SUPPORTED_LANGUAGES.includes(formatted);
    }
  };

  window.TranslateSenseChromeLanguages = ChromeLanguages;
})(window);
