/**
 * TranslateSense - Gutenberg Block Recovery System (block-recovery.js)
 * 
 * Production-ready, conservative, reliable Gutenberg block detection,
 * conservative default attribute recovery, and editor integration.
 */

(function (window, document, wp) {
  'use strict';

  if (!wp || !wp.blocks || !wp.data) {
    return;
  }

  const { registerPlugin } = wp.plugins || {};
  const { PluginDocumentSettingPanel } = wp.editPost || wp.editor || {};
  const { createElement, Fragment, useState } = wp.element || {};

  const config = window.TranslateSenseRecoveryData || {};
  const postId = parseInt(config.postId, 10) || 0;
  const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
  const nonce = config.nonce || '';
  const blockEditorSelect = wp.data.select('core/block-editor');
  const blockEditorDispatch = wp.data.dispatch('core/block-editor');


  if (!postId || !config.isPending) {
    return;
  }

  // Session State
  let initialScanPerformed = false;
  let sessionPromptDismissed = false;
  let isRecoveryPending = true;
  let refreshSidebarPanelFn = null;

  /* ==========================================================================
     HTML Normalization Helper
     ========================================================================== */
  function normalizeHtml(html) {
    if (!html || typeof html !== 'string') return '';

    const doc = new DOMParser().parseFromString(html, 'text/html');

    return (doc.body.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getHtmlInnerText(html) {
    if (typeof html !== 'string' || !html) return '';
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const text = doc.body.textContent || doc.body.innerText || '';
        return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      } catch (e) {
        // Fallback to regex
      }
    }
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize a string for source-to-translation matching. Original attribute
   * values are preserved unless an unambiguous mapping is found.
   */
  function normalizeRepairString(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  /**
   * Store an unambiguous source => translated string mapping. If the same
   * source string maps to different translations, mark it ambiguous and never
   * use it for automatic replacement.
   */
  function addRepairMapping(mapping, source, translated) {
    const key = normalizeRepairString(source);
    const value = normalizeRepairString(translated);

    if (!key || !value || key === value || mapping.ambiguous.has(key)) {
      return;
    }

    if (mapping.values.has(key) && mapping.values.get(key) !== value) {
      mapping.values.delete(key);
      mapping.ambiguous.add(key);
      return;
    }

    mapping.values.set(key, value);
  }

  /**
   * Compare generated default/source markup with the affected saved markup.
   * Only corresponding DOM nodes and a conservative list of human-readable
   * attributes are used to infer mappings. CSS classes, IDs and URLs are not
   * treated as translatable strings.
   */
  function buildRepairStringMap(sourceHTML, translatedHTML) {
    const mapping = { values: new Map(), ambiguous: new Set() };

    if (typeof sourceHTML !== 'string' || typeof translatedHTML !== 'string' || !sourceHTML || !translatedHTML) {
      return mapping;
    }

    if (typeof DOMParser === 'undefined') {
      return mapping;
    }

    try {
      const parser = new DOMParser();
      const sourceDoc = parser.parseFromString(sourceHTML, 'text/html');
      const translatedDoc = parser.parseFromString(translatedHTML, 'text/html');
      const translatableAttributes = [
        'alt', 'title', 'aria-label', 'aria-description', 'placeholder',
        'value', 'summary', 'caption'
      ];

      function compareNodes(sourceNode, translatedNode, depth) {
        if (!sourceNode || !translatedNode || depth > 100) return;
        if (sourceNode.nodeType !== translatedNode.nodeType) return;

        if (sourceNode.nodeType === Node.TEXT_NODE) {
          addRepairMapping(mapping, sourceNode.nodeValue, translatedNode.nodeValue);
          return;
        }

        if (sourceNode.nodeType !== Node.ELEMENT_NODE) return;
        if (sourceNode.tagName !== translatedNode.tagName) return;

        translatableAttributes.forEach((attrName) => {
          if (sourceNode.hasAttribute(attrName) && translatedNode.hasAttribute(attrName)) {
            addRepairMapping(
              mapping,
              sourceNode.getAttribute(attrName),
              translatedNode.getAttribute(attrName)
            );
          }
        });

        const sourceChildren = sourceNode.childNodes;
        const translatedChildren = translatedNode.childNodes;
        if (sourceChildren.length !== translatedChildren.length) return;

        for (let i = 0; i < sourceChildren.length; i++) {
          compareNodes(sourceChildren[i], translatedChildren[i], depth + 1);
        }
      }

      compareNodes(sourceDoc.body, translatedDoc.body, 0);
    } catch (error) {
      // A failed DOM comparison must not produce speculative mappings.
    }

    return mapping;
  }

  /**
   * Recursively translate exact string values using only unambiguous mappings.
   * Objects/arrays are cloned; non-string values remain unchanged.
   */
  function translateRepairValue(value, mapping, depth = 0) {
    if (depth > 100) return value;

    if (typeof value === 'string') {
      const key = normalizeRepairString(value);
      if (!key || mapping.ambiguous.has(key) || !mapping.values.has(key)) {
        return value;
      }

      const translated = mapping.values.get(key);
      const leading = (value.match(/^\s*/) || [''])[0];
      const trailing = (value.match(/\s*$/) || [''])[0];
      return leading + translated + trailing;
    }

    if (Array.isArray(value)) {
      return value.map((item) => translateRepairValue(item, mapping, depth + 1));
    }

    if (value && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return value;

      const result = {};
      Object.keys(value).forEach((key) => {
        result[key] = translateRepairValue(value[key], mapping, depth + 1);
      });

      return result;
    }

    return value;
  }

  function cloneRepairValue(value) {
    if (value === undefined || value === null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function cloneBlockTree(block) {
    if (!block || typeof block !== 'object') return block;
    return {
      ...block,
      attributes: cloneRepairValue(block.attributes || {}),
      innerBlocks: Array.isArray(block.innerBlocks)
        ? block.innerBlocks.map(cloneBlockTree)
        : []
    };
  }

  /* ==========================================================================
     Block Scanning & Analysis
     ========================================================================== */

  /**
   * Scan the block tree sequentially. Await each analysis and nested scan so
   * result ordering is deterministic and editor work is not run concurrently.
   *
   * @param {Array} blocks Blocks to scan.
   * @param {number} depth Recursion safety guard.
   * @return {Promise<Array>} Invalid or suspicious blocks.
   */
  async function scanInvalidBlocks(blocks, depth = 0) {
    if (!Array.isArray(blocks) || depth > 50) return [];

    const invalid = [];

    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;

      let isInvalid = block.isValid === false || block.name === 'core/missing';

      if (
        !isInvalid &&
        block.name &&
        block.name !== 'core/freeform' &&
        typeof block.originalContent === 'string'
      ) {
        try {
          const analysis = await analyzeBlockRepair(block);
          isInvalid = analysis.canRepair === true;
        } catch (error) {
          console.warn('[TranslateSense Recovery] Block analysis failed:', error);
        }
      }

      if (isInvalid) invalid.push(block);

      if (Array.isArray(block.innerBlocks) && block.innerBlocks.length) {
        const nestedInvalid = await scanInvalidBlocks(block.innerBlocks, depth + 1);
        invalid.push(...nestedInvalid);
      }
    }

    return invalid;
  }

  /**
   * Analyze a block without inserting or mutating anything in the editor.
   * A repair is offered only when candidate serialization matches saved markup.
   *
   * @param {Object} block Gutenberg block.
   * @return {Promise<Object>} Repair analysis.
   */
  async function analyzeBlockRepair(block) {
    const blockName = block && block.name ? block.name : '';
    const blockType = blockName ? wp.blocks.getBlockType(blockName) : null;
    const base = {
      block,
      canRepair: false,
      candidateBlock: null,
      restoredKeys: [],
      stringMappings: 0,
      ambiguousStrings: []
    };

    if (!blockType) {
      return { ...base, reason: 'Block type is not registered in this editor session.' };
    }

    if (typeof block.originalContent !== 'string' || !block.originalContent) {
      return { ...base, reason: 'Saved block HTML is unavailable on this block object.' };
    }

    if (typeof wp.blocks.createBlock !== 'function' || typeof wp.blocks.getBlockContent !== 'function') {
      return { ...base, reason: 'Required Gutenberg block APIs are unavailable.' };
    }

    if (!block.validationIssues || block.validationIssues.length === 0) {
      return { ...base, reason: 'Block is valid and does not need repair.' };
    }

    const schemaAttrs = blockType.attributes || {};
    const restoredAttrs = cloneRepairValue(block.attributes || {}) || {};
    const restoredKeys = [];
    let sourceHTML = ''

    let mapping = { values: new Map(), ambiguous: new Set() };

    try {
      // Diagnostic blocks must never be inserted into the live editor.
      const sourceBlock = wp.blocks.createBlock(blockName, restoredAttrs);
      sourceHTML = wp.blocks.getBlockContent(sourceBlock);

      if (typeof sourceHTML === 'string' && sourceHTML) {
        mapping = buildRepairStringMap(sourceHTML, block.originalContent);

        if (mapping.values.size) {
          const mappedAttrs = translateRepairValue(restoredAttrs, mapping);

          for (const key of Object.keys(mappedAttrs || {})) {
            if (
              mappedAttrs[key] !== restoredAttrs[key] &&
              !restoredKeys.some((item) => item.key === key)
            ) {
              restoredKeys.push({ key, source: 'markup-mapping' });
            }
          }

          Object.assign(restoredAttrs, mappedAttrs);
        }
      }
    } catch (error) {
      return {
        ...base,
        restoredKeys,
        reason: 'Could not generate or compare a safe repair candidate.',
        diagnostic: error && error.message ? error.message : ''
      };
    }

    if (!restoredKeys.length) {
      // When any validationIssues block attribute not found restoredKeys or empty restoredKeys,
      // check if sourceHTML and block.originalContent html innerTexts are same.
      const sourceInnerText = getHtmlInnerText(sourceHTML);
      const originalInnerText = getHtmlInnerText(block.originalContent);

      if (
        (sourceInnerText && originalInnerText && sourceInnerText === originalInnerText) ||
        (sourceInnerText === '' && originalInnerText === '' && normalizeHtml(sourceHTML) === normalizeHtml(block.originalContent))
      ) {
        // In this case we don't need to update attribute, only update originalContent with existing attributes
        try {
          const candidateBlock = wp.blocks.createBlock(
            blockName,
            restoredAttrs,
            Array.isArray(block.innerBlocks) ? block.innerBlocks : []
          );

          return {
            ...base,
            canRepair: true,
            candidateBlock,
            restoredKeys: [{ key: 'originalContent', source: 'markup-sync' }],
            stringMappings: mapping.values.size,
            ambiguousStrings: Array.from(mapping.ambiguous),
            reason: 'Markup synchronized: Text content matches existing attributes.'
          };
        } catch (candidateErr) {
          console.log(candidateErr)
          return {
            ...base,
            reason: 'Candidate block could not be created with existing attributes.',
            diagnostic: candidateErr && candidateErr.message ? candidateErr.message : ''
          };
        }
      }

      return {
        ...base,
        reason: 'No missing defaults or unambiguous string mappings were found.',
        stringMappings: mapping.values.size,
        ambiguousStrings: Array.from(mapping.ambiguous)
      };
    }

    try {
      const candidateBlock = wp.blocks.createBlock(blockName, restoredAttrs);
      const candidateHTML = wp.blocks.getBlockContent(candidateBlock);

      if (
        typeof candidateHTML !== 'string' ||
        !candidateHTML ||
        normalizeHtml(candidateHTML) !== normalizeHtml(block.originalContent)
      ) {
        return {
          ...base,
          restoredKeys,
          stringMappings: mapping.values.size,
          ambiguousStrings: Array.from(mapping.ambiguous),
          reason: 'Candidate markup does not match the saved block HTML.'
        };
      }

      return {
        ...base,
        canRepair: true,
        candidateBlock,
        restoredKeys,
        stringMappings: mapping.values.size,
        ambiguousStrings: Array.from(mapping.ambiguous),
        reason: 'Candidate markup matches the saved block HTML.'
      };
    } catch (error) {
      return {
        ...base,
        restoredKeys,
        stringMappings: mapping.values.size,
        ambiguousStrings: Array.from(mapping.ambiguous),
        reason: 'Candidate block could not be serialized safely.'
      };
    }
  }

  /**
   * Group findings in document order and await each analysis.
   *
   * @param {Array} invalidBlocks Invalid blocks.
   * @return {Promise<Array>} Grouped findings.
   */
  async function groupFindings(invalidBlocks) {
    const groups = Object.create(null);

    for (const block of invalidBlocks) {
      const name = block && block.name ? block.name : 'unknown';
      const blockType = wp.blocks.getBlockType(name);
      const title = blockType && blockType.title ? blockType.title : name;

      if (!groups[name]) {
        groups[name] = {
          name,
          title,
          totalCount: 0,
          repairableCount: 0,
          unresolvedCount: 0,
          items: []
        };
      }

      const analysis = await analyzeBlockRepair(block);
      groups[name].totalCount++;

      if (analysis.canRepair) {
        groups[name].repairableCount++;
      } else {
        groups[name].unresolvedCount++;
      }

      groups[name].items.push(analysis);
    }

    return Object.values(groups);
  }

  /* ==========================================================================
     Server-Side Metadata Clearance
     ========================================================================== */

  async function clearRecoveryMetadataOnServer() {
    try {
      const response = await fetch(restUrl + 'clear-block-repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce
        },
        body: JSON.stringify({ post_id: postId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          isRecoveryPending = false;
          if (typeof refreshSidebarPanelFn === 'function') {
            refreshSidebarPanelFn();
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('[TranslateSense] Error clearing recovery metadata:', err);
    }
    return false;
  }

  /* ==========================================================================
     Editor Readiness Waiter (Safe against premature empty blocks)
     ========================================================================== */

  /**
   * Wait for Gutenberg's initial block tree. Resolves with [] for a valid empty
   * post only after repeated checks, and rejects on timeout.
   *
   * @param {number} timeoutMs Maximum wait.
   * @return {Promise<Array>}
   */
  function waitForEditorReady(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe = null;
      let pollTimer = null;
      let timeoutTimer = null;
      let emptyChecks = 0;

      const cleanup = () => {
        if (unsubscribe) {
          try { unsubscribe(); } catch (error) { }
          unsubscribe = null;
        }
        if (pollTimer) clearInterval(pollTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
      };

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };

      const check = () => {
        if (settled) return;

        const editorSelect = wp.data.select('core/editor');
        const blockSelect = wp.data.select('core/block-editor');
        const ready = editorSelect &&
          (typeof editorSelect.__unstableIsEditorReady !== 'function' ||
            editorSelect.__unstableIsEditorReady());
        const blocks = blockSelect && typeof blockSelect.getBlocks === 'function'
          ? blockSelect.getBlocks()
          : null;

        if (!ready || !Array.isArray(blocks)) return;

        if (blocks.length > 0) {
          finish(resolve, blocks);
          return;
        }

        emptyChecks++;
        if (emptyChecks >= 30) finish(resolve, blocks);
      };

      unsubscribe = wp.data.subscribe(check);
      pollTimer = setInterval(check, 250);
      timeoutTimer = setTimeout(() => {
        finish(reject, new Error('Timed out waiting for the Gutenberg editor.'));
      }, timeoutMs);

      check();
    });
  }

  /* ==========================================================================
     DOM-Level Bulletproof Modal Component
     Mounted directly to document.body for 100% reliable display.
     ========================================================================== */

  function showRecoveryModal(initialFindings = [], onCompleteCallback = null) {
    // Remove any existing overlay
    const oldOverlay = document.getElementById('ts-recovery-modal-overlay');
    if (oldOverlay) oldOverlay.remove();

    let currentMode = 'initial'; // 'initial' | 'review' | 'repairing' | 'results'
    let findings = initialFindings;
    let repairResults = null;

    const overlay = document.createElement('div');
    overlay.id = 'ts-recovery-modal-overlay';
    overlay.className = 'ts-recovery-overlay';

    function renderContent() {
      const totalInvalid = findings.reduce((sum, g) => sum + g.totalCount, 0);
      const totalRepairable = findings.reduce((sum, g) => sum + g.repairableCount, 0);
      const totalUnresolved = findings.reduce((sum, g) => sum + g.unresolvedCount, 0);

      const isWide = (currentMode === 'review');

      let bodyHtml = '';

      if (currentMode === 'initial') {
        bodyHtml = `
          <div class="ts-recovery-banner warning">
            <span class="ts-recovery-banner-icon">⚠️</span>
            <div class="ts-recovery-banner-text">
              <div class="ts-recovery-banner-title">Translated Blocks Require Attribute Recovery</div>
              <div>This post was translated via bulk translation. <strong>${totalInvalid} ${totalInvalid === 1 ? 'block has' : 'blocks have'}</strong> JavaScript default attributes that must be restored to display and validate correctly in Gutenberg.</div>
            </div>
          </div>

          <div class="ts-recovery-stats-grid">
            <div class="ts-recovery-stat-card">
              <span class="ts-recovery-stat-label">Total Affected</span>
              <span class="ts-recovery-stat-val">${totalInvalid}</span>
            </div>
            <div class="ts-recovery-stat-card repairable">
              <span class="ts-recovery-stat-label">Repairable</span>
              <span class="ts-recovery-stat-val">${totalRepairable}</span>
            </div>
            <div class="ts-recovery-stat-card unresolved">
              <span class="ts-recovery-stat-label">Unresolved</span>
              <span class="ts-recovery-stat-val">${totalUnresolved}</span>
            </div>
          </div>

          <div class="ts-recovery-section-title">Affected Block Types</div>
          <div class="ts-recovery-card-list">
            ${findings.map(group => `
              <div class="ts-recovery-block-row">
                <div class="ts-recovery-block-info">
                  <div class="ts-recovery-block-icon">🧩</div>
                  <div class="ts-recovery-block-names">
                    <div class="ts-recovery-block-title">${escapeHtml(group.title)}</div>
                    <div class="ts-recovery-block-tag">${escapeHtml(group.name)}</div>
                  </div>
                </div>
                <div class="ts-recovery-block-badge-group">
                  <span class="ts-recovery-pill count">${group.totalCount} ${group.totalCount === 1 ? 'instance' : 'instances'}</span>
                  ${group.repairableCount > 0 ? `<span class="ts-recovery-pill repairable">✓ ${group.repairableCount} repairable</span>` : ''}
                  ${group.unresolvedCount > 0 ? `<span class="ts-recovery-pill unresolved">⚠️ ${group.unresolvedCount} unresolved</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (currentMode === 'review') {
        bodyHtml = `
          <div class="ts-recovery-banner info">
            <span class="ts-recovery-banner-icon">ℹ️</span>
            <div class="ts-recovery-banner-text">
              <div class="ts-recovery-banner-title">Proposed Attribute Recovery Details</div>
              <div>TranslateSense safely restores registered JavaScript default attributes without overwriting translated text, user settings, or structural properties.</div>
            </div>
          </div>

          ${findings.map(group => `
            <div class="ts-recovery-card-list">
              <div class="ts-recovery-block-row" style="background: #f8fafc; font-weight: 600;">
                <span>${escapeHtml(group.title)} (${escapeHtml(group.name)})</span>
                <span class="ts-recovery-pill count">${group.items.length} instances</span>
              </div>
              ${group.items.map((item, idx) => `
                <div class="ts-recovery-block-row" style="flex-direction: column; align-items: stretch;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: #334155;">Instance #${idx + 1}</span>
                    ${item.canRepair
            ? '<span class="ts-recovery-pill repairable">✓ Ready to repair</span>'
            : `<span class="ts-recovery-pill unresolved">⚠️ ${escapeHtml(item.reason)}</span>`}
                  </div>
                  ${item.restoredKeys && item.restoredKeys.length > 0 ? `
                    <div class="ts-recovery-detail-box">
                      <strong>Restoring Attributes: </strong>
                      ${item.restoredKeys.map(k => `<span class="ts-recovery-attr-tag" style="margin-right: 6px;">+ ${escapeHtml(k.key)}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}
        `;
      } else if (currentMode === 'repairing') {
        bodyHtml = `
          <div style="text-align: center; padding: 40px 20px;">
            <div class="ts-recovery-spinner dark" style="width: 36px; height: 36px; border-width: 3px; margin-bottom: 16px;"></div>
            <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #0f172a;">Repairing Block Attributes...</h4>
            <p style="margin: 0; font-size: 13.5px; color: #64748b;">Comparing registered defaults, translated strings, and saved block markup...</p>
          </div>
        `;
      } else if (currentMode === 'results' && repairResults) {
        bodyHtml = `
          <div class="ts-recovery-banner ${repairResults.allResolved ? 'success' : 'warning'}">
            <span class="ts-recovery-banner-icon">${repairResults.allResolved ? '🎉' : '⚠️'}</span>
            <div class="ts-recovery-banner-text">
              <div class="ts-recovery-banner-title">${repairResults.allResolved ? 'Block Recovery Completed Successfully!' : 'Partial Block Recovery Completed'}</div>
              <div>${repairResults.allResolved
            ? `All ${repairResults.repairedCount} affected blocks were repaired and their saved markup matched the recovery candidate.`
            : `${repairResults.repairedCount} blocks repaired. ${repairResults.failedCount} blocks could not be safely repaired automatically.`}</div>
            </div>
          </div>

          ${!repairResults.allResolved && repairResults.unresolvedItems && repairResults.unresolvedItems.length > 0 ? `
            <div class="ts-recovery-section-title">Unresolved Blocks</div>
            <div class="ts-recovery-card-list">
              ${repairResults.unresolvedItems.map(un => `
                <div class="ts-recovery-block-row">
                  <div class="ts-recovery-block-info">
                    <div class="ts-recovery-block-icon">🧩</div>
                    <div class="ts-recovery-block-names">
                      <div class="ts-recovery-block-title">${escapeHtml(un.title || 'Block')}</div>
                      <div class="ts-recovery-block-tag">${escapeHtml(un.name || '')}</div>
                    </div>
                  </div>
                  <div class="ts-recovery-block-badge-group">
                    <span class="ts-recovery-pill unresolved">⚠️ ${escapeHtml(un.reason || 'Unresolved block schema')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        `;
      }

      let footerHtml = '';

      if (currentMode === 'initial') {
        footerHtml = `
          <button type="button" class="ts-recovery-btn ts-recovery-btn-secondary" id="ts-recovery-btn-skip">Skip for Now</button>
          <button type="button" class="ts-recovery-btn ts-recovery-btn-secondary" id="ts-recovery-btn-review">Review Details</button>
          <button type="button" class="ts-recovery-btn ts-recovery-btn-primary" id="ts-recovery-btn-apply" ${totalRepairable === 0 ? 'disabled' : ''}>
            Repair ${totalRepairable} ${totalRepairable === 1 ? 'Block' : 'Blocks'}
          </button>
        `;
      } else if (currentMode === 'review') {
        footerHtml = `
          <button type="button" class="ts-recovery-btn ts-recovery-btn-secondary" id="ts-recovery-btn-back">← Back</button>
          <button type="button" class="ts-recovery-btn ts-recovery-btn-primary" id="ts-recovery-btn-apply" ${totalRepairable === 0 ? 'disabled' : ''}>
            Apply Repairs (${totalRepairable})
          </button>
        `;
      } else if (currentMode === 'results') {
        footerHtml = `
          <button type="button" class="ts-recovery-btn ts-recovery-btn-success" id="ts-recovery-btn-done">✓ Done (Close)</button>
        `;
      }

      overlay.innerHTML = `
        <div class="ts-recovery-modal ${isWide ? 'ts-recovery-modal-wide' : ''}" onclick="event.stopPropagation()">
          <div class="ts-recovery-header">
            <div class="ts-recovery-header-left">
              <div class="ts-recovery-icon-badge">
                <span class="dashicons dashicons-admin-tools"></span>
              </div>
              <div class="ts-recovery-header-titles">
                <h3 class="ts-recovery-header-title">TranslateSense Block Recovery</h3>
                <p class="ts-recovery-header-subtitle">Conservative default attribute repair for translated blocks</p>
              </div>
            </div>
            <button type="button" class="ts-recovery-close-btn" id="ts-recovery-btn-close" title="Close">×</button>
          </div>
          <div class="ts-recovery-body">
            ${bodyHtml}
          </div>
          <div class="ts-recovery-footer">
            ${footerHtml}
          </div>
        </div>
      `;

      bindEvents();
    }

    function closeModal() {
      sessionPromptDismissed = true;
      overlay.remove();
    }

    async function executeRepairs() {
      currentMode = 'repairing';
      renderContent();

      const blockEditorDispatch = wp.data.dispatch('core/block-editor');
      const blockEditorSelect = wp.data.select('core/block-editor');
      let repairedCount = 0;
      let failedCount = 0;
      const unresolvedItems = [];

      // 1. Create a replaceBlockCache array
      const replaceBlockCache = [];
      const directReplacements = [];
      const stagedRepairs = [];

      for (const group of findings) {
        for (const item of group.items) {
          if (!item.canRepair || !item.candidateBlock || !blockEditorDispatch) {
            failedCount++;
            unresolvedItems.push({
              title: group.title || 'Block',
              name: group.name || (item.block && item.block.name) || '',
              reason: item.reason || 'Unresolved block schema',
              clientId: (item.block && item.block.clientId) || ''
            });
            continue;
          }

          // 3. Create array temp for each block to store parent block IDs in top upper to lower order
          let temp = [];
          if (blockEditorSelect && typeof blockEditorSelect.getBlockParents === 'function') {
            const rawParents = blockEditorSelect.getBlockParents(item.block.clientId, false);
            if (Array.isArray(rawParents)) {
              temp = rawParents;
            }
          }
          if ((!Array.isArray(temp) || temp.length === 0) && blockEditorSelect && typeof blockEditorSelect.getBlockRootClientId === 'function') {
            let curr = item.block.clientId;
            temp = [];
            while (true) {
              const pId = blockEditorSelect.getBlockRootClientId(curr);
              if (!pId) break;
              temp.unshift(pId);
              curr = pId;
            }
          }
          if (!Array.isArray(temp)) {
            temp = [];
          }

          // Direct replacement case: block does not have a parent block
          if (temp.length === 0) {
            directReplacements.push({
              item,
              groupTitle: group.title,
              groupName: group.name
            });
            continue;
          }

          // Nested block case: block is inside innerBlock(s)
          // Top upper order parent block is at temp[0]
          const rootParentId = temp[0];
          let rootRef;

          // If parent block saved in replaceBlockCache object, get reference from cache object
          if (replaceBlockCache[rootParentId]) {
            rootRef = replaceBlockCache[rootParentId];
          } else {
            // If not exist, then first save this parent object in this reference replaceBlockCache object and get reference from this object
            const editorRootBlock = blockEditorSelect ? blockEditorSelect.getBlock(rootParentId) : null;
            if (!editorRootBlock) {
              failedCount++;
              unresolvedItems.push({
                title: group.title || 'Block',
                name: group.name || (item.block && item.block.name) || '',
                reason: 'Root parent block (' + rootParentId + ') not found in editor',
                clientId: item.block.clientId
              });
              continue;
            }
            replaceBlockCache[rootParentId] = cloneBlockTree(editorRootBlock);
            rootRef = replaceBlockCache[rootParentId];
          }

          // Run loop for this parent id to find parent blocks in this reference block innerBlock by finding block index
          let currentParentRef = rootRef;
          let traversalSuccess = true;

          for (let pIdx = 1; pIdx < temp.length; pIdx++) {
            const currentParentId = temp[pIdx];
            if (!currentParentRef || !Array.isArray(currentParentRef.innerBlocks)) {
              traversalSuccess = false;
              break;
            }
            const foundChildIndex = currentParentRef.innerBlocks.findIndex(
              child => child && child.clientId === currentParentId
            );
            if (foundChildIndex === -1) {
              traversalSuccess = false;
              break;
            }
            currentParentRef = currentParentRef.innerBlocks[foundChildIndex];
          }

          if (!traversalSuccess || !currentParentRef || !Array.isArray(currentParentRef.innerBlocks)) {
            failedCount++;
            unresolvedItems.push({
              title: group.title || 'Block',
              name: group.name || (item.block && item.block.name) || '',
              reason: 'Parent block container could not be traversed in block hierarchy',
              clientId: item.block.clientId
            });
            continue;
          }

          // Find target block index in currentParentRef.innerBlocks
          const targetBlockIndex = currentParentRef.innerBlocks.findIndex(
            child => child && child.clientId === item.block.clientId
          );

          if (targetBlockIndex === -1) {
            failedCount++;
            unresolvedItems.push({
              title: group.title || 'Block',
              name: group.name || (item.block && item.block.name) || '',
              reason: 'Target block index not found in parent innerBlocks',
              clientId: item.block.clientId
            });
            continue;
          }

          // Save this repair block in this innerBlock at right index where we need to replace
          currentParentRef.innerBlocks[targetBlockIndex] = item.candidateBlock;
          stagedRepairs.push({
            item,
            groupTitle: group.title,
            groupName: group.name
          });
        }
      }

      // In attempt recovery case when block is in innerBlock, update top first root parent block instead of current block
      const cachedRootIds = Object.keys(replaceBlockCache);
      for (const rootId of cachedRootIds) {
        const updatedRoot = replaceBlockCache[rootId];
        try {
          let replacement = null;
          if (typeof wp.blocks.createBlock === 'function') {
            try {
              replacement = wp.blocks.createBlock(
                updatedRoot.name,
                updatedRoot.attributes,
                updatedRoot.innerBlocks
              );
            } catch (createErr) {
              replacement = updatedRoot;
            }
          } else {
            replacement = updatedRoot;
          }
          blockEditorDispatch.replaceBlock(rootId, replacement || updatedRoot);
        } catch (err) {
          console.error('[TranslateSense Recovery] Error replacing root parent block:', err);
        }
      }

      // Current replace only works when block does not have a parent block
      for (const direct of directReplacements) {
        try {
          blockEditorDispatch.replaceBlock(direct.item.block.clientId, direct.item.candidateBlock);
          stagedRepairs.push(direct);
        } catch (err) {
          failedCount++;
          unresolvedItems.push({
            title: direct.groupTitle || 'Block',
            name: direct.groupName || (direct.item.block && direct.item.block.name) || '',
            reason: err.message || 'Direct block replacement failed',
            clientId: direct.item.block.clientId
          });
        }
      }

      // Verify repaired blocks in editor state
      for (const staged of stagedRepairs) {
        const candidateClientId = staged.item.candidateBlock ? staged.item.candidateBlock.clientId : null;
        const updatedBlock = candidateClientId && blockEditorSelect
          ? blockEditorSelect.getBlock(candidateClientId)
          : null;

        if (updatedBlock && updatedBlock.isValid !== false) {
          repairedCount++;
        } else if (!updatedBlock && blockEditorSelect) {
          const originalBlock = blockEditorSelect.getBlock(staged.item.block.clientId);
          if (!originalBlock || originalBlock.isValid !== false) {
            repairedCount++;
          } else {
            failedCount++;
            unresolvedItems.push({
              title: staged.groupTitle || 'Block',
              name: staged.groupName || (staged.item.block && staged.item.block.name) || '',
              reason: 'Block remains invalid after replacement',
              clientId: staged.item.block.clientId
            });
          }
        } else {
          failedCount++;
          unresolvedItems.push({
            title: staged.groupTitle || 'Block',
            name: staged.groupName || (staged.item.block && staged.item.block.name) || '',
            reason: 'Editor state verification failed after replacement',
            clientId: staged.item.block.clientId
          });
        }
      }

      const allResolved = (failedCount === 0 && repairedCount > 0);
      let cleared = false;

      if (allResolved) {
        cleared = await clearRecoveryMetadataOnServer();

        // Save post to persist recovered block markup to the database
        const editorDispatch = wp.data.dispatch('core/editor');
        if (editorDispatch && typeof editorDispatch.savePost === 'function') {
          try {
            await editorDispatch.savePost();
          } catch (saveErr) {
            console.warn('[TranslateSense Recovery] Auto-save post notice:', saveErr);
          }
        }

        if (wp.data.dispatch('core/notices')) {
          wp.data.dispatch('core/notices').createSuccessNotice(
            '✨ TranslateSense: All affected blocks recovered, verified, and saved successfully!',
            { type: 'snackbar', isDismissible: true }
          );
        }
      }

      repairResults = {
        repairedCount,
        failedCount,
        allResolved,
        cleared,
        unresolvedItems
      };

      currentMode = 'results';
      renderContent();

      if (typeof onCompleteCallback === 'function') {
        onCompleteCallback(allResolved);
      }
    }

    function bindEvents() {
      const closeBtn = overlay.querySelector('#ts-recovery-btn-close');
      if (closeBtn) closeBtn.onclick = closeModal;

      const skipBtn = overlay.querySelector('#ts-recovery-btn-skip');
      if (skipBtn) skipBtn.onclick = closeModal;

      const doneBtn = overlay.querySelector('#ts-recovery-btn-done');
      if (doneBtn) doneBtn.onclick = closeModal;

      const reviewBtn = overlay.querySelector('#ts-recovery-btn-review');
      if (reviewBtn) {
        reviewBtn.onclick = () => {
          currentMode = 'review';
          renderContent();
        };
      }

      const backBtn = overlay.querySelector('#ts-recovery-btn-back');
      if (backBtn) {
        backBtn.onclick = () => {
          currentMode = 'initial';
          renderContent();
        };
      }

      const applyBtn = overlay.querySelector('#ts-recovery-btn-apply');
      if (applyBtn) {
        applyBtn.onclick = executeRepairs;
      }
    }

    renderContent();
    document.body.appendChild(overlay);
  }

  /* ==========================================================================
     Gutenberg Sidebar Document Setting Panel
     ========================================================================== */

  function BlockRecoverySidebarPanel() {
    const [pending, setPending] = useState(isRecoveryPending);
    const [isScanning, setIsScanning] = useState(false);

    refreshSidebarPanelFn = () => {
      setPending(isRecoveryPending);
    };

    const handleManualScan = async () => {
      if (isScanning) return;
      setIsScanning(true);

      let blocks = [];
      let invalid = [];

      try {
        const editorSelect = wp.data.select('core/block-editor');
        blocks = editorSelect && typeof editorSelect.getBlocks === 'function'
          ? editorSelect.getBlocks()
          : [];
        invalid = await scanInvalidBlocks(blocks);
      } catch (error) {
        console.error('[TranslateSense Recovery] Scan failed:', error);
        if (wp.data.dispatch('core/notices')) {
          wp.data.dispatch('core/notices').createErrorNotice(
            'Block scan failed. Please try again.',
            { type: 'snackbar', isDismissible: true }
          );
        }
        return;
      } finally {
        setIsScanning(false);
      }

      if (invalid.length === 0) {
        // If blocks exist and none are invalid, clear server metadata
        if (blocks.length > 0) {
          await clearRecoveryMetadataOnServer();
          setPending(false);
        }
        if (wp.data.dispatch('core/notices')) {
          wp.data.dispatch('core/notices').createSuccessNotice(
            '✓ TranslateSense: All blocks in this post are valid. No recovery required.',
            { type: 'snackbar', isDismissible: true }
          );
        }
        return;
      }

      const grouped = await groupFindings(invalid);
      showRecoveryModal(grouped, (allResolved) => {
        if (allResolved) {
          setPending(false);
        }
      });
    };

    if (!pending || !PluginDocumentSettingPanel) {
      return null;
    }

    return createElement(
      PluginDocumentSettingPanel,
      {
        name: 'translatesense-block-recovery-panel',
        title: 'TranslateSense Block Recovery',
        icon: 'dashicons-admin-tools',
        className: 'ts-recovery-sidebar-panel'
      },
      createElement(
        'div',
        { className: 'ts-recovery-panel-content' },
        createElement(
          'div',
          { className: 'ts-recovery-panel-banner' },
          createElement('span', null, '⚠️'),
          createElement('div', null, 'Translated blocks may require default attribute recovery.')
        ),
        createElement(
          'div',
          { className: 'ts-recovery-panel-btn-wrap' },
          createElement(
            'button',
            {
              type: 'button',
              className: 'ts-recovery-panel-btn',
              onClick: handleManualScan,
              disabled: isScanning
            },
            isScanning
              ? createElement(Fragment, null, createElement('span', { className: 'ts-recovery-spinner' }), ' Scanning Blocks...')
              : createElement(Fragment, null, createElement('span', { className: 'dashicons dashicons-update' }), ' Scan & Repair Blocks')
          )
        )
      )
    );
  }

  // Register persistent Gutenberg panel
  if (registerPlugin) {
    registerPlugin('translatesense-block-recovery', {
      render: BlockRecoverySidebarPanel
    });
  }

  /* ==========================================================================
     Initial Scan Execution on Load
     ========================================================================== */

  waitForEditorReady()
    .then(async (blocks) => {
      if (initialScanPerformed) return;
      initialScanPerformed = true;

      if (!Array.isArray(blocks) || blocks.length === 0) {
        // Do not clear recovery metadata for an empty post without explicit review.
        return;
      }

      const invalid = await scanInvalidBlocks(blocks);

      if (invalid.length === 0) {
        await clearRecoveryMetadataOnServer();
        return;
      }

      const grouped = await groupFindings(invalid);

      if (!sessionPromptDismissed) {
        showRecoveryModal(grouped, (allResolved) => {
          if (allResolved && typeof refreshSidebarPanelFn === 'function') {
            refreshSidebarPanelFn();
          }
        });
      }
    })
    .catch((error) => {
      console.warn('[TranslateSense Recovery] Editor readiness check failed:', error);
    });

})(window, document, window.wp);