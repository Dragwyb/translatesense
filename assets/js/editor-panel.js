/**
 * TranslateSense - Universal Page Editor Panel (editor-panel.js)
 * 
 * 100% Pure Vanilla JavaScript (NO React, NO wp.element, NO useState).
 * Features:
 * 1. Source Post / Parent Post detection via _translatesense_source_id & from_post query parameter
 * 2. Editor-type detection for source post (Elementor, Divi, Gutenberg, Classic)
 * 3. Page load auto-translate prompt modal with editor-specific guidance
 * 4. Context-aware Translate button triggers across all editors
 */

(function (window, document) {
  'use strict';

  // Helper to dynamically get active enabled providers registered on TranslateSenseCore
  function getRegisteredProviders() {
    if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getProviders === 'function') {
      const providers = window.TranslateSenseCore.getProviders(true);
      if (providers.length > 0) return providers;
      const all = window.TranslateSenseCore.getProviders(false);
      if (all.length > 0) return all;
    }
    return [
      { id: 'openai', title: 'OpenAI (GPT-4o)', icon: '🧠', desc: 'High accuracy translation via OpenAI ChatGPT API.', category: 'ai' },
      { id: 'gemini', title: 'Gemini AI', icon: '✨', desc: 'Next-gen multilingual translation via Google Gemini AI.', category: 'ai' },
      { id: 'chrome_ai', title: 'Chrome Local AI', icon: '🤖', desc: 'On-device translation powered by Chrome built-in AI (window.ai).', category: 'browser' },
    ];
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
      this.selectedProvider = this.config.defaultProvider || 'openai';
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
        case 'divi':
          this.initDivi();
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
        case 'divi':
          return 'Divi';
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
      const existing = document.getElementById('ts-source-editor-guidance-modal');
      if (existing) existing.remove();

      const sourceEditorName = this.getEditorDisplayName(this.sourceEditorType);
      const isElementorOrDivi = this.sourceEditorType === 'elementor' || this.sourceEditorType === 'divi';

      let modalTitle = '⚡ Translate Page Content';
      let modalMessage = '';
      let actionBtnText = '🚀 Continue to Translation';

      if (!['elementor', 'divi'].includes(this.editorType) && isElementorOrDivi) {
        modalTitle = `🌐 Source Post: ${sourceEditorName} Editor Detected`;
        modalMessage = `Original post created with <strong>${sourceEditorName}</strong> editor.<br><br>If you want to translate this post in same editor then Click on <strong>Translate with ${sourceEditorName}</strong> button, or click the close icon to close this modal.`;
        actionBtnText = `⚡ Translate with ${sourceEditorName}`;
      } else {
        const srcDisplay = this.sourceLanguage ? `from <strong>${this.sourceLanguage.toUpperCase()}</strong> ` : '';
        modalMessage = `If you want to translate this post automatically ${srcDisplay}to <strong>${this.targetLang.toUpperCase()}</strong>, click to continue or close this modal.`;
        actionBtnText = '🚀 Continue to Translation';
      }

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
      // Gutenberg metabox is rendered via WordPress add_meta_box natively.
      // Trigger bindings are handled globally by bindUniversalTriggers().
    }

    /**
     * Bind generic trigger buttons anywhere in the DOM (Metaboxes, Media button, Divi, Elementor).
     */
    bindUniversalTriggers() {
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.ts-open-translate-btn, #ts-metabox-translate-btn, #ts-media-translate-btn, #ts-elementor-translate-btn, #ts-divi-translate-btn, #ts-classic-translate-btn');
        if (trigger) {
          e.preventDefault();

          // If source post was built in Elementor or Divi, show editor-specific prompt modal first
          if (!['elementor', 'divi'].includes(this.editorType) && (this.sourceEditorType === 'elementor' || this.sourceEditorType === 'divi')) {
            this.showSourceEditorPromptModal(false);
          } else {
            this.openProviderModal();
          }
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
     * Divi Visual Builder: Insert translate button into Divi Builder.
     */
    initDivi() {
      const checkDivi = () => {
        const diviBar = document.querySelector('.et-fb-page-settings-bar') || document.getElementById('et-fb-app') || document.getElementById('et-main-area');
        if (diviBar && !document.getElementById('ts-divi-translate-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.id = 'ts-divi-translate-btn';
          btn.className = 'ts-open-translate-btn et-fb-button';
          btn.style.cssText = 'position: fixed; bottom: 85px; right: 25px; z-index: 999999; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #fff; border: none; padding: 10px 18px; border-radius: 50px; font-weight: 700; font-size: 13px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;';
          btn.innerHTML = '⚡ Translate Page';
          document.body.appendChild(btn);
        }
      };

      checkDivi();
      setInterval(checkDivi, 1500);
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
        <div class="ts-review-container" style="max-width: 640px;" onclick="event.stopPropagation()">
          <div class="ts-review-header">
            <h3>🌐 Choose Translation Provider</h3>
            <button class="ts-bulk-close" id="ts-provider-modal-close">✕</button>
          </div>
          <div class="ts-review-body">
            <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0;">
              Translating content for page language: <strong style="color: #4f46e5;">🌐 ${this.targetLang.toUpperCase()}</strong>
            </p>
            <div class="ts-provider-grid">
              ${providersList.map((p, idx) => `
                <div class="ts-provider-card ${p.id === this.selectedProvider ? 'selected' : (idx === 0 ? 'selected' : '')}" data-provider="${p.id}">
                  <input type="radio" name="ts_provider_choice" value="${p.id}" ${p.id === this.selectedProvider ? 'checked' : (idx === 0 ? 'checked' : '')} class="ts-provider-radio" />
                  <div class="ts-provider-info">
                    <div class="ts-provider-title">
                      <span>${p.icon} ${p.title}</span>
                    </div>
                    <p class="ts-provider-desc">${p.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="ts-review-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-provider-modal-cancel">Cancel</button>
            <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-provider-modal-start">🚀 Start Translation</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      // Card Selection
      modalContainer.querySelectorAll('.ts-provider-card').forEach((card) => {
        card.addEventListener('click', () => {
          modalContainer.querySelectorAll('.ts-provider-card').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          const radio = card.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
          this.selectedProvider = card.getAttribute('data-provider');
        });
      });

      // Close handlers
      const closeModal = () => modalContainer.remove();
      document.getElementById('ts-provider-modal-close').addEventListener('click', closeModal);
      document.getElementById('ts-provider-modal-cancel').addEventListener('click', closeModal);

      // Start Translation Action
      document.getElementById('ts-provider-modal-start').addEventListener('click', async () => {
        const checked = modalContainer.querySelector('input[name="ts_provider_choice"]:checked');
        if (checked) this.selectedProvider = checked.value;

        closeModal();
        await this.extractAndTranslate();
      });
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
        if (!data.strings || data.strings.length === 0) {
          const serverRes = await this.processServerPostTranslation();

          if (serverRes.success && serverRes.edit_url) {
            window.location.href = serverRes.edit_url;
            return;
          }

          alert('No translatable strings found in current blocks matching XML rules.');
          return;
        }

        this.strings = data.strings;
        this.openReviewModal();
        await this.performBatchTranslation();
      } catch (err) {
        alert('Extraction Error: ' + (err.message || 'Unknown error'));
      }
    }

    /**
     * Perform Batch Translation on Extracted Strings.
     */
    async performBatchTranslation() {
      this.isTranslating = true;
      this.updateReviewTableStatus('Translating...');

      try {
        const itemsToTranslate = this.strings.map((s) => ({
          hash: s.hash,
          widget_id: s.name,
          field: s.key,
          source: s.source,
          content: s.value,
        }));

        const onProgress = (result) => {
          this.strings = this.strings.map((item) => {
            if (item.source === result.source || (result.hash && item.hash === result.hash)) {
              if (window.TranslateSenseCore) {
                window.TranslateSenseCore.saveSourceString(item.field || item.widget_id, item.source, item.widget_id);
                window.TranslateSenseCore.saveTranslatedString(
                  item.field || item.widget_id,
                  item.source,
                  result.translated,
                  this.selectedProvider,
                  item.widget_id
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
          this.renderReviewTableRows();
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
      } catch (err) {
        alert('Translation Batch Error: ' + (err.message || 'Error'));
      } finally {
        this.isTranslating = false;
        this.updateReviewTableStatus('Re-Translate All');
      }
    }

    /**
     * Open Pure Vanilla JS Strings Review Modal.
     */
    openReviewModal() {
      const existing = document.getElementById('ts-universal-review-modal');
      if (existing) existing.remove();

      const modalContainer = document.createElement('div');
      modalContainer.id = 'ts-universal-review-modal';
      modalContainer.className = 'ts-strings-review-modal';
      modalContainer.innerHTML = `
        <div class="ts-review-container" onclick="event.stopPropagation()">
          <div class="ts-review-header">
            <h3>Review Translations (${this.targetLang.toUpperCase()}) - <span id="ts-strings-count">${this.strings.length}</span> Strings</h3>
            <button class="ts-bulk-close" id="ts-review-modal-close">✕</button>
          </div>
          <div class="ts-review-body">
            <div style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
              <button type="button" class="ts-btn ts-btn-primary" id="ts-retranslate-btn">
                ⚡ Re-Translate All
              </button>
            </div>
            <table class="ts-strings-table">
              <thead>
                <tr>
                  <th style="width: 40%;">Source Text (XML Rule)</th>
                  <th style="width: 15%;">Status</th>
                  <th style="width: 45%;">Translated Text (Editable)</th>
                </tr>
              </thead>
              <tbody id="ts-review-table-tbody"></tbody>
            </table>
          </div>
          <div class="ts-review-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
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

      // Re-translate button
      document.getElementById('ts-retranslate-btn').addEventListener('click', () => {
        this.performBatchTranslation();
      });

      // Apply to editor button
      document.getElementById('ts-apply-to-editor-btn').addEventListener('click', () => {
        this.applyTranslationsToEditor();
        closeModal();
      });

      this.renderReviewTableRows();
    }

    renderReviewTableRows() {
      const tbody = document.getElementById('ts-review-table-tbody');
      if (!tbody) return;

      tbody.innerHTML = this.strings.map((item, idx) => `
        <tr data-idx="${idx}">
          <td>
            <div class="ts-source-text">${item.value || ''}</div>
            <div class="ts-widget-tag">${item.name || 'block'} &rarr; ${item.key || 'text'}</div>
          </td>
          <td>
            <span class="ts-status-tag ${(item.status || 'pending').toLowerCase().replace(/[^a-z]/g, '')}">
              ${item.status || 'Pending'}
            </span>
          </td>
          <td>
            <input type="text" class="ts-trans-input" data-idx="${idx}" value="${(item.translated || '').replace(/"/g, '&quot;')}" placeholder="Enter translation..." />
          </td>
        </tr>
      `).join('');

      // Input changes listener
      tbody.querySelectorAll('.ts-trans-input').forEach((input) => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          if (this.strings[idx]) {
            this.strings[idx].translated = e.target.value;
            this.strings[idx].status = 'Custom';
          }
        });
      });
    }

    updateReviewTableStatus(text) {
      const btn = document.getElementById('ts-retranslate-btn');
      if (btn) {
        btn.textContent = text;
        btn.disabled = this.isTranslating;
      }
    }

    /**
     * Apply translated strings back to the active editor (Gutenberg, Elementor, Divi, Classic).
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

      if (window.TranslateSenseCore && typeof window.TranslateSenseCore.applyToPageEditor === 'function') {
        const result = await window.TranslateSenseCore.applyToPageEditor(this.editorType, {
          strings: this.strings,
          sourcePageData: this.sourcePageData,
        });

        if (result && result.success) {
          console.log(`[TranslateSense] Successfully applied ${result.count} translated strings to ${result.editor} editor.`);
        }
      } else if (window.TranslateSenseLiveUpdater) {
        await window.TranslateSenseLiveUpdater.apply({
          strings: this.strings,
          editorType: this.editorType,
          options: { sourcePageData: this.sourcePageData },
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
