/**
 * TranslateSense - Bulk Translation Flow on WP List Table (Step 4.1)
 * Grid View Provider Selection with Google Widget, Chrome Local AI, OpenAI & Gemini AI
 */

(function ($) {
  'use strict';

  // 4 Primary Translation Providers
  const BULK_PROVIDERS = [
    {
      id: 'google_widget',
      title: 'Google Widget',
      icon: '🚀',
      desc: 'Instant frontend translation widget. No API key required.',
      savesToDb: false,
    },
    {
      id: 'chrome_ai',
      title: 'Chrome Local AI',
      icon: '🤖',
      desc: 'On-device translation powered by Chrome built-in AI (window.ai).',
      savesToDb: false,
    },
    {
      id: 'openai',
      title: 'OpenAI (GPT-4o)',
      icon: '🧠',
      desc: 'High accuracy translation via OpenAI ChatGPT API.',
      savesToDb: true,
    },
    {
      id: 'gemini',
      title: 'Gemini AI',
      icon: '✨',
      desc: 'Next-gen multilingual translation via Google Gemini AI.',
      savesToDb: true,
    },
  ];

  $(document).ready(function () {
    const config = window.TranslateSenseBulkData || {};

    // Ensure button is inserted next to Filter submit if not rendered by hook
    if ($('#ts-quick-filter-translate-btn').length === 0 && $('#post-query-submit').length > 0) {
      $('#post-query-submit').after(
        `<button type="button" id="ts-quick-filter-translate-btn" class="button button-primary ts-filter-action-btn" style="margin-left: 6px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); border-color: #3730a3; color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(79,70,229,0.35);">
          <span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1;"></span>
          Translate Selected
        </button>`
      );
    }

    // Direct click on "Translate Selected" button (next to Filter button)
    $(document).on('click', '#ts-quick-filter-translate-btn', function (e) {
      e.preventDefault();

      const selectedPosts = $('input[name="post[]"]:checked')
        .map(function () {
          return $(this).val();
        })
        .get();

      if (selectedPosts.length === 0) {
        alert('Please select posts first.');
        return false;
      }

      openBulkTranslateModal(selectedPosts);
    });

    // Intercept Bulk Action Dropdown
    $('#doaction, #doaction2').on('click', function (e) {
      const selectName = $(this).attr('id') === 'doaction' ? 'action' : 'action2';
      const selectedAction = $(`select[name="${selectName}"]`).val();

      if (selectedAction === 'translatesense_bulk_translate') {
        e.preventDefault();

        const selectedPosts = $('input[name="post[]"]:checked')
          .map(function () {
            return $(this).val();
          })
          .get();

        if (selectedPosts.length === 0) {
          alert('Please select posts first.');
          return false;
        }

        openBulkTranslateModal(selectedPosts);
      }
    });

    // Render Grid View Provider Modal
    function openBulkTranslateModal(postIds) {
      const languages = config.languages || [];
      const defaultLang = config.defaultLanguage || 'en';
      const availableTargets = languages.filter((l) => l.slug !== defaultLang);

      const targetOptionsHtml = (availableTargets.length > 0 ? availableTargets : languages)
        .map((l) => `<option value="${l.slug}">${l.name} (${l.slug.toUpperCase()})</option>`)
        .join('');

      let selectedProviderId = 'openai';

      const modalHtml = `
        <div class="ts-bulk-overlay" id="ts-bulk-modal-overlay">
          <div class="ts-bulk-modal">
            <div class="ts-bulk-header">
              <h2>⚡ TranslateSense Bulk Translation</h2>
              <button class="ts-bulk-close" id="ts-bulk-close-btn">&times;</button>
            </div>
            <div class="ts-bulk-body">
              <p style="margin-top: 0; color: #64748b; font-size: 13px;">
                Selected <strong>${postIds.length}</strong> post(s) to automatically parse against XML configs, translate, and link in Polylang.
              </p>

              <div class="ts-bulk-field">
                <label for="ts-bulk-target-lang">Select Target Language</label>
                <select id="ts-bulk-target-lang" class="ts-bulk-select">
                  ${targetOptionsHtml}
                </select>
              </div>

              <div class="ts-bulk-field">
                <label>Choose Translation Provider</label>
                <div class="ts-provider-grid">
                  ${BULK_PROVIDERS.map((p) => `
                    <div class="ts-provider-card ${p.id === selectedProviderId ? 'selected' : ''}" data-provider="${p.id}">
                      <input type="radio" name="ts_bulk_provider" value="${p.id}" ${p.id === selectedProviderId ? 'checked' : ''} class="ts-provider-radio" />
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

              <!-- Live Progress -->
              <div class="ts-progress-wrap" id="ts-progress-wrap" style="display: none;">
                <div class="ts-progress-bar-bg">
                  <div class="ts-progress-bar-fill" id="ts-progress-bar-fill"></div>
                </div>
                <div class="ts-progress-text">
                  <span id="ts-progress-status">Starting translation...</span>
                  <span id="ts-progress-percent">0%</span>
                </div>
                <div class="ts-progress-logs" id="ts-progress-logs"></div>
              </div>
            </div>

            <div class="ts-bulk-footer">
              <button type="button" class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-bulk-cancel-btn">Cancel</button>
              <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-bulk-start-btn">🚀 Start Bulk Translation</button>
            </div>
          </div>
        </div>
      `;

      $('#translatesense-bulk-modal-root').html(modalHtml);

      // Event handlers for Modal Grid Card Selection
      $('#ts-bulk-close-btn, #ts-bulk-cancel-btn').on('click', function () {
        $('#translatesense-bulk-modal-root').empty();
      });

      $('.ts-provider-card').on('click', function () {
        $('.ts-provider-card').removeClass('selected');
        $(this).addClass('selected');
        $(this).find('input[type="radio"]').prop('checked', true);

        const provId = $(this).data('provider');
        selectedProviderId = provId;
      });

      // Execution Engine
      $('#ts-bulk-start-btn').on('click', async function () {
        const targetLang = $('#ts-bulk-target-lang').val();
        const selectedProvider = $('input[name="ts_bulk_provider"]:checked').val() || selectedProviderId;

        $(this).prop('disabled', true).text('Processing...');
        $('#ts-bulk-cancel-btn').prop('disabled', true);
        $('#ts-progress-wrap').show();

        const logs = $('#ts-progress-logs');
        const barFill = $('#ts-progress-bar-fill');
        const statusText = $('#ts-progress-status');
        const percentText = $('#ts-progress-percent');

        let completed = 0;
        const total = postIds.length;

        for (let i = 0; i < total; i++) {
          const postId = postIds[i];
          statusText.text(`Translating post ID ${postId} with ${selectedProvider} (${i + 1}/${total})...`);

          try {
            const res = await $.ajax({
              url: config.restUrl + 'translate-post',
              method: 'POST',
              headers: { 'X-WP-Nonce': config.nonce },
              contentType: 'application/json',
              data: JSON.stringify({
                post_id: postId,
                target_lang: targetLang,
                provider: selectedProvider,
              }),
            });

            completed++;
            const pct = Math.round((completed / total) * 100);
            barFill.css('width', pct + '%');
            percentText.text(pct + '%');

            logs.append(
              `<div class="ts-log-item success">✓ Post #${postId} translated &rarr; Created #${res.target_post_id} (${targetLang.toUpperCase()})</div>`
            );
          } catch (err) {
            completed++;
            const pct = Math.round((completed / total) * 100);
            barFill.css('width', pct + '%');
            percentText.text(pct + '%');

            const errMsg = err.responseJSON && err.responseJSON.message ? err.responseJSON.message : 'Error';
            logs.append(`<div class="ts-log-item error">✕ Post #${postId} failed: ${errMsg}</div>`);
          }

          logs.scrollTop(logs[0].scrollHeight);
        }

        statusText.text(`Translation Complete! (${completed}/${total} processed)`);
        $('#ts-bulk-start-btn').hide();
        $('#ts-bulk-cancel-btn')
          .prop('disabled', false)
          .text('Done (Reload Page)')
          .off('click')
          .on('click', () => window.location.reload());
      });
    }
  });
})(jQuery);
