/**
 * TranslateSense - Gutenberg & Elementor Editor Integration
 * Includes:
 * 1. Auto-detected Polylang current page language translation
 * 2. 4-Provider Selection Modal (Google Widget, Chrome Local AI, OpenAI, Gemini AI in Grid View)
 * 3. Live in-editor string extraction & translation review
 */

(function () {
  'use strict';

  // 4 Primary Translation Providers
  const PROVIDERS = [
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
      title: 'Open AI (GPT-4o)',
      icon: '🧠',
      desc: 'State-of-the-art neural AI translation via OpenAI ChatGPT API.',
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

  // Helper for Chrome Built-in AI Translation
  async function translateWithChromeAi(text, sourceLang, targetLang) {
    if (window.translation && typeof window.translation.canTranslate === 'function') {
      const can = await window.translation.canTranslate({
        sourceLanguage: sourceLang.substring(0, 2),
        targetLanguage: targetLang.substring(0, 2),
      });
      if (can !== 'no') {
        const translator = await window.translation.createTranslator({
          sourceLanguage: sourceLang.substring(0, 2),
          targetLanguage: targetLang.substring(0, 2),
        });
        return await translator.translate(text);
      }
    }
    if (window.ai && window.ai.languageModel) {
      const session = await window.ai.languageModel.create();
      return await session.prompt(
        `Translate the following text from ${sourceLang} to ${targetLang}. Return only the translated text without commentary:\n\n${text}`
      );
    }
    throw new Error('Chrome Built-in Local AI is not available or not enabled in this browser.');
  }

  // 1. Gutenberg Block Editor Integration
  if (window.wp && window.wp.plugins && window.wp.editPost && window.wp.element) {
    const { createElement: el, useState } = window.wp.element;
    const { registerPlugin } = window.wp.plugins;
    const { PluginDocumentSettingPanel } = window.wp.editPost;
    const { select, dispatch } = window.wp.data;

    function TranslateSenseGutenbergPanel() {
      const config = window.TranslateSenseEditorData || {};
      const targetLang = config.currentLanguage || 'en';
      const [selectedProvider, setSelectedProvider] = useState(config.defaultProvider || 'openai');

      // Modals State
      const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
      const [isReviewOpen, setIsReviewOpen] = useState(false);
      const [strings, setStrings] = useState([]);
      const [isExtracting, setIsExtracting] = useState(false);
      const [isTranslating, setIsTranslating] = useState(false);
      const [statusNotice, setStatusNotice] = useState(null);

      // Click "Translate" in sidebar -> Opens Provider Modal
      const handleOpenTranslateFlow = () => {
        setStatusNotice(null);
        setIsProviderModalOpen(true);
      };

      // Extract & Run Translation with Selected Provider
      const handleStartTranslation = async () => {
        setIsExtracting(true);
        setStatusNotice(null);
        try {
          const blocks = select('core/block-editor').getBlocks();
          const serialized = wp.blocks.serialize(blocks);

          // 1. Extract strings from blocks
          const res = await window.wp.apiFetch({
            path: '/translatesense/v1/extract-strings',
            method: 'POST',
            data: {
              post_id: config.postId,
              content: serialized,
              target_lang: targetLang,
            },
          });

          if (!res.strings || res.strings.length === 0) {
            alert('No translatable strings found in current blocks matching XML rules.');
            setIsExtracting(false);
            setIsProviderModalOpen(false);
            return;
          }

          const extractedList = res.strings;
          setStrings(extractedList);
          setIsProviderModalOpen(false);
          setIsReviewOpen(true);

          // 2. Automatically translate with chosen provider
          await performBatchTranslation(extractedList, selectedProvider);
        } catch (err) {
          alert('Extraction error: ' + (err.message || 'Unknown error'));
        } finally {
          setIsExtracting(false);
        }
      };

      // Batch Translation Execution
      const performBatchTranslation = async (currentStrings, provider) => {
        setIsTranslating(true);
        try {
          const sourceLang = config.currentLanguage || 'en';
          const toTranslate = currentStrings.map((s) => s.source);

          // If Chrome Built-in Local AI
          if (provider === 'chrome_ai') {
            const updated = [...currentStrings];
            for (let i = 0; i < currentStrings.length; i++) {
              try {
                const trans = await translateWithChromeAi(currentStrings[i].source, sourceLang, targetLang);
                updated[i] = {
                  ...currentStrings[i],
                  translated: trans,
                  status: 'Local AI',
                };
              } catch (e) {
                // Fallback to server client_google
                const fallbackRes = await window.wp.apiFetch({
                  path: '/translatesense/v1/translate-batch',
                  method: 'POST',
                  data: {
                    strings: [currentStrings[i].source],
                    source_lang: sourceLang,
                    target_lang: targetLang,
                    provider: 'client_google',
                    post_id: config.postId,
                  },
                });
                updated[i] = {
                  ...currentStrings[i],
                  translated: fallbackRes.results[0]?.translated || currentStrings[i].source,
                  status: 'Frontend',
                };
              }
              setStrings([...updated]);
            }
            return;
          }

          // Backend / AI / Google Widget Providers
          const res = await window.wp.apiFetch({
            path: '/translatesense/v1/translate-batch',
            method: 'POST',
            data: {
              strings: toTranslate,
              source_lang: sourceLang,
              target_lang: targetLang,
              provider: provider,
              post_id: config.postId,
            },
          });

          if (res.results) {
            const updated = currentStrings.map((item, idx) => {
              const r = res.results[idx];
              return {
                ...item,
                translated: r ? r.translated : item.source,
                status: r && r.cached ? 'Cached' : 'Complete',
              };
            });
            setStrings(updated);
          }
        } catch (err) {
          alert('Translation error: ' + (err.message || 'Unknown error'));
        } finally {
          setIsTranslating(false);
        }
      };

      // Apply translated strings back to block attributes
      const handleApplyToEditor = () => {
        const blocks = select('core/block-editor').getBlocks();

        const updateBlocksRecursively = (blockList) => {
          blockList.forEach((blk) => {
            strings.forEach((strItem) => {
              if (blk.name === strItem.widget_id && strItem.translated) {
                if (blk.attrs && blk.attrs[strItem.field] === strItem.source) {
                  dispatch('core/block-editor').updateBlockAttributes(blk.clientId, {
                    [strItem.field]: strItem.translated,
                  });
                }
              }
            });

            if (blk.innerBlocks && blk.innerBlocks.length > 0) {
              updateBlocksRecursively(blk.innerBlocks);
            }
          });
        };

        updateBlocksRecursively(blocks);
        setIsReviewOpen(false);
        dispatch('core/notices').createSuccessNotice('Translated strings applied to blocks successfully!');
      };

      const currentProviderObj = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

      return el(
        PluginDocumentSettingPanel,
        {
          name: 'translatesense-panel',
          title: '⚡ TranslateSense',
          icon: 'translation',
        },
        el(
          'div',
          { className: 'ts-editor-sidebar-panel', style: { padding: '4px 0' } },
          el(
            'button',
            {
              type: 'button',
              className: 'ts-btn-extract',
              style: { width: '100%', padding: '10px 14px', fontWeight: 600, fontSize: '13px' },
              onClick: handleOpenTranslateFlow,
              disabled: isExtracting,
            },
            '⚡ Translate Page'
          ),
          statusNotice &&
            el('p', { style: { fontSize: '12px', color: '#b91c1c', marginTop: '8px' } }, statusNotice)
        ),

        // Provider Selection Modal (Grid View)
        isProviderModalOpen &&
          el(
            'div',
            { className: 'ts-strings-review-modal', onClick: () => setIsProviderModalOpen(false) },
            el(
              'div',
              { className: 'ts-review-container', style: { maxWidth: '640px' }, onClick: (e) => e.stopPropagation() },
              el(
                'div',
                { className: 'ts-review-header' },
                el('h3', null, '🌐 Choose Translation Provider'),
                el('button', { className: 'ts-bulk-close', onClick: () => setIsProviderModalOpen(false) }, '✕')
              ),
              el(
                'div',
                { className: 'ts-review-body' },
                el(
                  'p',
                  { style: { fontSize: '13px', color: '#64748b', marginTop: 0 } },
                  'Translating content for page language: ',
                  el('strong', { style: { color: '#4f46e5' } }, `🌐 ${targetLang.toUpperCase()}`)
                ),
                el(
                  'div',
                  { className: 'ts-provider-grid' },
                  PROVIDERS.map((p) =>
                    el(
                      'div',
                      {
                        key: p.id,
                        className: `ts-provider-card ${selectedProvider === p.id ? 'selected' : ''}`,
                        onClick: () => setSelectedProvider(p.id),
                      },
                      el('input', {
                        type: 'radio',
                        name: 'ts_provider_select',
                        className: 'ts-provider-radio',
                        checked: selectedProvider === p.id,
                        onChange: () => setSelectedProvider(p.id),
                      }),
                      el(
                        'div',
                        { className: 'ts-provider-info' },
                        el(
                          'div',
                          { className: 'ts-provider-title' },
                          el('span', null, `${p.icon} ${p.title}`)
                        ),
                        el('p', { className: 'ts-provider-desc' }, p.desc)
                      )
                    )
                  )
                )
              ),
              el(
                'div',
                { className: 'ts-review-footer' },
                el(
                  'button',
                  { className: 'ts-bulk-btn ts-bulk-btn-secondary', onClick: () => setIsProviderModalOpen(false) },
                  'Cancel'
                ),
                el(
                  'button',
                  {
                    className: 'ts-bulk-btn ts-bulk-btn-primary',
                    onClick: handleStartTranslation,
                    disabled: isExtracting,
                  },
                  isExtracting ? 'Extracting...' : '🚀 Start Translation'
                )
              )
            )
          ),

        // Strings Review Modal for Live Translation
        isReviewOpen &&
          el(
            'div',
            { className: 'ts-strings-review-modal', onClick: () => setIsReviewOpen(false) },
            el(
              'div',
              { className: 'ts-review-container', onClick: (e) => e.stopPropagation() },
              el(
                'div',
                { className: 'ts-review-header' },
                el('h3', null, `Review Translations (${targetLang.toUpperCase()}) - ${strings.length} Strings`),
                el('button', { className: 'ts-bulk-close', onClick: () => setIsReviewOpen(false) }, '✕')
              ),
              el(
                'div',
                { className: 'ts-review-body' },
                el(
                  'div',
                  { style: { marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  el(
                    'button',
                    {
                      className: 'ts-btn ts-btn-primary',
                      onClick: () => performBatchTranslation(strings, selectedProvider),
                      disabled: isTranslating,
                    },
                    isTranslating ? 'Translating Strings...' : `⚡ Re-Translate All with ${currentProviderObj.title}`
                  )
                ),
                el(
                  'table',
                  { className: 'ts-strings-table' },
                  el(
                    'thead',
                    null,
                    el(
                      'tr',
                      null,
                      el('th', { style: { width: '40%' } }, 'Source Text (XML Rule)'),
                      el('th', { style: { width: '15%' } }, 'Status'),
                      el('th', { style: { width: '45%' } }, 'Translated Text (Editable)')
                    )
                  ),
                  el(
                    'tbody',
                    null,
                    strings.map((item, idx) =>
                      el(
                        'tr',
                        { key: idx },
                        el(
                          'td',
                          null,
                          el('div', { className: 'ts-source-text' }, item.source),
                          el('div', { className: 'ts-widget-tag' }, `${item.widget_id} &rarr; ${item.field}`)
                        ),
                        el(
                          'td',
                          null,
                          el(
                            'span',
                            { className: `ts-status-tag ${item.status ? item.status.toLowerCase().replace(/[^a-z]/g, '') : 'pending'}` },
                            item.status || 'Pending'
                          )
                        ),
                        el(
                          'td',
                          null,
                          el('input', {
                            type: 'text',
                            className: 'ts-trans-input',
                            value: item.translated || '',
                            placeholder: isTranslating ? 'Translating...' : 'Enter translation...',
                            onChange: (e) => {
                              const val = e.target.value;
                              const next = [...strings];
                              next[idx] = { ...item, translated: val, status: 'Custom' };
                              setStrings(next);
                            },
                          })
                        )
                      )
                    )
                  )
                )
              ),
              el(
                'div',
                { className: 'ts-review-footer' },
                el(
                  'button',
                  { className: 'ts-bulk-btn ts-bulk-btn-secondary', onClick: () => setIsReviewOpen(false) },
                  'Cancel'
                ),
                el(
                  'button',
                  { className: 'ts-bulk-btn ts-bulk-btn-primary', onClick: handleApplyToEditor },
                  '✓ Apply to Blocks'
                )
              )
            )
          )
      );
    }

    registerPlugin('translatesense-editor', {
      render: TranslateSenseGutenbergPanel,
      icon: 'translation',
    });
  }

  // 2. Elementor Editor Integration
  if (window.jQuery) {
    window.jQuery(document).ready(function ($) {
      if (window.elementor && window.elementor.on) {
        window.elementor.on('preview:loaded', function () {
          // Add TranslateSense panel button in Elementor footer
          if ($('#ts-elementor-translate-btn').length === 0) {
            $('#elementor-panel-footer').prepend(`
              <div id="ts-elementor-panel-wrap" style="padding: 10px; border-top: 1px solid #3d414a; background: #26292c;">
                <button id="ts-elementor-translate-btn" class="elementor-button elementor-button-default" style="width: 100%; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #fff; font-weight: 600;">
                  ⚡ Translate Page
                </button>
              </div>
            `);

            // Translate button click -> Opens Provider dialog
            $('#ts-elementor-translate-btn').on('click', function () {
              const config = window.TranslateSenseEditorData || {};
              const targetLang = config.currentLanguage || 'en';

              let modalHtml = `
                <div id="ts-elementor-provider-modal" class="ts-strings-review-modal">
                  <div class="ts-review-container" style="max-width: 620px;">
                    <div class="ts-review-header">
                      <h3>🌐 Choose Translation Provider (Elementor)</h3>
                      <button class="ts-bulk-close" id="ts-elem-close-modal">✕</button>
                    </div>
                    <div class="ts-review-body">
                      <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0;">
                        Translating content for page language: <strong style="color: #4f46e5;">🌐 ${targetLang.toUpperCase()}</strong>
                      </p>
                      <div class="ts-provider-grid">
                        ${PROVIDERS.map(p => `
                          <div class="ts-provider-card ${p.id === 'openai' ? 'selected' : ''}" data-provider="${p.id}">
                            <input type="radio" name="elem_provider" value="${p.id}" ${p.id === 'openai' ? 'checked' : ''} class="ts-provider-radio" />
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
                    <div class="ts-review-footer">
                      <button class="ts-bulk-btn ts-bulk-btn-secondary" id="ts-elem-cancel-modal">Cancel</button>
                      <button class="ts-bulk-btn ts-bulk-btn-primary" id="ts-elem-start-trans-btn">🚀 Start Translation</button>
                    </div>
                  </div>
                </div>
              `;

              $('body').append(modalHtml);

              $('.ts-provider-card').on('click', function() {
                $('.ts-provider-card').removeClass('selected');
                $(this).addClass('selected');
                $(this).find('input[type="radio"]').prop('checked', true);
              });

              $('#ts-elem-close-modal, #ts-elem-cancel-modal').on('click', function() {
                $('#ts-elementor-provider-modal').remove();
              });

              $('#ts-elem-start-trans-btn').on('click', function() {
                const selectedProv = $('input[name="elem_provider"]:checked').val() || 'openai';
                const btn = $(this);

                btn.prop('disabled', true).text('Translating...');

                $.ajax({
                  url: config.restUrl + 'translate-post',
                  method: 'POST',
                  headers: { 'X-WP-Nonce': config.nonce },
                  contentType: 'application/json',
                  data: JSON.stringify({
                    post_id: config.postId,
                    target_lang: targetLang,
                    provider: selectedProv,
                  }),
                  success: function (res) {
                    $('#ts-elementor-provider-modal').remove();
                    if (res.success && res.edit_url) {
                      if (confirm('🎉 Translation completed successfully!\n\nWould you like to open the translated post in Elementor?')) {
                        window.open(res.edit_url, '_blank');
                      }
                    } else {
                      alert('Translation complete!');
                    }
                  },
                  error: function (xhr) {
                    btn.prop('disabled', false).text('🚀 Start Translation');
                    const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Translation failed.';
                    alert('Error: ' + msg);
                  }
                });
              });
            });
          }
        });
      }
    });
  }
})();
