/**
 * TranslateSense - Core Translate Registry & Provider Manager
 * File: assets/js/core-translate.js
 * 
 * Provides:
 * 1. Global registry for translation providers (registerProvider, getProviders, getProvider)
 * 2. Enable/Disable provider controls and active provider filtering
 * 3. Dynamic availability and credential validation
 * 4. Request cancellation / AbortController registry
 * 5. Standardized translation dispatching with progress callback({ hash, source, translated, status, error })
 */

(function (window) {
  'use strict';

  class TranslateSenseCore {
    constructor() {
      this.providers = new Map();
      this.pageEditors = new Map();
      this.sourceStrings = new Map();
      this.translatedStrings = new Map();
      this.activeControllers = new Set();
      this.defaultProvider = '';
      this.enabledProviders = ['chrome_ai', 'openai', 'gemini'];

      // Initialize enabled providers from localized data if available
      this.syncEnabledProviders();
    }

    /**
     * Generate MD5 hash for a string and widget/block name using SparkMD5 or internal fallback.
     * 
     * @param {string} widgetOrBlockName Block name or Elementor widget type
     * @param {string} stringValue Source string value
     * @returns {string} 32-character hexadecimal MD5 hash
     */
    generateHash(widgetOrBlockName = '', stringValue = '') {
      const payload = (widgetOrBlockName ? String(widgetOrBlockName).trim() : '') + '_' + (stringValue !== undefined ? String(stringValue) : '');
      if (typeof window !== 'undefined' && window.SparkMD5 && typeof window.SparkMD5.hash === 'function') {
        return window.SparkMD5.hash(payload);
      }
      throw new Error("SparkMD5 is not loaded");
    }

    /**
     * Save a source string with ID and source value.
     * 
     * @param {string} id Unique identifier or field name
     * @param {string} sourceValue Raw source string text
     * @param {string} [widgetOrBlockName=''] Block name, widget name, or module name
     * @returns {Object} Saved source string record { id, source, widget_id, hash, timestamp }
     */
    saveSourceString(id, sourceValue, widgetOrBlockName = '') {
      const widget = widgetOrBlockName || id || 'generic';
      const hash = this.generateHash(widget, sourceValue);

      const entry = {
        id: id || hash,
        source: sourceValue !== undefined ? String(sourceValue) : '',
        widget_id: widget,
        hash: hash,
        timestamp: Date.now(),
      };

      this.sourceStrings.set(hash, entry);
      if (id && id !== hash) {
        this.sourceStrings.set(id, entry);
      }

      return entry;
    }

    /**
     * Save a translated string with ID, source value, translated value, and provider.
     * 
     * @param {string} id Unique identifier or field name
     * @param {string} sourceValue Raw source string text
     * @param {string} translatedValue Translated string text
     * @param {string} [provider='default'] Translation provider ID (e.g. 'openai', 'gemini', 'chrome_ai')
     * @param {string} [widgetOrBlockName=''] Block name, widget name, or module name
     * @returns {Object} Saved translated string record
     */
    saveTranslatedString(id, sourceValue, filterValue, translatedValue, provider = 'default', widgetOrBlockName = '') {
      const widget = widgetOrBlockName || id || 'generic';
      const hash = this.generateHash(widget, filterValue);

      const entry = {
        id: id || hash,
        source: sourceValue !== undefined ? String(sourceValue) : '',
        filterValue: filterValue !== undefined ? String(filterValue) : '',
        translated: translatedValue !== undefined ? String(translatedValue) : '',
        provider: provider || 'default',
        widget_id: widget,
        hash: hash,
        timestamp: Date.now(),
      };

      // Save by provider-specific composite key and generic hash
      this.translatedStrings.set(`${hash}_${provider}`, entry);
      this.translatedStrings.set(hash, entry);

      if (id && id !== hash) {
        this.translatedStrings.set(`${id}_${provider}`, entry);
        this.translatedStrings.set(id, entry);
      }

      return entry;
    }

    /**
     * Get all registered source and translated strings.
     * 
     * @returns {{ source: Array<Object>, translated: Array<Object>, all: Array<Object> }}
     */
    getAllStrings() {
      const sourceList = Array.from(new Set(this.sourceStrings.values()));
      const translatedList = Array.from(new Set(this.translatedStrings.values()));

      // Composite list linking source with available translations
      const all = sourceList.map((src) => {
        const trans = this.getTranslatedString(src.id, src.value, null, src.widget_id);
        return {
          ...src,
          translated: trans || '',
        };
      });

      return {
        source: sourceList,
        translated: translatedList,
        all: all,
      };
    }

    /**
     * Get translated string by ID, source value, and optional provider.
     * 
     * @param {string} id Unique identifier or field name
     * @param {string} [sourceValue=''] Source string value
     * @param {string} [provider=null] Specific provider ID or null for latest
     * @param {string} [widgetOrBlockName=''] Block name, widget name, or module name
     * @returns {string} Translated string content or empty string if not found
     */
    getTranslatedString(id, sourceValue = '', provider = null, widgetOrBlockName = '') {
      const widget = widgetOrBlockName || id || '';

      const hash = this.generateHash(widget, sourceValue);

      // 1. Check by hash + provider
      if (provider && this.translatedStrings.has(`${hash}_${provider}`)) {
        return {
          source: sourceValue,
          translate: this.translatedStrings.get(`${hash}_${provider}`).translated
        };
      }

      let filterValue;

      for (const [key, data] of this.translatedStrings) {
        if (data.filterValue && data.source === sourceValue) {
          filterValue = data.filterValue;
          break;
        }
      }

      if (filterValue) {
        const hash = this.generateHash(widget, filterValue);

        if (provider && this.translatedStrings.has(`${hash}_${provider}`)) {

          return {
            source: sourceValue,
            translate: sourceValue.replace(this.translatedStrings.get(`${hash}_${provider}`).filterValue, this.translatedStrings.get(`${hash}_${provider}`).translated)
          }
        }
      }

      return '';
    }

    /**
     * Get source string record by ID or hash.
     * 
     * @param {string} id
     * @param {string} [sourceValue='']
     * @param {string} [widgetOrBlockName='']
     * @returns {Object|null}
     */
    getSourceString(id, sourceValue = '', widgetOrBlockName = '') {
      const widget = widgetOrBlockName || id || '';
      const hash = this.generateHash(widget, sourceValue);
      return this.sourceStrings.get(hash) || this.sourceStrings.get(id) || null;
    }

    /**
     * Sync enabled providers from localized WordPress global configurations.
     */
    syncEnabledProviders() {
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      if (Array.isArray(config.enabledProviders) && config.enabledProviders.length > 0) {
        this.enabledProviders = config.enabledProviders;
      }
      if (config.defaultProvider) {
        this.defaultProvider = config.defaultProvider;
      }
    }

    /**
     * Register a translation provider.
     * 
     * @param {string} id Unique provider ID (e.g. 'chrome_ai', 'openai', 'gemini')
     * @param {Object} options Configuration options
     * @param {string} options.title Display name
     * @param {string} options.icon Emoji or Dashicon icon identifier
     * @param {string} options.desc Brief description
     * @param {string} [options.category='ai'] Category: 'ai' | 'browser' | 'free'
     * @param {boolean} [options.savesToDb=false] Whether translated strings are cached in DB
     * @param {boolean} [options.requiresApiKey=false] Whether API key is required
     * @param {Function} [options.checkAvailability] Validation function returning { available: boolean, reason?: string, noticeType?: 'warning'|'error'|'info' }
     * @param {Function} [options.isLanguageSupported] Language support checker (sourceLang, targetLang) -> boolean
     * @param {Function} options.translate Translation function: translate({ items, sourceLang, targetLang, postId, signal }, onProgressCallback) -> Promise<Array>
     */
    registerProvider(id, options) {
      if (!id || typeof id !== 'string') {
        console.error('[TranslateSense] Invalid provider ID:', id);
        return;
      }

      if (!options || typeof options.translate !== 'function') {
        console.error(`[TranslateSense] Provider "${id}" must provide a translate() function.`);
        return;
      }

      const providerData = {
        id,
        title: options.title || id,
        icon: options.icon || '🌐',
        desc: options.desc || '',
        category: options.category || 'ai',
        savesToDb: !!options.savesToDb,
        requiresApiKey: !!options.requiresApiKey,
        checkAvailability: typeof options.checkAvailability === 'function' ? options.checkAvailability : () => ({ available: true }),
        isLanguageSupported: typeof options.isLanguageSupported === 'function' ? options.isLanguageSupported : () => true,
        translate: options.translate,
        docUrl: options.docUrl || '',
      };

      this.providers.set(id, providerData);
    }

    /**
     * Enable a provider by ID.
     * @param {string} id
     */
    enableProvider(id) {
      if (!this.enabledProviders.includes(id)) {
        this.enabledProviders.push(id);
      }
    }

    /**
     * Disable a provider by ID.
     * @param {string} id
     */
    disableProvider(id) {
      this.enabledProviders = this.enabledProviders.filter((p) => p !== id);
    }

    /**
     * Check if a provider is enabled in plugin settings.
     * @param {string} id
     * @returns {boolean}
     */
    isProviderEnabled(id) {
      return this.enabledProviders.includes(id);
    }

    /**
     * Get all registered providers.
     * 
     * @param {boolean} [onlyActive=false] If true, returns only providers enabled in settings
     * @returns {Array<Object>}
     */
    getProviders(onlyActive = false) {
      this.syncEnabledProviders();
      const all = Array.from(this.providers.values());
      if (!onlyActive) {
        return all;
      }
      return all.filter((provider) => this.isProviderEnabled(provider.id));
    }

    /**
     * Get a specific provider by ID.
     * @param {string} id
     * @returns {Object|null}
     */
    getProvider(id) {
      return this.providers.get(id) || null;
    }

    /**
     * Check if a provider is registered.
     * @param {string} id
     * @returns {boolean}
     */
    hasProvider(id) {
      return this.providers.has(id);
    }

    /**
     * Validate a provider for the given language pair and environment.
     * 
     * @param {string} providerId
     * @param {string} [sourceLang='en']
     * @param {string} [targetLang='es']
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<{ available: boolean, reason?: string, noticeType?: string }>}
     */
    async validateProvider(providerId, sourceLang = 'en', targetLang = 'es', bypassCache = false) {
      const provider = this.getProvider(providerId);
      if (!provider) {
        return { available: false, reason: `Provider "${providerId}" is not registered.`, noticeType: 'error' };
      }

      if (!this.isProviderEnabled(providerId)) {
        return { available: false, reason: `Provider "${provider.title}" is disabled in settings.`, noticeType: 'warning' };
      }

      // Check language support definition
      if (typeof provider.isLanguageSupported === 'function') {
        const supported = provider.isLanguageSupported(sourceLang, targetLang);
        if (!supported) {
          return {
            available: false,
            reason: `Language pair (${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}) is not supported by ${provider.title}.`,
            noticeType: 'warning',
          };
        }
      }

      // Run provider-specific availability check (e.g. browser on-device AI check, API key presence)
      try {
        const check = await provider.checkAvailability(sourceLang, targetLang, bypassCache);
        return check || { available: true };
      } catch (err) {
        return { available: false, reason: err.message || 'Provider availability check failed.', noticeType: 'error' };
      }
    }

    /**
     * Create an AbortController for tracking active requests.
     * @returns {AbortController}
     */
    createAbortController() {
      const controller = new AbortController();
      this.activeControllers.add(controller);
      return controller;
    }

    /**
     * Remove an AbortController from active set.
     * @param {AbortController} controller
     */
    releaseAbortController(controller) {
      this.activeControllers.delete(controller);
    }

    /**
     * Abort all active translation requests across providers.
     * @param {string} [reason='Translation cancelled by user']
     */
    abortAll(reason = 'Translation cancelled by user') {
      this.activeControllers.forEach((controller) => {
        try {
          if (!controller.signal.aborted) {
            controller.abort(reason);
          }
        } catch (e) {
          console.warn('[TranslateSense] Error aborting controller:', e);
        }
      });
      this.activeControllers.clear();
    }

    /**
     * Check if a string represents an email address, URL, or URL-related file path.
     * @param {string} str
     * @returns {boolean}
     */
    isEmailOrUrl(str) {
      if (!str || typeof str !== 'string') return false;
      const clean = str.trim();
      if (!clean) return false;

      // 1. Email or mailto:
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /^mailto:/i.test(clean)) return true;

      // 2. Protocols and schemes
      if (/^(https?:\/\/|ftp:\/\/|\/\/|www\.|tel:|sms:|javascript:|callto:|whatsapp:)/i.test(clean)) return true;

      // 3. Media or asset paths
      if (/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i.test(clean)) return true;

      // 4. Domain-like strings
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]*$/i.test(clean)) return true;

      return false;
    }

    /**
     * Mask inline URLs, email addresses, and protocols with unique protected placeholder tokens.
     * Prevents translation engines from translating or corrupting links embedded inside text.
     * 
     * @param {string} text Plain text segment.
     * @returns {{ maskedText: string, tokenMap: Object }}
     */
    maskUrlsAndEmails(text) {
      if (!text || typeof text !== 'string') {
        return { maskedText: text || '', tokenMap: {} };
      }

      const tokenMap = {};
      let counter = 0;

      // Regex matching:
      // 1. Full URLs: http(s)://..., ftp://...
      // 2. www-prefixed domains: www.example.com/...
      // 3. Email addresses: user@domain.com
      // 4. mailto: or tel: links
      const pattern = /(https?:\/\/[^\s<>"'`]+|ftp:\/\/[^\s<>"'`]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"'`]*|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|mailto:[^\s<>"'`]+|tel:\+?[0-9\s-]{6,})/gi;

      const maskedText = text.replace(pattern, (match) => {
        // Strip trailing sentence punctuation if captured (e.g. "https://domain.com/us," -> "," is stripped)
        let cleanMatch = match;
        let trailingPunctuation = '';

        while (cleanMatch.length > 0 && /[.,;:!?)\],>]$/.test(cleanMatch)) {
          trailingPunctuation = cleanMatch.slice(-1) + trailingPunctuation;
          cleanMatch = cleanMatch.slice(0, -1);
        }

        if (!cleanMatch) {
          return match;
        }

        const token = `__TS_LINK_${counter}__`;
        tokenMap[token] = cleanMatch;
        counter++;

        return token + trailingPunctuation;
      });

      return { maskedText, tokenMap };
    }

    /**
     * Restore masked URL and email placeholder tokens with their original values.
     * 
     * @param {string} text Translated text containing placeholder tokens.
     * @param {Object} tokenMap Map of token => original string.
     * @returns {string} Text with original URLs and emails restored.
     */
    unmaskUrlsAndEmails(text, tokenMap) {
      if (!text || typeof text !== 'string' || !tokenMap || typeof tokenMap !== 'object') {
        return text || '';
      }

      let restored = text;

      for (const [token, originalVal] of Object.entries(tokenMap)) {
        // Match token even if translation provider slightly altered casing or spacing
        const innerToken = token.replace(/^__+|__+$/g, '');
        const tokenRegex = new RegExp(`__\\s*${innerToken}\\s*__`, 'gi');
        restored = restored.replace(tokenRegex, originalVal);
      }

      return restored;
    }

    /**
     * Helper: Translate text preserving exact HTML tags, structure, and inline URLs/emails.
     * Splits sourceText into HTML tags/comments and plain text segments, masks inline URLs/emails,
     * executes translateCallback on clean text segments, and returns the reconstructed string.
     *
     * @param {string} sourceText Source string potentially containing HTML tags/comments and inline URLs.
     * @param {Function} translateCallback Async or sync callback: async (cleanText: string) => translatedText
     * @returns {Promise<string>} Translated string with exact HTML tags, spacing, and URLs preserved.
     */
    async translateTextPreservingHtml(sourceText, translateCallback) {
      if (!sourceText || typeof sourceText !== 'string' || sourceText.trim() === '') {
        return sourceText || '';
      }

      if (typeof translateCallback !== 'function') {
        return sourceText;
      }

      // Split string into HTML tags/comments and text segments
      // Matches HTML tags (<...>) and comments (<!--...-->)
      const tagRegex = /(<!--[\s\S]*?-->|<[^>]+>)/g;
      const parts = sourceText.split(tagRegex);

      let result = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        // If this part is an HTML tag or comment, keep it exactly as-is without adding/closing tags
        if (part.startsWith('<') && part.endsWith('>')) {
          result += part;
        } else {
          // Plain text segment: preserve leading & trailing whitespace
          const leadingMatch = part.match(/^\s*/);
          const trailingMatch = part.match(/\s*$/);
          const leadingSpace = leadingMatch ? leadingMatch[0] : '';
          const trailingSpace = trailingMatch ? trailingMatch[0] : '';
          const cleanText = part.trim();

          if (cleanText) {
            // If the entire text segment is just a URL or email, preserve it directly
            if (this.isEmailOrUrl(cleanText)) {
              result += leadingSpace + cleanText + trailingSpace;
            } else {
              // Mask inline URLs and email addresses so they are not altered by translation
              const { maskedText, tokenMap } = this.maskUrlsAndEmails(cleanText);
              let translated = await translateCallback(maskedText);

              if (translated !== undefined && translated !== null) {
                translated = this.unmaskUrlsAndEmails(translated, tokenMap);
              } else {
                translated = cleanText;
              }

              result += leadingSpace + translated + trailingSpace;
            }
          } else {
            result += part;
          }
        }
      }

      return result;
    }

    /**
     * Execute translation using the registered provider.
     * 
     * @param {string} providerId Provider ID to use
     * @param {Object} params Parameters object { items, sourceLang, targetLang, postId, signal }
     *        items is an array of { hash, content/source, widget_id, field }
     * @param {Function} [onProgressCallback] Callback invoked on translation: callback({ hash, source, translated, status, error })
     * @returns {Promise<Array<Object>>} Resolves with array of { hash, source, translated, status, error }
     */
    async translate(providerId, params, onProgressCallback) {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw new Error(`Translation provider "${providerId}" is not registered.`);
      }

      const safeCallback = typeof onProgressCallback === 'function' ? onProgressCallback : () => { };

      // Filter out items that are email addresses or URLs
      const translatableItems = [];
      const skippedResults = [];

      (params.items || []).forEach((item) => {
        const text = item.content || item.source || '';
        if (this.isEmailOrUrl(text)) {
          const res = {
            hash: item.hash,
            source: text,
            translated: text,
            status: 'Completed',
          };
          skippedResults.push(res);
          safeCallback(res);
        } else {
          translatableItems.push(item);
        }
      });

      if (translatableItems.length === 0) {
        return skippedResults;
      }

      try {
        const results = await provider.translate({ ...params, items: translatableItems }, safeCallback);
        return [...skippedResults, ...(Array.isArray(results) ? results : [])];
      } catch (error) {
        console.error(`[TranslateSense] Error translating with provider "${providerId}":`, error);
        throw error;
      }
    }
    /**
     * Register a Page Editor live updater (e.g. 'gutenberg', 'elementor', 'classic').
     * 
     * @param {string} id Unique editor ID
     * @param {Object} options
     * @param {string} options.title Human readable name
     * @param {Function} options.isActive Function returning boolean if editor is currently loaded
     * @param {Function} options.apply Function (strings, options) to apply translated content live
     */
    registerPageEditor(id, options) {
      if (!id || typeof id !== 'string') {
        console.error('[TranslateSense] Invalid editor ID:', id);
        return;
      }

      if (!options || typeof options.apply !== 'function') {
        console.error(`[TranslateSense] Editor "${id}" must provide an apply() function.`);
        return;
      }

      const editorData = {
        id,
        title: options.title || id,
        isActive: typeof options.isActive === 'function' ? options.isActive : () => false,
        apply: options.apply,
      };

      this.pageEditors.set(id, editorData);
    }

    /**
     * Get registered page editor by ID.
     * @param {string} id
     * @returns {Object|null}
     */
    getPageEditor(id) {
      return this.pageEditors.get(id) || null;
    }

    /**
     * Get all registered page editors.
     * @returns {Array<Object>}
     */
    getPageEditors() {
      return Array.from(this.pageEditors.values());
    }

    /**
     * Check if a page editor is registered.
     * @param {string} id
     * @returns {boolean}
     */
    hasPageEditor(id) {
      return this.pageEditors.has(id);
    }

    /**
     * Detect and return the currently active page editor.
     * @returns {Object|null}
     */
    getActivePageEditor() {
      for (const editor of this.pageEditors.values()) {
        try {
          if (editor.isActive()) {
            return editor;
          }
        } catch (e) {
          console.warn(`[TranslateSense] Error checking isActive for editor "${editor.id}":`, e);
        }
      }
      return null;
    }

    /**
     * Apply translated strings live to the specified or automatically detected page editor.
     * 
     * @param {string} [editorId] Optional specific editor ID ('gutenberg', 'elementor', 'classic')
     * @param {Object} options
     * @param {Array<Object>} options.strings Array of { field, widget_id, source, translated, hash }
     * @returns {Promise<Object>} Status object { success: boolean, editor: string, count: number }
     */
    async applyToPageEditor(editorId, params = {}) {
      const strings = params.strings || [];
      const options = params.options || {};
      const sourcePageData = params.sourcePageData || options.sourcePageData || null;

      if (!Array.isArray(strings) || strings.length === 0) {
        return { success: false, message: 'No strings to apply' };
      }

      let editor = editorId ? this.getPageEditor(editorId) : null;
      if (!editor || (typeof editor.isActive === 'function' && !editor.isActive())) {
        editor = this.getActivePageEditor();
      }

      if (!editor) {
        console.warn('[TranslateSense] No active page editor matched. Falling back to universal meta updater.');
        if (window.TranslateSenseMetaUpdater) {
          window.TranslateSenseMetaUpdater.apply(strings);
        }
        return { success: true, editor: 'generic', count: strings.length };
      }

      try {
        await editor.apply(strings, { ...options, sourcePageData });
        return { success: true, editor: editor.id, count: strings.length };
      } catch (error) {
        console.error(`[TranslateSense] Error applying translation to editor "${editor.id}":`, error);
        throw error;
      }
    }

    /**
     * Fetch comprehensive page content from REST endpoint (/get-page-content).
     * Returns post_title, post_content, post_excerpt, meta fields, etc.
     * 
     * @param {number} postId Post ID to retrieve
     * @param {Array<string>|string} [fields=[]] Optional specific fields filter
     * @returns {Promise<Object>}
     */
    async getPageContent(postId, fields = []) {
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';
      const id = postId || config.postId || 0;

      if (!id) {
        throw new Error('Missing post ID for getPageContent');
      }

      let url = restUrl + 'get-page-content?post_id=' + encodeURIComponent(id);
      if (fields && fields.length > 0) {
        const fieldsStr = Array.isArray(fields) ? fields.join(',') : fields;
        url += '&fields=' + encodeURIComponent(fieldsStr);
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
      });

      return await response.json();
    }

    /**
     * Fetch block configuration rules parsed from editor-xml-config REST endpoint.
     */
    async getEditorConfig(editor = null, cache) {

      if (!editor) {
        return;
      }

      if (cache) {
        return cache;
      }

      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      try {
        const response = await fetch(restUrl + 'editor-xml-config?editor=' + editor, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        });
        const data = await response.json();
        if (data && data.rules) {
          cache = data.rules;
          return cache;
        }
      } catch (err) {
        console.warn('[TranslateSense] Could not fetch /editor-xml-config?editor=' + editor + ':', err);
      }

      return {};
    }
  }

  // Create singleton instance
  window.TranslateSenseCore = new TranslateSenseCore();
})(window);
