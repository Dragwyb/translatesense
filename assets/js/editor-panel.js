/**
 * TranslateSense - Universal Page Editor Panel (editor-panel.js)
 * 
 * 100% Pure Vanilla JavaScript (NO React, NO wp.element, NO useState).
 * Features:
 * 1. Source Post / Parent Post detection via _translatesense_source_id & from_post query parameter
 * 2. Editor-type detection for source post (Elementor, Gutenberg, Classic)
 * 3. Page load auto-translate prompt modal with editor-specific guidance
 * 4. Context-aware Translate button triggers across all editors
 */

(function (window, document) {
  'use strict';

  function getLanguageFlagHtml(langInput, allLanguages = []) {
    let slug = '';
    let flagUrl = '';

    if (typeof langInput === 'object' && langInput !== null) {
      slug = (langInput.slug || '').toLowerCase();
      flagUrl = langInput.flag || '';
    } else if (typeof langInput === 'string') {
      slug = langInput.toLowerCase();
      const found = allLanguages.find((l) => (l.slug || '').toLowerCase() === slug);
      if (found && found.flag) {
        flagUrl = found.flag;
      }
    }

    if (flagUrl && typeof flagUrl === 'string' && (flagUrl.startsWith('http://') || flagUrl.startsWith('https://') || flagUrl.startsWith('/') || flagUrl.startsWith('data:image/'))) {
      return `<img src="${flagUrl}" class="ts-lang-flag-img" alt="${slug}" />`;
    }

    return '';
  }

  function getLanguageDisplay(langInput, allLanguages = []) {
    let slug = '';
    if (typeof langInput === 'object' && langInput !== null) {
      slug = (langInput.slug || '').toLowerCase();
    } else if (typeof langInput === 'string') {
      slug = langInput.toLowerCase();
    }
    const flagHtml = getLanguageFlagHtml(langInput, allLanguages);
    const code = slug.toUpperCase();
    return flagHtml ? `${flagHtml} (${code})` : `(${code})`;
  }

  // Helper to dynamically get active enabled providers registered on TranslateSenseCore
  function getRegisteredProviders() {
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    const pluginUrl = config.pluginUrl || '';
    const getLogo = (id) => (pluginUrl ? `${pluginUrl}assets/img/${id}.png` : '');
    const enabledProviders = Array.isArray(config.enabledProviders) ? config.enabledProviders : [];

    let providers = [];
    if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getProviders === 'function') {
      providers = window.TranslateSenseCore.getProviders(true);
      if (providers.length === 0 && enabledProviders.length === 0) {
        providers = window.TranslateSenseCore.getProviders(false);
      }
    }
    if (!providers || providers.length === 0) {
      const defaultList = [
        { id: 'openai', title: 'OpenAI (GPT-4o)', icon: '🧠', logo: getLogo('openai'), desc: 'High accuracy translation via OpenAI ChatGPT API.', category: 'ai' },
        { id: 'gemini', title: 'Gemini AI', icon: '✨', logo: getLogo('gemini'), desc: 'Next-gen multilingual translation via Google Gemini AI.', category: 'ai' },
        { id: 'chrome_ai', title: 'Chrome Local AI', icon: '🤖', logo: getLogo('chrome_ai'), desc: 'On-device translation powered by Chrome built-in AI (window.ai).', category: 'browser' },
      ];
      providers = enabledProviders.length > 0 ? defaultList.filter((p) => enabledProviders.includes(p.id)) : defaultList;
    }
    return providers.map((p) => ({
      ...p,
      logo: p.logo || getLogo(p.id),
    }));
  }

  // Universal TranslateSense Editor Controller (Pure Vanilla JS)
  class TranslateSenseEditor {
    constructor() {
      this.config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      this.postId = this.config.postId || 0;
      this.editorType = this.config.editorType || 'classic';
      this.sourcePostId = this.config.sourcePostId || 0;
      this.sourceLanguage = this.config.sourceLanguage || '';
      this.sourceEditorType = this.config.sourceEditorType || '';
      this.fromPost = this.config.fromPost || 0;
      this.targetLang = this.config.currentLanguage || 'en';
      const defaultProv = this.config.defaultProvider || '';
      const enabledProviders = Array.isArray(this.config.enabledProviders) ? this.config.enabledProviders : [];
      this.selectedProvider = (defaultProv && (enabledProviders.length === 0 || enabledProviders.includes(defaultProv))) ? defaultProv : '';
      this.strings = [];
      this.isExtracting = false;
      this.isTranslating = false;

      this.init();
    }

    init() {
      this.bindUniversalTriggers();
      // Dispatch specific initialization based on localized editorType
      switch (this.editorType) {
        case 'gutenberg':
          window.addEventListener('load', () => this.initGutenberg())
          break;
        case 'elementor':
          jQuery(window).on('elementor:init', () => elementor.on('document:loaded', () => this.initElementor()));
          break;
        case 'classic':
        default:
          window.addEventListener('load', () => this.initClassicEditorMediaButton())
          break;
      }
    }

    /**
     * Helper to get clean display name for editor types.
     */
    getEditorDisplayName(type) {
      switch (type) {
        case 'elementor':
          return 'Elementor';
        case 'gutenberg':
          return 'Gutenberg';
        case 'classic':
        default:
          return 'Classic';
      }
    }

    /**
     * Page Load Initial Prompt Modal.
     */
    initPageLoadPrompt() {
      // If we have a source post (or from_post query parameter)
      if (this.sourcePostId > 0 || this.fromPost > 0) {
        setTimeout(() => {
          this.showSourceEditorPromptModal(true);
        }, 800);
      }
    }

    /**
     * Show Source Post / Editor Type Guidance Modal.
     * 
     * @param {boolean} isPageLoad Whether this was triggered automatically on page load.
     */
    showSourceEditorPromptModal(isPageLoad = false) {

      if (!window.TranslateSenseEditorData.showInitialPromptModal) {
        return;
      }

      const existing = document.getElementById('ts-source-editor-guidance-modal');
      if (existing) existing.remove();

      let modalTitle = '⚡ Translate Page Content';
      let modalMessage = '';
      let actionBtnText = '🚀 Continue to Translation';
      const srcDisplay = this.sourceLanguage ? `from <strong>${getLanguageDisplay(this.sourceLanguage, this.config.languages)}</strong> ` : '';
      modalMessage = `If you want to translate this post automatically ${srcDisplay}to <strong>${getLanguageDisplay(this.targetLang, this.config.languages)}</strong>, click to continue or close this modal.`;
      actionBtnText = '🚀 Continue to Translation';

      const modalContainer = document.createElement('div');
      modalContainer.id = 'ts-source-editor-guidance-modal';
      modalContainer.className = 'ts-strings-review-modal';
      modalContainer.innerHTML = `
        <div class="ts-review-container" style="max-width: 560px;" onclick="event.stopPropagation()">
          <div class="ts-review-header">
            <h3>${modalTitle}</h3>
            <button class="ts-bulk-close" id="ts-source-prompt-close">✕</button>
          </div>
          <div class="ts-review-body">
            <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 8px;">
              ${modalMessage}
            </div>
          </div>
          <div class="ts-review-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-source-prompt-cancel">Close</button>
            <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-source-prompt-confirm">${actionBtnText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      const closeModal = () => modalContainer.remove();
      document.getElementById('ts-source-prompt-close').addEventListener('click', closeModal);
      document.getElementById('ts-source-prompt-cancel').addEventListener('click', closeModal);

      document.getElementById('ts-source-prompt-confirm').addEventListener('click', () => {
        closeModal();
        this.openProviderModal();
      });
    }

    /**
     * Gutenberg Block Editor Integration.
     */
    initGutenberg() {
      if (this.sourceEditorType === 'gutenberg') {
        // Check and show Page Load Auto-Translate Prompt Modal
        this.initPageLoadPrompt();
      }
    }

    /**
     * Bind generic trigger buttons anywhere in the DOM (Metaboxes, Media button, Elementor).
     */
    bindUniversalTriggers() {
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.ts-open-translate-btn, #ts-metabox-translate-btn, #ts-media-translate-btn, #ts-elementor-translate-btn, #ts-classic-translate-btn');
        if (trigger) {
          e.preventDefault();
          this.openProviderModal();
        }
      });
    }

    /**
     * Classic Editor: Ensure button is placed right after Add Media button.
     */
    initClassicEditorMediaButton() {
      const insertMediaBtn = () => {
        const mediaBtn = document.getElementById('insert-media-button');
        const mediaWrap = document.getElementById('wp-content-media-buttons') || document.querySelector('.wp-media-buttons');

        if (mediaBtn && !document.getElementById('ts-media-translate-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.id = 'ts-media-translate-btn';
          btn.className = 'button ts-open-translate-btn';
          btn.style.cssText = 'margin-left: 5px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); border-color: #3730a3; color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; vertical-align: middle;';
          btn.innerHTML = '<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1.2;"></span> Translate Page';
          mediaBtn.insertAdjacentElement('afterend', btn);
        } else if (mediaWrap && !document.getElementById('ts-media-translate-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.id = 'ts-media-translate-btn';
          btn.className = 'button ts-open-translate-btn';
          btn.style.cssText = 'margin-left: 5px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); border-color: #3730a3; color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; vertical-align: middle;';
          btn.innerHTML = '<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1.2;"></span> Translate Page';
          mediaWrap.appendChild(btn);
        }
      };

      insertMediaBtn();
      setInterval(insertMediaBtn, 2000);
    }

    /**
     * Elementor: Insert button into Elementor Panel footer.
     */
    initElementor() {
      const elementorBtnGroup = document.querySelector('.MuiButtonGroup-root.MuiButtonGroup-contained');

      if (!elementorBtnGroup) {
        return;
      }

      const btnContainer = elementorBtnGroup.closest('.MuiGrid-root');

      if (!btnContainer) {
        return;
      }

      const translateBtn = document.createElement('button');
      translateBtn.id = 'ts-elementor-translate-btn';
      translateBtn.className = 'elementor-button elementor-button-default ts-open-translate-btn';
      translateBtn.style.cssText = 'width: 100%; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #fff; font-weight: 600;';
      translateBtn.innerText = '⚡ Translate Page';

      btnContainer.prepend(translateBtn)

      // Check and show Page Load Auto-Translate Prompt Modal
      this.initPageLoadPrompt();
    }



    /**
     * Open Pure Vanilla JS Provider Selection Modal (Grid View).
     */
    openProviderModal() {
      if (this.editorType !== this.sourceEditorType) return;

      const existingModal = document.getElementById('ts-universal-provider-modal');
      if (existingModal) existingModal.remove();

      const providersList = getRegisteredProviders();

      const modalContainer = document.createElement('div');
      modalContainer.id = 'ts-universal-provider-modal';
      modalContainer.className = 'ts-strings-review-modal';
      modalContainer.innerHTML = `
        <div class="ts-review-container ts-provider-modal-container" onclick="event.stopPropagation()">
          <div class="ts-review-header">
            <div class="ts-review-header-title">
              <div class="ts-header-icon-box">
                <span class="dashicons dashicons-translation"></span>
              </div>
              <div>
                <h3>Choose Translation Provider</h3>
                <p class="ts-header-subtitle">Select engine for target language: <span class="ts-lang-pill">${getLanguageDisplay(this.targetLang, this.config.languages)}</span></p>
              </div>
            </div>
            <button class="ts-bulk-close" id="ts-provider-modal-close" title="Close">✕</button>
          </div>
          <div class="ts-review-body">
            <div class="ts-provider-list">
              ${(() => {
          const settingsUrl = this.config.settingsUrl || 'admin.php?page=translatesense&tab=settings';
          const isProviderMissingKey = (id) => {
            if (id === 'openai') return !this.config.hasOpenAiKey;
            if (id === 'gemini') return !this.config.hasGeminiKey;
            return false;
          };

          const defaultProv = this.config.defaultProvider || '';
          let currentSelected = (this.selectedProvider && providersList.some((p) => p.id === this.selectedProvider && !isProviderMissingKey(p.id)))
            ? this.selectedProvider
            : (defaultProv && providersList.some((p) => p.id === defaultProv && !isProviderMissingKey(p.id)) ? defaultProv : '');

          if (!currentSelected) {
            const firstAvailable = providersList.find((p) => !isProviderMissingKey(p.id));
            if (firstAvailable) currentSelected = firstAvailable.id;
          }
          this.selectedProvider = currentSelected;

          return providersList.map((p) => {
            const isMissingKey = isProviderMissingKey(p.id);
            const isSelected = Boolean(!isMissingKey && currentSelected && p.id === currentSelected);
            const isFrontend = (p.id === 'chrome_ai' || p.id === 'chrome_local_ai');
            const badgeHtml = isFrontend
              ? '<span class="ts-provider-badge on-device">⚡ On-Device</span>'
              : '';
            const actionHtml = isMissingKey
              ? `<a href="${settingsUrl}" target="_blank" class="ts-add-api-key-btn" onclick="event.stopPropagation();" title="Configure API Key in TranslateSense Settings">⚠️ Add API Key</a>`
              : badgeHtml;

            return `
                    <div class="ts-provider-row ${isSelected ? 'selected' : ''} ${isMissingKey ? 'disabled' : ''}" data-provider="${p.id}" ${isMissingKey ? 'data-disabled="true"' : ''}>
                      <div class="ts-provider-radio-wrap">
                        <input type="radio" name="ts_provider_choice" value="${p.id}" ${isSelected ? 'checked' : ''} ${isMissingKey ? 'disabled' : ''} class="ts-provider-radio-input" />
                        <span class="ts-provider-custom-radio"></span>
                      </div>
                      <div class="ts-provider-icon-box">
                        <img src="${p.logo}" alt="${p.title}" class="ts-provider-logo-img" />
                      </div>
                      <div class="ts-provider-main-info">
                        <div class="ts-provider-title-row">
                          <span class="ts-provider-name">${p.title}</span>
                          ${actionHtml}
                        </div>
                        <p class="ts-provider-caption">${p.desc}</p>
                      </div>
                    </div>
                  `;
          }).join('');
        })()}
            </div>
          </div>
          <div class="ts-review-footer">
            <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-provider-modal-cancel">Cancel</button>
            <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-provider-modal-start">
              <span>🚀</span> Start Translation
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      // Row Selection
      modalContainer.querySelectorAll('.ts-provider-row').forEach((row) => {
        row.addEventListener('click', () => {
          if (row.classList.contains('disabled') || row.getAttribute('data-disabled') === 'true') {
            return;
          }
          modalContainer.querySelectorAll('.ts-provider-row').forEach((r) => r.classList.remove('selected'));
          row.classList.add('selected');
          const radio = row.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
          this.selectedProvider = row.getAttribute('data-provider');
        });
      });

      // Close handlers
      const closeModal = () => modalContainer.remove();
      document.getElementById('ts-provider-modal-close').addEventListener('click', closeModal);
      document.getElementById('ts-provider-modal-cancel').addEventListener('click', closeModal);

      // Start Translation Action
      document.getElementById('ts-provider-modal-start').addEventListener('click', async () => {
        const checked = modalContainer.querySelector('input[name="ts_provider_choice"]:checked');
        if (checked && !checked.disabled) this.selectedProvider = checked.value;

        if (!this.selectedProvider) {
          alert('Please choose an active translation provider before starting.');
          return;
        }

        closeModal();
        await this.extractAndTranslate();
      });
    }

    /**
     * Get details for currently selected provider.
     */
    getSelectedProviderInfo() {
      const providers = getRegisteredProviders();
      return providers.find((p) => p.id === this.selectedProvider) || {
        id: this.selectedProvider,
        title: this.selectedProvider.toUpperCase(),
        icon: '⚡',
      };
    }

    /**
     * Show Translation Progress Overlay on top of the String Review Modal with blur effect.
     *
     * @param {number} totalStrings Total strings to translate.
     * @param {string} initialStatus Status text.
     */
    showTranslationProgressModal(totalStrings = 0, initialStatus = 'Extracting strings...') {
      this.closeTranslationProgressModal(true);

      // Ensure review modal exists so overlay sits directly on top of it
      let reviewContainer = document.querySelector('#ts-universal-review-modal .ts-review-container');
      if (!reviewContainer) {
        this.openReviewModal();
        reviewContainer = document.querySelector('#ts-universal-review-modal .ts-review-container');
      }

      const providerInfo = this.getSelectedProviderInfo();
      const overlay = document.createElement('div');
      overlay.id = 'ts-translation-progress-modal';
      overlay.className = 'ts-review-progress-overlay';
      overlay.innerHTML = `
        <div class="ts-progress-modal-card" onclick="event.stopPropagation()">
          <div class="ts-coffee-visual">
            <div class="ts-coffee-circle-bg"></div>
            <svg class="ts-coffee-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 52C12 50.8954 12.8954 50 14 50H50C51.1046 50 52 50.8954 52 52C52 53.1046 51.1046 54 50 54H14C12.8954 54 12 53.1046 12 52Z" fill="#94A3B8"/>
              <path d="M16 26H48V38C48 44.6274 42.6274 50 36 50H28C21.3726 50 16 44.6274 16 38V26Z" fill="url(#tsCoffeeGrad)"/>
              <path d="M48 30H51C53.7614 30 56 32.2386 56 35C56 37.7614 53.7614 40 51 40H48" stroke="#4F46E5" stroke-width="3.5" stroke-linecap="round"/>
              <path class="ts-steam-line ts-steam-1" d="M26 20C25 17 27 14 26 11" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round"/>
              <path class="ts-steam-line ts-steam-2" d="M32 21C31 17 33 13 32 9" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round"/>
              <path class="ts-steam-line ts-steam-3" d="M38 20C37 17 39 14 38 11" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round"/>
              <defs>
                <linearGradient id="tsCoffeeGrad" x1="16" y1="26" x2="48" y2="50" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6366F1"/>
                  <stop offset="1" stop-color="#4338CA"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div class="ts-progress-header-badge">
            <span>Translating to ${getLanguageDisplay(this.targetLang, this.config.languages)}</span>
          </div>

          <h3 class="ts-progress-title">Translation in progress...</h3>
          <p class="ts-progress-coffee-quote">
            Translation will take a few seconds or a minute, you can enjoy your coffee ☕ during this process.
          </p>

          <div class="ts-progress-section">
            <div class="ts-progress-meta-top">
              <span class="ts-progress-status-label" id="ts-modal-progress-status">${initialStatus}</span>
              <span class="ts-progress-percent-badge" id="ts-modal-progress-percent">0%</span>
            </div>
            <div class="ts-progress-track-wrap">
              <div class="ts-progress-track-fill" id="ts-modal-progress-bar" style="width: 0%;"></div>
            </div>
            <div class="ts-progress-sub-info">
              <span id="ts-modal-progress-subtext">${totalStrings > 0 ? `0 of ${totalStrings} strings translated` : 'Initializing translation...'}</span>
              <span class="ts-progress-provider-tag">
                <span>${providerInfo.icon}</span> ${providerInfo.title}
              </span>
            </div>
          </div>
        </div>
      `;

      if (reviewContainer) {
        reviewContainer.appendChild(overlay);
      } else {
        document.body.appendChild(overlay);
      }
    }

    /**
     * Update Translation Progress Bar & Status Text.
     */
    updateTranslationProgress(percent = 0, statusText = '', subText = '') {
      const bar = document.getElementById('ts-modal-progress-bar');
      const percentEl = document.getElementById('ts-modal-progress-percent');
      const statusEl = document.getElementById('ts-modal-progress-status');
      const subTextEl = document.getElementById('ts-modal-progress-subtext');

      const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));

      if (bar) bar.style.width = clampedPercent + '%';
      if (percentEl) percentEl.textContent = clampedPercent + '%';
      if (statusText && statusEl) statusEl.textContent = statusText;
      if (subText && subTextEl) subTextEl.textContent = subText;
    }

    /**
     * Close Translation Progress Overlay with smooth fade out.
     */
    closeTranslationProgressModal(immediate = false) {
      const modal = document.getElementById('ts-translation-progress-modal');
      if (!modal) return;

      if (immediate) {
        modal.remove();
      } else {
        modal.classList.add('ts-fade-out');
        setTimeout(() => modal.remove(), 320);
      }
    }

    /**
     * Extract strings from current active editor and run translation.
     */
    async processServerPostTranslation() {
      const restUrl = this.config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = this.config.nonce || '';
      const sourceId = this.sourcePostId || this.postId || this.config.postId || 0;

      const response = await fetch(restUrl + 'translate-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify({
          post_id: sourceId,
          target_lang: this.targetLang,
          provider: this.selectedProvider,
        }),
      });

      return await response.json();
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

    async extractAndTranslate() {
      try {
        const restUrl = this.config.restUrl || '/wp-json/translatesense/v1/';
        const nonce = this.config.nonce || '';

        if (!this.sourcePostId) {
          return;
        }

        // Fetch comprehensive source page content using TranslateSenseCore
        if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getPageContent === 'function') {
          try {
            this.sourcePageData = await window.TranslateSenseCore.getPageContent(this.sourcePostId);
          } catch (e) {
            console.warn('[TranslateSense] Could not fetch source page content:', e);
          }
        }

        const extractRes = await fetch(restUrl + 'extract-strings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
          body: JSON.stringify({
            post_id: this.sourcePostId,
            target_lang: this.targetLang,
            builder: this.editorType,
          }),
        });

        const data = await extractRes.json();
        let rawStrings = Array.isArray(data.strings) ? data.strings : [];

        // Exclude email addresses, URLs, and asset paths from translation
        rawStrings = rawStrings.filter((s) => !this.isEmailOrUrl(s.value || ''));

        if (!rawStrings || rawStrings.length === 0) {
          const serverRes = await this.processServerPostTranslation();

          if (serverRes.success && serverRes.edit_url) {
            window.location.href = serverRes.edit_url;
            return;
          }

          alert('No translatable strings found in current blocks matching XML rules.');
          return;
        }

        this.strings = rawStrings;
        this.openReviewModal();
        await this.performBatchTranslation();
      } catch (err) {
        this.closeTranslationProgressModal(true);
        alert('Extraction Error: ' + (err.message || 'Unknown error'));
      }
    }

    /**
     * Perform Batch Translation on Extracted Strings.
     */
    async performBatchTranslation() {
      this.isTranslating = true;
      const total = this.strings.length;

      // Show progress overlay on top of string modal
      this.showTranslationProgressModal(total, 'Starting translation...');
      this.updateTranslationProgress(10, 'Preparing strings...', `0 of ${total} strings translated`);

      const startTime = performance.now();
      let completedCount = 0;

      try {
        const itemsToTranslate = this.strings.map((s) => ({
          hash: s.hash,
          widget_id: s.name,
          field: s.key,
          source: s.source || s.value,
          content: s.value,
        }));

        const onProgress = (result) => {
          this.strings = this.strings.map((item) => {
            if (item.value === result.source || (result.hash && item.hash === result.hash)) {
              if (window.TranslateSenseCore) {
                window.TranslateSenseCore.saveSourceString(item.name, item.value, item.name);
                window.TranslateSenseCore.saveTranslatedString(
                  item.name,
                  item.source,
                  item.value,
                  result.translated,
                  this.selectedProvider,
                  item.name
                );
              }
              return {
                ...item,
                translated: result.translated,
                status: result.status || 'Completed',
              };
            }
            return item;
          });

          // Live update table rows in background under the blur
          this.renderReviewTableRows();

          // Count translated
          completedCount = this.strings.filter((s) => s.translated && s.translated.trim() !== '').length;
          const pct = Math.min(98, Math.max(15, Math.round((completedCount / total) * 100)));
          this.updateTranslationProgress(
            pct,
            `Translating strings... (${pct}%)`,
            `${completedCount} of ${total} strings translated`
          );
        };

        await window.TranslateSenseCore.translate(
          this.selectedProvider,
          {
            items: itemsToTranslate,
            sourceLang: this.sourceLanguage || 'en',
            targetLang: this.targetLang,
            postId: this.postId || this.config.postId || 0,
          },
          onProgress
        );

        // Compute Statistics (based on original source characters)
        const elapsedMs = performance.now() - startTime;
        const elapsedSec = (elapsedMs / 1000).toFixed(1);
        const timeFormatted = elapsedMs >= 60000
          ? `${Math.floor(elapsedMs / 60000)}m ${Math.round((elapsedMs % 60000) / 1000)}s`
          : `${elapsedSec}s`;

        const totalSourceChars = this.strings.reduce((sum, s) => {
          const val = String(s.value || '');
          return sum + val.length;
        }, 0);

        const totalTransChars = this.strings.reduce((sum, s) => {
          const isTranslated = s.translated && String(s.translated).trim() !== '';
          if (isTranslated) {
            const originalVal = String(s.value || '');
            return sum + originalVal.length;
          }
          return sum;
        }, 0);

        this.translationStats = {
          timeTaken: timeFormatted,
          totalChars: totalSourceChars,
          translatedChars: totalTransChars,
          stringCount: total,
        };

        // Update Stats Header in Review Modal
        this.updateStatsHeader();

        // 100% Progress Complete
        this.updateTranslationProgress(
          100,
          '✓ Translation Completed (100%)',
          `All ${total} strings translated successfully!`
        );

        // Graceful 1-2 seconds delay (1400ms) before fading out overlay
        await new Promise((resolve) => setTimeout(resolve, 1400));

        this.closeTranslationProgressModal();
      } catch (err) {
        this.closeTranslationProgressModal(true);
        alert('Translation Batch Error: ' + (err.message || 'Error'));
      } finally {
        this.isTranslating = false;
        this.updateReviewTableStatus('⚡ Re-Translate All');
      }
    }

    /**
     * Update stats cards in review modal header dynamically based on original characters.
     */
    updateStatsHeader() {
      const totalSourceChars = this.strings.reduce((sum, s) => sum + String(s.value || '').length, 0);
      const totalTransChars = this.strings.reduce((sum, s) => {
        const isTranslated = s.translated && String(s.translated).trim() !== '';
        return sum + (isTranslated ? String(s.value || '').length : 0);
      }, 0);

      const timeEl = document.querySelector('#ts-universal-review-modal .ts-stat-time .ts-stat-value');
      const srcCharsEl = document.querySelector('#ts-universal-review-modal .ts-stat-source-chars .ts-stat-value');
      const transCharsEl = document.querySelector('#ts-universal-review-modal .ts-stat-trans-chars .ts-stat-value');
      const totalEl = document.querySelector('#ts-universal-review-modal .ts-stat-total .ts-stat-value');

      if (this.translationStats && timeEl) timeEl.textContent = this.translationStats.timeTaken;
      if (srcCharsEl) srcCharsEl.textContent = totalSourceChars.toLocaleString();
      if (transCharsEl) transCharsEl.textContent = totalTransChars.toLocaleString();
      if (totalEl) totalEl.textContent = this.strings.length;
    }

    /**
     * Open Pure Vanilla JS Strings Review Modal with Header Stats Bar.
     */
    openReviewModal() {
      let modalContainer = document.getElementById('ts-universal-review-modal');
      if (modalContainer) return; // Keep existing if already opened

      const totalSourceChars = this.strings.reduce((sum, s) => sum + String(s.value || '').length, 0);
      const totalTransChars = this.strings.reduce((sum, s) => {
        const isTranslated = s.translated && String(s.translated).trim() !== '';
        return sum + (isTranslated ? String(s.value || '').length : 0);
      }, 0);

      const stats = this.translationStats || {
        timeTaken: '0.0s',
        totalChars: totalSourceChars,
        translatedChars: totalTransChars,
        stringCount: this.strings.length,
      };

      const providerInfo = this.getSelectedProviderInfo();

      modalContainer = document.createElement('div');
      modalContainer.id = 'ts-universal-review-modal';
      modalContainer.className = 'ts-strings-review-modal';
      modalContainer.innerHTML = `
        <div class="ts-review-container" onclick="event.stopPropagation()">
          <div class="ts-review-header">
            <div class="ts-review-header-title">
              <h3>⚡ Review Translations</h3>
              <span class="ts-badge-pill">${getLanguageDisplay(this.targetLang, this.config.languages)}</span>
              <span class="ts-badge-pill">${providerInfo.icon} ${providerInfo.title}</span>
            </div>
            <button class="ts-bulk-close" id="ts-review-modal-close" title="Close">✕</button>
          </div>
          <div class="ts-review-body">
            <!-- Header Stats Bar -->
            <div class="ts-modal-stats-bar">
              <div class="ts-stat-card ts-stat-time">
                <div class="ts-stat-icon-wrap">⏱️</div>
                <div class="ts-stat-content">
                  <span class="ts-stat-label">Translation Time</span>
                  <span class="ts-stat-value">${stats.timeTaken}</span>
                </div>
              </div>
              <div class="ts-stat-card ts-stat-source-chars">
                <div class="ts-stat-icon-wrap">📄</div>
                <div class="ts-stat-content">
                  <span class="ts-stat-label">Total Characters</span>
                  <span class="ts-stat-value">${stats.totalChars.toLocaleString()}</span>
                </div>
              </div>
              <div class="ts-stat-card ts-stat-trans-chars">
                <div class="ts-stat-icon-wrap">✨</div>
                <div class="ts-stat-content">
                  <span class="ts-stat-label">Translated Chars</span>
                  <span class="ts-stat-value">${stats.translatedChars.toLocaleString()}</span>
                </div>
              </div>
              <div class="ts-stat-card ts-stat-total">
                <div class="ts-stat-icon-wrap">🔤</div>
                <div class="ts-stat-content">
                  <span class="ts-stat-label">Total Strings</span>
                  <span class="ts-stat-value">${stats.stringCount}</span>
                </div>
              </div>
            </div>

            <!-- Toolbar (Search & Actions) -->
            <div class="ts-review-toolbar">
              <div class="ts-review-search-wrap">
                <span class="ts-review-search-icon">🔍</span>
                <input type="text" id="ts-review-search-input" class="ts-review-search-input" placeholder="Search source or translated text..." />
              </div>
              <div>
                <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-retranslate-btn">
                  ⚡ Re-Translate All
                </button>
              </div>
            </div>

            <!-- Strings Table Card -->
            <div class="ts-table-card">
              <table class="ts-strings-table">
                <thead>
                  <tr>
                    <th style="width: 38%;">Source Text & XML Rule</th>
                    <th style="width: 14%;">Status</th>
                    <th style="width: 48%;">Translated Text (Editable)</th>
                  </tr>
                </thead>
                <tbody id="ts-review-table-tbody"></tbody>
              </table>
            </div>
          </div>
          <div class="ts-review-footer">
            <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-review-cancel-btn">Cancel</button>
            <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-apply-to-editor-btn">✓ Apply to Page</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      // Close handlers
      const closeModal = () => modalContainer.remove();
      document.getElementById('ts-review-modal-close').addEventListener('click', closeModal);
      document.getElementById('ts-review-cancel-btn').addEventListener('click', closeModal);

      // Search filter listener
      const searchInput = document.getElementById('ts-review-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.renderReviewTableRows(e.target.value);
        });
      }

      // Re-translate button
      document.getElementById('ts-retranslate-btn').addEventListener('click', async () => {
        await this.performBatchTranslation();
      });

      // Apply to editor button
      document.getElementById('ts-apply-to-editor-btn').addEventListener('click', async () => {
        await this.applyTranslationsToEditor();
        closeModal();
      });

      this.renderReviewTableRows();
    }

    /**
     * Render review table rows with optional search filtering and live character counter.
     */
    renderReviewTableRows(filterQuery = '') {
      const tbody = document.getElementById('ts-review-table-tbody');
      if (!tbody) return;

      const q = (filterQuery || '').toLowerCase().trim();
      const filtered = this.strings
        .map((item, idx) => ({ ...item, originalIndex: idx }))
        .filter((item) => {
          if (!q) return true;
          const src = String(item.value || '').toLowerCase();
          const trans = String(item.translated || '').toLowerCase();
          const name = String(item.name || '').toLowerCase();
          const key = String(item.key || '').toLowerCase();
          return src.includes(q) || trans.includes(q) || name.includes(q) || key.includes(q);
        });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; padding: 36px 20px; color: #64748b;">
              <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
              <div>No matching strings found for "<strong>${this.escapeHtml(filterQuery)}</strong>".</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map((item) => {
        const idx = item.originalIndex;
        const sourceVal = item.value || '';
        const transVal = item.translated || '';
        const statusClass = (item.status || 'pending').toLowerCase().replace(/[^a-z]/g, '');

        return `
          <tr data-idx="${idx}">
            <td>
              <div class="ts-source-text">${this.escapeHtml(sourceVal)}</div>
              <div class="ts-widget-tag">
                <span>🧩</span>
                <span>${this.escapeHtml(item.name || 'block')} &rarr; ${this.escapeHtml(item.key || 'text')}</span>
                <span style="margin-left: 4px; opacity: 0.85;">(${sourceVal.length} chars)</span>
              </div>
            </td>
            <td>
              <span class="ts-status-tag ${statusClass}">
                ${item.status || 'Pending'}
              </span>
            </td>
            <td>
              <div class="ts-input-wrap">
                <textarea class="ts-trans-input" data-idx="${idx}" placeholder="Enter translation...">${this.escapeHtml(transVal)}</textarea>
                <span class="ts-row-char-count" id="ts-char-count-${idx}">${transVal.length} chars</span>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Input changes listener & dynamic character counter
      tbody.querySelectorAll('.ts-trans-input').forEach((input) => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          const val = e.target.value;
          if (this.strings[idx]) {
            this.strings[idx].translated = val;
            this.strings[idx].status = 'Custom';

            // Update row status badge if needed
            const row = e.target.closest('tr');
            if (row) {
              const badge = row.querySelector('.ts-status-tag');
              if (badge) {
                badge.className = 'ts-status-tag custom';
                badge.textContent = 'Custom';
              }
            }

            // Update character count
            const counter = document.getElementById(`ts-char-count-${idx}`);
            if (counter) {
              counter.textContent = `${val.length} chars`;
            }

            // Dynamically recompute header Translated Chars count based on original source characters
            this.updateStatsHeader();
          }
        });
      });
    }

    /**
     * Escape HTML special characters for safe DOM insertion.
     */
    escapeHtml(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    updateReviewTableStatus(text) {
      const btn = document.getElementById('ts-retranslate-btn');
      if (btn) {
        btn.textContent = text;
        btn.disabled = this.isTranslating;
      }
    }

    /**
     * Apply translated strings back to the active editor (Gutenberg, Elementor, Classic).
     */
    async applyTranslationsToEditor() {
      // Ensure sourcePageData is fetched if not present
      if (!this.sourcePageData && this.sourcePostId && window.TranslateSenseCore && typeof window.TranslateSenseCore.getPageContent === 'function') {
        try {
          this.sourcePageData = await window.TranslateSenseCore.getPageContent(this.sourcePostId);
        } catch (e) {
          console.warn('[TranslateSense] Could not fetch source page content:', e);
        }
      }

      const restUrl = this.config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = this.config.nonce || '';
      const currentPostId = this.postId || this.config.postId || 0;

      // Mark this post with _translatesense_traslated = 1
      if (currentPostId) {
        fetch(restUrl + 'mark-translated', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
          body: JSON.stringify({ post_id: currentPostId }),
        }).catch((err) => {
          console.warn('[TranslateSense] Could not update translated flag:', err);
        });
      }

      // Hide or remove Translate buttons on current page
      const metaBoxBtn = document.getElementById('ts-metabox-translate-btn');
      if (metaBoxBtn) {
        const metaContent = metaBoxBtn.closest('.translatesense-metabox-content') || metaBoxBtn.parentElement;
        if (metaContent) {
          metaContent.innerText = 'Translations Applied';
          metaContent.className = 'disabled';
        }
      }
      const mediaBtn = document.getElementById('ts-media-translate-btn');
      if (mediaBtn) {
        mediaBtn.innerText = 'Translations Applied';
        mediaBtn.className = 'disabled';
      }

      if (window.TranslateSenseCore && typeof window.TranslateSenseCore.applyToPageEditor === 'function') {
        const result = await window.TranslateSenseCore.applyToPageEditor(this.editorType, {
          strings: this.strings,
          sourcePageData: this.sourcePageData,
          options: {
            provider: this.selectedProvider
          }
        });

        if (result && result.success) {
          console.log(`[TranslateSense] Successfully applied ${result.count} translated strings to ${result.editor} editor.`);
        }
      } else if (window.TranslateSenseLiveUpdater) {
        await window.TranslateSenseLiveUpdater.apply({
          strings: this.strings,
          editorType: this.editorType,
          options: {
            sourcePageData: this.sourcePageData, provider: this.selectedProvider
          },
        });
      } else {
        alert('🎉 Translations applied to page successfully!');
      }
    }
  }

  // Initialize on DOM Ready
  function initTranslateSenseEditor() {
    window.TranslateSenseEditorInstance = new TranslateSenseEditor();
  }

  initTranslateSenseEditor();
})(window, document);

