/**
 * TranslateSense - Bulk Translation Flow on WP List Table (bulk-translate.js)
 * 
 * 100% Pure Vanilla JavaScript for maximum performance and cross-browser/cross-editor compatibility.
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

    return `<span class="dashicons dashicons-translation ts-lang-flag-fallback"></span>`;
  }

  // Helper: Format numbers to K / M / B notation when above 1,000
  function formatNumber(num) {
    const n = Number(num) || 0;
    if (Math.abs(n) < 1000) {
      return String(n);
    }

    const lookup = [
      { value: 1e9, symbol: 'B' },
      { value: 1e6, symbol: 'M' },
      { value: 1e3, symbol: 'K' }
    ];

    for (let i = 0; i < lookup.length; i++) {
      if (Math.abs(n) >= lookup[i].value) {
        const formatted = (n / lookup[i].value).toFixed(1);
        const clean = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
        return clean + lookup[i].symbol;
      }
    }

    return String(n);
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

  /**
   * Calculate individual translation job progress percentage.
   *
   * @param {Object} item Translation job item.
   * @return {number} Progress percentage between 0 and 100.
   */
  function getPostProgress(item) {
    if (!item) return 0;
    const status = item.status;
    const totalStrings = Number(item.total_strings !== undefined ? item.total_strings : item.totalStrings) || 0;
    const completedStrings = Number(item.completed_strings !== undefined ? item.completed_strings : item.completedStrings) || 0;

    switch (status) {
      case 'completed':
      case 'already_exists':
      case 'skipped':
        return 100;

      case 'running':
      case 'processing':
      case 'cancelling':
        return totalStrings > 0
          ? Math.min(100, Math.max(0, (completedStrings / totalStrings) * 100))
          : 0;

      case 'pending':
        return 0;

      case 'failed':
      default:
        return status === 'failed'
          ? Math.min(
            100,
            Math.max(
              0,
              totalStrings > 0 ? (completedStrings / totalStrings) * 100 : 0
            )
          )
          : 0;
    }
  }

  /**
   * Calculate post-weighted overall progress percentage across all batch jobs.
   *
   * @param {Array} items Array of translation jobs.
   * @return {number} Overall progress percentage between 0 and 100.
   */
  function getOverallProgress(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }

    const totalProgress = items.reduce((total, item) => {
      return total + getPostProgress(item);
    }, 0);

    return Math.min(
      100,
      Math.max(0, totalProgress / items.length)
    );
  }

  function initBulkTranslate() {
    const config = window.TranslateSenseBulkData || {};

    // 1. Initialize private TranslateSenseCore instance
    const core = typeof window.TranslateSenseCore === 'function' ? new window.TranslateSenseCore() : (window.TranslateSenseCore || null);

    // 2. Register all providers onto this private core instance
    if (window.TranslateSenseProviders && typeof window.TranslateSenseProviders.register === 'function') {
      window.TranslateSenseProviders.register(core);
    }

    // Helper to dynamically get active enabled providers registered on this core instance
    async function getRegisteredProviders(targetLang = 'es') {
      const enabledProviders = config.enabledProviders || {};
      const enabledKeys = Array.isArray(enabledProviders) ? enabledProviders : Object.keys(enabledProviders);

      let providers = [];
      if (core && typeof core.getProviders === 'function') {
        providers = core.getProviders(true);
        if (providers.length === 0 && enabledKeys.length === 0) {
          providers = core.getProviders(false);
        }
      }

      const chromeAiIndex = providers.findIndex((p) => p.id === 'chrome_ai');
      if (chromeAiIndex > -1 && typeof providers[chromeAiIndex].checkAvailability === 'function') {
        providers[chromeAiIndex].isSupported = await providers[chromeAiIndex].checkAvailability(config.defaultLanguage || config.sourceLanguage || 'en', targetLang || config.targetLanguage || 'es', true);
      }

      return providers;
    }

    // Ensure button is inserted next to Filter submit or Apply button if not rendered by hook
    const postQuerySubmit = document.getElementById('post-query-submit');
    if (!document.getElementById('ts-quick-filter-translate-btn') && postQuerySubmit) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ts-quick-filter-translate-btn';
      btn.className = 'button button-primary ts-filter-action-btn';
      btn.innerHTML = '<span class="dashicons dashicons-translation"></span> Bulk Translate';
      postQuerySubmit.insertAdjacentElement('afterend', btn);
    }

    const doAction2 = document.getElementById('doaction2');
    if (!document.getElementById('ts-quick-filter-translate-btn-bottom') && doAction2) {
      const btnBottom = document.createElement('button');
      btnBottom.type = 'button';
      btnBottom.id = 'ts-quick-filter-translate-btn-bottom';
      btnBottom.className = 'button button-primary ts-filter-action-btn';
      btnBottom.innerHTML = '<span class="dashicons dashicons-translation"></span> Bulk Translate';
      doAction2.insertAdjacentElement('afterend', btnBottom);
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

    let globalRunningPollingTimer = null;
    let inModalPollingTimer = null;
    let activeBatchesPollTimeout = null;
    let isActiveBatchesFetching = false;
    let hasActiveBackgroundBatches = Boolean(config.hasActiveBackgroundJobs);
    let activeBackgroundBatchesList = [];

    // Helper: Safely escape HTML strings
    function escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * Stop background active batches polling timer.
     */
    function stopActiveBatchesPolling() {
      if (activeBatchesPollTimeout) {
        clearTimeout(activeBatchesPollTimeout);
        activeBatchesPollTimeout = null;
      }
    }

    /**
     * Sequentially query bulk-active-batches endpoint.
     * Before triggering next polling, wait for previous one to finish.
     * If active batches found, start/continue sequential polling.
     * If no active batches found, stop this polling interval.
     */
    async function checkHasActiveBackgroundJobs() {
      if (isActiveBatchesFetching) {
        return hasActiveBackgroundBatches;
      }
      isActiveBatchesFetching = true;

      try {
        const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
        const nonce = config.nonce || '';
        const res = await fetch(`${restUrl}bulk-active-batches`, {
          headers: { 'X-WP-Nonce': nonce },
        });

        if (res.ok) {
          const data = await res.json();
          const batches = Array.isArray(data.batches) ? data.batches : [];
          activeBackgroundBatchesList = batches;
          hasActiveBackgroundBatches = batches.length > 0;

          // Update Previous Background Translation Notice (Workflow A) if present in DOM
          const noticeEl = document.getElementById('ts-previous-active-notice');
          if (noticeEl) {
            noticeEl.style.display = hasActiveBackgroundBatches ? 'flex' : 'none';
          }

          // If active batches found: schedule next poll sequentially (wait for completion before next poll)
          if (hasActiveBackgroundBatches) {
            stopActiveBatchesPolling();
            activeBatchesPollTimeout = setTimeout(function () {
              checkHasActiveBackgroundJobs();
            }, 5000);
          } else {
            // If not active batches found then stop this polling interval
            stopActiveBatchesPolling();
          }
        } else {
          stopActiveBatchesPolling();
        }
      } catch (err) {
        console.warn('[TranslateSense] Error checking active batches:', err);
        stopActiveBatchesPolling();
      } finally {
        isActiveBatchesFetching = false;
      }

      return hasActiveBackgroundBatches;
    }

    // Trigger bulk-active-batches on window load
    window.addEventListener('load', function () {
      checkHasActiveBackgroundJobs();
    });
    // Also trigger on first time script initialization
    checkHasActiveBackgroundJobs();

    // Modal Confirmation Dialog for Skip Action
    function showSkipConfirmationDialog(batchId, postId, onSkippedCallback) {
      const oldDialog = document.getElementById('ts-skip-dialog-overlay');
      if (oldDialog) oldDialog.remove();

      const dialogEl = document.createElement('div');
      dialogEl.id = 'ts-skip-dialog-overlay';
      dialogEl.className = 'ts-skip-dialog-overlay';
      dialogEl.innerHTML = `
        <div class="ts-skip-dialog-box">
          <div class="ts-skip-dialog-header">
            <span class="dashicons dashicons-warning ts-skip-warn-icon"></span>
            <h3 class="ts-skip-dialog-title">Skip remaining translations?</h3>
          </div>
          <div class="ts-skip-dialog-body">
            <p>This will skip the remaining pending translations for this post in the selected batch. Completed translations will not be affected.</p>
          </div>
          <div class="ts-skip-dialog-footer">
            <button type="button" class="button button-secondary" id="ts-skip-cancel-btn">Keep Translating</button>
            <button type="button" class="button button-primary button-danger ts-skip-confirm-btn" id="ts-skip-confirm-btn">Skip Remaining Translations</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialogEl);

      const cancelBtn = document.getElementById('ts-skip-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          dialogEl.remove();
        });
      }

      dialogEl.addEventListener('click', function (e) {
        if (e.target === dialogEl) {
          dialogEl.remove();
        }
      });

      const confirmBtn = document.getElementById('ts-skip-confirm-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async function () {
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '<span class="ts-spinner-circle"></span> Skipping...';

          try {
            const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
            const nonce = config.nonce || '';
            const res = await fetch(`${restUrl}bulk-skip-post`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
              },
              body: JSON.stringify({
                batch_id: batchId,
                post_id: parseInt(postId, 10),
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.message || 'Failed to skip translations');
            }

            dialogEl.remove();

            if (typeof onSkippedCallback === 'function') {
              onSkippedCallback(data);
            }
          } catch (err) {
            alert(err.message || 'Failed to skip translations');
            dialogEl.remove();
          }
        });
      }
    }

    // Workflow B: Previously Running Translations Progress Workflow
    async function openPreviouslyRunningModal(targetBatchId = null) {
      if (globalRunningPollingTimer) {
        clearInterval(globalRunningPollingTimer);
        globalRunningPollingTimer = null;
      }

      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';
      const allLanguages = config.languages || [];

      let root = document.getElementById('translatesense-bulk-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'translatesense-bulk-modal-root';
        document.body.appendChild(root);
      }

      // Fetch active background batches
      let activeBatches = [];
      try {
        const res = await fetch(`${restUrl}bulk-active-batches`, {
          headers: { 'X-WP-Nonce': nonce },
        });
        if (res.ok) {
          const data = await res.json();
          activeBatches = data.batches || [];
        }
      } catch (err) {
        console.warn('[TranslateSense] Error fetching active batches:', err);
      }

      if (activeBatches.length === 0 && targetBatchId) {
        try {
          const res = await fetch(`${restUrl}bulk-status?batch_id=${encodeURIComponent(targetBatchId)}`, {
            headers: { 'X-WP-Nonce': nonce },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.items) activeBatches = [data];
          }
        } catch (e) { }
      }

      if (activeBatches.length === 0) {
        root.innerHTML = `
          <div class="ts-bulk-overlay" id="ts-bulk-modal-overlay">
            <div class="ts-bulk-modal">
              ${core.createHeaderHTML({
          icon: '⚡',
          title: 'Background Translation Monitor',
          subtitle: 'No active background translations',
          closeId: 'ts-bulk-close-btn',
        })}
              <div class="ts-bulk-body" style="padding: 30px; text-align: center;">
                <p style="font-size: 14px; color: #475569;">There are no previously running background translations active at this time.</p>
              </div>
              ${core.createFooterHTML({
          id: 'ts-footer-empty',
          buttons: [
            { id: 'ts-bulk-done-btn', label: 'Close', variant: 'primary' }
          ]
        })}
            </div>
          </div>
        `;
        const closeBtn = document.getElementById('ts-bulk-close-btn');
        if (closeBtn) closeBtn.onclick = () => { root.innerHTML = ''; checkHasActiveBackgroundJobs(); };
        const doneBtn = document.getElementById('ts-bulk-done-btn');
        if (doneBtn) doneBtn.onclick = () => { root.innerHTML = ''; checkHasActiveBackgroundJobs(); };
        const overlayEl = document.getElementById('ts-bulk-modal-overlay');
        if (overlayEl) overlayEl.onclick = (e) => { if (e.target === overlayEl) { root.innerHTML = ''; checkHasActiveBackgroundJobs(); } };
        return;
      }

      let currentBatch = targetBatchId
        ? (activeBatches.find((b) => b.batch_id === targetBatchId) || activeBatches[0])
        : activeBatches[0];

      let runningPostResultsMap = {};
      let runningExpandedPosts = {};

      function populateRunningMap(batchData) {
        if (!Array.isArray(batchData.items)) return;
        batchData.items.forEach(function (item) {
          const pId = String(item.post_id);
          const tLang = String(item.target_language);

          if (!runningPostResultsMap[pId]) {
            runningPostResultsMap[pId] = {
              postId: item.post_id,
              postTitle: item.post_title || `Post #${item.post_id}`,
              provider: item.provider,
              translations: {},
            };
          }
          if (item.post_title) runningPostResultsMap[pId].postTitle = item.post_title;
          if (item.provider) runningPostResultsMap[pId].provider = item.provider;

          runningPostResultsMap[pId].translations[tLang] = {
            targetLang: item.target_language,
            targetPostId: item.target_post_id,
            targetTitle: item.target_post_title || (item.status === 'already_exists' || item.status === 'completed' ? (item.target_post_title || item.post_title) : (item.progress_status || 'Processing...')),
            editorType: item.editor_type,
            status: item.status,
            completedStrings: item.completed_strings,
            totalStrings: item.total_strings,
            progressPercent: getPostProgress(item),
            progressStatus: item.progress_status || '',
            editUrl: item.edit_url || (item.target_post_id ? `post.php?post=${item.target_post_id}&action=edit` : ''),
            viewUrl: item.view_url || (item.target_post_id ? `/?p=${item.target_post_id}` : ''),
            error: item.error_message,
            provider: item.provider,
          };
        });
      }

      populateRunningMap(currentBatch);

      const initialPct = currentBatch.items && currentBatch.items.length > 0
        ? Math.round(getOverallProgress(currentBatch.items))
        : Math.round(currentBatch.progress_percent || 0);

      const initialDone = (currentBatch.completed_jobs || 0) + (currentBatch.already_exists_jobs || 0) + (currentBatch.skipped_jobs || 0);

      root.innerHTML = `
        <div class="ts-bulk-overlay" id="ts-bulk-modal-overlay">
          <div class="ts-bulk-modal">
            ${core.createHeaderHTML({
        icon: '⚡',
        title: 'Previously Running Background Translations',
        subtitle: 'Monitor and manage active background translation jobs',
        closeId: 'ts-bulk-close-btn',
      })}
            
            <div class="ts-bulk-body">
              ${activeBatches.length > 1 ? `
                <div class="ts-batch-select-wrap">
                  <label for="ts-batch-select"><strong>Background Batch:</strong></label>
                  <select id="ts-batch-select" class="ts-batch-select">
                    ${activeBatches.map((b) => `
                      <option value="${b.batch_id}" ${b.batch_id === currentBatch.batch_id ? 'selected' : ''}>
                        Batch ${b.batch_id.substring(0, 8)}... (${(b.completed_jobs || 0) + (b.already_exists_jobs || 0) + (b.skipped_jobs || 0)}/${b.total_jobs} done, ${b.overall_status})
                      </option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}

              <!-- Progress Bar Card -->
              <div class="ts-progress-card" id="ts-running-progress-card">
                <div class="ts-progress-header">
                  <span class="ts-progress-status" id="ts-running-progress-status">${escapeHtml(currentBatch.current_status || 'Translating content in background...')}</span>
                  <div class="ts-progress-meta">
                    <span id="ts-running-posts-count">${initialDone} / ${currentBatch.total_jobs} posts (${initialPct}%)</span>
                  </div>
                </div>
                <div class="ts-progress-bar-bg" id="ts-running-progress-bar-bg">
                  <div class="ts-progress-bar-fill" id="ts-running-progress-bar-fill" style="width: ${initialPct}%;"></div>
                </div>
              </div>

              <!-- Summary Stats Grid -->
              <div class="ts-summary-stats-grid" id="ts-running-stats-grid" style="display: grid; margin-bottom: 16px;">
                <div class="ts-stat-card green">
                  <div class="ts-stat-icon-box green">
                    <span class="dashicons dashicons-yes-alt"></span>
                  </div>
                  <div class="ts-stat-info">
                    <div class="ts-stat-label">Completed Posts</div>
                    <div class="ts-stat-val" id="ts-running-stat-completed">${(currentBatch.completed_jobs || 0) + (currentBatch.already_exists_jobs || 0)} / ${currentBatch.total_jobs}</div>
                  </div>
                </div>

                <div class="ts-stat-card blue">
                  <div class="ts-stat-icon-box blue">
                    <span class="dashicons dashicons-update"></span>
                  </div>
                  <div class="ts-stat-info">
                    <div class="ts-stat-label">Pending / Running</div>
                    <div class="ts-stat-val" id="ts-running-stat-pending">${(currentBatch.running_jobs || 0) + (currentBatch.pending_jobs || 0)}</div>
                  </div>
                </div>

                <div class="ts-stat-card gray">
                  <div class="ts-stat-icon-box gray">
                    <span class="dashicons dashicons-controls-skipforward"></span>
                  </div>
                  <div class="ts-stat-info">
                    <div class="ts-stat-label">Skipped Posts</div>
                    <div class="ts-stat-val" id="ts-running-stat-skipped">${currentBatch.skipped_jobs || 0}</div>
                  </div>
                </div>

                <div class="ts-stat-card red">
                  <div class="ts-stat-icon-box red">
                    <span class="dashicons dashicons-dismiss"></span>
                  </div>
                  <div class="ts-stat-info">
                    <div class="ts-stat-label">Failed Posts</div>
                    <div class="ts-stat-val" id="ts-running-stat-failed">${currentBatch.failed_jobs || 0}</div>
                  </div>
                </div>
              </div>

              <!-- Post Accordion Group List -->
              <div class="ts-results-container" id="ts-running-results-container">
                <div class="ts-results-list" id="ts-running-results-list"></div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="ts-common-footer ts-review-footer" id="ts-running-footer" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-running-back-new-btn">
                  &larr; New Translation
                </button>
              </div>
              <div class="ts-footer-buttons-group">
                <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-running-done-btn">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const runningResultsListEl = document.getElementById('ts-running-results-list');

      function updateRunningProgressCards(bStatus) {
        const barFill = document.getElementById('ts-running-progress-bar-fill');
        const postsCount = document.getElementById('ts-running-posts-count');
        const statusEl = document.getElementById('ts-running-progress-status');
        const statComp = document.getElementById('ts-running-stat-completed');
        const statPend = document.getElementById('ts-running-stat-pending');
        const statSkip = document.getElementById('ts-running-stat-skipped');
        const statFail = document.getElementById('ts-running-stat-failed');

        const pct = Array.isArray(bStatus.items) && bStatus.items.length > 0
          ? Math.round(getOverallProgress(bStatus.items))
          : Math.round(bStatus.progress_percent || 0);

        const doneTotal = (bStatus.completed_jobs || 0) + (bStatus.already_exists_jobs || 0) + (bStatus.skipped_jobs || 0);

        if (barFill) barFill.style.width = pct + '%';
        if (postsCount) postsCount.textContent = `${doneTotal} / ${bStatus.total_jobs} posts (${pct}%)`;
        if (statusEl) statusEl.textContent = bStatus.current_status || `Processing background translations... (${pct}%)`;

        if (statComp) statComp.textContent = `${(bStatus.completed_jobs || 0) + (bStatus.already_exists_jobs || 0)} / ${bStatus.total_jobs}`;
        if (statPend) statPend.textContent = `${(bStatus.running_jobs || 0) + (bStatus.pending_jobs || 0)}`;
        if (statSkip) statSkip.textContent = `${bStatus.skipped_jobs || 0}`;
        if (statFail) statFail.textContent = `${bStatus.failed_jobs || 0}`;
      }

      function renderRunningResultsUI() {
        if (!runningResultsListEl) return;

        let html = '';
        const postIdsList = Object.keys(runningPostResultsMap);

        postIdsList.forEach(function (pId) {
          const postData = runningPostResultsMap[pId];
          const transKeys = Object.keys(postData.translations);

          let compCount = 0;
          let failCount = 0;
          let runCount = 0;
          let pendCount = 0;
          let skipCount = 0;

          transKeys.forEach(function (langSlug) {
            const trans = postData.translations[langSlug];
            if (trans.status === 'completed' || trans.status === 'already_exists') {
              compCount++;
            } else if (trans.status === 'skipped') {
              skipCount++;
            } else if (trans.status === 'failed') {
              failCount++;
            } else if (trans.status === 'running' || trans.status === 'cancelling') {
              runCount++;
            } else {
              pendCount++;
            }
          });

          // Post header pill
          let headerStatusHtml = '';
          if (failCount > 0) {
            headerStatusHtml = `<span class="ts-post-status-pill failed"><span class="dashicons dashicons-dismiss"></span> Failed (${failCount})</span>`;
          } else if (runCount > 0) {
            headerStatusHtml = '<span class="ts-post-status-pill in-progress"><span class="ts-dots-spinner"></span> In Progress</span>';
          } else if (skipCount > 0 && (skipCount + compCount === transKeys.length) && compCount === 0) {
            headerStatusHtml = '<span class="ts-post-status-pill skipped"><span class="dashicons dashicons-controls-skipforward"></span> Skipped</span>';
          } else if (compCount === transKeys.length) {
            headerStatusHtml = '<span class="ts-post-status-pill completed"><span class="dashicons dashicons-yes"></span> Completed</span>';
          }

          // Skip action button: Strictly visible ONLY in Previously Running Translations Progress View
          // and ONLY for eligible OpenAI or Gemini background jobs with pending or running items.
          let postSkipBtnHtml = '';
          const hasActiveJobs = (runCount > 0 || pendCount > 0);
          const prov = (postData.provider || currentBatch.provider || '').toLowerCase();
          const isEligibleProvider = (prov === 'openai' || prov === 'gemini');
          if (isEligibleProvider && hasActiveJobs) {
            postSkipBtnHtml = `<button type="button" class="ts-post-skip-btn button button-small" data-post-id="${escapeHtml(pId)}" data-batch-id="${escapeHtml(currentBatch.batch_id)}" title="Skip remaining translations for this post in this batch"><span class="dashicons dashicons-controls-skipforward"></span> Skip</button>`;
          }

          let isExpanded = true;
          if (runningExpandedPosts[pId] !== undefined) {
            isExpanded = runningExpandedPosts[pId];
          }

          html += `
            <div class="ts-post-group-card ${isExpanded ? 'expanded' : ''}" data-post-id="${pId}">
              <div class="ts-post-group-header">
                <div class="ts-post-source-info">
                  <div class="ts-post-icon-box">
                    <span class="dashicons dashicons-media-text"></span>
                  </div>
                  <span class="ts-source-title-text">${escapeHtml(postData.postTitle || `Post #${pId}`)}</span>
                  <span class="ts-post-id-tag">#${pId}</span>
                </div>
                <div class="ts-post-header-right">
                  ${postSkipBtnHtml}
                  ${headerStatusHtml}
                  <span class="ts-post-chevron dashicons dashicons-arrow-down-alt2"></span>
                </div>
              </div>
              <div class="ts-post-translations-list">
          `;

          transKeys.forEach(function (langSlug) {
            const trans = postData.translations[langSlug];
            const isAlreadyExists = trans.status === 'already_exists';
            const isDone = trans.status === 'completed';
            const isFail = trans.status === 'failed' || Boolean(trans.error);
            const isRunning = trans.status === 'running';
            const isSkipped = trans.status === 'skipped';
            const isCancelling = trans.status === 'cancelling';

            const langUpper = langSlug.toUpperCase();
            const langObj = allLanguages.find(function (l) { return l.slug === langSlug; });

            let rowStatusHtml = '';
            if (isAlreadyExists || isDone) {
              rowStatusHtml = '<span class="ts-row-status completed"><span class="dashicons dashicons-yes-alt"></span> Completed</span>';
            } else if (isSkipped) {
              rowStatusHtml = '<span class="ts-row-status skipped"><span class="dashicons dashicons-controls-skipforward"></span> Skipped</span>';
            } else if (isCancelling) {
              rowStatusHtml = '<span class="ts-row-status cancelling"><span class="ts-spinner-circle"></span> Cancelling...</span>';
            } else if (isFail) {
              rowStatusHtml = '<span class="ts-row-status failed"><span class="dashicons dashicons-dismiss"></span> Failed</span>';
            } else if (isRunning) {
              rowStatusHtml = `<span class="ts-row-status translating">
                  <span class="ts-spinner-circle"></span>
                  <span class="ts-translating-label">Translating</span>
                  <span class="ts-ellipsis-dots">
                    <span class="ts-dot"></span>
                    <span class="ts-dot"></span>
                    <span class="ts-dot"></span>
                  </span>
                </span>`;
            } else {
              rowStatusHtml = '<span class="ts-row-status pending"><span class="dashicons dashicons-clock"></span> Pending...</span>';
            }

            const isAvailable = isDone || isAlreadyExists;
            const editHref = trans.editUrl || '#';
            const viewHref = trans.viewUrl || '#';

            let actionsHtml = '';
            if (isAvailable) {
              actionsHtml += `<a href="${viewHref}" target="_blank" rel="noopener noreferrer" class="ts-row-action-btn view" title="View translated post on site"><span class="dashicons dashicons-visibility"></span> View</a>`;
              actionsHtml += `<a href="${editHref}" target="_blank" rel="noopener noreferrer" class="ts-row-action-btn edit" title="Edit translated post"><span class="dashicons dashicons-edit"></span> Edit</a>`;
            } else {
              actionsHtml += `<span class="ts-row-action-btn view disabled"><span class="dashicons dashicons-visibility"></span> View</span>`;
              actionsHtml += `<span class="ts-row-action-btn edit disabled"><span class="dashicons dashicons-edit"></span> Edit</span>`;
            }

            const displayTitle = trans.targetTitle
              || (isAlreadyExists || isDone ? (trans.targetTitle || postData.postTitle)
                : (isSkipped || isFail ? (postData.postTitle || `Post #${pId}`)
                  : (isRunning ? 'Translating content...'
                    : (postData.postTitle || `Post #${pId}`))));

            html += `
              <div class="ts-translation-item ${trans.status}">
                <div class="ts-trans-lang-col">
                  <span class="ts-trans-lang-flag">${getLanguageFlagHtml(langObj || langSlug, allLanguages)}</span>
                  <span class="ts-trans-lang-code">${langUpper}</span>
                </div>
                <div class="ts-trans-title-col">
                  <span class="ts-trans-title-text" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</span>
                </div>
                <div class="ts-trans-status-col">
                  ${rowStatusHtml}
                </div>
                <div class="ts-trans-actions-col">
                  ${actionsHtml}
                </div>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;
        });

        runningResultsListEl.innerHTML = html;
      }

      renderRunningResultsUI();

      // Header click for expand/collapse (ignores Skip button and action links)
      runningResultsListEl.addEventListener('click', function (e) {
        if (e.target.closest('.ts-post-skip-btn') || e.target.closest('.ts-row-action-btn')) {
          return;
        }
        const header = e.target.closest('.ts-post-group-header');
        if (header) {
          const card = header.closest('.ts-post-group-card');
          if (card) {
            const pId = card.getAttribute('data-post-id');
            card.classList.toggle('expanded');
            runningExpandedPosts[pId] = card.classList.contains('expanded');
          }
        }
      });

      // Skip button click handler inside Workflow B
      runningResultsListEl.addEventListener('click', function (e) {
        const skipBtn = e.target.closest('.ts-post-skip-btn');
        if (skipBtn) {
          e.preventDefault();
          e.stopPropagation();
          const pId = skipBtn.getAttribute('data-post-id');
          const bId = skipBtn.getAttribute('data-batch-id');
          if (!pId || !bId) return;

          showSkipConfirmationDialog(bId, pId, function (data) {
            const pIdStr = String(pId);
            if (runningPostResultsMap[pIdStr] && runningPostResultsMap[pIdStr].translations) {
              Object.keys(runningPostResultsMap[pIdStr].translations).forEach(function (lang) {
                const t = runningPostResultsMap[pIdStr].translations[lang];
                if (t.status === 'pending') {
                  t.status = 'skipped';
                  t.progressStatus = 'Skipped by user';
                } else if (t.status === 'running') {
                  t.status = 'cancelling';
                  t.progressStatus = 'Cancellation requested...';
                }
              });
            }

            if (data && data.batch_status) {
              updateRunningProgressCards(data.batch_status);
            }

            renderRunningResultsUI();
          });
        }
      });

      // Batch selector change listener
      const batchSelectEl = document.getElementById('ts-batch-select');
      if (batchSelectEl) {
        batchSelectEl.addEventListener('change', function () {
          const newBatchId = this.value;
          if (globalRunningPollingTimer) {
            clearInterval(globalRunningPollingTimer);
            globalRunningPollingTimer = null;
          }
          openPreviouslyRunningModal(newBatchId);
        });
      }

      // Close button
      const closeBtn = document.getElementById('ts-bulk-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          if (globalRunningPollingTimer) {
            clearTimeout(globalRunningPollingTimer);
            globalRunningPollingTimer = null;
          }
          root.innerHTML = '';
          checkHasActiveBackgroundJobs();
        });
      }

      // Done button
      const doneBtn = document.getElementById('ts-running-done-btn');
      if (doneBtn) {
        doneBtn.addEventListener('click', function () {
          if (globalRunningPollingTimer) {
            clearTimeout(globalRunningPollingTimer);
            globalRunningPollingTimer = null;
          }
          root.innerHTML = '';
          checkHasActiveBackgroundJobs();
        });
      }

      // Modal overlay click
      const runningOverlay = document.getElementById('ts-running-modal-overlay');
      if (runningOverlay) {
        runningOverlay.addEventListener('click', function (e) {
          if (e.target === runningOverlay) {
            if (globalRunningPollingTimer) {
              clearTimeout(globalRunningPollingTimer);
              globalRunningPollingTimer = null;
            }
            root.innerHTML = '';
            checkHasActiveBackgroundJobs();
          }
        });
      }

      // Back to New Translation button
      const backNewBtn = document.getElementById('ts-running-back-new-btn');
      if (backNewBtn) {
        backNewBtn.addEventListener('click', function () {
          if (globalRunningPollingTimer) {
            clearTimeout(globalRunningPollingTimer);
            globalRunningPollingTimer = null;
          }
          const selectedPosts = getSelectedPostIds();
          if (selectedPosts.length > 0) {
            openBulkTranslateWizard(selectedPosts);
          } else {
            root.innerHTML = '';
            alert('Please select posts in the table to start a new translation.');
            checkHasActiveBackgroundJobs();
          }
        });
      }

      // Sequential Polling in Workflow B (waits for previous request to complete)
      let isPollingRunning = false;
      const pollRunningBatch = async () => {
        if (isPollingRunning) return;
        isPollingRunning = true;

        try {
          const res = await fetch(`${restUrl}bulk-status?batch_id=${encodeURIComponent(currentBatch.batch_id)}`, {
            headers: { 'X-WP-Nonce': nonce },
          });

          if (!res.ok) {
            globalRunningPollingTimer = setTimeout(pollRunningBatch, 5000);
            return;
          }

          const data = await res.json();
          currentBatch = data;
          populateRunningMap(data);
          updateRunningProgressCards(data);
          renderRunningResultsUI();

          if (data.overall_status === 'completed' || data.overall_status === 'failed' || data.overall_status === 'skipped') {
            if (globalRunningPollingTimer) {
              clearTimeout(globalRunningPollingTimer);
              globalRunningPollingTimer = null;
            }
            checkHasActiveBackgroundJobs();
          } else {
            globalRunningPollingTimer = setTimeout(pollRunningBatch, 5000);
          }
        } catch (pollErr) {
          console.warn('[TranslateSense] Polling error in Workflow B:', pollErr);
          globalRunningPollingTimer = setTimeout(pollRunningBatch, 5000);
        } finally {
          isPollingRunning = false;
        }
      };

      globalRunningPollingTimer = setTimeout(pollRunningBatch, 5000);
    }

    // Direct click on "Bulk Translate" button (top or bottom)
    document.addEventListener('click', async function (e) {
      const target = e.target.closest('.ts-filter-action-btn');
      if (target) {
        e.preventDefault();
        const selectedPosts = getSelectedPostIds();
        if (selectedPosts.length === 0) {
          let hasActive = hasActiveBackgroundBatches;
          if (!hasActive) {
            hasActive = await checkHasActiveBackgroundJobs();
          }
          if (hasActive) {
            await openPreviouslyRunningModal();
            return false;
          }
          alert('Please select posts first.');
          return false;
        }
        await openBulkTranslateWizard(selectedPosts);
      }
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
    async function openBulkTranslateWizard(postIds) {
      const allLanguages = config.languages || [];
      const defaultLang = config.defaultLanguage || 'en';

      let selectedTargetLangs = allLanguages
        .filter((l) => l.slug !== defaultLang)
        .map((l) => l.slug);

      if (selectedTargetLangs.length === 0 && allLanguages.length > 0) {
        selectedTargetLangs = [allLanguages[0].slug];
      }

      let providers = await getRegisteredProviders(selectedTargetLangs[0] || 'es');
      const defaultProv = config.defaultProvider || '';
      const settingsUrl = config.settingsUrl || 'admin.php?page=translatesense&tab=settings';
      const connectorsUrl = config.connectorsUrl || 'options-connectors.php';
      const enabledProviders = config.enabledProviders || {};

      const getProviderStatus = (id) => {
        if (enabledProviders && typeof enabledProviders === 'object' && !Array.isArray(enabledProviders) && enabledProviders[id]) {
          const meta = enabledProviders[id];
          const isConn = meta.isConnected !== false;
          const isCore = Boolean(meta.connectors);
          const isInstall = meta.isProviderInstall !== undefined ? Boolean(meta.isProviderInstall) : true;
          const isActive = meta.isProviderActive !== undefined ? Boolean(meta.isProviderActive) : true;
          return {
            isConnected: isConn,
            connectors: isCore,
            isProviderInstall: isInstall,
            isProviderActive: isActive,
            targetUrl: isCore ? connectorsUrl : settingsUrl,
          };
        }
        const isMissing = (id === 'openai') ? !config.hasOpenAiKey : (id === 'gemini') ? !config.hasGeminiKey : false;
        return {
          isConnected: !isMissing,
          connectors: false,
          isProviderInstall: false,
          isProviderActive: false,
          targetUrl: settingsUrl,
        };
      };

      const isProviderAvailable = (id) => {
        if (id === 'chrome_ai' || id === 'edge_ai') {
          const chromeProv = providers.find((p) => p.id === id);
          return !(chromeProv && chromeProv.isSupported && false === chromeProv.isSupported.available);
        }
        const st = getProviderStatus(id);
        if (st.connectors && st.isProviderInstall) {
          return Boolean(st.isProviderActive && st.isConnected);
        }
        return Boolean(st.isConnected);
      };

      let selectedProviderId = (defaultProv && providers.some((p) => p.id === defaultProv && isProviderAvailable(p.id))) ? defaultProv : '';
      if (!selectedProviderId) {
        const firstAvail = providers.find((p) => isProviderAvailable(p.id));
        if (firstAvail) selectedProviderId = firstAvail.id;
      }

      let proidersAvailable = false;

      function renderStep2ProvidersData() {
        let ErrorModals = '';
        proidersAvailable = false;

        const providerRowsHtml = providers.map((p) => {
          const status = getProviderStatus(p.id);
          const isFrontend = (p.id === 'chrome_ai' || p.id === 'edge_ai');
          const isConnector = Boolean(status.connectors && status.isProviderInstall);

          let isAvailable = false;
          let actionHtml = '';
          let containerErrorBtn = false;

          if (isFrontend) {
            isAvailable = p.isSupported && false === p.isSupported.available ? false : true;
            actionHtml = !isAvailable
              ? `<button type="button" class="ts-provider-badge error-badge ts-provider-error-btn" title="${p.desc}" data-provider="${p.id}">⚠️ View Error</button>`
              : '<span class="ts-provider-badge on-device">On-device</span>';
          } else if (isConnector) {
            if (!status.isProviderActive) {
              isAvailable = false;
              actionHtml = `<a href="${status.targetUrl}" target="_blank" class="ts-provider-badge api-required" onclick="event.stopPropagation();" title="Activate Provider in WordPress Connectors">Activate Provider</a>`;
            } else if (!status.isConnected) {
              isAvailable = false;
              actionHtml = `<a href="${status.targetUrl}" target="_blank" class="ts-provider-badge error-badge api-required" onclick="event.stopPropagation();" title="Configure API Key in WordPress Connectors">API key required</a>`;
            } else {
              isAvailable = true;
              actionHtml = '<span class="ts-provider-badge core-connector">WP Connector</span>';
            }
          } else {
            if (!status.isConnected) {
              isAvailable = false;
              actionHtml = `<a href="${status.targetUrl}" target="_blank" class="ts-provider-badge error-badge api-required" onclick="event.stopPropagation();" title="Configure API Key in TranslateSense Settings">API key required</a>`;
            } else {
              isAvailable = true;
              actionHtml = '<span class="ts-provider-badge ready">Ready</span>';
            }
          }

          if (isAvailable && !proidersAvailable) {
            proidersAvailable = true;
          }

          if (p.isSupported && false === p.isSupported.available && p.isSupported.reason && '' !== p.isSupported.reason) {
            containerErrorBtn = true;
            const errorTitle = p.isSupported.reasonTitle || p.isSupported.title || p.title;
            ErrorModals += `
              <div class="ts-error-container ts-provider-modal-container hide" id="ts-error-${p.id}">
                ${core.createHeaderHTML({
              icon: p.logo,
              title: errorTitle,
              closeClass: 'ts-bulk-close',
            })}
                <div class="ts-review-body">
                  <div class="ts-error-message">${p.isSupported.reasonHTML || p.isSupported.reason}</div>
                </div>
                ${core.createFooterHTML({
              customHtml: p.isSupported.actionHtml ? p.isSupported.actionHtml : '',
              buttons: [
                { label: '&larr; Back', variant: 'secondary', attributes: { 'data-provider': p.id } }
              ]
            })}
              </div>
            `;
          }

          const isSelected = Boolean(isAvailable && selectedProviderId && p.id === selectedProviderId);
          const isDisabled = !isAvailable;

          return `
            <div class="ts-provider-row ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''} ${containerErrorBtn ? 'ts-provider-error-btn' : ''}" data-provider="${p.id}" ${isDisabled ? 'data-disabled="true"' : ''}>
              <div class="ts-provider-card-top">
                <div class="ts-provider-icon-box">
                  <img src="${p.logo}" alt="${p.title}" class="ts-provider-logo-img" />
                </div>
                <div class="ts-provider-header-content">
                  <div class="ts-provider-name">${p.title}</div>
                  ${actionHtml ? `<div class="ts-provider-badge-wrap">${actionHtml}</div>` : ''}
                </div>
                <div class="ts-provider-radio-wrap">
                  <input type="radio" id="ts-bulk-provider-${p.id}" name="ts_bulk_provider" value="${p.id}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} class="ts-provider-radio-input" />
                  <span class="ts-provider-custom-radio"></span>
                </div>
              </div>
              <p class="ts-provider-caption">${p.desc}</p>
            </div>
          `;
        }).join('');

        return { providerRowsHtml, ErrorModals, proidersAvailable };
      }

      const initialStep2 = renderStep2ProvidersData();

      // Ensure root container exists
      let root = document.getElementById('translatesense-bulk-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'translatesense-bulk-modal-root';
        document.body.appendChild(root);
      }

      // Render Modal Skeleton with 3 distinct views: Languages -> Provider -> Live Progress
      root.innerHTML = `
        <div class="ts-bulk-overlay" id="ts-bulk-modal-overlay">
          <div class="ts-bulk-modal">
            ${core.createHeaderHTML({
        icon: '⚡',
        title: 'TranslateSense Bulk Translation',
        subtitle: 'Choose a translation provider',
        closeId: 'ts-bulk-close-btn',
      })}
            
            <div class="ts-bulk-body">
              <!-- Notice for previously running translations (when eligible OpenAI/Gemini jobs are active) -->
              <div id="ts-previous-active-notice" class="ts-previous-active-notice" style="display: none;">
                <div class="ts-notice-inner">
                  <span class="ts-notice-icon">ℹ️</span>
                  <div class="ts-notice-text">
                    <span class="ts-notice-title">Background translations running</span>
                    <span class="ts-notice-desc">Previous translations are currently processing on the server.</span>
                  </div>
                </div>
                <button type="button" class="button button-secondary ts-show-running-btn" id="ts-show-running-posts-btn">Show Running Posts &rarr;</button>
              </div>

              <!-- Step 1 View: Languages -->
              <div id="ts-view-step-1">
                <div class="ts-step-bar">
                  <div class="ts-step-item active">
                    <span class="ts-step-number">1</span>
                    <span>Select Target Languages</span>
                  </div>
                  <span class="ts-step-divider"></span>
                  <div class="ts-step-item">
                    <span class="ts-step-number">2</span>
                    <span>Choose Provider</span>
                  </div>
                  <span class="ts-step-divider"></span>
                  <div class="ts-step-item">
                    <span class="ts-step-number">3</span>
                    <span>Translation Progress</span>
                  </div>
                </div>

                <div class="ts-lang-info-banner">
                  <span class="ts-info-icon">ℹ️</span>
                  <span>Targeting <strong class="ts-highlight-tag">${postIds.length} ${postIds.length === 1 ? 'post' : 'posts'}</strong>. Choose target language(s) to translate into:</span>
                </div>

                <div class="ts-lang-actions">
                  <div class="ts-lang-btn-group">
                    <button type="button" class="ts-lang-action-btn" id="ts-select-all-langs">Select All</button>
                    <button type="button" class="ts-lang-action-btn" id="ts-unselect-all-langs">Unselect All</button>
                  </div>
                  <div class="ts-lang-counter" id="ts-lang-counter">
                    ${selectedTargetLangs.length} of ${allLanguages.length} selected
                  </div>
                </div>

                <div class="ts-lang-grid ${allLanguages.length > 6 ? 'cols-3' : 'cols-2'}" id="ts-lang-grid">
                  ${allLanguages
          .map((lang) => {
            const isChecked = selectedTargetLangs.includes(lang.slug);
            return `
                        <div class="ts-lang-card ${isChecked ? 'selected' : ''}" data-lang="${lang.slug}">
                          <input type="checkbox" id="ts-lang-${lang.slug}" name="ts_target_langs[]" class="ts-lang-checkbox" value="${lang.slug}" ${isChecked ? 'checked' : ''} />
                          <span class="ts-lang-name" title="${lang.name}">${lang.name}</span>
                          <span class="ts-lang-code">${getLanguageDisplay(lang, allLanguages)}</span>
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
                  <span class="ts-step-divider"></span>
                  <div class="ts-step-item active">
                    <span class="ts-step-number">2</span>
                    <span>Choose Provider</span>
                  </div>
                  <span class="ts-step-divider"></span>
                  <div class="ts-step-item">
                    <span class="ts-step-number">3</span>
                    <span>Translation Progress</span>
                  </div>
                </div>

                <div class="ts-summary-box" id="ts-summary-box-content"></div>

                <div class="ts-bulk-field">
                  <div class="ts-provider-list" id="ts-bulk-provider-list">
                    ${initialStep2.providerRowsHtml}
                  </div>
                </div>
              </div>

              <!-- Step 3 View: Dedicated Live Progress & Results View -->
              <div id="ts-view-progress" style="display: none;">
                <!-- Keep Window Open Notice (Screenshot 1) -->
                <div id="ts-progress-notice-banner" class="ts-modal-notice-banner" style="display: none;"></div>

                <!-- Progress Bar Card (Screenshot 3) -->
                <div class="ts-progress-card" id="ts-progress-card">
                  <div class="ts-progress-header">
                    <span class="ts-progress-status" id="ts-progress-status">Translating content...</span>
                    <div class="ts-progress-meta">
                      <span id="ts-progress-posts-count">0 / ${postIds.length} posts (0%)</span>
                      <span class="ts-progress-timer" id="ts-progress-timer">00:00 elapsed</span>
                    </div>
                  </div>
                  <div class="ts-progress-bar-bg" id="ts-progress-bar-bg">
                    <div class="ts-progress-bar-fill" id="ts-progress-bar-fill"></div>
                  </div>
                </div>

                <!-- Summary Stats Grid after translation (Screenshot 2) -->
                <div class="ts-summary-stats-grid" id="ts-summary-stats-grid" style="display: none;">
                  <!-- Card 1: Completed Posts -->
                  <div class="ts-stat-card green">
                    <div class="ts-stat-icon-box green">
                      <span class="dashicons dashicons-yes-alt"></span>
                    </div>
                    <div class="ts-stat-info">
                      <div class="ts-stat-label">Completed Posts</div>
                      <div class="ts-stat-val" id="ts-stat-completed-posts">0 / ${postIds.length}</div>
                    </div>
                  </div>

                  <!-- Card 2: Failed Posts -->
                  <div class="ts-stat-card red">
                    <div class="ts-stat-icon-box red">
                      <span class="dashicons dashicons-dismiss"></span>
                    </div>
                    <div class="ts-stat-info">
                      <div class="ts-stat-label">Failed Posts</div>
                      <div class="ts-stat-val" id="ts-stat-failed-posts">0 / ${postIds.length}</div>
                    </div>
                  </div>

                  <!-- Card 3: Total Characters -->
                  <div class="ts-stat-card blue">
                    <div class="ts-stat-icon-box blue">
                      <span class="dashicons dashicons-editor-textcolor"></span>
                    </div>
                    <div class="ts-stat-info">
                      <div class="ts-stat-label">Total Characters</div>
                      <div class="ts-stat-val" id="ts-stat-total-characters">0</div>
                    </div>
                  </div>

                  <!-- Card 4: Elapsed Time -->
                  <div class="ts-stat-card orange">
                    <div class="ts-stat-icon-box orange">
                      <span class="dashicons dashicons-clock"></span>
                    </div>
                    <div class="ts-stat-info">
                      <div class="ts-stat-label">Elapsed Time</div>
                      <div class="ts-stat-val" id="ts-stat-elapsed-time">0m 00s</div>
                    </div>
                  </div>
                </div>

                <!-- Post Accordion Group List (Screenshot 1) -->
                <div class="ts-results-container" id="ts-results-container">
                  <div class="ts-results-list" id="ts-results-list"></div>
                </div>
              </div>
            </div>

            <!-- Modal Footers -->
            ${core.createFooterHTML({
            id: 'ts-footer-step-1',
            buttons: [
              { id: 'ts-wizard-next-btn', label: 'Next: Choose Provider &rarr;', variant: 'primary', disabled: selectedTargetLangs.length === 0 }
            ]
          })}

            ${core.createFooterHTML({
            id: 'ts-footer-step-2',
            style: 'display: none;',
            buttons: [
              { id: 'ts-wizard-back-btn', label: '&larr; Back', variant: 'secondary' },
              { id: 'ts-bulk-start-btn', label: 'Start Bulk Translation', variant: initialStep2.proidersAvailable ? 'primary' : 'disabled', disabled: !initialStep2.proidersAvailable, title: !initialStep2.proidersAvailable ? 'Not available for translation. Select an available provider to start translation.' : 'Start Bulk Translation' }
            ]
          })}

          <div class="ts-common-footer ts-review-footer" id="ts-footer-progress" style="display: none; justify-content: space-between; align-items: center;">
            <div class="ts-footer-filter-wrap" id="ts-footer-filter-wrap" style="display: none;">
              <label class="ts-footer-filter-label" for="ts-filter-untranslated-chk">
                <input type="checkbox" id="ts-filter-untranslated-chk" class="ts-footer-checkbox" />
                <span>Only show untranslated or failed items</span>
              </label>
            </div>
            <div class="ts-footer-buttons-group">
              <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-bulk-retry-failed-btn" style="display: none;">
                <span class="dashicons dashicons-update"></span> Retry Failed
              </button>
              <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-bulk-done-btn" disabled>
                <span class="dashicons dashicons-hourglass" style="font-size: 15px; width: 15px; height: 15px; line-height: 15px; margin-right: 4px;"></span> Translation In Progress...
              </button>
            </div>
          </div>
          </div>
          <div id="ts-bulk-error-modals-wrap" style="display: contents;">
            ${initialStep2.ErrorModals}
          </div>
        </div>
      `;

      const sourceLangCode = 'en';

      // Close modal handler
      const closeBtn = document.getElementById('ts-bulk-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          if (inModalPollingTimer) {
            clearTimeout(inModalPollingTimer);
            inModalPollingTimer = null;
          }
          root.innerHTML = '';
          const errModalRoot = document.getElementById('ts-error-modal-root');
          if (errModalRoot) errModalRoot.remove();
          checkHasActiveBackgroundJobs();
        });
      }

      // Modal overlay click handler
      const modalOverlay = document.getElementById('ts-bulk-modal-overlay');
      if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
          if (e.target === modalOverlay) {
            if (inModalPollingTimer) {
              clearTimeout(inModalPollingTimer);
              inModalPollingTimer = null;
            }
            root.innerHTML = '';
            const errModalRoot = document.getElementById('ts-error-modal-root');
            if (errModalRoot) errModalRoot.remove();
            checkHasActiveBackgroundJobs();
          }
        });
      }

      // Check and display Previous Background Translation Notice (Workflow A)
      checkHasActiveBackgroundJobs().then(function (hasActive) {
        const noticeEl = document.getElementById('ts-previous-active-notice');
        if (noticeEl && hasActive) {
          noticeEl.style.display = 'flex';
        }
      });

      const showRunningBtn = document.getElementById('ts-show-running-posts-btn');
      if (showRunningBtn) {
        showRunningBtn.addEventListener('click', function () {
          openPreviouslyRunningModal();
        });
      }

      function bindProviderCardEvents() {
        // Provider Selection Row Click
        root.querySelectorAll('.ts-provider-row, .ts-provider-card').forEach(function (row) {
          row.addEventListener('click', function () {
            if (row.classList.contains('ts-provider-error-btn')) {
              return;
            }
            if (row.classList.contains('disabled') || row.getAttribute('data-disabled') === 'true') {
              return;
            }
            root.querySelectorAll('.ts-provider-row, .ts-provider-card').forEach(function (c) {
              c.classList.remove('selected');
            });
            row.classList.add('selected');
            const radio = row.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            selectedProviderId = row.getAttribute('data-provider');
          });
        });

        // Error Modal Box Button or Row Click
        root.querySelectorAll('.ts-provider-error-btn').forEach((errorBtn) => {
          errorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetModal = errorBtn.dataset.provider;
            if (targetModal) {
              const modal = document.querySelector("#ts-error-" + targetModal);
              const mainModal = root.querySelector('.ts-bulk-modal');
              if (modal && mainModal) {
                modal.classList.remove('hide');
                mainModal.classList.add('hide');
              }
            }
          });
        });

        // Error Modals Back & Close buttons
        root.querySelectorAll('.ts-error-container').forEach((errorModal) => {
          const backBtn = errorModal.querySelector('.ts-bulk-btn-secondary');
          const errCloseBtn = errorModal.querySelector('.ts-bulk-close');
          const mainModal = root.querySelector('.ts-bulk-modal');
          if (backBtn) {
            backBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              errorModal.classList.add('hide');
              if (mainModal) mainModal.classList.remove('hide');
            });
          }
          if (errCloseBtn) {
            errCloseBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              errorModal.classList.add('hide');
              if (mainModal) mainModal.classList.remove('hide');
            });
          }
        });
      }

      bindProviderCardEvents();

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
        nextBtn.addEventListener('click', async function () {
          if (selectedTargetLangs.length === 0) {
            alert('Please select at least one target language.');
            return;
          }

          nextBtn.disabled = true;
          const origText = nextBtn.innerHTML;
          nextBtn.innerHTML = 'Checking Providers...';

          try {
            providers = await getRegisteredProviders(selectedTargetLangs[0] || 'es');
            if (!selectedProviderId || !isProviderAvailable(selectedProviderId)) {
              const firstAvail = providers.find((p) => isProviderAvailable(p.id));
              selectedProviderId = firstAvail ? firstAvail.id : '';
            }

            const step2Data = renderStep2ProvidersData();
            const provList = document.getElementById('ts-bulk-provider-list');
            if (provList) provList.innerHTML = step2Data.providerRowsHtml;

            const errWrap = document.getElementById('ts-bulk-error-modals-wrap');
            if (errWrap) errWrap.innerHTML = step2Data.ErrorModals;

            const startBtnEl = document.getElementById('ts-bulk-start-btn');
            if (startBtnEl) {
              startBtnEl.className = 'ts-bulk-btn ' + (step2Data.proidersAvailable ? 'ts-bulk-btn-primary' : 'ts-bulk-btn-disabled');
              startBtnEl.disabled = !step2Data.proidersAvailable;
              startBtnEl.title = !step2Data.proidersAvailable ? 'Not available for translation. Select an available provider to start translation.' : 'Start Bulk Translation';
            }

            bindProviderCardEvents();
          } catch (err) {
            console.error('[TranslateSense] Error refreshing providers:', err);
          } finally {
            nextBtn.disabled = false;
            nextBtn.innerHTML = origText;
          }

          const totalTranslations = postIds.length * selectedTargetLangs.length;
          const step1Label = document.getElementById('ts-summary-step1-label');
          const summaryContent = document.getElementById('ts-summary-box-content');

          if (step1Label) step1Label.textContent = `${selectedTargetLangs.length} Languages`;
          if (summaryContent) {
            summaryContent.innerHTML = `
              <div class="ts-summary-job-row">
                <span class="ts-summary-job-icon">📄</span>
                <span class="ts-summary-job-text"><strong>${postIds.length} ${postIds.length === 1 ? 'post' : 'posts'}</strong> &middot; <strong>${selectedTargetLangs.length} languages</strong> &middot; <strong>${totalTranslations} translations</strong></span>
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

          const subtitleEl = root.querySelector('.ts-common-subtitle');
          if (subtitleEl) subtitleEl.textContent = 'Choose a translation provider';
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

          const subtitleEl = root.querySelector('.ts-common-subtitle');
          if (subtitleEl) subtitleEl.textContent = 'Fast & Accurate Multi-Language Content Localizer';
        });
      }

      // Execution Engine
      const startBtn = document.getElementById('ts-bulk-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', async function () {
          if (!proidersAvailable) return;

          const checkedRadio = document.querySelector('input[name="ts_bulk_provider"]:checked');
          const selectedProvider = checkedRadio && !checkedRadio.disabled ? checkedRadio.value : selectedProviderId;

          if (!selectedProvider || !isProviderAvailable(selectedProvider)) {
            alert('Please choose an active translation engine with a configured API key before starting.');
            return;
          }

          const matchingProvider = providers.find((p) => p.id === selectedProvider);
          const isChromeAi = Boolean(
            selectedProvider === 'chrome_ai' ||
            selectedProvider === 'edge_ai' ||
            (matchingProvider && (
              matchingProvider.id === 'chrome_ai' ||
              matchingProvider.id === 'edge_ai' ||
              matchingProvider.browserType === 'edge' ||
              matchingProvider.browserType === 'chrome'
            ))
          );

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
          const initRetryBtn = document.getElementById('ts-bulk-retry-failed-btn');
          if (initRetryBtn) {
            if (isChromeAi) {
              initRetryBtn.style.setProperty('display', 'none', 'important');
              initRetryBtn.classList.add('ts-hide');
              initRetryBtn.remove();
            } else {
              initRetryBtn.style.setProperty('display', 'none', 'important');
              initRetryBtn.classList.add('ts-hide');
            }
          }

          if (providerLabel && matchingProvider) {
            providerLabel.textContent = matchingProvider.title;
          }

          const resultsListEl = document.getElementById('ts-results-list');
          const reviewModalEle = resultsListEl.closest('.ts-bulk-modal');
          const barFill = document.getElementById('ts-progress-bar-fill');
          const statusText = document.getElementById('ts-progress-status');
          const postsCountEl = document.getElementById('ts-progress-posts-count');
          const noticeBanner = document.getElementById('ts-progress-notice-banner');

          // Initialize provider status line matching Screenshot 3
          const providerName = matchingProvider ? matchingProvider.title : (isChromeAi ? 'Chrome Local AI' : 'AI Engine');
          if (statusText) {
            statusText.textContent = `Translating content with ${providerName}...`;
          }
          if (postsCountEl) {
            postsCountEl.textContent = `0 / ${postIds.length * selectedTargetLangs.length} posts (0%)`;
          }

          // Real-time elapsed timer tracking accumulated time across phases (existing time + retry time)
          let accumulatedElapsedTime = 0;
          let phaseStartTime = Date.now();
          let elapsedTimerInterval = null;

          function startElapsedTimer() {
            phaseStartTime = Date.now();
            if (elapsedTimerInterval) clearInterval(elapsedTimerInterval);
            elapsedTimerInterval = setInterval(function () {
              const currentPhaseSecs = Math.floor((Date.now() - phaseStartTime) / 1000);
              const totalSecs = accumulatedElapsedTime + currentPhaseSecs;
              const m = Math.floor(totalSecs / 60);
              const s = totalSecs % 60;
              const currentTimerEl = document.getElementById('ts-progress-timer');
              if (currentTimerEl) {
                currentTimerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} elapsed`;
              }
              const statTimerEl = document.getElementById('ts-stat-elapsed-time');
              if (statTimerEl) {
                statTimerEl.textContent = (m > 0) ? `${m}m ${s}s` : `${s}s`;
              }
            }, 1000);
          }

          startElapsedTimer();

          // Helper: Escape HTML strings safely
          function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
          }

          // State tracking for grouped post results & activity
          const postResultsMap = {};
          const expandedPosts = {};
          const postExtractedStringsCache = {};

          postIds.forEach(function (pid) {
            const pIdStr = String(pid);
            postResultsMap[pIdStr] = {
              postId: pid,
              postTitle: `Post #${pid}`,
              translations: {},
              extractedStrings: null,
            };
            selectedTargetLangs.forEach(function (lang) {
              let initialStatus = 'pending';
              let initialError = '';

              postResultsMap[pIdStr].translations[lang] = {
                targetLang: lang,
                targetPostId: null,
                targetTitle: '',
                status: initialStatus,
                completedStrings: 0,
                totalStrings: 0,
                totalCharacters: 0,
                completedCharacters: 0,
                editUrl: '',
                viewUrl: '',
                error: initialError,
                errorObj: null,
              };
            });
          });

          // State for filtering untranslated/failed items
          let filterOnlyFailedOrUntranslated = false;

          // Function to render grouped post results (Matching Screenshot & media_1793390497248_8f63968f.jpg)
          function renderResultsUI() {
            if (!resultsListEl) return;

            let html = '';
            const postIdsList = Object.keys(postResultsMap);

            postIdsList.forEach(function (pId, postIdx) {
              const postData = postResultsMap[pId];
              const transKeys = Object.keys(postData.translations);

              let compCount = 0;
              let failCount = 0;
              let runCount = 0;
              let pendCount = 0;

              transKeys.forEach(function (langSlug) {
                const trans = postData.translations[langSlug];
                if (trans.status === 'completed' || trans.status === 'already_exists') {
                  compCount++;
                } else if (trans.status === 'failed') {
                  failCount++;
                } else if (trans.status === 'running') {
                  runCount++;
                } else {
                  pendCount++;
                }
              });

              // If filter checkbox is enabled, check if post has any untranslated or failed items
              let displayKeys = transKeys;
              if (filterOnlyFailedOrUntranslated) {
                displayKeys = transKeys.filter(function (langSlug) {
                  const s = postData.translations[langSlug].status;
                  return s !== 'completed' && s !== 'already_exists';
                });
                if (displayKeys.length === 0) {
                  return; // Skip this post entirely if it has no untranslated/failed items
                }
              }

              let groupCompletedStrings = 0;
              let groupTotalStrings = 0;

              transKeys.forEach(function (langSlug) {
                const trans = postData.translations[langSlug];
                if (trans.status === 'completed' || trans.status === 'already_exists') {
                  groupCompletedStrings += (trans.completedStrings || trans.totalStrings || 0);
                }
                groupTotalStrings += (trans.totalStrings || trans.completedStrings || 0);
              });

              // Post header badges: show only failed post count badge (completed and strings removed)
              let headerStatusHtml = '';
              if (failCount > 0) {
                headerStatusHtml = `<span class="ts-post-status-pill failed"><span class="dashicons dashicons-dismiss"></span> Failed (${failCount})</span>`;
              } else if (runCount > 0) {
                headerStatusHtml = '<span class="ts-post-status-pill in-progress"><span class="ts-dots-spinner"></span> In Progress</span>';
              }

              // Determine if expanded: default all post cards to expanded
              let isExpanded = true;
              if (expandedPosts[pId] !== undefined) {
                isExpanded = expandedPosts[pId];
              }

              html += `
                <div class="ts-post-group-card ${isExpanded ? 'expanded' : ''}" data-post-id="${pId}">
                  <div class="ts-post-group-header">
                    <div class="ts-post-source-info">
                      <div class="ts-post-icon-box">
                        <span class="dashicons dashicons-media-text"></span>
                      </div>
                      <span class="ts-source-title-text">${escapeHtml(postData.postTitle || `Post #${pId}`)}</span>
                      <span class="ts-post-id-tag">#${pId}</span>
                    </div>
                    <div class="ts-post-header-right">
                      ${headerStatusHtml}
                      <span class="ts-post-chevron dashicons dashicons-arrow-down-alt2"></span>
                    </div>
                  </div>
                  <div class="ts-post-translations-list">
              `;

              displayKeys.forEach(function (langSlug) {
                const trans = postData.translations[langSlug];
                const isAlreadyExists = trans.status === 'already_exists';
                const isDone = trans.status === 'completed';
                const isFail = trans.status === 'failed' || Boolean(trans.error) || Boolean(trans.errorObj);
                const isRunning = trans.status === 'running';

                const langUpper = langSlug.toUpperCase();
                const langObj = allLanguages.find(function (l) { return l.slug === langSlug; });

                let rowStatusHtml = '';
                if (isAlreadyExists) {
                  rowStatusHtml = '<span class="ts-row-status completed"><span class="dashicons dashicons-yes-alt"></span> Completed</span>';
                } else if (isDone) {
                  rowStatusHtml = '<span class="ts-row-status completed"><span class="dashicons dashicons-yes-alt"></span> Completed</span>';
                } else if (trans.status === 'skipped') {
                  rowStatusHtml = '<span class="ts-row-status skipped"><span class="dashicons dashicons-controls-skipforward"></span> Skipped</span>';
                } else if (trans.status === 'cancelling') {
                  rowStatusHtml = '<span class="ts-row-status cancelling"><span class="ts-spinner-circle"></span> Cancelling...</span>';
                } else if (isFail) {
                  const isUnsupported = trans.error && (trans.error.toLowerCase().includes('not supported') || trans.error.toLowerCase().includes('unavailable') || trans.error.toLowerCase().includes('requires a user'));
                  const failText = isUnsupported ? 'Language not supported' : 'Failed';
                  if (trans.error || trans.errorObj) {
                    rowStatusHtml = `<button type="button" class="ts-row-status failed ts-error-detail-btn" data-post-id="${escapeHtml(pId)}" data-lang="${escapeHtml(langSlug)}" title="Click to view error details"><span class="dashicons dashicons-dismiss"></span> ${failText}</button>`;
                  } else {
                    rowStatusHtml = `<span class="ts-row-status failed"><span class="dashicons dashicons-dismiss"></span> ${failText}</span>`;
                  }
                } else if (isRunning) {
                  rowStatusHtml = `<span class="ts-row-status translating">
                      <span class="ts-spinner-circle"></span>
                      <span class="ts-translating-label">Translating</span>
                      <span class="ts-ellipsis-dots">
                        <span class="ts-dot"></span>
                        <span class="ts-dot"></span>
                        <span class="ts-dot"></span>
                      </span>
                    </span>`;
                } else {
                  rowStatusHtml = '<span class="ts-row-status pending"><span class="dashicons dashicons-clock"></span> Pending...</span>';
                }

                const isElementor = (trans.editorType === 'elementor' || (trans.editUrl && trans.editUrl.indexOf('action=elementor') !== -1));
                const defaultEditUrl = isElementor && trans.targetPostId ? `post.php?post=${trans.targetPostId}&action=elementor` : (trans.targetPostId ? `post.php?post=${trans.targetPostId}&action=edit` : '#');
                const editHref = trans.editUrl || defaultEditUrl;
                const viewHref = trans.viewUrl || (trans.targetPostId ? `/?p=${trans.targetPostId}` : '#');
                const isAvailable = isDone || isAlreadyExists;

                let actionsHtml = '';
                if (isAvailable) {
                  actionsHtml += `<a href="${viewHref}" target="_blank" rel="noopener noreferrer" class="ts-row-action-btn view" title="View translated post on site"><span class="dashicons dashicons-visibility"></span> View</a>`;
                  actionsHtml += `<a href="${editHref}" target="_blank" rel="noopener noreferrer" class="ts-row-action-btn edit" title="Edit translated post"><span class="dashicons dashicons-edit"></span> Edit</a>`;
                } else if (!isFail) {
                  actionsHtml += `<span class="ts-row-action-btn view disabled"><span class="dashicons dashicons-visibility"></span> View</span>`;
                  actionsHtml += `<span class="ts-row-action-btn edit disabled"><span class="dashicons dashicons-edit"></span> Edit</span>`;
                }

                const displayTitle = trans.targetTitle
                  || (isAlreadyExists ? (trans.targetTitle || postData.postTitle)
                    : (isDone ? (trans.targetTitle || postData.postTitle)
                      : (isFail ? (postData.postTitle || `Post #${pId}`)
                        : (isRunning ? 'Translating content...'
                          : (postData.postTitle || `Post #${pId}`)))));

                html += `
                  <div class="ts-translation-item ${trans.status}">
                    <div class="ts-trans-lang-col">
                      <span class="ts-trans-lang-flag">${getLanguageFlagHtml(langObj || langSlug, allLanguages)}</span>
                      <span class="ts-trans-lang-code">${langUpper}</span>
                    </div>
                    <div class="ts-trans-title-col">
                      <span class="ts-trans-title-text" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</span>
                    </div>
                    <div class="ts-trans-status-col">
                      ${rowStatusHtml}
                    </div>
                    <div class="ts-trans-actions-col">
                      ${actionsHtml}
                    </div>
                  </div>
                `;
              });

              html += `
                  </div>
                </div>
              `;
            });

            resultsListEl.innerHTML = html;

            // Guarantee retryBtn is never visible when any post is in running or pending state,
            // and never added or shown if provider is chrome_ai or edge_ai
            const activeRetryBtn = document.getElementById('ts-bulk-retry-failed-btn');
            if (activeRetryBtn) {
              if (isChromeAi) {
                activeRetryBtn.style.setProperty('display', 'none', 'important');
                activeRetryBtn.classList.add('ts-hide');
                activeRetryBtn.remove();
              } else {
                let isAnyActive = false;
                Object.keys(postResultsMap).forEach(function (pid) {
                  Object.keys(postResultsMap[pid].translations).forEach(function (lang) {
                    const st = postResultsMap[pid].translations[lang].status;
                    if (st === 'running' || st === 'pending') {
                      isAnyActive = true;
                    }
                  });
                });
                if (isAnyActive) {
                  activeRetryBtn.style.setProperty('display', 'none', 'important');
                  activeRetryBtn.classList.add('ts-hide');
                }
              }
            }
          }

          // Header Click Toggle Listener
          if (resultsListEl && !resultsListEl._hasHeaderToggleListener) {
            resultsListEl._hasHeaderToggleListener = true;
            resultsListEl.addEventListener('click', function (e) {
              const header = e.target.closest('.ts-post-group-header');
              if (!header) return;
              const card = header.closest('.ts-post-group-card');
              if (!card) return;
              const pid = card.getAttribute('data-post-id');
              const isNowExpanded = !card.classList.contains('expanded');
              expandedPosts[pid] = isNowExpanded;
              card.classList.toggle('expanded', isNowExpanded);
            });
          }

          // Global delegation for error details button click
          if (resultsListEl && !resultsListEl._hasErrorDetailListener) {
            resultsListEl._hasErrorDetailListener = true;
            resultsListEl.addEventListener('click', function (e) {
              const errorBtn = e.target.closest('.ts-error-detail-btn');
              if (!errorBtn) return;
              e.preventDefault();
              e.stopPropagation();

              const postId = errorBtn.getAttribute('data-post-id');
              const langSlug = errorBtn.getAttribute('data-lang');

              const postData = postResultsMap[postId] || postResultsMap[String(postId)];
              const trans = postData && postData.translations ? postData.translations[langSlug] : null;

              const langObj = allLanguages.find(function (l) { return l.slug === langSlug; });
              const langUpper = (langSlug || '').toUpperCase();
              const langDisplayName = langObj ? `${langObj.name} (${langUpper})` : langUpper;

              const errObj = (trans && trans.errorObj) ? trans.errorObj : {
                reasonTitle: `${langDisplayName} Notice`,
                reason: (trans && trans.error) || 'Translation failed.',
                reasonHTML: `<p>${escapeHtml((trans && trans.error) || 'Translation failed.')}</p>`,
                actionHtml: ''
              };


              const modalTitle = errObj.reasonTitle || `${langDisplayName} Notice`;
              const modalBodyHtml = errObj.reasonHTML || `
                <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 14px 16px;">
                  <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <span class="dashicons dashicons-warning" style="color: #dc2626; font-size: 20px; width: 20px; height: 20px; line-height: 20px; flex-shrink: 0; margin-top: 1px;"></span>
                    <p style="margin: 0; font-size: 13.5px; color: #991b1b; line-height: 1.5; font-weight: 500; word-break: break-word;">
                      ${escapeHtml(errObj.reason || 'Translation failed.')}
                    </p>
                  </div>
                </div>
              `;
              const modalActionHtml = errObj.actionHtml || '';

              let errorModalEle = root.querySelector('#ts-bulk-error-modals-wrap');
              if (!errorModalEle) {
                errorModalEle = document.createElement('div');
                errorModalEle.id = 'ts-bulk-error-modals-wrap';
                document.body.appendChild(errorModalEle);
              }

              const matchingProvider = providers.find((p) => p.id === selectedProvider);
              const modalIcon = (matchingProvider && matchingProvider.logo) ? matchingProvider.logo : 'dashicons-warning';

              errorModalEle.innerHTML = `<div class="ts-error-container">
              ${core ? core.createHeaderHTML({
                icon: modalIcon,
                title: escapeHtml(modalTitle),
                closeId: 'ts-err-modal-close',
                closeClass: 'ts-bulk-close',
              }) : `
                      <div class="ts-bulk-header">
                        <h2>⚠️ ${escapeHtml(modalTitle)}</h2>
                        <button type="button" class="ts-bulk-close" id="ts-err-modal-close">&times;</button>
                      </div>
                    `}
                    <div class="ts-bulk-body ts-review-body" style="padding: 22px;">
                      <div class="ts-error-message">
                        ${modalBodyHtml}
                      </div>
                    </div>
                    ${core ? core.createFooterHTML({
                customHtml: modalActionHtml,
                buttons: [
                  { id: 'ts-err-modal-ok', label: 'Close', variant: 'primary' }
                ]
              }) : `
                      <div class="ts-common-footer">
                        ${modalActionHtml ? `<div>${modalActionHtml}</div>` : ''}
                        <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-err-modal-ok">Close</button>
                      </div>
                      </div>
                    `}
              `;

              function closeModal() {
                if (errorModalEle) errorModalEle.innerHTML = '';
                reviewModalEle.classList.remove('hide');
              }

              reviewModalEle.classList.add('hide');
              const closeBtn = errorModalEle.querySelector('.ts-bulk-close');
              const okBtn = errorModalEle.querySelector('#ts-err-modal-ok');
              if (closeBtn) closeBtn.addEventListener('click', closeModal);
              if (okBtn) okBtn.addEventListener('click', closeModal);

              const overlay = errorModalEle.querySelector('.ts-bulk-overlay');
              if (overlay) {
                overlay.addEventListener('click', function (ev) {
                  if (ev.target === overlay) closeModal();
                });
              }
            });
          }

          // Filter Checkbox Listener (Only show untranslated or failed items)
          const filterChk = document.getElementById('ts-filter-untranslated-chk');
          if (filterChk && !filterChk._hasFilterListener) {
            filterChk._hasFilterListener = true;
            filterChk.addEventListener('change', function () {
              filterOnlyFailedOrUntranslated = Boolean(this.checked);
              renderResultsUI();
            });
          }

          // Helper: Handle Bulk Translation Completion & Show 4 Stats Cards (Screenshot 2 & Refined Modal UI)
          function onBulkProgressComplete(isSuccess, summaryMsg, completedJobs, totalJobs) {
            if (elapsedTimerInterval) {
              clearInterval(elapsedTimerInterval);
              elapsedTimerInterval = null;
            }

            // Accumulate elapsed duration from this phase
            const phaseDuration = Math.floor((Date.now() - phaseStartTime) / 1000);
            accumulatedElapsedTime += phaseDuration;

            const m = Math.floor(accumulatedElapsedTime / 60);
            const s = accumulatedElapsedTime % 60;
            const formattedTime = (m > 0) ? `${m}m ${s}s` : `${s}s`;

            let totalLangPosts = 0;
            let completedLangPosts = 0;
            let failedLangPosts = 0;
            let totalCharactersSum = 0;
            let completedCharactersSum = 0;

            // Compute total language posts, failed posts, and character counts across all groups
            Object.keys(postResultsMap).forEach(function (pid) {
              const post = postResultsMap[pid];
              const transKeys = Object.keys(post.translations);

              transKeys.forEach(function (lang) {
                const t = post.translations[lang];
                totalLangPosts++;

                const itemTotalChars = t.totalCharacters || (t.totalStrings ? t.totalStrings * 45 : 0);
                const itemCompChars = t.completedCharacters || (t.completedStrings ? t.completedStrings * 45 : 0);

                totalCharactersSum += itemTotalChars;

                if (t.status === 'completed' || t.status === 'already_exists') {
                  completedLangPosts++;
                  completedCharactersSum += (itemCompChars || itemTotalChars);
                } else if (t.status === 'failed') {
                  failedLangPosts++;
                }
              });
            });

            if (totalCharactersSum < completedCharactersSum) {
              totalCharactersSum = completedCharactersSum;
            }

            const compPostsEl = document.getElementById('ts-stat-completed-posts');
            const failPostsEl = document.getElementById('ts-stat-failed-posts');
            const totalCharsEl = document.getElementById('ts-stat-total-characters');
            const elapsedTimeEl = document.getElementById('ts-stat-elapsed-time');

            if (compPostsEl) compPostsEl.textContent = `${completedLangPosts} / ${totalLangPosts || (postIds.length * selectedTargetLangs.length)}`;
            if (failPostsEl) failPostsEl.textContent = `${failedLangPosts} / ${totalLangPosts || (postIds.length * selectedTargetLangs.length)}`;
            if (totalCharsEl) {
              totalCharsEl.textContent = `${formatNumber(completedCharactersSum)}`;
              totalCharsEl.title = `${completedCharactersSum.toLocaleString()} characters`;
            }
            if (elapsedTimeEl) elapsedTimeEl.textContent = formattedTime;

            // Hide the progress bar card (Screenshot 3) and notice banner (Screenshot 1)
            const progressCard = document.getElementById('ts-progress-card');
            if (progressCard) progressCard.style.display = 'none';

            if (noticeBanner) noticeBanner.style.display = 'none';

            // Show the 4 summary stat cards (Screenshot 2)
            const statsGrid = document.getElementById('ts-summary-stats-grid');
            if (statsGrid) statsGrid.style.display = 'grid';

            // Show footer filter checkbox
            const filterWrap = document.getElementById('ts-footer-filter-wrap');
            if (filterWrap) filterWrap.style.display = 'inline-flex';

            // Check if there are any running or pending items, and any failed items across all posts
            let hasAnyRunningOrPending = false;
            let hasAnyFailedItems = false;
            Object.keys(postResultsMap).forEach(function (pid) {
              Object.keys(postResultsMap[pid].translations).forEach(function (lang) {
                const st = postResultsMap[pid].translations[lang].status;
                if (st === 'running' || st === 'pending') {
                  hasAnyRunningOrPending = true;
                }
                if (st === 'failed') {
                  hasAnyFailedItems = true;
                }
              });
            });

            // Show "Retry Failed" button ONLY after translation is fully complete (no pending or running posts) AND failures exist
            // BUT if provider is chrome_ai or edge_ai, don't add or show Retry Failed button in modal footer
            const retryBtn = document.getElementById('ts-bulk-retry-failed-btn');
            if (retryBtn) {
              if (isChromeAi) {
                retryBtn.style.setProperty('display', 'none', 'important');
                retryBtn.classList.add('ts-hide');
                retryBtn.remove();
              } else if (!hasAnyRunningOrPending && hasAnyFailedItems) {
                retryBtn.style.setProperty('display', 'inline-flex', 'important');
                retryBtn.classList.remove('ts-hide');
                retryBtn.disabled = false;
                retryBtn.onclick = async function () {
                  // Immediately hide Retry Failed button while retry is in progress
                  retryBtn.style.setProperty('display', 'none', 'important');
                  retryBtn.classList.add('ts-hide');
                  retryBtn.disabled = true;

                  const failedItems = [];
                  Object.keys(postResultsMap).forEach(function (pid) {
                    Object.keys(postResultsMap[pid].translations).forEach(function (lang) {
                      const t = postResultsMap[pid].translations[lang];
                      if (t.status === 'failed') {
                        failedItems.push({
                          postId: pid,
                          targetLang: lang,
                          postTitle: postResultsMap[pid].postTitle,
                          editorType: t.editorType || 'core',
                          trans: t,
                        });
                        t.status = 'pending';
                        t.error = '';
                        t.errorObj = null;
                      }
                    });
                  });

                  if (failedItems.length === 0) {
                    retryBtn.disabled = false;
                    retryBtn.style.display = 'none';
                    return;
                  }

                  // Re-query DOM elements for progress bar and stats cards
                  const statsGridEl = document.getElementById('ts-summary-stats-grid');
                  const progressCardEl = document.getElementById('ts-progress-card');
                  const filterWrapEl = document.getElementById('ts-footer-filter-wrap');
                  const noticeBannerEl = document.getElementById('ts-progress-notice-banner');

                  // Switch UI view back to progress mode: show progress bar card for remaining posts
                  if (statsGridEl) statsGridEl.style.display = 'none';
                  if (progressCardEl) progressCardEl.style.display = 'block';
                  if (filterWrapEl) filterWrapEl.style.display = 'none';
                  if (noticeBannerEl && isChromeAi) noticeBannerEl.style.display = 'flex';

                  const progressStatusEl = document.getElementById('ts-progress-status');
                  const progressPostsEl = document.getElementById('ts-progress-posts-count');
                  const progressFill = document.getElementById('ts-progress-bar-fill');

                  if (progressStatusEl) progressStatusEl.textContent = `Retrying failed translations (0/${failedItems.length})...`;
                  if (progressPostsEl) progressPostsEl.textContent = `0 / ${failedItems.length} posts (0%)`;
                  if (progressFill) progressFill.style.width = '0%';

                  if (doneBtn) {
                    doneBtn.disabled = true;
                    doneBtn.className = 'ts-bulk-btn ts-bulk-btn-primary';
                    doneBtn.innerHTML = '<span class="dashicons dashicons-hourglass" style="font-size: 15px; width: 15px; height: 15px; line-height: 15px; margin-right: 4px;"></span> Translation In Progress...';
                  }

                  renderResultsUI();

                  // Resume timer counting both existing time + new retry time
                  startElapsedTimer();

                  let reCompletedCount = 0;
                  let reFailedCount = 0;

                  try {
                    for (let i = 0; i < failedItems.length; i++) {
                      const item = failedItems[i];
                      const pId = item.postId;
                      const tLang = item.targetLang;
                      const trans = item.trans;

                      trans.status = 'running';
                      const langUpper = tLang.toUpperCase();
                      if (progressStatusEl) {
                        progressStatusEl.textContent = `Retrying ${item.postTitle || `Post #${pId}`} (${langUpper}) [${i + 1}/${failedItems.length}]...`;
                      }
                      renderResultsUI();

                      try {
                        // 1. Validate Language Availability for Chrome Built-in AI
                        if (isChromeAi && core && typeof core.validateProvider === 'function') {
                          const check = await core.validateProvider('chrome_ai', sourceLangCode, tLang, false);
                          if (check && check.available === false) {
                            const reasonMsg = check.reason || `Language pair (${sourceLangCode.toUpperCase()} → ${langUpper}) is not supported by Built-in AI.`;
                            const checkErr = new Error(reasonMsg);
                            checkErr.errorObj = {
                              reasonTitle: check.reasonTitle || 'Language Not Supported',
                              reason: reasonMsg,
                              reasonHTML: check.reasonHTML || `<p>${reasonMsg}</p>`,
                              actionHTML: check.actionHtml || check.actionHTML || ''
                            };
                            throw checkErr;
                          }
                        }

                        // 2. Extract strings from source post if not already cached
                        let rawStrings = (postResultsMap[pId] && postResultsMap[pId].extractedStrings) || postExtractedStringsCache[pId];

                        if (!rawStrings) {
                          const extractRes = await fetch(restUrl + 'extract-strings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                            body: JSON.stringify({ post_id: pId, target_lang: tLang, builder: item.editorType }),
                          });

                          const extractData = await extractRes.json();
                          rawStrings = Array.isArray(extractData.strings) ? extractData.strings : [];
                          rawStrings = rawStrings.filter((s) => !isEmailOrUrl(s.value || ''));

                          const rawSlugTranslation = String(config.slugTranslation || 'slug_translate').toLowerCase().trim();
                          const slugTranslation = ['keep_orignal', 'title_based', 'slug_translate'].includes(rawSlugTranslation)
                            ? rawSlugTranslation
                            : 'slug_translate';
                          if (item.target_post_id > 0 || slugTranslation !== 'slug_translate') {
                            rawStrings = rawStrings.filter((s) => s && s.name !== 'post_name');
                          }

                          if (postResultsMap[pId]) {
                            postResultsMap[pId].extractedStrings = rawStrings;
                          }
                          postExtractedStringsCache[pId] = rawStrings;
                        }

                        let itemChars = 0;
                        rawStrings.forEach(function (s) {
                          const txt = typeof s === 'object' ? (s.value || s.content || '') : String(s);
                          itemChars += txt.length;
                        });

                        trans.totalStrings = rawStrings.length;
                        trans.totalCharacters = itemChars;

                        // 3. Translate strings with Chrome Local AI with granular progress update
                        const inMemory = {};
                        if (rawStrings.length > 0 && core) {
                          const items = rawStrings.map((s) => ({ hash: s.hash, widget_id: s.name, field: s.key, content: s.value }));
                          let itemStrDone = 0;
                          await core.translate('chrome_ai', { items: items, sourceLang: 'en', targetLang: tLang, postId: pId }, (resItem) => {
                            if (resItem && resItem.translated && resItem.hash) {
                              inMemory[resItem.hash] = resItem.translated;
                            }
                            itemStrDone++;
                            const strRatio = rawStrings.length > 0 ? (itemStrDone / rawStrings.length) : 1;
                            const currentOverallPct = Math.min(100, Math.round(((i + (0.05 + strRatio * 0.85)) / failedItems.length) * 100));
                            if (progressFill) progressFill.style.width = `${currentOverallPct}%`;
                            if (progressPostsEl) progressPostsEl.textContent = `${i} / ${failedItems.length} posts (${currentOverallPct}%)`;
                          });
                        }

                        // 4. Save translated post
                        const postResponse = await fetch(restUrl + 'translate-post', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                          body: JSON.stringify({ post_id: pId, target_lang: tLang, provider: selectedProvider, in_memory_translations: inMemory, is_bulk: true }),
                        });

                        const postRes = await postResponse.json();
                        if (!postResponse.ok || !postRes.target_post_id) {
                          throw new Error(postRes.message || 'Post translation save failed');
                        }

                        trans.status = 'completed';
                        trans.targetPostId = postRes.target_post_id;
                        trans.targetTitle = postRes.translated_title || postRes.target_post_title || postResultsMap[pId].postTitle;
                        trans.viewUrl = postRes.view_url || `/?p=${postRes.target_post_id}`;
                        trans.editUrl = postRes.edit_url || (trans.editorType === 'elementor' ? `post.php?post=${postRes.target_post_id}&action=elementor` : `post.php?post=${postRes.target_post_id}&action=edit`);
                        trans.completedStrings = rawStrings.length;
                        trans.completedCharacters = itemChars;
                        trans.error = '';
                        reCompletedCount++;
                      } catch (reErr) {
                        trans.status = 'failed';
                        trans.error = reErr.message || 'Translation failed during retry';
                        trans.errorObj = reErr.errorObj || {
                          reasonTitle: 'Translation Failed',
                          reason: reErr.message || 'Translation failed during retry',
                          reasonHTML: `<p>${escapeHtml(reErr.message || 'Translation failed during retry')}</p>`,
                          actionHTML: ''
                        };
                        reFailedCount++;
                      }

                      const pct = Math.round(((i + 1) / failedItems.length) * 100);
                      if (progressFill) progressFill.style.width = `${pct}%`;
                      if (progressPostsEl) progressPostsEl.textContent = `${i + 1} / ${failedItems.length} posts (${pct}%)`;
                      renderResultsUI();
                    }

                    onBulkProgressComplete(reFailedCount === 0, 'Retry completed', reCompletedCount, failedItems.length);
                  } catch (fatalErr) {
                    console.error('[TranslateSense] Fatal error during retry:', fatalErr);
                    onBulkProgressComplete(false, 'Retry interrupted', reCompletedCount, failedItems.length);
                  } finally {
                    const rBtn = document.getElementById('ts-bulk-retry-failed-btn');
                    if (rBtn) {
                      rBtn.disabled = false;
                    }
                  }
                };
              } else {
                retryBtn.style.setProperty('display', 'none', 'important');
                retryBtn.classList.add('ts-hide');
              }
            }

            // Update footer button to Done (Reload Page) (matching Screenshot 2 and 3)
            if (doneBtn) {
              doneBtn.disabled = false;
              doneBtn.className = 'ts-bulk-btn ts-bulk-btn-primary';
              doneBtn.innerHTML = '<span class="dashicons dashicons-yes" style="font-size: 16px; width: 16px; height: 16px; line-height: 16px; margin-right: 4px;"></span> Done (Reload Page)';
              doneBtn.onclick = function () {
                window.location.reload();
              };
            }
          }

          if (noticeBanner) {
            if (isChromeAi) {
              const engineTitle = (matchingProvider && (matchingProvider.browserType === 'edge' || matchingProvider.id === 'edge_ai' || selectedProvider === 'edge_ai')) ? 'Microsoft Edge Built-in AI' : 'Google Chrome Built-in AI';
              noticeBanner.className = 'ts-modal-notice-banner warning';
              noticeBanner.style.display = 'flex';
              noticeBanner.innerHTML = `
                <span class="ts-notice-icon">⚠️</span>
                <div class="ts-notice-text">
                  <div class="ts-notice-title">Keep this window open during translation</div>
                  <div>${engineTitle} runs on your device. If you close this tab or window, the translation process will stop.</div>
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

          // For Chrome AI, filter and only proceed with supported languages
          let effectiveTargetLangs = [...selectedTargetLangs];
          if (isChromeAi && core) {
            const supported = [];
            const unsupported = [];

            for (let i = 0; i < selectedTargetLangs.length; i++) {
              const lang = selectedTargetLangs[i];
              const check = await core.validateProvider('chrome_ai', sourceLangCode, lang, false);
              if (check && check.available === false) {
                const reason = check.reason || `Language ${lang.toUpperCase()} is not supported by Built-in AI.`;
                unsupported.push({
                  lang: lang,
                  reason: reason,
                  errorObj: {
                    reasonTitle: check.reasonTitle || 'Language Not Supported',
                    reason: reason,
                    reasonHTML: check.reasonHTML ? check.reasonHTML : `<p>${reason}</p>`,
                    actionHtml: check.actionHtml ? check.actionHtml : ''
                  }
                });
              } else {
                supported.push(lang);
              }
            }

            if (unsupported.length > 0) {
              if (supported.length === 0) {
                const unsuppList = unsupported.map((u) => u.lang.toUpperCase()).join(', ');
                alert('None of the selected languages are supported by Built-in AI: ' + unsuppList);
                unsupported.forEach(function (uItem) {
                  const uLang = uItem.lang;
                  const reason = uItem.reason;
                  const errorObj = uItem.errorObj;
                  postIds.forEach(function (pid) {
                    const pIdStr = String(pid);
                    if (postResultsMap[pIdStr] && postResultsMap[pIdStr].translations[uLang]) {
                      const trans = postResultsMap[pIdStr].translations[uLang];
                      trans.status = 'failed';
                      trans.error = reason;
                      trans.errorObj = errorObj;
                      trans.targetTitle = postResultsMap[pIdStr].postTitle || `Post #${pid}`;
                    }
                  });
                });
                renderResultsUI();
                onBulkProgressComplete(false, 'Translation stopped: Selected languages are not supported by Built-in AI.', 0, postIds.length * selectedTargetLangs.length);
                return;
              }

              console.warn('[TranslateSense] Excluding unsupported Chrome AI languages from bulk translation:', unsupported);
              effectiveTargetLangs = supported;

              unsupported.forEach(function (uItem) {
                const uLang = uItem.lang;
                const reason = uItem.reason;
                const errorObj = uItem.errorObj;
                postIds.forEach(function (pid) {
                  const pIdStr = String(pid);
                  if (postResultsMap[pIdStr] && postResultsMap[pIdStr].translations[uLang]) {
                    const trans = postResultsMap[pIdStr].translations[uLang];
                    trans.status = 'failed';
                    trans.error = reason;
                    trans.errorObj = errorObj;
                    trans.targetTitle = postResultsMap[pIdStr].postTitle || `Post #${pid}`;
                  }
                });
              });
              renderResultsUI();
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
                target_languages: effectiveTargetLangs,
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

          // Populate post titles & editor types from batch jobs
          jobsList.forEach(function (job) {
            const pId = String(job.post_id);
            const tLang = String(job.target_language);

            if (!postResultsMap[pId]) {
              postResultsMap[pId] = {
                postId: job.post_id,
                postTitle: job.post_title || `Post #${job.post_id}`,
                translations: {},
              };
            }
            if (job.post_title) postResultsMap[pId].postTitle = job.post_title;

            if (!postResultsMap[pId].translations[tLang]) {
              postResultsMap[pId].translations[tLang] = {
                targetLang: tLang,
                targetPostId: null,
                targetTitle: '',
                status: 'pending',
                completedStrings: 0,
                totalStrings: 0,
                totalCharacters: 0,
                completedCharacters: 0,
                editUrl: '',
                viewUrl: '',
                error: '',
              };
            }

            const trans = postResultsMap[pId].translations[tLang];
            if (job.editor_type) {
              trans.editorType = job.editor_type;
            }
            if (job.target_post_id > 0 && job.status === 'pending') {
              trans.targetPostId = job.target_post_id;
              trans.targetTitle = job.target_post_title || job.post_title;
              trans.viewUrl = job.view_url || `/?p=${job.target_post_id}`;
              trans.editUrl = job.edit_url || `post.php?post=${job.target_post_id}&action=edit`;
              trans.progressStatus = job.progress_status || 'Queued to update existing translation';
            }
            if (job.status === 'already_exists') {
              trans.status = 'already_exists';
              trans.targetPostId = job.target_post_id;
              trans.targetTitle = job.target_post_title || job.post_title;
              trans.viewUrl = job.view_url || (job.target_post_id ? `/?p=${job.target_post_id}` : '');
              trans.editUrl = job.edit_url || (job.target_post_id ? `post.php?post=${job.target_post_id}&action=edit` : '');
            }
          });
          renderResultsUI();

          if (jobsList.length > 0) {
            const initialPct = Math.round(getOverallProgress(jobsList));
            const initialDone = jobsList.filter((j) => j.status === 'already_exists' || j.status === 'completed').length;
            if (barFill && initialPct > 0) {
              barFill.style.width = initialPct + '%';
            }
            if (postsCountEl && initialDone > 0) {
              postsCountEl.textContent = `${initialDone} / ${jobsList.length} posts (${initialPct}%)`;
            }
          }

          // =========================================================================
          // WORKFLOW A: Backend AI Providers (OpenAI, Gemini, etc.) -> Backend Cron & 5s Polling
          // Frontend does NOT translate strings or call AI providers in JS.
          // =========================================================================
          if (!isChromeAi) {
            if (statusText) statusText.textContent = 'Background bulk translation queued. Polling status every 5 seconds...';

            // Trigger bulk-active-batches tracking for OpenAI / Gemini
            checkHasActiveBackgroundJobs();

            if (inModalPollingTimer) {
              clearTimeout(inModalPollingTimer);
              inModalPollingTimer = null;
            }

            let isRunning = false;
            const pollStatus = async () => {
              if (isRunning) return;
              isRunning = true;

              try {
                const statusRes = await fetch(`${restUrl}bulk-status?batch_id=${encodeURIComponent(batchId)}`, {
                  headers: { 'X-WP-Nonce': nonce },
                });

                if (!statusRes.ok) {
                  inModalPollingTimer = setTimeout(pollStatus, 5000);
                  return;
                }

                const data = await statusRes.json();
                const pct = Array.isArray(data.items) && data.items.length > 0
                  ? Math.round(getOverallProgress(data.items))
                  : Math.round(data.progress_percent || 0);

                if (barFill) barFill.style.width = pct + '%';
                if (postsCountEl) {
                  const doneCount = (data.completed_jobs || 0) + (data.already_exists_jobs || 0);
                  postsCountEl.textContent = `${doneCount} / ${data.total_jobs || (postIds.length * selectedTargetLangs.length)} posts (${pct}%)`;
                }
                if (statusText) statusText.textContent = data.current_status || `Translating content with ${providerName}... (${pct}%)`;

                // Update Grouped Results Map from Polling Items
                if (Array.isArray(data.items)) {
                  data.items.forEach(function (item) {
                    const pId = String(item.post_id);
                    const tLang = String(item.target_language);

                    if (!postResultsMap[pId]) {
                      postResultsMap[pId] = {
                        postId: item.post_id,
                        postTitle: item.post_title || `Post #${item.post_id}`,
                        translations: {},
                      };
                    }
                    if (item.post_title) postResultsMap[pId].postTitle = item.post_title;

                    postResultsMap[pId].translations[tLang] = {
                      targetLang: item.target_language,
                      targetPostId: item.target_post_id,
                      targetTitle: item.target_post_title || (item.status === 'already_exists' || item.status === 'completed' ? (item.target_post_title || item.post_title) : (item.progress_status || 'Processing...')),
                      editorType: item.editor_type,
                      status: item.status,
                      completedStrings: item.completed_strings,
                      totalStrings: item.total_strings,
                      progressPercent: getPostProgress(item),
                      progressStatus: item.progress_status || '',
                      editUrl: item.edit_url || (item.target_post_id ? `post.php?post=${item.target_post_id}&action=edit` : ''),
                      viewUrl: item.view_url || (item.target_post_id ? `/?p=${item.target_post_id}` : ''),
                      error: item.error_message,
                    };
                  });
                  renderResultsUI();
                }

                // Check Completion
                if (data.overall_status === 'completed' || data.overall_status === 'failed' || data.overall_status === 'skipped') {
                  if (inModalPollingTimer) {
                    clearTimeout(inModalPollingTimer);
                    inModalPollingTimer = null;
                  }
                  const isDone = data.overall_status === 'completed';
                  const existsCount = data.already_exists_jobs || 0;
                  const doneCount = data.completed_jobs || 0;
                  const skipCount = data.skipped_jobs || 0;
                  let msg = '';
                  if (data.overall_status === 'skipped') {
                    msg = `Batch translation skipped (${skipCount} skipped).`;
                  } else if (isDone) {
                    if (existsCount > 0 && doneCount > 0) {
                      msg = `🎉 Bulk Translation Complete! (${doneCount} translated, ${existsCount} already existed${skipCount > 0 ? `, ${skipCount} skipped` : ''})`;
                    } else if (existsCount > 0 && doneCount === 0) {
                      msg = `ℹ️ All ${existsCount} translation(s) already exist.`;
                    } else {
                      msg = `🎉 Bulk Translation Complete! (${doneCount}/${data.total_jobs} posts translated${skipCount > 0 ? `, ${skipCount} skipped` : ''})`;
                    }
                  } else {
                    msg = `Batch translation completed with issues (${data.failed_jobs} failed).`;
                  }
                  onBulkProgressComplete(isDone, msg, (doneCount + existsCount + skipCount), data.total_jobs);
                  checkHasActiveBackgroundJobs();
                } else {
                  // Wait for complete previous one before next polling
                  inModalPollingTimer = setTimeout(pollStatus, 5000);
                }
              } catch (pollErr) {
                console.warn('[TranslateSense] Polling error:', pollErr);
                inModalPollingTimer = setTimeout(pollStatus, 5000);
              } finally {
                isRunning = false;
              }
            };

            // Start sequential polling immediately
            pollStatus();
            return;
          }

          // =========================================================================
          // WORKFLOW B: Chrome Local AI In-Memory String Translation Workflow
          // Runs on-device inside browser, creates translated post and sets strings in backend.
          // =========================================================================
          let completedBatchStrings = 0;
          let completedJobsCount = 0;
          let failedJobsCount = 0;
          const totalJobsCount = jobsList.length || 1;



          function updateBulkProgressUI(currentJobIndex, jobFraction = 0) {
            const safeFraction = Math.max(0, Math.min(1, jobFraction));
            const progressRatio = (currentJobIndex + safeFraction) / totalJobsCount;
            const pct = Math.min(100, Math.round(progressRatio * 100));

            if (barFill) barFill.style.width = pct + '%';
            if (postsCountEl) {
              const currentPostNum = Math.min(totalJobsCount, completedJobsCount + (jobFraction > 0 ? 1 : 0));
              postsCountEl.textContent = `${currentPostNum} / ${totalJobsCount} posts (${pct}%)`;
            }
          }

          // Initial progress state (0%)
          updateBulkProgressUI(0, 0);

          for (let jobIndex = 0; jobIndex < jobsList.length; jobIndex++) {
            const job = jobsList[jobIndex];
            const postId = String(job.post_id);
            const targetLang = String(job.target_language);
            const jobId = job.id;
            const postEditorType = job.editor_type || 'core';
            const postTitle = job.post_title || `Post #${postId}`;

            if (!postResultsMap[postId]) {
              postResultsMap[postId] = {
                postId: job.post_id,
                postTitle: postTitle,
                translations: {},
              };
            }
            if (!postResultsMap[postId].translations[targetLang]) {
              postResultsMap[postId].translations[targetLang] = {
                targetLang: targetLang,
                targetPostId: null,
                targetTitle: '',
                status: 'pending',
                completedStrings: 0,
                totalStrings: 0,
                totalCharacters: 0,
                completedCharacters: 0,
                editUrl: '',
                viewUrl: '',
                error: '',
              };
            }

            // Skip Chrome AI translation if already exists
            if (job.status === 'already_exists') {
              const transObj = postResultsMap[postId].translations[targetLang];
              transObj.status = 'already_exists';
              transObj.targetPostId = job.target_post_id;
              transObj.targetTitle = job.target_post_title || postTitle;
              transObj.editorType = job.editor_type || postEditorType;
              transObj.editUrl = job.edit_url || (job.target_post_id ? `post.php?post=${job.target_post_id}&action=edit` : '');
              transObj.viewUrl = job.view_url || (job.target_post_id ? `/?p=${job.target_post_id}` : '');
              renderResultsUI();
              completedJobsCount++;
              updateBulkProgressUI(jobIndex + 1, 0);
              continue;
            }

            postResultsMap[postId].postTitle = postTitle;
            postResultsMap[postId].translations[targetLang].status = 'running';
            renderResultsUI();

            if (statusText) {
              statusText.textContent = `Extracting strings for ${postTitle} (${targetLang.toUpperCase()}) [${jobIndex + 1}/${totalJobsCount}]...`;
            }
            updateBulkProgressUI(jobIndex, 0.05);

            const jobStartTime = performance.now();
            try {
              // 1. Extract strings for this post one by one passing editor_type if not already cached
              let rawStrings = (postResultsMap[postId] && postResultsMap[postId].extractedStrings) || postExtractedStringsCache[postId];

              if (!rawStrings) {
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
                rawStrings = Array.isArray(extractData.strings) ? extractData.strings : [];
                rawStrings = rawStrings.filter((s) => !isEmailOrUrl(s.value || ''));

                const rawSlugTranslation = String(config.slugTranslation || 'slug_translate').toLowerCase().trim();
                const slugTranslation = ['keep_orignal', 'title_based', 'slug_translate'].includes(rawSlugTranslation)
                  ? rawSlugTranslation
                  : 'slug_translate';
                // Existing translations keep their current URL slug. Do not
                // send the slug package to Chrome AI during re-translation.
                if (job.target_post_id > 0 || slugTranslation !== 'slug_translate') {
                  rawStrings = rawStrings.filter((s) => s && s.name !== 'post_name');
                }

                if (postResultsMap[postId]) {
                  postResultsMap[postId].extractedStrings = rawStrings;
                }
                postExtractedStringsCache[postId] = rawStrings;
              }

              let postChars = 0;
              rawStrings.forEach(function (s) {
                const txt = typeof s === 'object' ? (s.value || s.content || '') : String(s);
                postChars += txt.length;
              });

              if (postResultsMap[postId] && postResultsMap[postId].translations[targetLang]) {
                postResultsMap[postId].translations[targetLang].totalStrings = rawStrings.length;
                postResultsMap[postId].translations[targetLang].totalCharacters = postChars;
                renderResultsUI();
              }

              // Local in-memory dictionary for pre-translated strings
              const inMemoryTranslations = {};
              let jobStringsCompleted = 0;

              if (rawStrings.length > 0) {
                if (statusText) {
                  statusText.textContent = `Translating ${rawStrings.length} strings on-device with Chrome Local AI for ${postTitle} (${targetLang.toUpperCase()})...`;
                }

                const itemsToTranslate = rawStrings.map((s) => ({
                  hash: s.hash,
                  widget_id: s.name,
                  field: s.key,
                  content: s.value,
                }));

                const onStringProgress = (resItem) => {
                  if (resItem && resItem.translated) {
                    if (resItem.hash) inMemoryTranslations[resItem.hash] = resItem.translated;
                  }
                  completedBatchStrings++;
                  jobStringsCompleted++;
                  const strRatio = rawStrings.length > 0 ? (jobStringsCompleted / rawStrings.length) : 1;
                  // Map string translation to 0.05 -> 0.90 of this job's slice
                  updateBulkProgressUI(jobIndex, 0.05 + (strRatio * 0.85));
                };

                // Run client-side Chrome / Edge AI translation
                if (core) {
                  const clientProviderId = (selectedProvider === 'edge_ai' && core.getProvider && core.getProvider('edge_ai')) ? 'edge_ai' : 'chrome_ai';
                  await core.translate(
                    clientProviderId,
                    {
                      items: itemsToTranslate,
                      sourceLang: 'en',
                      targetLang: targetLang,
                      postId: postId,
                    },
                    onStringProgress
                  );
                }
              }

              // 2. Directly create translated post passing in_memory_translations map
              if (statusText) {
                statusText.textContent = `Saving translated Post #${postId} (${targetLang.toUpperCase()})...`;
              }
              updateBulkProgressUI(jobIndex, 0.95);

              const postResponse = await fetch(restUrl + 'translate-post', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                  post_id: postId,
                  target_lang: targetLang,
                  provider: (selectedProvider === 'edge_ai' ? 'edge_ai' : 'chrome_ai'),
                  in_memory_translations: inMemoryTranslations,
                  is_bulk: true,
                }),
              });

              const postRes = await postResponse.json();
              if (!postResponse.ok || !postRes.target_post_id) {
                throw new Error(postRes.message || `Post translation save failed`);
              }

              const indexedStrings = rawStrings.map((s) => (typeof s === 'object' ? s.content || s.value || '' : String(s)));
              const indexedTranslated = rawStrings.map((s) => {
                const h = typeof s === 'object' ? s.hash : '';
                const src = typeof s === 'object' ? s.content || s.value || '' : String(s);
                return inMemoryTranslations[h] || inMemoryTranslations[src] || src;
              });

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
                    total_characters: postChars,
                    time_take: Math.round(performance.now() - jobStartTime),
                    target_post_id: postRes.target_post_id,
                    sent_data: indexedStrings,
                    receive_data: indexedTranslated,
                  },
                }),
              });

              completedJobsCount++;
              updateBulkProgressUI(jobIndex + 1, 0);

              // Update Result Item
              if (postResultsMap[postId] && postResultsMap[postId].translations[targetLang]) {
                const transObj = postResultsMap[postId].translations[targetLang];
                transObj.status = 'completed';
                transObj.targetPostId = postRes.target_post_id;
                transObj.targetTitle = postRes.translated_title || postRes.target_post_title || postTitle;
                transObj.editorType = postRes.editor_type || postEditorType;
                transObj.editUrl = postRes.edit_url || (transObj.editorType === 'elementor' ? `post.php?post=${postRes.target_post_id}&action=elementor` : `post.php?post=${postRes.target_post_id}&action=edit`);
                transObj.viewUrl = postRes.view_url || '';
                transObj.completedStrings = rawStrings.length;
                transObj.completedCharacters = postChars;
                renderResultsUI();
              }
            } catch (err) {
              console.error(`[TranslateSense] Chrome AI error for post #${postId}:`, err);
              failedJobsCount++;

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
                    total_strings: (rawStrings ? rawStrings.length : 0),
                    total_characters: (typeof postChars !== 'undefined' ? postChars : 0),
                    time_take: Math.round(performance.now() - jobStartTime),
                  },
                }),
              });

              if (postResultsMap[postId] && postResultsMap[postId].translations[targetLang]) {
                const transObj = postResultsMap[postId].translations[targetLang];
                transObj.status = 'failed';
                transObj.error = err.message || 'Error';
                transObj.errorObj = err.errorObj || {
                  reasonTitle: 'Translation Failed',
                  reason: err.message || 'Translation failed',
                  reasonHTML: `<p>${escapeHtml(err.message || 'Translation failed')}</p>`,
                  actionHTML: ''
                };
                renderResultsUI();
              }

              // Complete progress slice for this failed post so progress count reaches 100%
              updateBulkProgressUI(jobIndex + 1, 0);
            }
          }

          const isOverallSuccess = (failedJobsCount === 0 || completedJobsCount > 0);
          const finalMsg = failedJobsCount > 0
            ? `Chrome Local AI Bulk Translation Finished (${completedJobsCount} succeeded, ${failedJobsCount} failed of ${totalJobsCount} total).`
            : `🎉 Chrome Local AI Bulk Translation Complete! (${completedJobsCount}/${totalJobsCount} jobs processed)`;

          onBulkProgressComplete(
            isOverallSuccess,
            finalMsg,
            completedJobsCount,
            totalJobsCount
          );
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
