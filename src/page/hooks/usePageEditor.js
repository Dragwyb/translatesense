import { useEffect, useCallback } from '@wordpress/element';

/**
 * Hook to manage page editor environment integrations (Gutenberg, Elementor, Classic)
 */
export function usePageEditor({ onOpenProviderModal, onShowInitialPrompt }) {
  const config =
    (typeof window !== 'undefined' && window.TranslateSenseEditorData) || {};

  const editorType = config.editorType || 'classic';
  const sourcePostId = config.sourcePostId || 0;
  const fromPost = config.fromPost || 0;
  const showInitialPromptModal = Boolean(config.showInitialPromptModal);

  // Initial prompt modal on page load
  useEffect(() => {
    if (!showInitialPromptModal) return;
    if (sourcePostId > 0 || fromPost > 0) {
      const timer = setTimeout(() => {
        if (onShowInitialPrompt) {
          onShowInitialPrompt();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showInitialPromptModal, sourcePostId, fromPost, onShowInitialPrompt]);

  // Elementor integration: inject button into control footer panel
  useEffect(() => {
    if (editorType !== 'elementor' || typeof window === 'undefined') return;

    const injectElementorButton = () => {
      if (document.getElementById('ts-elementor-translate-btn')) return;

      const elementorBtnGroup = document.querySelector(
        '.MuiButtonGroup-root.MuiButtonGroup-contained'
      );
      if (!elementorBtnGroup) return;

      const btnContainer = elementorBtnGroup.closest('.MuiGrid-root');
      if (!btnContainer) return;

      const translateBtn = document.createElement('button');
      translateBtn.id = 'ts-elementor-translate-btn';
      translateBtn.className =
        'elementor-button elementor-button-default ts-open-translate-btn';
      translateBtn.style.cssText =
        'width: 100%; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #fff; font-weight: 600; margin-bottom: 8px;';
      translateBtn.innerText = 'Translate Page';

      btnContainer.prepend(translateBtn);
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
  }, [editorType]);

  // Universal click listener for all translate buttons
  useEffect(() => {
    const handleTriggerClick = (e) => {
      const trigger = e.target.closest(
        '.ts-open-translate-btn, #ts-metabox-translate-btn, #ts-media-translate-btn, #ts-elementor-translate-btn, #ts-classic-translate-btn'
      );
      if (!trigger) return;
      e.preventDefault();

      if (onOpenProviderModal) {
        onOpenProviderModal();
      }
    };

    document.addEventListener('click', handleTriggerClick);
    return () => document.removeEventListener('click', handleTriggerClick);
  }, [onOpenProviderModal]);

  const markButtonsApplied = useCallback(() => {
    const metaBoxBtn = document.getElementById('ts-metabox-translate-btn');
    if (metaBoxBtn) {
      const metaContent =
        metaBoxBtn.closest('.translatesense-metabox-content') || metaBoxBtn.parentElement;
      if (metaContent) {
        metaContent.innerText = 'Translations Applied';
        metaContent.className = 'disabled';
      }
    }

    const mediaBtn = document.getElementById('ts-media-translate-btn');
    if (mediaBtn) {
      mediaBtn.innerText = 'Translations Applied';
      mediaBtn.className = 'disabled';
    }
  }, []);

  return {
    editorType,
    config,
    markButtonsApplied,
  };
}

