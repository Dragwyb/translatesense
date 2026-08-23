/**
 * TranslateSense - Bulk Translation Flow on WP List Table (bulk-translate.js)
 * 
 * 100% Pure Vanilla JavaScript for maximum performance and cross-browser/cross-editor compatibility.
 */

(function (window, document) {
  'use strict';

  // Helper to dynamically get providers registered on TranslateSenseCore
  function getRegisteredProviders() {
    if (window.TranslateSenseCore && typeof window.TranslateSenseCore.getProviders === 'function') {
      const providers = window.TranslateSenseCore.getProviders();
      if (providers.length > 0) return providers;
    }
    return [
      { id: 'openai', title: 'OpenAI (GPT-4o)', icon: '🧠', desc: 'High accuracy translation via OpenAI ChatGPT API.' },
      { id: 'gemini', title: 'Gemini AI', icon: '✨', desc: 'Next-gen multilingual translation via Google Gemini AI.' },
      { id: 'google_widget', title: 'Google Widget', icon: '🚀', desc: 'Instant frontend translation widget. No API key required.' },
      { id: 'chrome_ai', title: 'Chrome Local AI', icon: '🤖', desc: 'On-device translation powered by Chrome built-in AI (window.ai).' },
    ];
  }

  function initBulkTranslate() {
    const config = window.TranslateSenseBulkData || {};

    // Ensure button is inserted next to Filter submit if not rendered by hook
    const postQuerySubmit = document.getElementById('post-query-submit');
    if (!document.getElementById('ts-quick-filter-translate-btn') && postQuerySubmit) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ts-quick-filter-translate-btn';
      btn.className = 'button button-primary ts-filter-action-btn';
      btn.style.cssText = 'margin-left: 6px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); border-color: #3730a3; color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(79,70,229,0.35);';
      btn.innerHTML = '<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1;"></span> Translate Selected';
      postQuerySubmit.insertAdjacentElement('afterend', btn);
    }

    // Get selected post IDs from table checkboxes
    function getSelectedPostIds() {
      const checkedBoxes = document.querySelectorAll('input[name="post[]"]:checked');
      const ids = [];
      checkedBoxes.forEach(function (cb) {
        if (cb.value) ids.push(cb.value);
      });
      return ids;
    }

    // Direct click on "Translate Selected" button (next to Filter button)
    document.addEventListener('click', function (e) {
      const target = e.target.closest('#ts-quick-filter-translate-btn');
      if (target) {
        e.preventDefault();
        const selectedPosts = getSelectedPostIds();
        if (selectedPosts.length === 0) {
          alert('Please select posts first.');
          return false;
        }
        openBulkTranslateWizard(selectedPosts);
      }
    });

    // Intercept Bulk Action Dropdown
    const doAction1 = document.getElementById('doaction');
    const doAction2 = document.getElementById('doaction2');

    [doAction1, doAction2].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        const selectName = btn.id === 'doaction' ? 'action' : 'action2';
        const selectEl = document.querySelector(`select[name="${selectName}"]`);
        if (selectEl && selectEl.value === 'translatesense_bulk_translate') {
          e.preventDefault();
          const selectedPosts = getSelectedPostIds();
          if (selectedPosts.length === 0) {
            alert('Please select posts first.');
            return false;
          }
          openBulkTranslateWizard(selectedPosts);
        }
      });
    });

    // Multi-Step Bulk Translation Wizard (Pure Vanilla JS)
    function openBulkTranslateWizard(postIds) {
      const allLanguages = config.languages || [];
      const defaultLang = config.defaultLanguage || 'en';

      let selectedTargetLangs = allLanguages
        .filter((l) => l.slug !== defaultLang)
        .map((l) => l.slug);

      if (selectedTargetLangs.length === 0 && allLanguages.length > 0) {
        selectedTargetLangs = [allLanguages[0].slug];
      }

      let selectedProviderId = 'openai';

      // Ensure root container exists
      let root = document.getElementById('translatesense-bulk-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'translatesense-bulk-modal-root';
        document.body.appendChild(root);
      }

      const providers = getRegisteredProviders();

      // Render Modal Skeleton Once (prevents blinking)
      root.innerHTML = `
        <div class="ts-bulk-overlay" id="ts-bulk-modal-overlay">
          <div class="ts-bulk-modal">
            <div class="ts-bulk-header">
              <h2>⚡ TranslateSense Bulk Translation</h2>
              <button class="ts-bulk-close" id="ts-bulk-close-btn">&times;</button>
            </div>
            
            <div class="ts-bulk-body">
              <!-- Step 1 View: Languages -->
              <div id="ts-view-step-1">
                <div class="ts-step-bar">
                  <div class="ts-step-item active">
                    <span class="ts-step-number">1</span>
                    <span>Select Target Languages</span>
                  </div>
                  <span class="ts-step-divider">&rarr;</span>
                  <div class="ts-step-item">
                    <span class="ts-step-number">2</span>
                    <span>Choose Provider</span>
                  </div>
                </div>

                <p style="margin-top: 0; color: #64748b; font-size: 13px;">
                  Selected <strong>${postIds.length}</strong> post(s). Choose target language(s) to translate into:
                </p>

                <div class="ts-lang-actions">
                  <div class="ts-lang-btn-group">
                    <button type="button" class="ts-lang-action-btn" id="ts-select-all-langs">✓ Select All</button>
                    <button type="button" class="ts-lang-action-btn" id="ts-unselect-all-langs">✕ Unselect All</button>
                  </div>
                  <div class="ts-lang-counter" id="ts-lang-counter">
                    ${selectedTargetLangs.length} of ${allLanguages.length} selected
                  </div>
                </div>

                <div class="ts-lang-grid" id="ts-lang-grid">
                  ${allLanguages
                    .map((lang) => {
                      const isChecked = selectedTargetLangs.includes(lang.slug);
                      return `
                        <div class="ts-lang-card ${isChecked ? 'selected' : ''}" data-lang="${lang.slug}">
                          <input type="checkbox" class="ts-lang-checkbox" value="${lang.slug}" ${isChecked ? 'checked' : ''} />
                          <span class="ts-lang-name">${lang.name}</span>
                          <span class="ts-lang-code">${lang.slug.toUpperCase()}</span>
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              </div>

              <!-- Step 2 View: Provider -->
              <div id="ts-view-step-2" style="display: none;">
                <div class="ts-step-bar">
                  <div class="ts-step-item">
                    <span class="ts-step-number">✓</span>
                    <span id="ts-summary-step1-label">${selectedTargetLangs.length} Languages</span>
                  </div>
                  <span class="ts-step-divider">&rarr;</span>
                  <div class="ts-step-item active">
                    <span class="ts-step-number">2</span>
                    <span>Choose Provider</span>
                  </div>
                </div>

                <div class="ts-summary-box" id="ts-summary-box-content"></div>

                <div class="ts-bulk-field">
                  <label>Choose Translation Engine</label>
                  <div class="ts-provider-grid">
                    ${providers.map(
                      (p) => `
                      <div class="ts-provider-card ${p.id === selectedProviderId ? 'selected' : ''}" data-provider="${p.id}">
                        <input type="radio" name="ts_bulk_provider" value="${p.id}" ${p.id === selectedProviderId ? 'checked' : ''} class="ts-provider-radio" />
                        <div class="ts-provider-info">
                          <div class="ts-provider-title">
                            <span>${p.icon} ${p.title}</span>
                          </div>
                          <p class="ts-provider-desc">${p.desc}</p>
                        </div>
                      </div>
                    `
                    ).join('')}
                  </div>
                </div>

                <!-- Live Progress -->
                <div class="ts-progress-wrap" id="ts-progress-wrap" style="display: none;">
                  <div class="ts-progress-bar-bg">
                    <div class="ts-progress-bar-fill" id="ts-progress-bar-fill"></div>
                  </div>
                  <div class="ts-progress-text">
                    <span id="ts-progress-status">Starting batch translation...</span>
                    <span id="ts-progress-percent">0%</span>
                  </div>
                  <div class="ts-progress-logs" id="ts-progress-logs"></div>
                </div>
              </div>
            </div>

            <!-- Modal Footers -->
            <div class="ts-bulk-footer" id="ts-footer-step-1" style="display: flex; justify-content: flex-end;">
              <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-wizard-next-btn" ${selectedTargetLangs.length === 0 ? 'disabled' : ''}>
                Next: Choose Provider &rarr;
              </button>
            </div>

            <div class="ts-bulk-footer" id="ts-footer-step-2" style="display: none; justify-content: space-between;">
              <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-wizard-back-btn">&larr; Back</button>
              <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-bulk-start-btn">🚀 Start Bulk Translation</button>
            </div>
          </div>
        </div>
      `;

      // Close modal handler
      const closeBtn = document.getElementById('ts-bulk-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          root.innerHTML = '';
        });
      }

      // Update UI state for language selection smoothly without DOM rebuild
      function updateLanguageSelectionState() {
        const count = selectedTargetLangs.length;
        const counterEl = document.getElementById('ts-lang-counter');
        const nextBtn = document.getElementById('ts-wizard-next-btn');

        if (counterEl) counterEl.textContent = `${count} of ${allLanguages.length} selected`;
        if (nextBtn) nextBtn.disabled = count === 0;

        document.querySelectorAll('.ts-lang-card').forEach(function (card) {
          const slug = card.getAttribute('data-lang');
          const isSelected = selectedTargetLangs.includes(slug);
          card.classList.toggle('selected', isSelected);
          const cb = card.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = isSelected;
        });
      }

      // 1. Language Card Click Listeners
      document.querySelectorAll('.ts-lang-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          const slug = card.getAttribute('data-lang');
          const isInput = e.target && e.target.type === 'checkbox';

          if (isInput) {
            const checked = e.target.checked;
            if (checked) {
              if (!selectedTargetLangs.includes(slug)) selectedTargetLangs.push(slug);
            } else {
              selectedTargetLangs = selectedTargetLangs.filter((s) => s !== slug);
            }
          } else {
            if (selectedTargetLangs.includes(slug)) {
              selectedTargetLangs = selectedTargetLangs.filter((s) => s !== slug);
            } else {
              selectedTargetLangs.push(slug);
            }
          }

          updateLanguageSelectionState();
        });
      });

      // Select All Button
      const selectAllBtn = document.getElementById('ts-select-all-langs');
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function () {
          selectedTargetLangs = allLanguages.map((l) => l.slug);
          updateLanguageSelectionState();
        });
      }

      // Unselect All Button
      const unselectAllBtn = document.getElementById('ts-unselect-all-langs');
      if (unselectAllBtn) {
        unselectAllBtn.addEventListener('click', function () {
          selectedTargetLangs = [];
          updateLanguageSelectionState();
        });
      }

      // 2. Step 1 -> Step 2 Navigation
      const nextBtn = document.getElementById('ts-wizard-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (selectedTargetLangs.length === 0) {
            alert('Please select at least one target language.');
            return;
          }

          const totalTranslations = postIds.length * selectedTargetLangs.length;
          const langTags = allLanguages
            .filter((l) => selectedTargetLangs.includes(l.slug))
            .map((l) => `<span class="ts-summary-tag">${l.name} (${l.slug.toUpperCase()})</span>`)
            .join(' ');

          const step1Label = document.getElementById('ts-summary-step1-label');
          const summaryContent = document.getElementById('ts-summary-box-content');

          if (step1Label) step1Label.textContent = `${selectedTargetLangs.length} Languages`;
          if (summaryContent) {
            summaryContent.innerHTML = `
              <div><strong>Bulk Job Summary:</strong> <strong>${postIds.length}</strong> post(s) &times; <strong>${selectedTargetLangs.length}</strong> language(s) = <strong>${totalTranslations}</strong> total translations.</div>
              <div class="ts-summary-tags" style="margin-top: 6px;">
                ${langTags}
              </div>
            `;
          }

          // Smooth view transition
          const view1 = document.getElementById('ts-view-step-1');
          const footer1 = document.getElementById('ts-footer-step-1');
          const view2 = document.getElementById('ts-view-step-2');
          const footer2 = document.getElementById('ts-footer-step-2');

          if (view1) view1.style.display = 'none';
          if (footer1) footer1.style.display = 'none';
          if (view2) view2.style.display = 'block';
          if (footer2) footer2.style.display = 'flex';
        });
      }

      // Step 2 -> Step 1 (Back Navigation)
      const backBtn = document.getElementById('ts-wizard-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          const view1 = document.getElementById('ts-view-step-1');
          const footer1 = document.getElementById('ts-footer-step-1');
          const view2 = document.getElementById('ts-view-step-2');
          const footer2 = document.getElementById('ts-footer-step-2');

          if (view2) view2.style.display = 'none';
          if (footer2) footer2.style.display = 'none';
          if (view1) view1.style.display = 'block';
          if (footer1) footer1.style.display = 'flex';
        });
      }

      // Provider Selection Card Click
      document.querySelectorAll('.ts-provider-card').forEach(function (card) {
        card.addEventListener('click', function () {
          document.querySelectorAll('.ts-provider-card').forEach(function (c) {
            c.classList.remove('selected');
          });
          card.classList.add('selected');
          const radio = card.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
          selectedProviderId = card.getAttribute('data-provider');
        });
      });

      // 3. Execution Engine via Pure Vanilla Fetch API
      const startBtn = document.getElementById('ts-bulk-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', async function () {
          const checkedRadio = document.querySelector('input[name="ts_bulk_provider"]:checked');
          const selectedProvider = checkedRadio ? checkedRadio.value : selectedProviderId;

          startBtn.disabled = true;
          startBtn.textContent = 'Processing...';
          const backBtnEl = document.getElementById('ts-wizard-back-btn');
          const progressWrap = document.getElementById('ts-progress-wrap');

          if (backBtnEl) backBtnEl.style.display = 'none';
          if (progressWrap) progressWrap.style.display = 'block';

          const logs = document.getElementById('ts-progress-logs');
          const barFill = document.getElementById('ts-progress-bar-fill');
          const statusText = document.getElementById('ts-progress-status');
          const percentText = document.getElementById('ts-progress-percent');

          let completed = 0;
          const totalTasks = postIds.length * selectedTargetLangs.length;
          const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
          const nonce = config.nonce || '';

          for (let i = 0; i < postIds.length; i++) {
            const postId = postIds[i];

            for (let j = 0; j < selectedTargetLangs.length; j++) {
              const targetLang = selectedTargetLangs[j];
              if (statusText) {
                statusText.textContent = `Translating post ID #${postId} to ${targetLang.toUpperCase()} (${completed + 1}/${totalTasks})...`;
              }

              try {
                const response = await fetch(restUrl + 'translate-post', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                  },
                  body: JSON.stringify({
                    post_id: postId,
                    target_lang: targetLang,
                    provider: selectedProvider,
                  }),
                });

                const res = await response.json();

                if (!response.ok) {
                  throw new Error(res.message || `HTTP ${response.status}`);
                }

                completed++;
                const pct = Math.round((completed / totalTasks) * 100);
                if (barFill) barFill.style.width = pct + '%';
                if (percentText) percentText.textContent = pct + '%';

                if (logs) {
                  const logItem = document.createElement('div');
                  logItem.className = 'ts-log-item success';
                  logItem.textContent = `✓ Post #${postId} → Created/Updated #${res.target_post_id} (${targetLang.toUpperCase()})`;
                  logs.appendChild(logItem);
                  logs.scrollTop = logs.scrollHeight;
                }
              } catch (err) {
                completed++;
                const pct = Math.round((completed / totalTasks) * 100);
                if (barFill) barFill.style.width = pct + '%';
                if (percentText) percentText.textContent = pct + '%';

                if (logs) {
                  const logItem = document.createElement('div');
                  logItem.className = 'ts-log-item error';
                  logItem.textContent = `✕ Post #${postId} (${targetLang.toUpperCase()}) failed: ${err.message || 'Error'}`;
                  logs.appendChild(logItem);
                  logs.scrollTop = logs.scrollHeight;
                }
              }
            }
          }

          if (statusText) {
            statusText.textContent = `Bulk Translation Complete! (${completed}/${totalTasks} jobs processed)`;
          }

          startBtn.disabled = false;
          startBtn.textContent = 'Done (Reload Page)';
          startBtn.onclick = function () {
            window.location.reload();
          };
        });
      }
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulkTranslate);
  } else {
    initBulkTranslate();
  }
})(window, document);
