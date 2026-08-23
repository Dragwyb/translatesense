/**
 * TranslateSense - Bulk Translation Flow on WP List Table (Step 4.1)
 */

(function ($) {
  'use strict';

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

    // 1. Intercept Bulk Action Form (Step 4.1 #1)
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

        // Validation check (Step 4.1 #1)
        if (selectedPosts.length === 0) {
          alert('Please select posts first.');
          return false;
        }

        openBulkTranslateModal(selectedPosts);
      }
    });

    // 2. Render Modal (Step 4.1 #2)
    function openBulkTranslateModal(postIds) {
      const languages = config.languages || [];
      const defaultLang = config.defaultLanguage || 'en';
      const availableTargets = languages.filter((l) => l.slug !== defaultLang);

      const targetOptionsHtml = (availableTargets.length > 0 ? availableTargets : languages)
        .map((l) => `<option value="${l.slug}">${l.name} (${l.slug.toUpperCase()})</option>`)
        .join('');

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
                <label>Translation Provider</label>
                <div class="ts-provider-options">
                  <div class="ts-provider-radio ${config.defaultProvider === 'client_google' ? 'selected' : ''}" data-provider="client_google">
                    <input type="radio" name="ts_bulk_provider" value="client_google" ${config.defaultProvider === 'client_google' ? 'checked' : ''}>
                    <span>Client / Free Engine</span>
                  </div>
                  <div class="ts-provider-radio ${config.defaultProvider === 'chrome_ai' ? 'selected' : ''}" data-provider="chrome_ai">
                    <input type="radio" name="ts_bulk_provider" value="chrome_ai" ${config.defaultProvider === 'chrome_ai' ? 'checked' : ''}>
                    <span>Chrome Built-in AI</span>
                  </div>
                  <div class="ts-provider-radio ${config.defaultProvider === 'google_api' ? 'selected' : ''}" data-provider="google_api">
                    <input type="radio" name="ts_bulk_provider" value="google_api" ${config.defaultProvider === 'google_api' ? 'checked' : ''}>
                    <span>Google Cloud API</span>
                  </div>
                  <div class="ts-provider-radio ${config.defaultProvider === 'deepl' ? 'selected' : ''}" data-provider="deepl">
                    <input type="radio" name="ts_bulk_provider" value="deepl" ${config.defaultProvider === 'deepl' ? 'checked' : ''}>
                    <span>DeepL API</span>
                  </div>
                </div>
              </div>

              <!-- Live Progress (Step 4.1 #4) -->
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
              <button type="button" class="ts-bulk-btn ts-bulk-btn-primary" id="ts-bulk-start-btn">⚡ Start Translation</button>
            </div>
          </div>
        </div>
      `;

      $('#translatesense-bulk-modal-root').html(modalHtml);

      // Event handlers
      $('#ts-bulk-close-btn, #ts-bulk-cancel-btn').on('click', function () {
        $('#translatesense-bulk-modal-root').empty();
      });

      $('.ts-provider-radio').on('click', function () {
        $('.ts-provider-radio').removeClass('selected');
        $(this).addClass('selected');
        $(this).find('input[type="radio"]').prop('checked', true);
      });

      // 3. Execution Engine (Step 4.1 #3 & #4)
      $('#ts-bulk-start-btn').on('click', async function () {
        const targetLang = $('#ts-bulk-target-lang').val();
        const selectedProvider = $('input[name="ts_bulk_provider"]:checked').val() || 'client_google';

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
          statusText.text(`Translating post ID ${postId} (${i + 1}/${total})...`);

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
