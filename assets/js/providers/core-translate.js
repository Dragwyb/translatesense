/**
 * TranslateSense - Core Translate Registry & Provider Manager
 * File: assets/js/providers/core-translate.js
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
      this.activeControllers = new Set();
      this.defaultProvider = 'openai';
      this.enabledProviders = ['chrome_ai', 'openai', 'gemini'];

      // Initialize enabled providers from localized data if available
      this.syncEnabledProviders();
    }

    /**
     * Sync enabled providers from localized WordPress global configurations.
     */
    syncEnabledProviders() {
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || window.TranslateSenseData || {};
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
     * @returns {Promise<{ available: boolean, reason?: string, noticeType?: string }>}
     */
    async validateProvider(providerId, sourceLang = 'en', targetLang = 'es') {
      const provider = this.getProvider(providerId);
      if (!provider) {
        return { available: false, reason: `Provider "${providerId}" is not registered.`, noticeType: 'error' };
      }

      if (!this.isProviderEnabled(providerId)) {
        return { available: false, reason: `Provider "${provider.title}" is disabled in settings.`, noticeType: 'warning' };
      }

      // Check language support
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
        const check = await provider.checkAvailability(sourceLang, targetLang);
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

      const safeCallback = typeof onProgressCallback === 'function' ? onProgressCallback : () => {};

      try {
        return await provider.translate(params, safeCallback);
      } catch (error) {
        console.error(`[TranslateSense] Error translating with provider "${providerId}":`, error);
        throw error;
      }
    }
  }

  // Create singleton instance
  window.TranslateSenseCore = new TranslateSenseCore();
  window.TranslateSenseModal = TranslateSenseCore; // Backward compatibility alias
})(window);
