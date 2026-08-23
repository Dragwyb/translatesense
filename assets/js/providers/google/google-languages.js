/**
 * TranslateSense - Google Translate Supported Languages Dataset & Utility
 * File: assets/js/providers/google/google-languages.js
 */

(function (window) {
  'use strict';

  // Comprehensive Google Translate supported language codes (ISO 639-1 / BCP-47)
  const GOOGLE_SUPPORTED_LANGUAGES = [
    'aa', 'ab', 'ace', 'ach', 'af', 'ak', 'alz', 'am', 'ar', 'as', 'av', 'awa', 'ay', 'az',
    'ba', 'bal', 'ban', 'bbc', 'bci', 'be', 'bem', 'bew', 'bg', 'bho', 'bik', 'bm', 'bm-nkoo',
    'bn', 'bo', 'br', 'bs', 'btx', 'bts', 'bua', 'ca', 'ce', 'ceb', 'cgg', 'ch', 'chk', 'chm',
    'ckb', 'cnh', 'co', 'crh', 'crh-latn', 'crs', 'cs', 'cv', 'cy', 'da', 'de', 'din', 'doi',
    'dov', 'dv', 'dyu', 'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'fa-af', 'ff',
    'fi', 'fj', 'fo', 'fon', 'fr', 'fr-ca', 'fur', 'fy', 'ga', 'gaa', 'gd', 'gl', 'gn', 'gom',
    'gu', 'gv', 'ha', 'haw', 'hi', 'hil', 'hmn', 'hr', 'hrx', 'ht', 'hu', 'hy', 'iba', 'id',
    'ig', 'ilo', 'is', 'it', 'iu', 'iu-latn', 'iw', 'ja', 'jam', 'jw', 'ka', 'kac', 'kek',
    'kg', 'kha', 'kk', 'kl', 'km', 'kn', 'ko', 'kri', 'ktu', 'ku', 'kv', 'ky', 'la', 'lb',
    'lg', 'li', 'lij', 'lmo', 'ln', 'lo', 'lt', 'ltg', 'lua', 'luo', 'lus', 'lv', 'mad', 'mai',
    'mak', 'mam', 'mfe', 'mg', 'mh', 'mi', 'min', 'mk', 'ml', 'mn', 'mni-mtei', 'mr', 'ms',
    'ms-arab', 'mt', 'mwr', 'my', 'ndc-zw', 'ne', 'new', 'nhe', 'nl', 'no', 'nr', 'nso', 'nus',
    'ny', 'oc', 'om', 'or', 'os', 'pa', 'pa-arab', 'pag', 'pam', 'pap', 'pl', 'ps', 'pt',
    'pt-pt', 'qu', 'rn', 'ro', 'rom', 'ru', 'rw', 'sa', 'sah', 'sat', 'sat-latn', 'scn', 'sd',
    'se', 'sg', 'shn', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sus',
    'sv', 'sw', 'szl', 'ta', 'tcy', 'te', 'tet', 'tg', 'th', 'ti', 'tiv', 'tk', 'tl', 'tn',
    'to', 'tpi', 'tr', 'trp', 'ts', 'tt', 'tum', 'ty', 'tyv', 'udm', 'ug', 'uk', 'ur', 'uz',
    've', 'vec', 'vi', 'war', 'wo', 'xh', 'yi', 'yo', 'yua', 'zap', 'zh', 'zh-cn', 'zh-tw', 'zu'
  ];

  const GoogleLanguages = {
    /**
     * Get all supported Google language codes.
     * @returns {Array<string>}
     */
    getAll() {
      return GOOGLE_SUPPORTED_LANGUAGES;
    },

    /**
     * Standardize language code format for Google Translate (e.g., 'zh_CN' -> 'zh-CN').
     * @param {string} langCode
     * @returns {string}
     */
    formatCode(langCode) {
      if (!langCode || typeof langCode !== 'string') return 'en';
      const clean = langCode.trim().toLowerCase().replace('_', '-');
      if (clean === 'zh') return 'zh-cn';
      if (clean === 'zh-hant') return 'zh-tw';
      if (clean === 'zh-hans') return 'zh-cn';
      if (clean === 'he') return 'iw';
      if (clean === 'jv') return 'jw';
      return clean;
    },

    /**
     * Check if a language code is supported by Google Translate.
     * @param {string} langCode
     * @returns {boolean}
     */
    isSupported(langCode) {
      if (!langCode) return false;
      const formatted = this.formatCode(langCode);
      const base = formatted.split('-')[0];
      return GOOGLE_SUPPORTED_LANGUAGES.includes(formatted) || GOOGLE_SUPPORTED_LANGUAGES.includes(base);
    }
  };

  window.TranslateSenseGoogleLanguages = GoogleLanguages;
})(window);
