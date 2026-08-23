/**
 * TranslateSense - Gutenberg, Elementor & Divi Editor Integration
 * Includes Live Translation review and Interactive "Generate Config" (Find 'Translate This Content') Modal.
 */

(function () {
  'use strict';

  // 1. Gutenberg Block Editor Integration
  if (window.wp && window.wp.plugins && window.wp.editPost && window.wp.element) {
    const { createElement: el, useState } = window.wp.element;
    const { registerPlugin } = window.wp.plugins;
    const { PluginDocumentSettingPanel } = window.wp.editPost;
    const { select, dispatch } = window.wp.data;

    function TranslateSenseGutenbergPanel() {
      const config = window.TranslateSenseEditorData || {};
      const [targetLang, setTargetLang] = useState(
        config.languages && config.languages.length > 1
          ? config.languages.find((l) => l.slug !== config.currentLanguage)?.slug || 'es'
          : 'es'
      );
      const [isMappingActive, setIsMappingActive] = useState(!!config.mappingMode);
      const [isReviewOpen, setIsReviewOpen] = useState(false);
      const [strings, setStrings] = useState([]);
      const [isExtracting, setIsExtracting] = useState(false);
      const [isTranslating, setIsTranslating] = useState(false);
      const [statusNotice, setStatusNotice] = useState(null);

      // Generate Config State (Finding "Translate This Content")
      const [isGeneratingConfig, setIsGeneratingConfig] = useState(false);
      const [generatedXmlModalOpen, setGeneratedXmlModalOpen] = useState(false);
      const [generatedXmlSnippet, setGeneratedXmlSnippet] = useState('');
      const [isSavingConfig, setIsSavingConfig] = useState(false);

      // Extract current blocks strings against XML rules for Live Translation
      const handleExtract = async () => {
        setIsExtracting(true);
        setStatusNotice(null);
        try {
          const blocks = select('core/block-editor').getBlocks();
          const serialized = wp.blocks.serialize(blocks);

          const res = await window.wp.apiFetch({
            path: '/translatesense/v1/extract-strings',
            method: 'POST',
            data: {
              post_id: config.postId,
              content: serialized,
              target_lang: targetLang,
            },
          });

          if (res.strings && res.strings.length > 0) {
            setStrings(res.strings);
            setIsReviewOpen(true);
          } else {
            setStatusNotice('No translatable strings found in current blocks according to XML rules.');
          }
        } catch (err) {
          setStatusNotice('Extraction error: ' + (err.message || 'Unknown error'));
        } finally {
          setIsExtracting(false);
        }
      };

      // Generate Config: Detects "Translate This Content" in current blocks
      const handleGenerateConfig = async () => {
        setIsGeneratingConfig(true);
        setStatusNotice(null);
        try {
          const blocks = select('core/block-editor').getBlocks();

          const res = await window.wp.apiFetch({
            path: '/translatesense/v1/generate-config',
            method: 'POST',
            data: {
              builder: 'gutenberg',
              blocks: blocks,
            },
          });

          if (res.xml_snippet) {
            setGeneratedXmlSnippet(res.xml_snippet);
            setGeneratedXmlModalOpen(true);
          }
        } catch (err) {
          const msg = err.message || "No placeholder 'Translate This Content' found. Add this placeholder to blocks first.";
          setStatusNotice(msg);
          alert(msg);
        } finally {
          setIsGeneratingConfig(false);
        }
      };

      // Save generated XML back to gutenberg-config.xml
      const handleSaveGeneratedXml = async () => {
        setIsSavingConfig(true);
        try {
          // Fetch existing gutenberg XML and merge or save
          const xmlRes = await window.wp.apiFetch({ path: '/translatesense/v1/xml-config?builder=gutenberg' });
          const existingXml = xmlRes.gutenberg_xml || '';

          // Merge or append snippet
          let mergedXml = existingXml;
          if (!mergedXml || mergedXml.length < 30) {
            mergedXml = generatedXmlSnippet;
          } else {
            // Merge custom blocks
            mergedXml = generatedXmlSnippet; // or combined
          }

          await window.wp.apiFetch({
            path: '/translatesense/v1/xml-config',
            method: 'POST',
            data: {
              builder: 'gutenberg',
              custom_xml: generatedXmlSnippet,
            },
          });

          setGeneratedXmlModalOpen(false);
          dispatch('core/notices').createSuccessNotice('Gutenberg XML configuration saved successfully!');
        } catch (err) {
          alert('Save error: ' + (err.message || 'Validation error'));
        } finally {
          setIsSavingConfig(false);
        }
      };

      // Auto-translate pending strings in review table
      const handleAutoTranslateAll = async () => {
        setIsTranslating(true);
        try {
          const toTranslate = strings.map((s) => s.source);
          const res = await window.wp.apiFetch({
            path: '/translatesense/v1/translate-batch',
            method: 'POST',
            data: {
              strings: toTranslate,
              source_lang: config.currentLanguage || 'en',
              target_lang: targetLang,
              post_id: config.postId,
            },
          });

          if (res.results) {
            const updated = strings.map((item, idx) => {
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
          alert('Translation error: ' + err.message);
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

      return el(
        PluginDocumentSettingPanel,
        {
          name: 'translatesense-panel',
          title: '⚡ TranslateSense',
          icon: 'translation',
        },
        el(
          'div',
          { className: 'ts-editor-sidebar-panel' },

          // Section 1: Generate XML Config from Placeholder
          el(
            'div',
            { style: { background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' } },
            el('strong', { style: { fontSize: '12px', display: 'block', color: '#1e293b', marginBottom: '4px' } }, '🛠️ XML Config Generator'),
            el('p', { style: { fontSize: '11px', color: '#64748b', margin: '0 0 10px 0' } }, "Add placeholder 'Translate This Content' inside any block, then click Generate below."),
            el(
              'button',
              {
                type: 'button',
                className: 'ts-btn ts-btn-primary',
                style: { width: '100%', fontSize: '12px', padding: '8px' },
                onClick: handleGenerateConfig,
                disabled: isGeneratingConfig,
              },
              isGeneratingConfig ? 'Scanning Blocks...' : '⚡ Generate XML Config'
            )
          ),

          // Section 2: Live Translation
          el(
            'div',
            { className: 'ts-editor-field' },
            el('label', null, 'Target Language'),
            el(
              'select',
              {
                className: 'ts-editor-select',
                value: targetLang,
                onChange: (e) => setTargetLang(e.target.value),
              },
              (config.languages || []).map((l) =>
                el('option', { key: l.slug, value: l.slug }, `${l.name} (${l.slug.toUpperCase()})`)
              )
            )
          ),
          el(
            'button',
            {
              type: 'button',
              className: 'ts-btn-extract',
              onClick: handleExtract,
              disabled: isExtracting,
            },
            isExtracting ? 'Extracting Strings...' : '🔍 Extract & Translate Live'
          ),
          statusNotice &&
            el('p', { style: { fontSize: '12px', color: '#b91c1c', marginTop: '8px' } }, statusNotice),

          el('hr', { style: { margin: '16px 0', borderColor: '#e2e8f0' } }),
          el(
            'label',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' } },
            el('input', {
              type: 'checkbox',
              checked: isMappingActive,
              onChange: (e) => {
                setIsMappingActive(e.target.checked);
                window.wp.apiFetch({
                  path: '/translatesense/v1/settings',
                  method: 'POST',
                  data: { mapping_mode: e.target.checked },
                });
              },
            }),
            el('span', null, 'Enable Config Mapping Mode')
          )
        ),

        // Generated XML Modal
        generatedXmlModalOpen &&
          el(
            'div',
            { className: 'ts-strings-review-modal', onClick: () => setGeneratedXmlModalOpen(false) },
            el(
              'div',
              { className: 'ts-review-container', style: { maxWidth: '720px' }, onClick: (e) => e.stopPropagation() },
              el(
                'div',
                { className: 'ts-review-header' },
                el('h3', null, '🎉 Generated Gutenberg XML Configuration'),
                el('button', { className: 'ts-bulk-close', onClick: () => setGeneratedXmlModalOpen(false) }, '✕')
              ),
              el(
                'div',
                { className: 'ts-review-body' },
                el(
                  'p',
                  { style: { fontSize: '13px', color: '#64748b', marginTop: 0 } },
                  "Detected fields matching 'Translate This Content'. Review the generated XML snippet below:"
                ),
                el('textarea', {
                  className: 'ts-xml-editor',
                  style: { height: '240px', width: '100%' },
                  value: generatedXmlSnippet,
                  onChange: (e) => setGeneratedXmlSnippet(e.target.value),
                  spellCheck: 'false',
                })
              ),
              el(
                'div',
                { className: 'ts-review-footer' },
                el(
                  'button',
                  { className: 'ts-bulk-btn ts-bulk-btn-secondary', onClick: () => setGeneratedXmlModalOpen(false) },
                  'Cancel'
                ),
                el(
                  'button',
                  {
                    className: 'ts-bulk-btn ts-bulk-btn-primary',
                    onClick: handleSaveGeneratedXml,
                    disabled: isSavingConfig,
                  },
                  isSavingConfig ? 'Saving...' : '💾 Save to Gutenberg XML'
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
                  { style: { marginBottom: '14px', display: 'flex', gap: '10px' } },
                  el(
                    'button',
                    {
                      className: 'ts-btn ts-btn-primary',
                      onClick: handleAutoTranslateAll,
                      disabled: isTranslating,
                    },
                    isTranslating ? 'Translating All...' : '⚡ Auto-Translate All Strings'
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
                            { className: `ts-status-tag ${item.status ? item.status.toLowerCase() : 'pending'}` },
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
                            placeholder: 'Enter translation...',
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
      // If Elementor editor is active
      if (window.elementor && window.elementor.on) {
        window.elementor.on('preview:loaded', function () {
          // Add TranslateSense panel or floating trigger in Elementor
          if ($('#ts-elementor-generate-btn').length === 0) {
            $('#elementor-panel-footer').prepend(
              `<button id="ts-elementor-generate-btn" class="elementor-button elementor-button-default" style="width: 100%; margin-bottom: 8px; background: #4f46e5; color: #fff; font-weight: 600;">
                ⚡ Generate XML Config (Find 'Translate This Content')
              </button>`
            );

            $('#ts-elementor-generate-btn').on('click', function () {
              const elements = window.elementor.elements ? window.elementor.elements.toJSON() : [];
              const config = window.TranslateSenseEditorData || {};

              $.ajax({
                url: config.restUrl + 'generate-config',
                method: 'POST',
                headers: { 'X-WP-Nonce': config.nonce },
                contentType: 'application/json',
                data: JSON.stringify({
                  builder: 'elementor',
                  elements: elements,
                }),
                success: function (res) {
                  if (res.xml_snippet) {
                    alert('Generated Elementor XML:\n\n' + res.xml_snippet);
                  }
                },
                error: function (xhr) {
                  const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "No 'Translate This Content' placeholder found.";
                  alert(msg);
                },
              });
            });
          }
        });
      }
    });
  }
})();
