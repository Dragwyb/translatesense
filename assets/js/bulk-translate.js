/**
 * TranslateSense - Bulk Translation Flow on WP List Table (bulk-translate.js)
 * 
 * 100% Pure Vanilla JavaScript for maximum performance and cross-browser/cross-editor compatibility.
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

    // Helper: Check if string is email or URL
    function isEmailOrUrl(str) {
      if (!str || typeof str !== 'string') return false;
      const clean = str.trim();
      if (!clean) return false;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /^mailto:/i.test(clean)) return true;
      if (/^(https?:\/\/|ftp:\/\/|\/\/|www\.|tel:|sms:|javascript:|callto:|whatsapp:)/i.test(clean)) return true;
      if (/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i.test(clean)) return true;
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]*$/i.test(clean)) return true;
      return false;
    }

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

      let selectedProviderId = config.defaultProvider || 'openai';

      // Ensure root container exists
      let root = document.getElementById('translatesense-bulk-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'translatesense-bulk-modal-root';
        document.body.appendChild(root);
      }

      const providers = getRegisteredProviders();

      // Render Modal Skeleton with 3 distinct views: Languages -> Provider -> Live Progress
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
                      (p) => {
                        const isLocalFrontend = (p.id === 'chrome_ai' || p.id === 'chrome_local_ai');
                        const badgeHtml = isLocalFrontend
                          ? '<span class="ts-provider-badge frontend">Frontend</span>'
                          : '<span class="ts-provider-badge backend">Backend</span>';

                        return `
                          <div class="ts-provider-card ${p.id === selectedProviderId ? 'selected' : ''}" data-provider="${p.id}">
                            ${badgeHtml}
                            <input type="radio" name="ts_bulk_provider" value="${p.id}" ${p.id === selectedProviderId ? 'checked' : ''} class="ts-provider-radio" />
                            <div class="ts-provider-info">
                              <div class="ts-provider-title">
                                <span>${p.icon} ${p.title}</span>
                              </div>
                              <p class="ts-provider-desc">${p.desc}</p>
                            </div>
                          </div>
                        `;
                      }
                    ).join('')}
                  </div>
                </div>
              </div>

              <!-- Step 3 View: Dedicated Live Progress View (Hides Provider View) -->
              <div id="ts-view-progress" style="display: none;">
                <div class="ts-step-bar">
                  <div class="ts-step-item">
                    <span class="ts-step-number">✓</span>
                    <span>Languages</span>
                  </div>
                  <span class="ts-step-divider">&rarr;</span>
                  <div class="ts-step-item">
                    <span class="ts-step-number">✓</span>
                    <span id="ts-progress-provider-label">Provider</span>
                  </div>
                  <span class="ts-step-divider">&rarr;</span>
                  <div class="ts-step-item active">
                    <span class="ts-step-number">3</span>
                    <span>Translation Progress</span>
                  </div>
                </div>

                <div id="ts-progress-notice-banner" class="ts-modal-notice-banner" style="margin-top: 14px;"></div>

                <div class="ts-progress-wrap" style="margin-top: 14px;">
                  <div class="ts-progress-bar-bg">
                    <div class="ts-progress-bar-fill" id="ts-progress-bar-fill"></div>
                  </div>
                  <div class="ts-progress-text">
                    <span id="ts-progress-status">Starting bulk translation...</span>
                    <span id="ts-progress-percent">0%</span>
                  </div>
                  
                  <div class="ts-bulk-stats-row" id="ts-bulk-stats-row" style="display: flex; gap: 12px; margin-top: 10px; font-size: 12px; color: #475569;">
                    <span id="ts-stat-completed-strings"><strong>0</strong> Completed Strings</span>
                    <span>•</span>
                    <span id="ts-stat-pending-strings"><strong>0</strong> Pending Strings</span>
                    <span>•</span>
                    <span id="ts-stat-status-badge" style="font-weight: 600; color: #4f46e5;">Pending</span>
                  </div>

                  <div class="ts-progress-logs" id="ts-progress-logs" style="margin-top: 14px; max-height: 180px;"></div>
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

            <div class="ts-bulk-footer" id="ts-footer-progress" style="display: none; justify-content: flex-end;">
              <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-bulk-done-btn" disabled>
                ⏳ Translation In Progress...
              </button>
            </div>
          </div>
        </div>
      `;

      let pollingTimer = null;

      // Close modal handler
      const closeBtn = document.getElementById('ts-bulk-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          if (pollingTimer) clearInterval(pollingTimer);
          root.innerHTML = '';
        });
      }

      // Update UI state for language selection
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

      // Language Card Click Listeners
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

      // Step 1 -> Step 2 Navigation
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

      // Execution Engine
      const startBtn = document.getElementById('ts-bulk-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', async function () {
          const checkedRadio = document.querySelector('input[name="ts_bulk_provider"]:checked');
          const selectedProvider = checkedRadio ? checkedRadio.value : selectedProviderId;
          const isChromeAi = (selectedProvider === 'chrome_ai' || selectedProvider === 'chrome_local_ai');

          // Switch UI view: Hide provider view, show dedicated progress view
          const view2 = document.getElementById('ts-view-step-2');
          const footer2 = document.getElementById('ts-footer-step-2');
          const viewProgress = document.getElementById('ts-view-progress');
          const footerProgress = document.getElementById('ts-footer-progress');
          const doneBtn = document.getElementById('ts-bulk-done-btn');
          const providerLabel = document.getElementById('ts-progress-provider-label');

          if (view2) view2.style.display = 'none';
          if (footer2) footer2.style.display = 'none';
          if (viewProgress) viewProgress.style.display = 'block';
          if (footerProgress) footerProgress.style.display = 'flex';

          const matchingProvider = providers.find((p) => p.id === selectedProvider);
          if (providerLabel && matchingProvider) {
            providerLabel.textContent = matchingProvider.title;
          }

          const logs = document.getElementById('ts-progress-logs');
          const barFill = document.getElementById('ts-progress-bar-fill');
          const statusText = document.getElementById('ts-progress-status');
          const percentText = document.getElementById('ts-progress-percent');
          const completedStringsEl = document.getElementById('ts-stat-completed-strings');
          const pendingStringsEl = document.getElementById('ts-stat-pending-strings');
          const statusBadgeEl = document.getElementById('ts-stat-status-badge');

          const noticeBanner = document.getElementById('ts-progress-notice-banner');
          if (noticeBanner) {
            if (isChromeAi) {
              noticeBanner.className = 'ts-modal-notice-banner warning';
              noticeBanner.style.display = 'flex';
              noticeBanner.innerHTML = `
                <span class="ts-notice-icon">⚠️</span>
                <div class="ts-notice-text">
                  <div class="ts-notice-title">Please Keep This Window Open</div>
                  <div>Chrome Local AI runs on-device directly in your browser. If you close this tab or window, your local translation workflow will stop.</div>
                </div>
              `;
            } else {
              noticeBanner.className = 'ts-modal-notice-banner info';
              noticeBanner.style.display = 'flex';
              noticeBanner.innerHTML = `
                <span class="ts-notice-icon">ℹ️</span>
                <div class="ts-notice-text">
                  <div class="ts-notice-title">Background Cron Translation Running</div>
                  <div>Your translations are being processed on the server via background cron. You can safely close this modal or navigate away—the process will continue running smoothly.</div>
                </div>
              `;
            }
          }

          const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
          const nonce = config.nonce || '';

          // 1. Start batch in bulk translations table
          let batchData = null;
          try {
            const startResponse = await fetch(restUrl + 'bulk-start', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
              },
              body: JSON.stringify({
                post_ids: postIds,
                target_languages: selectedTargetLangs,
                provider: selectedProvider,
              }),
            });

            batchData = await startResponse.json();
            if (!startResponse.ok || !batchData.batch_id) {
              throw new Error(batchData.message || `Failed to start bulk job`);
            }
          } catch (initErr) {
            if (statusText) statusText.textContent = `Initialization Error: ${initErr.message}`;
            if (doneBtn) {
              doneBtn.disabled = false;
              doneBtn.textContent = 'Retry';
              doneBtn.onclick = function () {
                window.location.reload();
              };
            }
            return;
          }

          const batchId = batchData.batch_id;
          const jobsList = batchData.jobs || [];

          // =========================================================================
          // WORKFLOW A: Backend AI Providers (OpenAI, Gemini) via Cron + 5s Polling
          // =========================================================================
          if (!isChromeAi) {
            if (statusText) statusText.textContent = 'Background bulk translation queued. Polling status every 5 seconds...';
            if (statusBadgeEl) {
              statusBadgeEl.textContent = 'Running';
              statusBadgeEl.style.color = '#0284c7';
            }

            const pollStatus = async () => {
              try {
                const statusRes = await fetch(`${restUrl}bulk-status?batch_id=${encodeURIComponent(batchId)}`, {
                  headers: { 'X-WP-Nonce': nonce },
                });

                if (!statusRes.ok) return;

                const data = await statusRes.json();
                const pct = data.progress_percent || 0;

                if (barFill) barFill.style.width = pct + '%';
                if (percentText) percentText.textContent = pct + '%';
                if (statusText) statusText.textContent = data.current_status || `Processing... (${pct}%)`;

                if (completedStringsEl) completedStringsEl.innerHTML = `<strong>${data.completed_strings || 0}</strong> Completed Strings`;
                if (pendingStringsEl) pendingStringsEl.innerHTML = `<strong>${data.pending_strings || 0}</strong> Pending Strings`;
                if (statusBadgeEl) {
                  statusBadgeEl.textContent = (data.overall_status || 'running').toUpperCase();
                  statusBadgeEl.style.color = (data.overall_status === 'completed') ? '#16a34a' : ((data.overall_status === 'failed') ? '#dc2626' : '#0284c7');
                }

                // Render Logs
                if (logs && Array.isArray(data.items)) {
                  logs.innerHTML = '';
                  data.items.forEach((item) => {
                    const logItem = document.createElement('div');
                    const isDone = item.status === 'completed';
                    const isFail = item.status === 'failed';
                    logItem.className = `ts-log-item ${isDone ? 'success' : (isFail ? 'error' : 'info')}`;

                    if (isDone) {
                      logItem.innerHTML = `✓ <strong>${item.post_title}</strong> (#${item.post_id}) &rarr; Created #${item.target_post_id} (${item.target_language.toUpperCase()}) [${item.completed_strings} strings]`;
                    } else if (isFail) {
                      logItem.innerHTML = `✕ <strong>${item.post_title}</strong> (#${item.post_id}) [${item.target_language.toUpperCase()}]: ${item.error_message || 'Failed'}`;
                    } else {
                      logItem.innerHTML = `⏳ <strong>${item.post_title}</strong> (#${item.post_id}) &rarr; ${item.target_language.toUpperCase()}: ${item.progress_status || 'Queued'}`;
                    }
                    logs.appendChild(logItem);
                  });
                  logs.scrollTop = logs.scrollHeight;
                }

                // Check Completion
                if (data.overall_status === 'completed' || data.overall_status === 'failed') {
                  clearInterval(pollingTimer);
                  pollingTimer = null;

                  if (statusText) {
                    statusText.textContent = (data.overall_status === 'completed')
                      ? `🎉 Bulk Translation Complete! (${data.completed_jobs}/${data.total_jobs} posts translated)`
                      : `Batch translation completed with issues (${data.failed_jobs} failed).`;
                  }

                  if (doneBtn) {
                    doneBtn.disabled = false;
                    doneBtn.textContent = '✓ Done (Reload Page)';
                    doneBtn.onclick = function () {
                      window.location.reload();
                    };
                  }
                }
              } catch (pollErr) {
                console.warn('[TranslateSense] Polling error:', pollErr);
              }
            };

            // First poll immediately, then every 5 seconds
            pollStatus();
            pollingTimer = setInterval(pollStatus, 5000);
            return;
          }

          // =========================================================================
          // WORKFLOW B: Chrome Local AI In-Memory String Translation Workflow
          // =========================================================================
          let totalBatchStrings = 0;
          let completedBatchStrings = 0;
          let completedJobsCount = 0;
          const totalJobsCount = jobsList.length;

          if (statusBadgeEl) {
            statusBadgeEl.textContent = 'Local AI Running';
            statusBadgeEl.style.color = '#4f46e5';
          }

          for (let jobIndex = 0; jobIndex < jobsList.length; jobIndex++) {
            const job = jobsList[jobIndex];
            const postId = job.post_id;
            const targetLang = job.target_language;
            const jobId = job.id;
            const postEditorType = job.editor_type || 'core';

            if (statusText) {
              statusText.textContent = `Extracting strings for Post #${postId} (${targetLang.toUpperCase()}) [${jobIndex + 1}/${totalJobsCount}]...`;
            }

            try {
              // 1. Extract strings for this post one by one passing editor_type
              const extractRes = await fetch(restUrl + 'extract-strings', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                  post_id: postId,
                  target_lang: targetLang,
                  builder: postEditorType,
                }),
              });

              const extractData = await extractRes.json();
              let rawStrings = Array.isArray(extractData.strings) ? extractData.strings : [];
              rawStrings = rawStrings.filter((s) => !isEmailOrUrl(s.value || s.source || ''));

              totalBatchStrings += rawStrings.length;
              if (pendingStringsEl) pendingStringsEl.innerHTML = `<strong>${Math.max(0, totalBatchStrings - completedBatchStrings)}</strong> Pending Strings`;

              // Local in-memory dictionary for pre-translated strings
              const inMemoryTranslations = {};

              if (rawStrings.length > 0) {
                if (statusText) {
                  statusText.textContent = `Translating ${rawStrings.length} strings on-device with Chrome Local AI for Post #${postId} (${targetLang.toUpperCase()})...`;
                }

                const itemsToTranslate = rawStrings.map((s) => ({
                  hash: s.hash,
                  widget_id: s.name,
                  field: s.key,
                  source: s.source || s.value,
                  content: s.value,
                }));

                const onStringProgress = (resItem) => {
                  if (resItem && resItem.translated) {
                    if (resItem.hash) inMemoryTranslations[resItem.hash] = resItem.translated;
                    if (resItem.source) inMemoryTranslations[resItem.source] = resItem.translated;
                  }
                  completedBatchStrings++;
                  const strPct = totalBatchStrings > 0 ? Math.round((completedBatchStrings / totalBatchStrings) * 100) : 0;
                  if (barFill) barFill.style.width = strPct + '%';
                  if (percentText) percentText.textContent = strPct + '%';
                  if (completedStringsEl) completedStringsEl.innerHTML = `<strong>${completedBatchStrings}</strong> Completed Strings`;
                  if (pendingStringsEl) pendingStringsEl.innerHTML = `<strong>${Math.max(0, totalBatchStrings - completedBatchStrings)}</strong> Pending Strings`;
                };

                // Run client-side Chrome AI translation (stores results in inMemoryTranslations variable, NOT in DB translations cache)
                await window.TranslateSenseCore.translate(
                  'chrome_ai',
                  {
                    items: itemsToTranslate,
                    sourceLang: 'en',
                    targetLang: targetLang,
                    postId: postId,
                  },
                  onStringProgress
                );
              }

              // 2. Directly create translated post passing in_memory_translations map
              if (statusText) {
                statusText.textContent = `Saving translated Post #${postId} (${targetLang.toUpperCase()})...`;
              }

              const postResponse = await fetch(restUrl + 'translate-post', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                  post_id: postId,
                  target_lang: targetLang,
                  provider: 'chrome_ai',
                  in_memory_translations: inMemoryTranslations,
                }),
              });

              const postRes = await postResponse.json();
              if (!postResponse.ok || !postRes.target_post_id) {
                throw new Error(postRes.message || `Post translation save failed`);
              }

              // 3. Update bulk job record in DB
              await fetch(restUrl + 'bulk-update-job', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                  job_id: jobId,
                  data: {
                    status: 'completed',
                    progress_status: 'Completed successfully',
                    total_strings: rawStrings.length,
                    completed_strings: rawStrings.length,
                    target_post_id: postRes.target_post_id,
                    sent_ai_request_data: rawStrings,
                    received_ai_request_data: inMemoryTranslations,
                  },
                }),
              });

              completedJobsCount++;

              if (logs) {
                const logItem = document.createElement('div');
                logItem.className = 'ts-log-item success';
                logItem.innerHTML = `✓ Post #${postId} &rarr; Created/Updated #${postRes.target_post_id} (${targetLang.toUpperCase()}) [${rawStrings.length} strings]`;
                logs.appendChild(logItem);
                logs.scrollTop = logs.scrollHeight;
              }
            } catch (err) {
              console.error(`[TranslateSense] Chrome AI error for post #${postId}:`, err);

              await fetch(restUrl + 'bulk-update-job', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                  job_id: jobId,
                  data: {
                    status: 'failed',
                    progress_status: `Failed: ${err.message}`,
                    error_message: err.message,
                  },
                }),
              });

              if (logs) {
                const logItem = document.createElement('div');
                logItem.className = 'ts-log-item error';
                logItem.innerHTML = `✕ Post #${postId} (${targetLang.toUpperCase()}) failed: ${err.message || 'Error'}`;
                logs.appendChild(logItem);
                logs.scrollTop = logs.scrollHeight;
              }
            }
          }

          if (barFill) barFill.style.width = '100%';
          if (percentText) percentText.textContent = '100%';
          if (statusText) {
            statusText.textContent = `🎉 Chrome Local AI Bulk Translation Complete! (${completedJobsCount}/${totalJobsCount} jobs processed)`;
          }
          if (statusBadgeEl) {
            statusBadgeEl.textContent = 'COMPLETED';
            statusBadgeEl.style.color = '#16a34a';
          }

          if (doneBtn) {
            doneBtn.disabled = false;
            doneBtn.textContent = '✓ Done (Reload Page)';
            doneBtn.onclick = function () {
              window.location.reload();
            };
          }
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
