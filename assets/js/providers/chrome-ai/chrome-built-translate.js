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
   * Detailed map of supported language codes to human-readable names.
   */
  const CHROME_AI_LANGUAGE_NAMES = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', 'zh-hant': 'Traditional Chinese',
    ar: 'Arabic', hi: 'Hindi', bn: 'Bengali', cs: 'Czech', da: 'Danish',
    el: 'Greek', fi: 'Finnish', hr: 'Croatian', hu: 'Hungarian', id: 'Indonesian',
    iw: 'Hebrew', kn: 'Kannada', ko: 'Korean', lt: 'Lithuanian', mr: 'Marathi',
    nl: 'Dutch', no: 'Norwegian', pl: 'Polish', ro: 'Romanian', sk: 'Slovak',
    sl: 'Slovenian', sv: 'Swedish', ta: 'Tamil', te: 'Telugu', th: 'Thai',
    tr: 'Turkish', uk: 'Ukrainian', vi: 'Vietnamese', bg: 'Bulgarian'
  };

  /**
   * Escape HTML entities to prevent injection in generated guidance HTML.
   *
   * @param {*} text
   * @returns {string}
   */
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get human-readable language label (e.g., 'English (en)').
   *
   * @param {string} code
   * @returns {string}
   */
  function getLanguageDisplayName(code) {
    if (!code) return '';
    const clean = String(code).toLowerCase().trim();
    const formatted = TranslateSenseLanguageHelper.formatCode(clean);
    const name = CHROME_AI_LANGUAGE_NAMES[formatted] || CHROME_AI_LANGUAGE_NAMES[clean];
    return name ? `${name} (${clean})` : clean.toUpperCase();
  }

  /**
   * Detect detailed browser identity and configuration URL scheme.
   *
   * @returns {{ name: string, type: 'Chrome'|'Edge'|'Other', scheme: string }}
   */
  function getDetailedBrowserInfo() {
    const nav = window.navigator || {};
    const userAgent = nav.userAgent || '';
    const brands =
      nav.userAgentData && Array.isArray(nav.userAgentData.brands)
        ? nav.userAgentData.brands
        : [];

    if (brands.some((b) => b.brand === 'Microsoft Edge') || userAgent.indexOf('Edg/') !== -1) {
      return {
        name: 'Microsoft Edge',
        type: 'Edge',
        scheme: 'edge'
      };
    }

    if (
      brands.some((b) => b.brand === 'Google Chrome') ||
      (userAgent.indexOf('Chrome/') !== -1 && userAgent.indexOf('Edg/') === -1)
    ) {
      if (nav.brave && typeof nav.brave.isBrave === 'function') {
        return {
          name: 'Brave Browser',
          type: 'Other',
          scheme: 'brave'
        };
      }
      if (userAgent.indexOf('OPR/') !== -1 || userAgent.indexOf('Opera/') !== -1) {
        return {
          name: 'Opera',
          type: 'Other',
          scheme: 'opera'
        };
      }
      if (userAgent.indexOf('Vivaldi/') !== -1) {
        return {
          name: 'Vivaldi',
          type: 'Other',
          scheme: 'chrome'
        };
      }
      return {
        name: 'Google Chrome',
        type: 'Chrome',
        scheme: 'chrome'
      };
    }

    if (userAgent.indexOf('Firefox/') !== -1) {
      return {
        name: 'Mozilla Firefox',
        type: 'Other',
        scheme: 'about'
      };
    }

    if (userAgent.indexOf('Safari/') !== -1 && userAgent.indexOf('Chrome/') === -1) {
      return {
        name: 'Apple Safari',
        type: 'Other',
        scheme: ''
      };
    }

    return {
      name: 'Unsupported Browser',
      type: 'Other',
      scheme: 'chrome'
    };
  }

  /**
   * Detect the browser supported by TranslateSense Built-in AI.
   *
   * @returns {string} Chrome|Edge|Other
   */
  function detectTranslateSenseAiBrowser() {
    return getDetailedBrowserInfo().type;
  }

  /**
   * Get a clean, professional error/status title for a reason type.
   *
   * @param {string} reasonType
   * @param {Object} [context={}]
   * @returns {string}
   */
  function getTranslateSenseAiReasonTitle(reasonType, context = {}) {
    switch (reasonType) {
      case 'browser':
        return 'Browser Not Supported';
      case 'notSecure':
        return 'Secure Context (HTTPS) Required';
      case 'translation-api-not-available':
        return 'Translation API Not Enabled';
      case 'downloadable':
        return 'Language Pack Downloadable';
      case 'downloading':
        return 'Language Pack Downloading';
      case 'requires-user-gesture':
        return 'User Action Required';
      case 'languagePairNotSupported':
        return 'Language Pair Not Supported';
      case 'download-timeout':
        return 'Model Download Timed Out';
      case 'language-pack-not-installed':
        return 'Language Pack Unavailable';
      case 'sourceLangNotSupported':
        return 'Source Language Not Supported';
      case 'targetLangNotSupported':
        return 'Target Language Not Supported';
      case 'warmup-error':
      default:
        return 'Translation Initialization Error';
    }
  }

  /**
   * Generate action button HTML link based on browserType.
   *
   * @param {string} [type='docs'] 'docs' | 'languages' | 'setup'
   * @param {string} [browserType]
   * @returns {string} HTML string
   */
  function getTranslateSenseAiActionHtml(type = 'docs', browserType) {
    const browserInfo = getDetailedBrowserInfo();
    const resolvedBrowserType = browserType || browserInfo.type;
    const isEdge = resolvedBrowserType === 'Edge';
    const isChrome = resolvedBrowserType === 'Chrome';

    let url;
    let label;

    if (isEdge) {
      url = 'https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api';
      if (type === 'languages') {
        label = 'Supported Languages &#x2197;';
      } else if (type === 'setup') {
        label = 'Edge AI Setup Guide &#x2197;';
      } else {
        label = 'Edge AI Docs &#x2197;';
      }
    } else {
      if (type === 'languages') {
        url = 'https://developer.chrome.com/docs/ai/translator-api#supported_languages';
        label = 'Supported Languages &#x2197;';
      } else if (type === 'setup') {
        url = 'https://developer.chrome.com/docs/ai/translator-api';
        label = isChrome ? 'Chrome AI Setup Guide &#x2197;' : 'Local AI Setup Guide &#x2197;';
      } else {
        url = 'https://developer.chrome.com/docs/ai/translator-api';
        label = isChrome ? 'Chrome AI Docs &#x2197;' : 'Local AI Docs &#x2197;';
      }
    }

    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="ts-bulk-btn ts-bulk-btn-primary">${label}</a>`;
  }

  /**
   * Build structured HTML guidance (clean, professional ul/li steps with dynamic browser guidance, URLs, and docs).
   *
   * @param {string} reasonType
   * @param {Object} [context={}]
   * @returns {string} HTML string
   */
  function buildTranslateSenseAiReasonHtml(reasonType, context = {}) {
    const browserInfo = getDetailedBrowserInfo();
    const browserType = context.browserType || browserInfo.type;
    const browserName = context.browserName || (browserType === 'Edge' ? 'Microsoft Edge' : (browserType === 'Chrome' ? 'Google Chrome' : browserInfo.name));
    const scheme = context.scheme || browserInfo.scheme || (browserType === 'Edge' ? 'edge' : 'chrome');
    const sourceDisplay = getLanguageDisplayName(context.sourceLanguage || context.sourceLang || 'en');
    const targetDisplay = getLanguageDisplayName(context.targetLanguage || context.targetLang || '');
    const currentOrigin = escapeHtml(context.currentOrigin || (window.location && window.location.origin ? window.location.origin : 'http://your-site.local'));
    const rawError = escapeHtml(context.error || context.reason || '');

    const copyOnClick = "if(navigator.clipboard){navigator.clipboard.writeText(this.textContent.trim());const orig=this.style.outline;this.style.outline='2px solid #4f46e5';setTimeout(()=>{this.style.outline=orig;},1200);}";
    const makeCode = (url) => `<code class="ts-code-pill" onclick="${copyOnClick}" title="Click to copy url to clipboard">${escapeHtml(url)}</code>`;
    const makeDocLink = (url, label) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="ts-doc-link">${escapeHtml(label)} &#x2197;</a>`;

    const refDocUrl = browserType === 'Edge'
      ? 'https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api'
      : 'https://developer.chrome.com/docs/ai/translator-api';
    const langDocUrl = browserType === 'Edge'
      ? 'https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api'
      : 'https://developer.chrome.com/docs/ai/translator-api#supported_languages';

    const refDocLink = makeDocLink(refDocUrl, `${escapeHtml(browserName)} Local AI Translation Reference`);
    const langDocLink = makeDocLink(langDocUrl, `${escapeHtml(browserName)} Supported Languages Reference`);

    let steps = [];

    switch (reasonType) {
      case 'browser':
        steps = [
          `Built-in AI runs locally on your device and requires <strong>Google Chrome</strong> (v131+) or <strong>Microsoft Edge</strong> (v131+).`,
          `To use local AI, please open your WordPress dashboard in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.`,
          `<strong>Alternative:</strong> If you prefer to stay in ${escapeHtml(browserName)}, choose <strong>OpenAI</strong> or <strong>Google Gemini AI</strong> to translate without any special browser requirements.`,
          `Reference: ${refDocLink}`
        ];
        break;

      case 'notSecure':
        steps = [
          `The browser blocks offline AI models on insecure (<code>http://</code>) connections to protect your privacy.`,
          `<strong>Recommended:</strong> Open your WordPress site using a secure address with an SSL certificate (<strong>HTTPS</strong>).`,
          `<strong>For Local Development:</strong>
            <div style="margin-top:6px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;line-height:1.6;">
              1. Open this flag in a new tab: ${makeCode(`${scheme}://flags/#unsafely-treat-insecure-origin-as-secure`)}<br/>
              2. Change it to <strong>Enabled</strong>, add your site origin ${makeCode(currentOrigin)}, and click <strong>Relaunch</strong>.
            </div>`,
          `<strong>Alternative:</strong> Switch to <strong>OpenAI</strong> or <strong>Gemini AI</strong>, which work on both HTTP and HTTPS.`
        ];
        break;

      case 'translation-api-not-available':
        steps = [
          `<strong>Step 1 (Enable Translation):</strong> Open ${makeCode(`${scheme}://flags/#translation-api`)} and set it to <strong>Enabled</strong>.`,
          `<strong>Step 2 (Enable AI Model):</strong> Open ${makeCode(`${scheme}://flags/#optimization-guide-on-device-model`)} and set it to <strong>Enabled BypassPrefRequirement</strong>.`,
          `<strong>Step 3 (Relaunch):</strong> Click the <strong>Relaunch</strong> button at the bottom of the flags page to apply changes.`,
          `<strong>Step 4 (Download Model):</strong> Open ${makeCode(`${scheme}://components`)}, locate <em>Optimization Guide On Device Model</em>, and click <strong>Check for update</strong>.`,
          `Reference: ${refDocLink}`
        ];
        break;

      case 'downloadable':
        steps = [
          `Translation from <strong>${sourceDisplay}</strong> to <strong>${targetDisplay}</strong> is supported.`,
          `The translation model (~20MB–100MB) will download automatically in the background when translation starts.`,
          `Ensure your device is connected to the internet, then click <strong>Start Translation</strong> to begin.`
        ];
        break;

      case 'downloading':
        steps = [
          `${escapeHtml(browserName)} is currently downloading the language pack for <strong>${sourceDisplay} &rarr; ${targetDisplay}</strong>.`,
          `Downloads usually take 15–45 seconds depending on your connection speed.`,
          `Please leave this tab open. It will automatically switch to ready once completed.`
        ];
        break;

      case 'requires-user-gesture':
        steps = [
          `${escapeHtml(browserName)} requires your authorization before downloading the offline translation model.`,
          `<strong>To authorize:</strong> Simply click anywhere inside this dialog or press any key on your keyboard.`,
          `TranslateSense is listening and will immediately start the download upon your interaction.`
        ];
        break;

      case 'languagePairNotSupported':
        steps = [
          `The local model does not currently support translating directly between <strong>${sourceDisplay}</strong> and <strong>${targetDisplay}</strong>.`,
          `<strong>Solution:</strong> Switch to <strong>Google Gemini AI</strong> or <strong>OpenAI (GPT-4o)</strong> in the provider list for 100+ supported languages.`,
          `Reference: ${langDocLink}`
        ];
        break;

      case 'download-timeout':
        steps = [
          `The translation model could not complete downloading.`,
          `Ensure you have at least <strong>22 GB free disk space</strong> on your system drive.`,
          `Open ${makeCode(`${scheme}://components`)}, locate <em>Optimization Guide On Device Model</em>, and click <strong>Check for update</strong>.`,
          `Restart ${escapeHtml(browserName)} and try again.`,
          `Reference: ${refDocLink}`
        ];
        break;

      case 'language-pack-not-installed':
        steps = [
          `The required language pack for <strong>${sourceDisplay} &rarr; ${targetDisplay}</strong> is not installed in the browser.`,
          `Verify that flags at ${makeCode(`${scheme}://flags/#translation-api`)} and ${makeCode(`${scheme}://flags/#optimization-guide-on-device-model`)} are Enabled.`,
          `Open ${makeCode(`${scheme}://components`)} and ensure all Translation components are updated.`,
          `<strong>Alternative:</strong> Use <strong>Gemini AI</strong> or <strong>OpenAI</strong> to translate immediately without downloading files.`,
          `Reference: ${refDocLink}`
        ];
        break;

      case 'sourceLangNotSupported':
        steps = [
          `The source language (<code>${escapeHtml(context.sourceLang || context.sourceLanguage)}</code>) is not supported by Built-in AI.`,
          `Select <strong>Google Gemini AI</strong> or <strong>OpenAI (GPT-4o)</strong> for full support of this language.`,
          `Reference: ${langDocLink}`
        ];
        break;

      case 'targetLangNotSupported':
        steps = [
          `The target language (<code>${escapeHtml(context.targetLang || context.targetLanguage)}</code>) is not supported by Built-in AI.`,
          `Select <strong>Google Gemini AI</strong> or <strong>OpenAI (GPT-4o)</strong> for full support of this language.`,
          `Reference: ${langDocLink}`
        ];
        break;

      case 'warmup-error':
      default:
        steps = [
          rawError ? `Error details: <code>${rawError}</code>` : `An unexpected error occurred while initializing Built-in AI.`,
          `Verify translation flags are enabled at ${makeCode(`${scheme}://flags/#translation-api`)}.`,
          `Restart ${escapeHtml(browserName)} and try again.`,
          `<strong>Alternative:</strong> Switch to <strong>OpenAI</strong> or <strong>Gemini AI</strong> to continue translating without local setup.`,
          `Reference: ${refDocLink}`
        ];
        break;
    }

    const itemsHtml = steps
      .map((s) => `<li class="ts-guidance-step">${s}</li>`)
      .join('');

    return `
      <div class="ts-guidance-container">
        <ul class="ts-guidance-list">
          ${itemsHtml}
        </ul>
      </div>
    `.trim();
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

  function normalizeAvailabilityStatus(status, browserType, sourceLanguage, targetLanguage) {
    if (!status) return null;

    const browserInfo = getDetailedBrowserInfo();
    const resolvedBrowserType = browserType || browserInfo.type;

    if (status === 'readily' || status === 'available' || status === 'yes') {
      return { available: true, status: 'readily' };
    }

    if (status === 'after-download' || status === 'downloadable') {
      const reason = `${resolvedBrowserType} is downloading the required language pack in the background. The first translation might take a few seconds.`;
      return {
        available: true,
        status: 'downloadable',
        type: 'downloadable',
        reasonTitle: getTranslateSenseAiReasonTitle('downloadable'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('downloadable', {
          browserType: resolvedBrowserType,
          sourceLanguage,
          targetLanguage,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', resolvedBrowserType),
        noticeType: 'info'
      };
    }

    if (status === 'downloading') {
      const reason = `The required ${resolvedBrowserType} translation language pack is currently downloading. Please wait for the download to complete.`;
      return {
        available: false,
        status: 'downloading',
        type: 'downloading',
        reasonTitle: getTranslateSenseAiReasonTitle('downloading'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('downloading', {
          browserType: resolvedBrowserType,
          sourceLanguage,
          targetLanguage,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', resolvedBrowserType),
        noticeType: 'info'
      };
    }

    if (status === 'requires-user-gesture') {
      const reason = `${resolvedBrowserType} requires a user action before the translation model can be downloaded.`;
      return {
        available: false,
        status: 'requires-user-gesture',
        type: 'requires-user-gesture',
        reasonTitle: getTranslateSenseAiReasonTitle('requires-user-gesture'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('requires-user-gesture', {
          browserType: resolvedBrowserType,
          sourceLanguage,
          targetLanguage,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', resolvedBrowserType),
        noticeType: 'info'
      };
    }

    if (status === 'no' || status === 'unsupported') {
      const reason = `Language pair (${sourceLanguage} → ${targetLanguage}) cannot be translated by the current ${resolvedBrowserType} on-device model.`;
      return {
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('languagePairNotSupported'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('languagePairNotSupported', {
          browserType: resolvedBrowserType,
          sourceLanguage,
          targetLanguage,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('languages', resolvedBrowserType),
        noticeType: 'warning',
        type: 'languagePairNotSupported'
      };
    }

    if (status === 'download-timeout') {
      const reason = `The ${resolvedBrowserType} translation model could not be loaded completely. Please check the browser's language model status and try again.`;
      return {
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('download-timeout'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('download-timeout', {
          browserType: resolvedBrowserType,
          sourceLanguage,
          targetLanguage,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', resolvedBrowserType),
        noticeType: 'warning',
        type: 'download-timeout'
      };
    }

    if (status === 'unavailable' || status === 'no-download') {
      const reason = `The required ${resolvedBrowserType} translation language pack is not currently available.`;
      return {
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('language-pack-not-installed'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('language-pack-not-installed', {
          browserType: resolvedBrowserType,
          sourceLanguage,
          targetLanguage,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', resolvedBrowserType),
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

    const browserInfo = getDetailedBrowserInfo();
    const browserType = browserInfo.type;

    if (browserType === 'Other') {
      const reason = 'TranslateSense Built-in AI translation requires Google Chrome or Microsoft Edge.';
      return returnWithCache({
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('browser'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('browser', {
          browserType: 'Other',
          browserName: browserInfo.name,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', browserType),
        noticeType: 'info',
        type: 'browser'
      });
    }

    if (!window.isSecureContext) {
      const browserUrl = browserType === 'Edge' ? 'edge' : 'chrome';
      const reason =
        `${browserType} Built-in AI translation requires a secure connection (HTTPS) or localhost. ` +
        `For local development, configure ${browserUrl}://flags/#unsafely-treat-insecure-origin-as-secure.`;
      return returnWithCache({
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('notSecure'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('notSecure', {
          browserType,
          browserName: browserInfo.name,
          scheme: browserUrl,
          currentOrigin: window.location.origin,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('docs', browserType),
        noticeType: 'warning',
        type: 'notSecure'
      });
    }

    const sourceLanguage = TranslateSenseLanguageHelper.formatCode(sourceLang);
    const targetLanguage = TranslateSenseLanguageHelper.formatCode(targetLang);

    if (!TranslateSenseLanguageHelper.isSupported(sourceLanguage)) {
      const reason = `Language ${sourceLang} is not supported by ${browserType} Built-in AI translation.`;
      return returnWithCache({
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('sourceLangNotSupported'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('sourceLangNotSupported', {
          browserType,
          sourceLanguage,
          sourceLang,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('languages', browserType),
        noticeType: 'warning',
        type: 'sourceLangNotSupported'
      });
    }

    if (!TranslateSenseLanguageHelper.isSupported(targetLanguage)) {
      const reason = `Language ${targetLang} is not supported by ${browserType} Built-in AI translation.`;
      return returnWithCache({
        available: false,
        reasonTitle: getTranslateSenseAiReasonTitle('targetLangNotSupported'),
        reason: reason,
        reasonHTML: buildTranslateSenseAiReasonHtml('targetLangNotSupported', {
          browserType,
          targetLanguage,
          targetLang,
          reason
        }),
        actionHtml: getTranslateSenseAiActionHtml('languages', browserType),
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
    const reason =
      `${browserType} Built-in AI translation API is not available in this browser. ` +
      `If you are using an experimental browser build, enable the Experimental translation API at ${flagUrl}.`;

    return returnWithCache({
      available: false,
      reasonTitle: getTranslateSenseAiReasonTitle('translation-api-not-available'),
      reason: reason,
      reasonHTML: buildTranslateSenseAiReasonHtml('translation-api-not-available', {
        browserType,
        browserName: browserInfo.name,
        scheme: browserInfo.scheme,
        sourceLanguage,
        targetLanguage,
        reason
      }),
      actionHtml: getTranslateSenseAiActionHtml('setup', browserType),
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
  async function translateTranslateSenseHtml(core, sourceText, sourceLang, targetLang) {
    if (
      core &&
      typeof core.translateTextPreservingHtml === 'function'
    ) {
      return core.translateTextPreservingHtml(
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
   * Register TranslateSense Built-in AI provider on a TranslateSenseCore instance.
   *
   * @param {TranslateSenseCore} core
   */
  function registerChromeAiProvider(core) {
    if (!core || typeof core.registerProvider !== 'function') {
      return;
    }

    core.registerProvider('chrome_ai', {
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
              core,
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
  }

  // Export module for provider registration
  window.TranslateSenseChromeAi = {
    register: registerChromeAiProvider,
    checkAvailability: checkTranslateSenseAiAvailability,
    translateHtml: translateTranslateSenseHtml,
    getLogo: getTranslateSenseAiLogo,
    browserType: browserType.toLowerCase()
  };

  // Backward compatibility: If window.TranslateSenseCore is an instantiated object with registerProvider
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerProvider === 'function') {
    registerChromeAiProvider(window.TranslateSenseCore);
  }

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
              reasonTitle: getTranslateSenseAiReasonTitle('warmup-error'),
              reason: errMsg,
              reasonHTML: buildTranslateSenseAiReasonHtml('warmup-error', {
                browserType,
                targetLanguage: targetLang,
                error: errMsg
              }),
              actionHtml: getTranslateSenseAiActionHtml('docs', browserType),
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