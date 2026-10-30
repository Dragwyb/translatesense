/**
 * TranslateSense - Translation Providers Manager & Coordinator
 * File: assets/js/providers/index.js
 * 
 * Central coordinator for translation providers (Chrome Built-in AI, OpenAI, Gemini).
 * Injects and initializes providers into a given TranslateSenseCore instance.
 */

(function (window) {
  'use strict';

  const ProvidersManager = {
    /**
     * Register all available translation providers onto the supplied TranslateSenseCore instance.
     * 
     * @param {TranslateSenseCore} core The core instance to register providers onto.
     * @returns {TranslateSenseCore} The core instance.
     */
    register(core) {
      if (!core || typeof core.registerProvider !== 'function') {
        console.warn('[TranslateSense] Invalid TranslateSenseCore instance passed to TranslateSenseProviders.register().');
        return core;
      }

      // 1. Chrome Built-in AI Provider
      if (window.TranslateSenseChromeAi && typeof window.TranslateSenseChromeAi.register === 'function') {
        window.TranslateSenseChromeAi.register(core);
      }

      // 2. AI Services Providers (OpenAI & Gemini)
      if (window.TranslateSenseAiServices && typeof window.TranslateSenseAiServices.register === 'function') {
        window.TranslateSenseAiServices.register(core);
      }

      return core;
    },

    /**
     * Initialize providers on a core instance (alias for register).
     * 
     * @param {TranslateSenseCore} core
     * @returns {TranslateSenseCore}
     */
    init(core) {
      return this.register(core);
    }
  };

  window.TranslateSenseProviders = ProvidersManager;
})(window);
