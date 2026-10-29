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
      btn.innerHTML = '<span class="dashicons dashicons-translation"></span> Translate Selected';
      postQuerySubmit.insertAdjacentElement('afterend', btn);
    }

    const doAction2 = document.getElementById('doaction2');
    if (!document.getElementById('ts-quick-filter-translate-btn-bottom') && doAction2) {
      const btnBottom = document.createElement('button');
      btnBottom.type = 'button';
      btnBottom.id = 'ts-quick-filter-translate-btn-bottom';
      btnBottom.className = 'button button-primary ts-filter-action-btn';
      btnBottom.innerHTML = '<span class="dashicons dashicons-translation"></span> Translate Selected';
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

    // Direct click on "Translate Selected" button (top or bottom)
    document.addEventListener('click', async function (e) {
      const target = e.target.closest('.ts-filter-action-btn');
      if (target) {
        e.preventDefault();
        const selectedPosts = getSelectedPostIds();
        if (selectedPosts.length === 0) {
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
        if (id === 'chrome_ai' || id === 'chrome_local_ai') {
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
          const isFrontend = (p.id === 'chrome_ai' || p.id === 'chrome_local_ai');
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
        subtitle: 'Fast &amp; Accurate Multi-Language Content Localizer',
        closeId: 'ts-bulk-close-btn',
      })}
            
            <div class="ts-bulk-body">
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

              <!-- Step 3 View: Dedicated Live Progress View (Hides Provider View) -->
              <div id="ts-view-progress" style="display: none;">
                <div class="ts-step-bar">
                  <div class="ts-step-item">
                    <span class="ts-step-number">✓</span>
                    <span>Languages</span>
                  </div>
                  <span class="ts-step-divider"></span>
                  <div class="ts-step-item">
                    <span class="ts-step-number">✓</span>
                    <span id="ts-progress-provider-label">Provider</span>
                  </div>
                  <span class="ts-step-divider"></span>
                  <div class="ts-step-item active">
                    <span class="ts-step-number">3</span>
                    <span>Translation Progress</span>
                  </div>
                </div>

                <div id="ts-progress-notice-banner" class="ts-modal-notice-banner" style="margin-top: 14px;"></div>

                <div class="ts-progress-wrap" id="ts-progress-wrap" style="margin-top: 14px;">
                  <!-- Progress Bar Card -->
                  <div class="ts-progress-card" id="ts-progress-card">
                    <div class="ts-progress-header">
                      <div class="ts-progress-status-wrap">
                        <span class="ts-progress-spinner" id="ts-progress-spinner"></span>
                        <span class="ts-progress-status" id="ts-progress-status">Starting bulk translation...</span>
                      </div>
                      <span class="ts-progress-percent-pill" id="ts-progress-percent">0%</span>
                    </div>
                    <div class="ts-progress-bar-bg" id="ts-progress-bar-bg">
                      <div class="ts-progress-bar-fill" id="ts-progress-bar-fill"></div>
                    </div>
                  </div>

                  <!-- Single Success Celebration Box (Smoothly revealed after progress bar fades out) -->
                  <div class="ts-success-summary-card" id="ts-success-summary-card" style="display: none;">
                    <div style="font-size: 24px; line-height: 1;">🎉</div>
                    <div style="flex: 1;">
                      <div style="font-weight: 700; color: #065f46; font-size: 13.5px; margin-bottom: 2px;">Bulk Translation Completed!</div>
                      <div style="font-size: 12.5px; color: #047857;" id="ts-success-summary-text">All translations finished successfully.</div>
                    </div>
                  </div>

                  <!-- Modern Stats Badges Row -->
                  <div class="ts-bulk-stats-row" id="ts-bulk-stats-row">
                    <div class="ts-stat-badge ts-stat-badge-info" id="ts-stat-completed-wrap">
                      <span>✓</span>
                      <span id="ts-stat-completed-strings"><strong>0</strong> Completed Strings</span>
                    </div>
                    <div class="ts-stat-badge ts-stat-badge-muted" id="ts-stat-pending-wrap">
                      <span>⏳</span>
                      <span id="ts-stat-pending-strings"><strong>0</strong> Pending Strings</span>
                    </div>
                    <div class="ts-stat-badge ts-stat-badge-status running" id="ts-stat-status-badge">
                      <span class="ts-badge-dot"></span>
                      <span id="ts-stat-status-label">RUNNING</span>
                    </div>
                  </div>

                  <!-- Grouped Post Translation Results & Activity -->
                  <div class="ts-results-container" id="ts-results-container">
                    <div class="ts-results-header">
                      <div class="ts-results-title-wrap">
                        <span class="ts-results-icon">📋</span>
                        <span class="ts-results-title">Translation Results & Activity</span>
                      </div>
                      <span class="ts-results-counter" id="ts-results-counter">0 Translations</span>
                    </div>
                    <div class="ts-results-list" id="ts-results-list"></div>
                  </div>
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

            ${core.createFooterHTML({
            id: 'ts-footer-progress',
            style: 'display: none;',
            buttons: [
              { id: 'ts-bulk-done-btn', label: '⏳ Translation In Progress...', variant: 'primary', disabled: true }
            ]
          })}
          </div>
          <div id="ts-bulk-error-modals-wrap" style="display: contents;">
            ${initialStep2.ErrorModals}
          </div>
        </div>
      `;

      let pollingTimer = null;
      const sourceLangCode = 'en';

      // Close modal handler
      const closeBtn = document.getElementById('ts-bulk-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          if (pollingTimer) clearInterval(pollingTimer);
          root.innerHTML = '';
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

          const resultsListEl = document.getElementById('ts-results-list');
          const resultsCounterEl = document.getElementById('ts-results-counter');
          const barFill = document.getElementById('ts-progress-bar-fill');
          const statusText = document.getElementById('ts-progress-status');
          const percentText = document.getElementById('ts-progress-percent');
          const spinnerEl = document.getElementById('ts-progress-spinner');
          const completedStringsEl = document.getElementById('ts-stat-completed-strings');
          const pendingStringsEl = document.getElementById('ts-stat-pending-strings');
          const statusBadgeEl = document.getElementById('ts-stat-status-badge');
          const statusLabelEl = document.getElementById('ts-stat-status-label');
          const noticeBanner = document.getElementById('ts-progress-notice-banner');

          // Helper: Escape HTML strings safely
          function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
          }

          // State tracking for grouped post results & activity
          const postResultsMap = {};
          postIds.forEach(function (pid) {
            const pIdStr = String(pid);
            postResultsMap[pIdStr] = {
              postId: pid,
              postTitle: `Post #${pid}`,
              translations: {},
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
                editUrl: '',
                viewUrl: '',
                error: initialError,
              };
            });
          });

          // Function to render grouped post results
          function renderResultsUI() {
            if (!resultsListEl) return;

            let totalTranslationsCount = 0;
            let completedTranslationsCount = 0;
            let html = '';

            const postIdsList = Object.keys(postResultsMap);
            postIdsList.forEach(function (pId) {
              const postData = postResultsMap[pId];
              const transKeys = Object.keys(postData.translations);
              totalTranslationsCount += transKeys.length;

              html += `
                <div class="ts-post-group-card">
                  <div class="ts-post-group-header">
                    <div class="ts-post-source-info">
                      <span class="ts-post-icon">📄</span>
                      <div class="ts-post-source-title">
                        <span class="ts-source-title-text">${escapeHtml(postData.postTitle || `Post #${pId}`)}</span>
                        <span class="ts-post-id-tag">#${pId}</span>
                      </div>
                    </div>
                    <span class="ts-post-group-badge">Source Post</span>
                  </div>
                  <div class="ts-post-translations-list">
              `;

              transKeys.forEach(function (langSlug) {
                const trans = postData.translations[langSlug];
                const isAlreadyExists = trans.status === 'already_exists';
                const isDone = trans.status === 'completed';
                const isFail = trans.status === 'failed';
                const isRunning = trans.status === 'running';

                if (isDone || isAlreadyExists) completedTranslationsCount++;

                const langUpper = langSlug.toUpperCase();
                const langObj = allLanguages.find(function (l) { return l.slug === langSlug; });
                const langDisplayName = langObj ? `${langObj.name} (${langUpper})` : langUpper;

                let statusBadge = '';
                if (isAlreadyExists) {
                  statusBadge = '<span class="ts-trans-status-pill already-exists">⚡ Already Exists</span>';
                } else if (isDone) {
                  statusBadge = '<span class="ts-trans-status-pill success">✓ Completed</span>';
                } else if (isFail) {
                  const isUnsupported = trans.error && (trans.error.toLowerCase().includes('not supported') || trans.error.toLowerCase().includes('unavailable') || trans.error.toLowerCase().includes('requires a user'));
                  statusBadge = isUnsupported
                    ? `<button type="button" class="ts-trans-status-pill failed ts-error-detail-btn" data-lang="${escapeHtml(langDisplayName)}" data-error="${escapeHtml(trans.error || 'Language is not supported by Chrome Local AI.')}" title="Click to view detailed reason">✕ Language Not Supported ℹ️</button>`
                    : '<span class="ts-trans-status-pill failed">✕ Failed</span>';
                } else if (isRunning) {
                  statusBadge = '<span class="ts-trans-status-pill running">⏳ In Progress</span>';
                } else {
                  statusBadge = '<span class="ts-trans-status-pill pending">Queued</span>';
                }

                let metaInfo = '';
                if (isAlreadyExists) {
                  metaInfo = trans.targetPostId ? `<span class="ts-trans-target-id">#${trans.targetPostId}</span>` : '';
                } else if (isDone && trans.completedStrings) {
                  metaInfo = `<span class="ts-trans-strings-count">${trans.completedStrings} strings</span>`;
                } else if (isFail && trans.error) {
                  const isUnsupported = trans.error.toLowerCase().includes('not supported') || trans.error.toLowerCase().includes('unavailable');
                  if (!isUnsupported) {
                    metaInfo = `<span class="ts-trans-error-msg">${escapeHtml(trans.error)}</span>`;
                  }
                } else if (trans.targetPostId) {
                  metaInfo = `<span class="ts-trans-target-id">#${trans.targetPostId}</span>`;
                }

                let actionsHtml = '';
                const isElementor = (trans.editorType === 'elementor' || (trans.editUrl && trans.editUrl.indexOf('action=elementor') !== -1));
                const editLabel = '✏️ Edit';
                const editClass = isElementor ? 'ts-action-link-btn edit elementor' : 'ts-action-link-btn edit';
                const editTitle = isElementor ? 'Edit translated post in Elementor Website Builder' : 'Edit translated post in WordPress editor';

                const defaultEditUrl = isElementor && trans.targetPostId ? `post.php?post=${trans.targetPostId}&action=elementor` : (trans.targetPostId ? `post.php?post=${trans.targetPostId}&action=edit` : '#');
                const editHref = trans.editUrl || defaultEditUrl;
                const viewHref = trans.viewUrl || (trans.targetPostId ? `/?p=${trans.targetPostId}` : '#');

                if (isAlreadyExists || isDone) {
                  actionsHtml += `<a href="${viewHref}" target="_blank" rel="noopener noreferrer" class="ts-action-link-btn view" title="View translated post on site">👁 View</a>`;
                  if (trans.targetPostId || trans.editUrl) {
                    actionsHtml += `<a href="${editHref}" target="_blank" rel="noopener noreferrer" class="${editClass}" title="${editTitle}">${editLabel}</a>`;
                  }
                } else {
                  actionsHtml += `<span class="ts-action-link-btn disabled">👁 View</span><span class="ts-action-link-btn disabled">✏️ Edit</span>`;
                }

                const displayTitle = trans.targetTitle
                  || (isAlreadyExists ? (trans.targetTitle || postData.postTitle)
                    : (isDone ? (trans.targetTitle || postData.postTitle)
                      : (isFail ? (postData.postTitle || `Post #${pId}`)
                        : (isRunning ? 'Translating content...'
                          : `Waiting in queue (${langDisplayName})`))));

                html += `
                  <div class="ts-translation-item ${trans.status}">
                    <div class="ts-trans-lang-col">
                      <span class="ts-trans-lang-badge ${isAlreadyExists ? 'already-exists' : (isDone ? 'success' : (isFail ? 'failed' : ''))}">${getLanguageFlagHtml(langObj || langSlug, allLanguages)} (${langUpper})</span>
                    </div>
                    <div class="ts-trans-details-col">
                      <div class="ts-trans-title">
                        ${escapeHtml(displayTitle)}
                      </div>
                      <div class="ts-trans-meta">
                        ${statusBadge}
                        ${metaInfo}
                      </div>
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
            if (resultsCounterEl) {
              resultsCounterEl.textContent = `${completedTranslationsCount}/${totalTranslationsCount} Completed`;
            }
          }

          // Global delegation for error details button click
          if (resultsListEl && !resultsListEl._hasErrorDetailListener) {
            resultsListEl._hasErrorDetailListener = true;
            resultsListEl.addEventListener('click', function (e) {
              const errorBtn = e.target.closest('.ts-error-detail-btn');
              if (!errorBtn) return;
              e.preventDefault();
              e.stopPropagation();

              const langName = errorBtn.getAttribute('data-lang') || 'Language';
              const errorMsg = errorBtn.getAttribute('data-error') || 'This language is not supported by the local AI engine.';

              let modalRoot = document.getElementById('ts-error-modal-root');
              if (!modalRoot) {
                modalRoot = document.createElement('div');
                modalRoot.id = 'ts-error-modal-root';
                document.body.appendChild(modalRoot);
              }

              modalRoot.innerHTML = `
                <div class="ts-bulk-overlay" style="z-index: 1000000;">
                  <div class="ts-bulk-modal" style="max-width: 480px;">
                    ${core.createHeaderHTML({
                icon: '⚠️',
                title: `${escapeHtml(langName)} Notice`,
                closeId: 'ts-err-modal-close',
              })}
                    <div class="ts-bulk-body" style="padding: 22px;">
                      <p style="margin-top: 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                        ${escapeHtml(errorMsg)}
                      </p>
                    </div>
                    ${core.createFooterHTML({
                buttons: [
                  { id: 'ts-err-modal-ok', label: 'OK', variant: 'primary' }
                ]
              })}
                  </div>
                </div>
              `;

              function closeModal() {
                if (modalRoot) modalRoot.innerHTML = '';
              }

              const closeBtn = document.getElementById('ts-err-modal-close');
              const okBtn = document.getElementById('ts-err-modal-ok');
              if (closeBtn) closeBtn.addEventListener('click', closeModal);
              if (okBtn) okBtn.addEventListener('click', closeModal);
            });
          }

          // Initial render of results skeleton
          renderResultsUI();

          // Helper: Handle Bulk Translation Completion & Remove Progress Bar After a Few Seconds
          function onBulkProgressComplete(isSuccess, summaryMsg, completedJobs, totalJobs) {
            if (barFill) {
              barFill.style.width = '100%';
              barFill.classList.add('completed');
            }
            if (percentText) {
              percentText.textContent = '100%';
              percentText.classList.add('completed');
            }
            if (spinnerEl) {
              spinnerEl.classList.add('completed');
            }
            if (statusText) {
              statusText.textContent = summaryMsg;
            }
            if (statusBadgeEl) {
              statusBadgeEl.className = isSuccess
                ? 'ts-stat-badge ts-stat-badge-status completed'
                : 'ts-stat-badge ts-stat-badge-status failed';
            }
            if (statusLabelEl) {
              statusLabelEl.textContent = isSuccess ? 'COMPLETED' : 'FAILED';
            }

            // Hide the top warning/info notice banner completely on completion so there are NO multiple stacked notices
            if (noticeBanner) {
              noticeBanner.style.display = 'none';
            }

            // Remove progress bar after a few seconds (2.5s delay + smooth fade-out collapse)
            if (isSuccess) {
              setTimeout(function () {
                const card = document.getElementById('ts-progress-card');
                const successSummary = document.getElementById('ts-success-summary-card');
                const successSummaryText = document.getElementById('ts-success-summary-text');
                if (card) {
                  card.classList.add('ts-progress-fade-out');
                  setTimeout(function () {
                    card.style.display = 'none';
                    if (successSummary) {
                      if (successSummaryText) {
                        successSummaryText.textContent = `Successfully processed and created translations for ${completedJobs || 1} of ${totalJobs || 1} post(s).`;
                      }
                      successSummary.style.display = 'flex';

                      // Auto-hide success notice after 20 seconds
                      setTimeout(function () {
                        successSummary.classList.add('ts-progress-fade-out');
                        setTimeout(function () {
                          successSummary.style.display = 'none';
                        }, 500);
                      }, 7000);
                    }
                  }, 500);
                }
              }, 2500);
            }

            if (doneBtn) {
              doneBtn.disabled = false;
              doneBtn.className = 'ts-bulk-btn ts-bulk-btn-primary ts-btn-success-pulse';
              doneBtn.textContent = '✓ Done (Reload Page)';
              doneBtn.onclick = function () {
                window.location.reload();
              };
            }
          }

          if (noticeBanner) {
            if (isChromeAi) {
              const engineTitle = (matchingProvider && matchingProvider.browserType === 'edge') ? 'Microsoft Edge Built-in AI' : 'Google Chrome Built-in AI';
              noticeBanner.className = 'ts-modal-notice-banner warning';
              noticeBanner.style.display = 'flex';
              noticeBanner.innerHTML = `
                <span class="ts-notice-icon">⚠️</span>
                <div class="ts-notice-text">
                  <div class="ts-notice-title">Please Keep This Window Open</div>
                  <div>${engineTitle} runs on-device directly in your browser. If you close this tab or window, your local translation workflow will stop.</div>
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
                unsupported.push({
                  lang: lang,
                  reason: check.reason || `Language ${lang.toUpperCase()} is not supported by Built-in AI.`
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
                  postIds.forEach(function (pid) {
                    const pIdStr = String(pid);
                    if (postResultsMap[pIdStr] && postResultsMap[pIdStr].translations[uLang]) {
                      const trans = postResultsMap[pIdStr].translations[uLang];
                      trans.status = 'failed';
                      trans.error = reason;
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
                postIds.forEach(function (pid) {
                  const pIdStr = String(pid);
                  if (postResultsMap[pIdStr] && postResultsMap[pIdStr].translations[uLang]) {
                    const trans = postResultsMap[pIdStr].translations[uLang];
                    trans.status = 'failed';
                    trans.error = reason;
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
                editUrl: '',
                viewUrl: '',
                error: '',
              };
            }

            const trans = postResultsMap[pId].translations[tLang];
            if (job.editor_type) {
              trans.editorType = job.editor_type;
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

          // =========================================================================
          // WORKFLOW A: Backend AI Providers (OpenAI, Gemini, etc.) -> Backend Cron & 5s Polling
          // Frontend does NOT translate strings or call AI providers in JS.
          // =========================================================================
          if (!isChromeAi) {
            if (statusText) statusText.textContent = 'Background bulk translation queued. Polling status every 5 seconds...';
            if (statusBadgeEl) {
              statusBadgeEl.className = 'ts-stat-badge ts-stat-badge-status running';
            }
            if (statusLabelEl) {
              statusLabelEl.textContent = 'RUNNING';
            }

            let pollingTimer = null;
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
                  const isDone = data.overall_status === 'completed';
                  const isFail = data.overall_status === 'failed';
                  statusBadgeEl.className = `ts-stat-badge ts-stat-badge-status ${isDone ? 'completed' : (isFail ? 'failed' : 'running')}`;
                }
                if (statusLabelEl) {
                  statusLabelEl.textContent = (data.overall_status || 'running').toUpperCase();
                }

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
                      editUrl: item.edit_url || (item.target_post_id ? `post.php?post=${item.target_post_id}&action=edit` : ''),
                      viewUrl: item.view_url || (item.target_post_id ? `/?p=${item.target_post_id}` : ''),
                      error: item.error_message,
                    };
                  });
                  renderResultsUI();
                }

                // Check Completion
                if (data.overall_status === 'completed' || data.overall_status === 'failed') {
                  clearInterval(pollingTimer);
                  pollingTimer = null;
                  const isDone = data.overall_status === 'completed';
                  const existsCount = data.already_exists_jobs || 0;
                  const doneCount = data.completed_jobs || 0;
                  let msg = '';
                  if (isDone) {
                    if (existsCount > 0 && doneCount > 0) {
                      msg = `🎉 Bulk Translation Complete! (${doneCount} translated, ${existsCount} already existed)`;
                    } else if (existsCount > 0 && doneCount === 0) {
                      msg = `ℹ️ All ${existsCount} translation(s) already exist.`;
                    } else {
                      msg = `🎉 Bulk Translation Complete! (${doneCount}/${data.total_jobs} posts translated)`;
                    }
                  } else {
                    msg = `Batch translation completed with issues (${data.failed_jobs} failed).`;
                  }
                  onBulkProgressComplete(isDone, msg, (doneCount + existsCount), data.total_jobs);
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
          // Runs on-device inside browser, creates translated post and sets strings in backend.
          // =========================================================================
          let completedBatchStrings = 0;
          let completedJobsCount = 0;
          let failedJobsCount = 0;
          const totalJobsCount = jobsList.length || 1;

          if (statusBadgeEl) {
            statusBadgeEl.className = 'ts-stat-badge ts-stat-badge-status running';
          }
          if (statusLabelEl) {
            statusLabelEl.textContent = 'LOCAL AI RUNNING';
          }

          function updateBulkProgressUI(currentJobIndex, jobFraction = 0) {
            const safeFraction = Math.max(0, Math.min(1, jobFraction));
            const progressRatio = (currentJobIndex + safeFraction) / totalJobsCount;
            const pct = Math.min(100, Math.round(progressRatio * 100));

            if (barFill) barFill.style.width = pct + '%';
            if (percentText) percentText.textContent = pct + '%';
            if (completedStringsEl) completedStringsEl.innerHTML = `<strong>${completedBatchStrings}</strong> Completed Strings`;
            if (pendingStringsEl) pendingStringsEl.innerHTML = `<strong>${Math.max(0, totalJobsCount - (completedJobsCount + failedJobsCount))}</strong> Pending Posts`;
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
              rawStrings = rawStrings.filter((s) => !isEmailOrUrl(s.value || ''));

              if (postResultsMap[postId] && postResultsMap[postId].translations[targetLang]) {
                postResultsMap[postId].translations[targetLang].totalStrings = rawStrings.length;
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

                // Run client-side Chrome AI translation
                if (core) {
                  await core.translate(
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
                  provider: 'chrome_ai',
                  in_memory_translations: inMemoryTranslations,
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
                  },
                }),
              });

              if (postResultsMap[postId] && postResultsMap[postId].translations[targetLang]) {
                const transObj = postResultsMap[postId].translations[targetLang];
                transObj.status = 'failed';
                transObj.error = err.message || 'Error';
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
