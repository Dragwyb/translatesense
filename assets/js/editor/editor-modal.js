/**
 * TranslateSense - Editor Mismatch Guidance Modal & Elementor Integration
 * File: assets/js/editor/editorModal.js
 *
 * Displayed in Gutenberg and Classic Editor when the source page was created in Elementor.
 * Skips loading heavy universal page editor translation assets and guides the user
 * to open the page in Elementor to start translation using Elementor's native editor trigger.
 */

(function (window, document) {
  'use strict';

  var data = window.TranslateSenseEditorModalData || window.TranslateSenseEditorData || window.translatesenseData || {};
  if (!window.translatesenseData && Object.keys(data).length > 0) {
    window.translatesenseData = data;
  }

  var postId = parseInt(data.postId, 10) || 0;
  var sourcePostId = parseInt(data.sourcePostId, 10) || 0;
  var pluginUrl = data.pluginUrl || '';
  var showInitialModal = Boolean(data.showInitialPromptModal);

  var languages = data.languages || {};
  var languagesList = Array.isArray(languages) ? languages : Object.values(languages);

  var STORAGE_KEY = 'translateSenseEditorOpen';
  var EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  function getEditorOpenKey(sourceId, targetLang) {
    var id = parseInt(sourceId, 10);
    if (!id || !targetLang) return '';
    return id + '_' + String(targetLang).trim().toLowerCase();
  }

  function setEditorOpenFlag(sourceId, targetLang) {
    var itemKey = getEditorOpenKey(sourceId, targetLang);
    if (!itemKey) return;

    try {
      var now = Date.now();
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var store = {};
      if (raw) {
        try {
          store = JSON.parse(raw) || {};
        } catch (e) {
          store = {};
        }
      }

      var cleaned = {};
      for (var k in store) {
        if (Object.prototype.hasOwnProperty.call(store, k)) {
          var item = store[k];
          var itemExpiry = item && item.expiresAt;
          if (itemExpiry && itemExpiry > now) {
            cleaned[k] = item;
          }
        }
      }

      cleaned[itemKey] = {
        sourcePostId: parseInt(sourceId, 10),
        targetLanguage: String(targetLang).trim().toLowerCase(),
        expiresAt: now + EXPIRY_MS,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch (e) {
      console.warn('[TranslateSense] Could not set editor open flag in localStorage:', e);
    }
  }

  function removeEditorOpenFlag(sourceId, targetLang) {
    var itemKey = getEditorOpenKey(sourceId, targetLang);
    if (!itemKey) return;

    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      var store = {};
      try {
        store = JSON.parse(raw) || {};
      } catch (e) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      delete store[itemKey];

      var now = Date.now();
      var cleaned = {};
      for (var k in store) {
        if (Object.prototype.hasOwnProperty.call(store, k)) {
          var item = store[k];
          var itemExpiry = item && item.expiresAt;
          if (itemExpiry && itemExpiry > now) {
            cleaned[k] = item;
          }
        }
      }

      if (Object.keys(cleaned).length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) { }
  }

  function getLangDisplay(code) {
    if (!code) return '';
    var found = languagesList.find(function (l) {
      return (l.slug && l.slug.toLowerCase() === String(code).toLowerCase()) ||
        (l.code && l.code.toLowerCase() === String(code).toLowerCase());
    });
    if (found) {
      return found.name || String(found.slug).toUpperCase();
    }
    return String(code).toUpperCase();
  }

  function getLangFlag(code) {
    if (!code) return '';
    var found = languagesList.find(function (l) {
      return (l.slug && l.slug.toLowerCase() === String(code).toLowerCase()) ||
        (l.code && l.code.toLowerCase() === String(code).toLowerCase());
    });
    return (found && found.flag) ? found.flag : '';
  }

  var sourceLangName = getLangDisplay(data.sourceLanguage);
  var targetLangName = getLangDisplay(data.targetLanguage);
  var sourceFlag = getLangFlag(data.sourceLanguage);
  var targetFlag = getLangFlag(data.targetLanguage);

  var modalOverlay = null;

  var TranslateSenseEditorModal = {
    _translateSenseElementorBound: false,
    _isNavigatingToElementor: false,

    /**
     * Binds click interception to Elementor's native editor button.
     * Supports both #elementor-edit-mode-button and #elementor-editor-button.
     */
    bindTranslateSenseElementorEditor: function () {
      var elementorButton = document.querySelector(
        '#elementor-edit-mode-button, #elementor-editor-button'
      );

      if (!elementorButton || this._translateSenseElementorBound) {
        return;
      }

      this._translateSenseElementorBound = true;
      var self = this;

      elementorButton.addEventListener('click', function (event) {
        var config = window.translatesenseData || window.TranslateSenseEditorModalData || window.TranslateSenseEditorData || {};
        var currentEditor = config.editorType || config.currentEditorType || 'classic';

        // For Gutenberg or other editors, preserve Elementor's native behavior without intercepting
        if (currentEditor !== 'classic') {
          return;
        }

        // Prevent duplicate concurrent saves or redirects
        if (self._isNavigatingToElementor) {
          event.preventDefault();
          return;
        }

        var titleField = document.querySelector('#title');
        var postIdInput = document.querySelector('#post_ID');
        var currentPostId = (postIdInput && postIdInput.value) || config.postId || postId || '';

        // Check if page title field is empty; if empty, set default Elementor title
        if (titleField && !titleField.value.trim()) {
          titleField.value = 'Elementor #' + (currentPostId || '');

          if (window.jQuery) {
            window.jQuery(titleField).trigger('input').trigger('change');
          }
        }

        var elementorAdmin = window.elementorAdmin;

        if (
          !window.wp ||
          !window.wp.autosave ||
          !window.wp.autosave.server ||
          !window.wp.autosave.server.triggerSave ||
          !elementorAdmin ||
          !elementorAdmin.getDefaultElements
        ) {
          return;
        }

        var defaultElements = elementorAdmin.getDefaultElements();
        var $goToEditLink = defaultElements && defaultElements.$goToEditLink;

        if (!$goToEditLink || !$goToEditLink.length) {
          return;
        }

        event.preventDefault();
        self._isNavigatingToElementor = true;

        var $document = window.jQuery ? window.jQuery(document) : null;
        var timeoutId = null;

        function cleanup() {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if ($document) {
            $document.off('heartbeat-tick.translatesenseElementor');
            $document.off('heartbeat-connection-lost.translatesenseElementor');
          }
        }

        function handleAutosaveError(errMsg) {
          cleanup();
          self._isNavigatingToElementor = false;

          // Remove editor open flag since navigation aborted/failed
          var effectiveSourceId = sourcePostId || postId;
          var effectiveTargetLang = data.targetLanguage || '';
          if (effectiveSourceId && effectiveTargetLang) {
            removeEditorOpenFlag(effectiveSourceId, effectiveTargetLang);
          }

          var translateBtn = document.querySelector('#ts-editor-modal-translate-btn');
          if (translateBtn) {
            translateBtn.disabled = false;
            translateBtn.innerHTML =
              '<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1; vertical-align: middle; margin-right: 4px;"></span>' +
              '<span>Translate in Elementor &rarr;</span>';
          }

          console.error('TranslateSense: Autosave failed before Elementor navigation.', errMsg || '');
        }

        var handleTranslateSenseAutosave = function (e, tickData) {
          // Do not assume that any heartbeat event means autosave succeeded.
          // Verify that wp_autosave response exists and succeeded.
          if (tickData && typeof tickData.wp_autosave !== 'undefined') {
            if (tickData.wp_autosave && tickData.wp_autosave.success) {
              cleanup();

              if (window.elementorCommon && window.elementorCommon.elements && window.elementorCommon.elements.$window) {
                window.elementorCommon.elements.$window.off('beforeunload.edit-post');
              }

              var targetUrl = $goToEditLink.attr('href');
              if (targetUrl) {
                window.location.href = targetUrl;
              }
            } else {
              handleAutosaveError('Autosave returned unsuccessful');
            }
          }
        };

        if ($document) {
          $document.on(
            'heartbeat-tick.translatesenseElementor',
            handleTranslateSenseAutosave
          );

          $document.one(
            'heartbeat-connection-lost.translatesenseElementor',
            function () {
              handleAutosaveError('Heartbeat connection lost');
            }
          );
        }

        // Safety timeout (15s) to avoid hanging if heartbeat stops responding
        timeoutId = setTimeout(function () {
          handleAutosaveError('Autosave request timed out');
        }, 15000);

        window.wp.autosave.server.triggerSave();
      });
    },

    open: openModal,
    close: closeModal,
  };

  function createModalDOM() {
    if (modalOverlay) return modalOverlay;

    var portalRoot = document.getElementById('translatesense-editor-portal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'translatesense-editor-portal-root';
      document.body.appendChild(portalRoot);
    }

    var logoSrc = pluginUrl ? (pluginUrl.replace(/\/+$/, '') + '/assets/img/logo.png') : '';

    var overlay = document.createElement('div');
    overlay.className = 'ts-modal-overlay';
    overlay.id = 'ts-editor-mismatch-modal-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML =
      '<div class="ts-modal-container" style="max-width: 580px;" role="dialog" aria-modal="true">' +
      '<!-- Header -->' +
      '<div class="ts-modal-header ts-common-header">' +
      '<div class="ts-header-title-group">' +
      '<div class="ts-header-icon-box">' +
      (logoSrc
        ? '<img src="' + logoSrc + '" alt="TranslateSense" class="ts-header-icon-img" />'
        : '<span class="dashicons dashicons-translation" style="font-size: 22px; width: 22px; height: 22px; color: #2563eb;"></span>') +
      '</div>' +
      '<div class="ts-header-text-wrap">' +
      '<h2 class="ts-modal-title ts-common-title">Translate Page Content</h2>' +
      '<p class="ts-modal-subtitle ts-common-subtitle">Elementor Page Translation</p>' +
      '</div>' +
      '</div>' +
      '<button type="button" class="ts-modal-close-btn ts-bulk-close" id="ts-editor-modal-x-btn" aria-label="Close modal" title="Close modal">&times;</button>' +
      '</div>' +

      '<!-- Body -->' +
      '<div class="ts-modal-body ts-common-body">' +
      '<div class="ts-source-guidance-content">' +
      '<div class="ts-modal-notice-banner info" style="margin-bottom: 16px;">' +
      '<span class="ts-notice-icon" aria-hidden="true">&#9889;</span>' +
      '<div class="ts-notice-text">' +
      '<strong class="ts-notice-title">Created in Elementor</strong>' +
      '<span class="ts-notice-desc" style="display: block; font-size: 13.5px; line-height: 1.5; color: #1e40af; margin-top: 4px;">' +
      'This page was created in Elementor. Click Translate to open this page in the Elementor editor to start translation, or click Close to skip.' +
      '</span>' +
      '</div>' +
      '</div>' +

      (data.sourceLanguage || data.targetLanguage
        ? '<div class="ts-lang-info-banner" style="margin-bottom: 0;">' +
        '<span class="ts-info-icon" aria-hidden="true">&#8505;</span>' +
        '<span>' +
        'Translating from <strong>' + (sourceFlag ? '<img src="' + sourceFlag + '" style="width: 15px; vertical-align: middle; margin-right: 3px;" /> ' : '') + sourceLangName + '</strong> (Elementor) &rarr; ' +
        'Target: <strong>' + (targetFlag ? '<img src="' + targetFlag + '" style="width: 15px; vertical-align: middle; margin-right: 3px;" /> ' : '') + targetLangName + '</strong>' +
        '</span>' +
        '</div>'
        : '') +
      '</div>' +
      '</div>' +

      '<!-- Footer -->' +
      '<div class="ts-modal-footer ts-common-footer" style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">' +
      '<button type="button" class="ts-btn ts-btn-secondary" id="ts-editor-modal-skip-btn">Close</button>' +
      '<button type="button" class="ts-btn ts-btn-primary" id="ts-editor-modal-translate-btn">' +
      '<span class="dashicons dashicons-translation" style="font-size: 16px; width: 16px; height: 16px; line-height: 1; vertical-align: middle; margin-right: 4px;"></span>' +
      '<span>Translate in Elementor &rarr;</span>' +
      '</button>' +
      '</div>' +
      '</div>';

    portalRoot.appendChild(overlay);
    modalOverlay = overlay;

    // Bind modal actions
    var closeBtn = overlay.querySelector('#ts-editor-modal-skip-btn');
    var xBtn = overlay.querySelector('#ts-editor-modal-x-btn');
    var translateBtn = overlay.querySelector('#ts-editor-modal-translate-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (xBtn) xBtn.addEventListener('click', closeModal);

    if (translateBtn) {
      translateBtn.addEventListener('click', function () {
        // Set localStorage flag so Elementor editor directly opens the provider modal
        var effectiveSourceId = sourcePostId || postId;
        var effectiveTargetLang = data.targetLanguage || '';
        if (effectiveSourceId && effectiveTargetLang) {
          setEditorOpenFlag(effectiveSourceId, effectiveTargetLang);
        }

        // Ensure Elementor button binding is initialized
        TranslateSenseEditorModal.bindTranslateSenseElementorEditor();

        var elementorButton = document.querySelector(
          '#elementor-edit-mode-button, #elementor-editor-button'
        );

        if (elementorButton) {
          translateBtn.disabled = true;
          translateBtn.innerHTML =
            '<span class="ts-spinner-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> Opening Elementor...';

          elementorButton.click();
        } else {
          // Check elementorAdmin native link as direct fallback
          var elementorAdmin = window.elementorAdmin;
          var defaultElements = elementorAdmin && elementorAdmin.getDefaultElements ? elementorAdmin.getDefaultElements() : null;
          var $goToEditLink = defaultElements && defaultElements.$goToEditLink;

          if ($goToEditLink && $goToEditLink.length) {
            translateBtn.disabled = true;
            translateBtn.innerHTML =
              '<span class="ts-spinner-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> Opening Elementor...';

            $goToEditLink[0].click();
          } else {
            console.warn('TranslateSense: Elementor editor button not found on this screen.');
          }
        }
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeModal();
      }
    });

    return overlay;
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeModal();
    }
  }

  function openModal() {
    TranslateSenseEditorModal.bindTranslateSenseElementorEditor();
    var overlay = createModalDOM();
    if (overlay) {
      overlay.style.display = 'flex';
      document.addEventListener('keydown', handleKeyDown);
    }
  }

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.style.display = 'none';
      document.removeEventListener('keydown', handleKeyDown);
    }
  }

  // Universal button trigger listener (for Auto Translate buttons in meta box and classic editor)
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest(
      '.ts-open-translate-btn, #ts-metabox-translate-btn, #ts-media-translate-btn, #ts-classic-translate-btn'
    );
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    }
  });

  // Attempt initial binding
  TranslateSenseEditorModal.bindTranslateSenseElementorEditor();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      TranslateSenseEditorModal.bindTranslateSenseElementorEditor();
    });
  } else {
    // If DOM already loaded, schedule a deferred check in case Gutenberg or Elementor injects button asynchronously
    setTimeout(function () {
      TranslateSenseEditorModal.bindTranslateSenseElementorEditor();
    }, 500);
  }

  // Automatically show initial guidance modal if configured
  if (showInitialModal && (sourcePostId > 0 || postId > 0)) {
    setTimeout(function () {
      openModal();
    }, 800);
  }

  // Expose global controller
  window.TranslateSenseEditorModal = TranslateSenseEditorModal;

})(window, document);
