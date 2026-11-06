import { useEffect, useCallback, useRef } from '@wordpress/element';
import { checkAndConsumeEditorOpenFlag } from '../../utils/editorStorage';
import { dismissInitialPrompt } from '../../services/api/promptService';

const ALL_TRANSLATE_BUTTON_SELECTORS =
  '.ts-open-translate-btn, #ts-metabox-translate-btn, #ts-media-translate-btn, #ts-elementor-translate-btn, #ts-classic-translate-btn';

/**
 * Disables a translate trigger button element and updates its UI to applied/translated state.
 *
 * @param {HTMLButtonElement|HTMLElement} button
 */
function disableTranslateButton(button) {
  if (!button) return;

  button.disabled = true;
  button.setAttribute('disabled', 'disabled');
  button.setAttribute('aria-disabled', 'true');
  button.classList.add('disabled', 'ts-btn-disabled');
  button.classList.remove('ts-btn-loading', 'is-loading');

  const appliedText =
    typeof window !== 'undefined' &&
      window.wp &&
      window.wp.i18n &&
      typeof window.wp.i18n.__ === 'function'
      ? window.wp.i18n.__('Translations Applied', 'translatesense')
      : 'Translations Applied';

  button.innerHTML = `<span class="dashicons dashicons-yes-alt" style="margin-right: 5px; vertical-align: middle;"></span>${appliedText}`;
  button.title = appliedText;
}

/**
 * Checks whether a trigger button is disabled or translations have been applied.
 *
 * @param {HTMLElement} trigger
 * @param {boolean} isApplied
 * @return {boolean}
 */
function isButtonDisabled(trigger, isApplied) {
  if (isApplied) return true;
  if (!trigger) return false;
  return Boolean(
    trigger.disabled ||
    trigger.getAttribute('disabled') !== null ||
    trigger.getAttribute('aria-disabled') === 'true' ||
    trigger.classList.contains('disabled') ||
    trigger.classList.contains('ts-btn-disabled')
  );
}

/**
 * Hook to manage page editor environment integrations (Gutenberg, Elementor, Classic)
 */
export function usePageEditor({ onOpenProviderModal, onShowInitialPrompt, translation }) {
  const config =
    (typeof window !== 'undefined' && window.TranslateSenseEditorData) || {};

  const editorType = config.editorType || 'classic';
  const sourcePostId = config.sourcePostId || 0;
  const fromPost = config.fromPost || 0;
  const showInitialPromptModal = Boolean(config.showInitialPromptModal);

  const hasCheckedEditorOpenRef = useRef(false);
  const isDirectlyOpeningProviderRef = useRef(false);
  const isAppliedRef = useRef(false);

  // Initial prompt modal or direct provider modal on page load
  useEffect(() => {
    const effectiveSourceId = sourcePostId || fromPost;
    if (effectiveSourceId <= 0) return;

    // In Elementor editor: check if coming from editorModal.js translate button click
    if (editorType === 'elementor' && !hasCheckedEditorOpenRef.current) {
      hasCheckedEditorOpenRef.current = true;
      const shouldDirectlyOpen = checkAndConsumeEditorOpenFlag(
        effectiveSourceId,
        config.targetLanguage
      );
      if (shouldDirectlyOpen) {
        isDirectlyOpeningProviderRef.current = true;
      }
    }

    // If flagged from editorModal.js, open Provider modal directly without showing SourcePrompt
    if (isDirectlyOpeningProviderRef.current) {
      const timer = setTimeout(() => {
        if (onOpenProviderModal) {
          const currentPostId =
            config.postId ||
            (typeof window !== 'undefined' &&
              window.TranslateSenseEditorData &&
              window.TranslateSenseEditorData.postId);
          if (currentPostId) {
            dismissInitialPrompt(currentPostId);
          }
          onOpenProviderModal();
          translation.setIsSourcePromptOpen(false);
          isDirectlyOpeningProviderRef.current = false;
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    if (!showInitialPromptModal) return;

    const timer = setTimeout(() => {
      if (onShowInitialPrompt) {
        onShowInitialPrompt();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [
    showInitialPromptModal,
    sourcePostId,
    fromPost,
    editorType,
    config.targetLanguage,
    onOpenProviderModal,
    onShowInitialPrompt,
  ]);

  // Mark all editor translate buttons as applied / disabled
  const markButtonsApplied = useCallback(() => {
    isAppliedRef.current = true;

    // 1. Disable all buttons matching universal selectors across any editor
    const buttons = document.querySelectorAll(ALL_TRANSLATE_BUTTON_SELECTORS);
    buttons.forEach((btn) => {
      disableTranslateButton(btn);
    });

    // 2. Elementor-specific button
    const elementorBtn = document.getElementById('ts-elementor-translate-btn');
    if (elementorBtn) {
      disableTranslateButton(elementorBtn);
    }

    // 3. Gutenberg & Classic Meta box button and container
    const metaBoxBtn = document.getElementById('ts-metabox-translate-btn');
    if (metaBoxBtn) {
      disableTranslateButton(metaBoxBtn);
      const metaContent = metaBoxBtn.closest('.translatesense-metabox-content');
      if (metaContent) {
        metaContent.classList.add('ts-applied');
      }
    }

    // 4. Classic Editor media button
    const mediaBtn = document.getElementById('ts-media-translate-btn');
    if (mediaBtn) {
      disableTranslateButton(mediaBtn);
    }
  }, []);

  // Elementor integration: inject button into control footer panel
  useEffect(() => {
    if (editorType !== 'elementor' || typeof window === 'undefined') return;

    const injectElementorButton = () => {
      let translateBtn = document.getElementById('ts-elementor-translate-btn');
      if (!translateBtn) {
        const elementorBtnGroup = document.querySelector(
          '.MuiButtonGroup-root.MuiButtonGroup-contained'
        );
        if (!elementorBtnGroup) return;

        const btnContainer = elementorBtnGroup.closest('.MuiGrid-root');
        if (!btnContainer) return;

        translateBtn = document.createElement('button');
        translateBtn.id = 'ts-elementor-translate-btn';
        translateBtn.className =
          'elementor-button elementor-button-default ts-open-translate-btn';
        translateBtn.innerHTML = '<span class="dashicons dashicons-translation"></span>Auto Translate';

        btnContainer.prepend(translateBtn);
      }

      // If translation was already completed/applied, maintain disabled state
      if (isAppliedRef.current) {
        disableTranslateButton(translateBtn);
      }
    };

    if (window.jQuery) {
      window.jQuery(window).on('elementor:init', () => {
        if (window.elementor) {
          window.elementor.on('document:loaded', injectElementorButton);
        }
      });
    }

    // Try injecting directly if already loaded
    injectElementorButton();

    // Deferred periodic checks in case Elementor panel renders asynchronously
    const interval = setInterval(injectElementorButton, 1000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [editorType]);

  // Universal click listener for all translate buttons
  useEffect(() => {
    const handleTriggerClick = (e) => {
      const trigger = e.target.closest(ALL_TRANSLATE_BUTTON_SELECTORS);
      if (!trigger) return;

      // Prevent click if button is disabled or translations have been applied
      if (isButtonDisabled(trigger, isAppliedRef.current)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();

      const currentPostId =
        config.postId ||
        (typeof window !== 'undefined' &&
          window.TranslateSenseEditorData &&
          window.TranslateSenseEditorData.postId);
      if (currentPostId) {
        dismissInitialPrompt(currentPostId);
      }

      if (onOpenProviderModal) {
        onOpenProviderModal();
      }
    };

    document.addEventListener('click', handleTriggerClick, true);
    return () => document.removeEventListener('click', handleTriggerClick, true);
  }, [onOpenProviderModal, config.postId]);

  return {
    editorType,
    config,
    markButtonsApplied,
  };
}
