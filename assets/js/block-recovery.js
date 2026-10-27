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
    return html
      .replace(/<!--[\s\S]*?-->/g, '') // remove HTML comments
      .replace(/\s+/g, ' ')            // collapse whitespace
      .replace(/> </g, '><')           // remove inter-tag spaces
      .trim()
      .toLowerCase();
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

  /* ==========================================================================
     Block Scanning & Analysis
     ========================================================================== */

  /**
   * Recursively scan block hierarchy for invalid blocks.
   *
   * @param {Array} blocks Root blocks array.
   * @param {number} depth Recursion depth safety guard.
   * @return {Array} List of invalid block objects.
   */
  function scanInvalidBlocks(blocks, depth = 0) {
    if (!Array.isArray(blocks) || depth > 50) {
      return [];
    }

    const invalid = [];

    for (const block of blocks) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      let isInvalid = false;

      // 1. Direct Gutenberg invalid flag
      if (block.isValid === false) {
        isInvalid = true;
      }

      // 2. Missing block type
      if (block.name === 'core/missing') {
        isInvalid = true;
      }

      // 3. Proactive check for missing JavaScript schema defaults
      if (!isInvalid && block.name && block.name !== 'core/freeform') {
        const blockType = wp.blocks.getBlockType(block.name);
        if (blockType && blockType.attributes && block.originalContent) {
          const schemaAttrs = blockType.attributes;
          const currentAttrs = block.attributes || {};
          let hasMissingDefaults = false;
          const candidateAttrs = { ...currentAttrs };

          for (const attrKey of Object.keys(schemaAttrs)) {
            const def = schemaAttrs[attrKey];
            if (!def) continue;
            if (currentAttrs[attrKey] === undefined && def.default !== undefined) {
              candidateAttrs[attrKey] = (typeof def.default === 'object' && def.default !== null)
                ? JSON.parse(JSON.stringify(def.default))
                : def.default;
              hasMissingDefaults = true;
            }
          }

          if (hasMissingDefaults && typeof blockType.save === 'function') {
            try {
              const currentGen = wp.blocks.getBlockContent({ name: block.name, attributes: currentAttrs, innerBlocks: block.innerBlocks || [] });
              const candidateGen = wp.blocks.getBlockContent({ name: block.name, attributes: candidateAttrs, innerBlocks: block.innerBlocks || [] });

              // If current attributes fail to match original HTML, but candidate matches
              if (normalizeHtml(currentGen) !== normalizeHtml(block.originalContent) &&
                normalizeHtml(candidateGen) === normalizeHtml(block.originalContent)) {
                isInvalid = true;
              }
            } catch (e) {
              // Ignore save execution errors
            }
          }
        }
      }

      if (isInvalid) {
        invalid.push(block);
      }

      if (Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
        const nestedInvalid = scanInvalidBlocks(block.innerBlocks, depth + 1);
        if (nestedInvalid.length > 0) {
          invalid.push(...nestedInvalid);
        }
      }
    }

    return invalid;
  }

  /**
   * Inspect an invalid block and determine if missing default attributes can safely repair it.
   * Conservative and non-destructive.
   *
   * @param {Object} block Gutenberg block object.
   * @return {Object} Analysis result.
   */
  function analyzeBlockRepair(block) {
    const blockName = block.name || '';
    const blockType = wp.blocks.getBlockType(blockName);

    if (!blockType) {
      return {
        canRepair: false,
        reason: 'Missing JavaScript block registration',
        block,
        candidateBlock: null,
        restoredKeys: []
      };
    }

    const schemaAttrs = blockType.attributes || {};
    const currentAttrs = block.attributes || {};
    const restoredAttrs = { ...currentAttrs };
    const restoredKeys = [];

    // 1. Inspect schema for missing defaults or HTML sources
    for (const attrName of Object.keys(schemaAttrs)) {
      const def = schemaAttrs[attrName];
      if (!def) continue;

      // Never overwrite already defined attribute values
      if (currentAttrs[attrName] !== undefined && currentAttrs[attrName] !== null) {
        continue;
      }

      // Case A: Missing attribute with a registered default
      if (def.default !== undefined) {
        restoredAttrs[attrName] = (typeof def.default === 'object' && def.default !== null)
          ? JSON.parse(JSON.stringify(def.default))
          : def.default;
        restoredKeys.push({ key: attrName, type: 'default', value: def.default });
      }
      // Case B: Attribute sourced from HTML/text with a selector
      else if (def.source && def.selector && block.originalContent) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(block.originalContent, 'text/html');
          const el = doc.querySelector(def.selector);
          if (el) {
            let extracted = null;
            if (def.source === 'text') extracted = el.textContent;
            else if (def.source === 'html') extracted = el.innerHTML;
            else if (def.source === 'attribute' && def.attribute) extracted = el.getAttribute(def.attribute);

            if (extracted !== null && extracted !== undefined) {
              restoredAttrs[attrName] = extracted;
              restoredKeys.push({ key: attrName, type: 'source', value: extracted });
            }
          }
        } catch (e) {
          // Ignore DOM parsing errors
        }
      }
    }

    // 2. Recursively check inner blocks if any
    let candidateInnerBlocks = block.innerBlocks || [];
    let innerBlocksRepaired = false;

    if (Array.isArray(candidateInnerBlocks) && candidateInnerBlocks.length > 0) {
      candidateInnerBlocks = candidateInnerBlocks.map(child => {
        if (child.isValid === false) {
          const childAnalysis = analyzeBlockRepair(child);
          if (childAnalysis.canRepair && childAnalysis.candidateBlock) {
            innerBlocksRepaired = true;
            return childAnalysis.candidateBlock;
          }
        }
        return child;
      });
    }

    if (restoredKeys.length === 0 && !innerBlocksRepaired) {
      return {
        canRepair: false,
        reason: 'No missing default attributes detected in registered schema',
        block,
        candidateBlock: null,
        restoredKeys: []
      };
    }

    // 3. Create candidate block
    let candidateBlock = null;
    try {
      candidateBlock = wp.blocks.createBlock(blockName, restoredAttrs, candidateInnerBlocks);
    } catch (err) {
      return {
        canRepair: false,
        reason: 'Could not construct candidate block: ' + err.message,
        block,
        candidateBlock: null,
        restoredKeys: []
      };
    }

    // 4. Validate Candidate Block with Gutenberg validation mechanisms
    let isValidCandidate = false;

    // Test 1: Serialize candidate and re-parse with Gutenberg's official block parser
    try {
      const serialized = wp.blocks.serialize([candidateBlock]);
      const parsed = wp.blocks.parse(serialized);
      if (parsed && parsed[0] && parsed[0].isValid !== false) {
        isValidCandidate = true;
      }
    } catch (e) {
      // Fallback to next test
    }

    // Test 2: HTML save match against originalContent
    if (!isValidCandidate && typeof blockType.save === 'function' && block.originalContent) {
      try {
        const genHtml = wp.blocks.getBlockContent(candidateBlock);
        if (normalizeHtml(genHtml) === normalizeHtml(block.originalContent)) {
          isValidCandidate = true;
        }
      } catch (e) {
        // Fallback to next test
      }
    }

    // Test 3: Dynamic blocks where save() returns null
    if (!isValidCandidate && typeof blockType.save === 'function') {
      try {
        const testEl = blockType.save({ attributes: restoredAttrs });
        if (testEl === null && restoredKeys.length > 0) {
          isValidCandidate = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!isValidCandidate) {
      return {
        canRepair: false,
        reason: 'Restored attributes did not satisfy Gutenberg block validation',
        block,
        candidateBlock: null,
        restoredKeys
      };
    }

    return {
      canRepair: true,
      candidateBlock,
      restoredKeys,
      block
    };
  }

  /**
   * Group invalid blocks by block type for clean summary display.
   *
   * @param {Array} invalidBlocks
   * @return {Array} Grouped analysis.
   */
  function groupFindings(invalidBlocks) {
    const groups = {};

    for (const block of invalidBlocks) {
      const name = block.name || 'unknown';
      const blockType = wp.blocks.getBlockType(name);
      const title = (blockType && blockType.title) ? blockType.title : name;

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

      const analysis = analyzeBlockRepair(block);

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

  function waitForEditorReady(onReady) {
    let executed = false;
    let pollCount = 0;

    const check = () => {
      if (executed) return true;
      pollCount++;

      const editorSelect = wp.data.select('core/editor');
      const blockEditorSelect = wp.data.select('core/block-editor');

      const isEditorReady = editorSelect && typeof editorSelect.__unstableIsEditorReady === 'function'
        ? editorSelect.__unstableIsEditorReady()
        : true;

      const blocks = blockEditorSelect && typeof blockEditorSelect.getBlocks === 'function'
        ? blockEditorSelect.getBlocks()
        : null;

      // Ensure blocks array is populated or waited long enough for empty post
      const isReadyToScan = isEditorReady && Array.isArray(blocks) && (blocks.length > 0 || pollCount >= 12);

      if (isReadyToScan) {
        executed = true;
        setTimeout(onReady, 400);
        return true;
      }
      return false;
    };

    if (check()) return;

    const unsubscribe = wp.data.subscribe(() => {
      if (check()) {
        unsubscribe();
      }
    });

    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        try { unsubscribe(); } catch (e) { }
      }
    }, 250);
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
            <p style="margin: 0; font-size: 13.5px; color: #64748b;">Applying conservative schema defaults and re-verifying block validity in Gutenberg...</p>
          </div>
        `;
      } else if (currentMode === 'results' && repairResults) {
        bodyHtml = `
          <div class="ts-recovery-banner ${repairResults.allResolved ? 'success' : 'warning'}">
            <span class="ts-recovery-banner-icon">${repairResults.allResolved ? '🎉' : '⚠️'}</span>
            <div class="ts-recovery-banner-text">
              <div class="ts-recovery-banner-title">${repairResults.allResolved ? 'Block Recovery Completed Successfully!' : 'Partial Block Recovery Completed'}</div>
              <div>${repairResults.allResolved
            ? `All ${repairResults.repairedCount} affected blocks were repaired and confirmed valid in the Gutenberg editor.`
            : `${repairResults.repairedCount} blocks repaired. ${repairResults.failedCount} blocks could not be safely repaired automatically.`}</div>
            </div>
          </div>

          ${!repairResults.allResolved && repairResults.unresolvedItems && repairResults.unresolvedItems.length > 0 ? `
            <div class="ts-recovery-section-title">Unresolved Blocks Summary</div>
            <div class="ts-recovery-card-list">
              ${repairResults.unresolvedItems.map(un => `
                <div class="ts-recovery-block-row">
                  <span style="font-weight: 600;">${escapeHtml(un.title)}</span>
                  <span class="ts-recovery-pill unresolved">${escapeHtml(un.reason)}</span>
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
      let repairedCount = 0;
      let failedCount = 0;
      const unresolvedItems = [];

      for (const group of findings) {
        for (const item of group.items) {
          if (item.canRepair && item.candidateBlock && blockEditorDispatch) {
            try {
              blockEditorDispatch.replaceBlock(item.block.clientId, item.candidateBlock);

              const updatedBlock = wp.data.select('core/block-editor').getBlock(item.candidateBlock.clientId);
              if (updatedBlock && updatedBlock.isValid !== false) {
                repairedCount++;
              } else {
                failedCount++;
                unresolvedItems.push({
                  title: group.title,
                  name: group.name,
                  reason: 'Editor state verification failed after replacement'
                });
              }
            } catch (err) {
              failedCount++;
              unresolvedItems.push({
                title: group.title,
                name: group.name,
                reason: err.message || 'Replacement failed'
              });
            }
          } else {
            failedCount++;
            unresolvedItems.push({
              title: group.title,
              name: group.name,
              reason: item.reason || 'Unresolved block schema'
            });
          }
        }
      }

      const allResolved = (failedCount === 0 && repairedCount > 0);
      let cleared = false;

      if (allResolved) {
        cleared = await clearRecoveryMetadataOnServer();
        if (wp.data.dispatch('core/notices')) {
          wp.data.dispatch('core/notices').createSuccessNotice(
            '✨ TranslateSense: All affected blocks recovered and verified successfully!',
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

      const blockEditorSelect = wp.data.select('core/block-editor');
      const blocks = blockEditorSelect ? blockEditorSelect.getBlocks() : [];
      const invalid = scanInvalidBlocks(blocks);

      setIsScanning(false);

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

      const grouped = groupFindings(invalid);
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

  waitForEditorReady(async () => {
    if (initialScanPerformed) return;
    initialScanPerformed = true;

    const blockEditorSelect = wp.data.select('core/block-editor');
    const blocks = blockEditorSelect ? blockEditorSelect.getBlocks() : [];

    if (!Array.isArray(blocks) || blocks.length === 0) {
      // Do not clear metadata if blocks have not arrived yet
      return;
    }

    const invalid = scanInvalidBlocks(blocks);

    if (invalid.length === 0) {
      // All blocks are genuinely valid in loaded post -> clear recovery flag
      await clearRecoveryMetadataOnServer();
      return;
    }

    const grouped = groupFindings(invalid);

    // If invalid blocks exist and prompt not dismissed in this session, show modal
    if (!sessionPromptDismissed) {
      showRecoveryModal(grouped, (allResolved) => {
        if (allResolved && typeof refreshSidebarPanelFn === 'function') {
          refreshSidebarPanelFn();
        }
      });
    }
  });

})(window, document, window.wp);
