/**
 * TranslateSense - Core Translate Registry & Modal Manager (core-translate.js)
 * 
 * Provides:
 * 1. Global registry for translation providers (registerProvider, getProviders, getProvider)
 * 2. Standardized translate dispatching with callback(hash, source, translated, status)
 * 3. Global window.TranslateSenseCore instance
 */

(function (window) {
  'use strict';

  class TranslateSenseCore {
    constructor() {
      this.providers = new Map();
      this.defaultProvider = 'openai';
    }

    /**
     * Register a translation provider.
     * 
     * @param {string} id Unique provider ID (e.g. 'google_widget', 'chrome_ai', 'openai', 'gemini')
     * @param {Object} options Configuration object
     * @param {string} options.title Display name
     * @param {string} options.icon Emoji or dashicon
     * @param {string} options.desc Brief description
     * @param {boolean} [options.savesToDb=false] Whether translated strings are stored in DB
     * @param {Function} options.translate Callback method for translating content
     *        Signature: translate({ items, sourceLang, targetLang, postId }, onProgressCallback) -> Promise
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
        savesToDb: !!options.savesToDb,
        translate: options.translate,
      };

      this.providers.set(id, providerData);
    }

    /**
     * Get all registered providers as an array.
     * @returns {Array<Object>}
     */
    getProviders() {
      return Array.from(this.providers.values());
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
     * Execute translation using the registered provider.
     * 
     * @param {string} providerId Provider ID to use
     * @param {Object} params Parameters object { items, sourceLang, targetLang, postId }
     *        items is an array of { hash, content/source, widget_id, field }
     * @param {Function} [onProgressCallback] Callback invoked on translation: callback({ hash, source, translated, status })
     * @returns {Promise<Array<Object>>} Resolves with array of { hash, source, translated, status }
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

  // Create global instance
  window.TranslateSenseCore = new TranslateSenseCore();
  window.TranslateSenseModal = TranslateSenseCore; // Alias for modal registry access
})(window);
