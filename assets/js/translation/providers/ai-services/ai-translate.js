/**
 * TranslateSense - AI Services Provider (OpenAI & Gemini AI)
 * File: assets/js/providers/ai-services/ai-translate.js
 * 
 * Registers "openai" and "gemini" on window.TranslateSenseCore.
 * Features:
 * - Intelligent token-aware batching (MAX_TOKENS per request)
 * - Concurrent queue processing (CONCURRENCY_LIMIT)
 * - Robust AbortController cancellation
 * - Detailed error diagnostics (quota limits, invalid keys, network timeouts)
 * - Word & character count statistics
 */

(function (window) {
  'use strict';

  class AIServiceRunner {
    constructor(providerName, options = {}) {
      this.providerName = providerName;
      this.concurrencyLimit = options.concurrencyLimit || 5;
      this.maxTokensPerBatch = options.maxTokensPerBatch || 600;
    }

    /**
     * Estimate token count for a text string (~4 characters per token).
     * @param {string} text
     * @returns {number}
     */
    estimateTokens(text) {
      if (!text) return 0;
      return Math.ceil(text.length / 4);
    }

    /**
     * Partition items into token-balanced batches.
     * @param {Array<Object>} items
     * @returns {Array<Array<Object>>}
     */
    createBatches(items) {
      const batches = [];
      let currentBatch = [];
      let currentTokens = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const content = item.content || item.source || '';
        const tokens = this.estimateTokens(content);

        if (currentTokens + tokens > this.maxTokensPerBatch && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [item];
          currentTokens = tokens;
        } else {
          currentBatch.push(item);
          currentTokens += tokens;
        }
      }

      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      return batches;
    }

    /**
     * Execute translation for a single batch over WordPress REST API.
     */
    async executeBatchRequest(batch, { sourceLang, targetLang, postId, signal }, onProgressCallback) {
      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      const stringContents = batch.map((item) => item.content || item.source || '');
      const widgetIds = batch.map((item) => item.widget_id || 'generic');

      const response = await fetch(restUrl + 'translate-batch', {
        method: 'POST',
        signal: signal,
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify({
          strings: stringContents,
          widget_ids: widgetIds,
          source_lang: sourceLang,
          target_lang: targetLang,
          provider: this.providerName,
          post_id: postId || config.postId || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = errorData.message || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
          message = `API Quota / Rate Limit reached for ${this.providerName.toUpperCase()}. Please check your API account plan.`;
        }
        throw new Error(message);
      }

      const data = await response.json();
      const translatedList = (data && Array.isArray(data.results)) ? data.results : [];
      const batchResults = [];

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const sourceText = item.content || item.source || '';

        // Match response by hash identifier, falling back to positional index
        let transResult = null;
        if (item.hash) {
          transResult = translatedList.find((r) => r && r.hash === item.hash);
        }
        if (!transResult && translatedList[i]) {
          transResult = translatedList[i];
        }

        const rawTranslated = transResult && transResult.translated !== undefined ? transResult.translated : null;
        const hasError = Boolean(transResult && transResult.error);

        // A valid translation must not be null/undefined, must not have an error, and must not be empty (legitimate strings like "0" are valid)
        const isValid = !hasError && rawTranslated !== null && rawTranslated !== undefined && String(rawTranslated).trim() !== '';
        const isCached = Boolean(transResult && transResult.cached);

        const itemResult = {
          hash: item.hash || (transResult && transResult.hash) || '',
          source: sourceText,
          translated: isValid ? String(rawTranslated) : '',
          status: isValid ? (isCached ? 'Cached' : 'AI Completed') : 'AI Failed',
          isSuccess: isValid,
          error: hasError ? transResult.error : (!isValid ? 'Translation missing or empty' : null),
        };

        batchResults.push(itemResult);

        if (typeof onProgressCallback === 'function') {
          onProgressCallback(itemResult);
        }
      }

      return batchResults;
    }

    /**
     * Run all batches with controlled concurrency.
     */
    async run({ items, sourceLang, targetLang, postId, signal }, onProgressCallback) {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const batches = this.createBatches(items);
      const allResults = [];
      let batchIndex = 0;
      let stopProcessing = false;
      let lastError = null;

      const worker = async () => {
        while (batchIndex < batches.length && !stopProcessing) {
          if (signal && signal.aborted) {
            console.error('Translation cancelled');
          }

          const currentIdx = batchIndex++;
          const batch = batches[currentIdx];

          try {
            const batchResults = await this.executeBatchRequest(batch, { sourceLang, targetLang, postId, signal }, onProgressCallback);
            allResults.push(...batchResults);
          } catch (err) {
            if (err.name === 'AbortError' || (signal && signal.aborted)) {
              stopProcessing = true;
              console.error(err);
            }

            console.error(`[TranslateSense] Error in ${this.providerName} batch #${currentIdx}:`, err.message);
            lastError = err;

            // Fail-safe reporting for this batch
            for (let j = 0; j < batch.length; j++) {
              const item = batch[j];
              const sourceText = item.content || item.source || '';
              const fallbackResult = {
                hash: item.hash || '',
                source: sourceText,
                translated: '',
                status: 'AI Failed',
                error: err.message,
                isSuccess: false,
              };

              allResults.push(fallbackResult);

              if (typeof onProgressCallback === 'function') {
                onProgressCallback(fallbackResult);
              }
            }

            // Stop if serious auth or quota error
            if (err.message.includes('Quota') || err.message.includes('401') || err.message.includes('Unauthorized')) {
              stopProcessing = true;
            }
          }
        }
      };

      const workers = [];
      const activeWorkersCount = Math.min(this.concurrencyLimit, batches.length);
      for (let w = 0; w < activeWorkersCount; w++) {
        workers.push(worker());
      }

      await Promise.all(workers);

      if (lastError && allResults.every((r) => r.status === 'AI Failed')) {
        console.error(lastError);
      }

      return allResults;
    }
  }

  const getProviderLogo = (id) => {
    const data = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    const base = data.pluginUrl || '';
    return base ? `${base}assets/img/providers/${id}.png` : '';
  };

  function registerAiServicesProviders(core) {
    if (!core || typeof core.registerProvider !== 'function') {
      return;
    }

    // 1. Register OpenAI Provider
    core.registerProvider('openai', {
      title: 'OpenAI (GPT-4o)',
      logo: getProviderLogo('openai'),
      desc: 'High-accuracy neural AI translation via OpenAI ChatGPT API.',
      category: 'ai',

      checkAvailability: function () {
        return { available: true };
      },

      translate: function (params, onProgressCallback) {
        const runner = new AIServiceRunner('openai', { concurrencyLimit: 4, maxTokensPerBatch: 500 });
        return runner.run(params, onProgressCallback);
      },
    });

    // 2. Register Gemini AI Provider
    core.registerProvider('gemini', {
      title: 'Gemini AI',
      logo: getProviderLogo('gemini'),
      desc: 'Next-generation multilingual translation powered by Google Gemini AI.',
      category: 'ai',

      checkAvailability: function () {
        return { available: true };
      },

      translate: function (params, onProgressCallback) {
        const runner = new AIServiceRunner('gemini', { concurrencyLimit: 4, maxTokensPerBatch: 600 });
        return runner.run(params, onProgressCallback);
      },
    });
  }

  // Export module for provider registration
  window.TranslateSenseAiServices = {
    register: registerAiServicesProviders,
  };

  // Backward compatibility: If window.TranslateSenseCore is an instantiated object with registerProvider
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerProvider === 'function') {
    registerAiServicesProviders(window.TranslateSenseCore);
  }
})(window);
