/**
 * PageApp Component
 * Root component for Universal Page Editor Application (Gutenberg, Elementor, Classic)
 * Coordinates modals inside a single root ts-modal-overlay when any modal is open.
 */

import { useCallback } from '@wordpress/element';
import { usePageTranslation } from './hooks/usePageTranslation';
import { usePageEditor } from './hooks/usePageEditor';
import { SourcePrompt } from './components/SourcePrompt';
import { ProviderModal } from './components/ProviderModal';
import { ReviewModal } from './components/ReviewModal';
import { ErrorModal } from '../components/ErrorModal';
import { dismissInitialPrompt } from '../services/api/promptService';

export function PageApp() {
  const config =
    (typeof window !== 'undefined' && window.TranslateSenseEditorData) || {};

  const translation = usePageTranslation(config);

  const handleOpenProvider = useCallback(() => {
    const currentPostId =
      config.postId ||
      (typeof window !== 'undefined' &&
        window.TranslateSenseEditorData &&
        window.TranslateSenseEditorData.postId);
    if (currentPostId) {
      dismissInitialPrompt(currentPostId);
    }
    translation.loadProviders();
    translation.setIsProviderModalOpen(true);
  }, [translation, config.postId]);

  const handleShowInitialPrompt = useCallback(() => {
    if (
      translation.isProviderModalOpen ||
      translation.isReviewModalOpen ||
      translation.progress?.isOpen
    ) {
      return;
    }
    if (null === translation.isSourcePromptOpen) {
      translation.setIsSourcePromptOpen(true);
    }
  }, [translation]);

  const { markButtonsApplied } = usePageEditor({
    onOpenProviderModal: handleOpenProvider,
    onShowInitialPrompt: handleShowInitialPrompt,
    translation
  });

  const handleStartTranslation = async () => {
    translation.setIsProviderModalOpen(false);
    await translation.extractAndTranslate(translation.selectedProvider);
  };

  const handleApplyToPage = async () => {
    const res = await translation.applyTranslationsToPage();
    markButtonsApplied();
    return res;
  };

  const handleUpdateTranslation = (index, newVal) => {
    translation.setStrings((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        const hasVal = Boolean(newVal !== null && newVal !== undefined && String(newVal).trim() !== '');
        updated[index] = {
          ...updated[index],
          translated: newVal,
          status: hasVal ? 'Custom' : 'Pending',
        };
      }
      return updated;
    });
  };

  const handleResetTranslation = (index) => {
    translation.setStrings((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        const provVal = updated[index].providerTranslated || '';
        const hasVal = Boolean(provVal && String(provVal).trim() !== '');
        updated[index] = {
          ...updated[index],
          translated: provVal,
          status: hasVal ? 'Completed' : 'Pending',
        };
      }
      return updated;
    });
  };

  const selectedProviderObj = translation.providers.find(
    (p) => p.id === translation.selectedProvider
  );
  const providerTitle = selectedProviderObj?.title || 'AI Provider';
  const allLanguages = Object.values(config.languages || {});

  const isAnyModalOpen = Boolean(
    (translation.errorModal && translation.errorModal.isOpen) ||
    (translation.progress && translation.progress.isOpen) ||
    translation.isReviewModalOpen ||
    translation.isProviderModalOpen ||
    translation.isSourcePromptOpen
  );

  const handleOverlayClick = (e) => {
    if (e.target !== e.currentTarget) return;

    if (translation.errorModal?.isOpen) {
      translation.setErrorModal({
        isOpen: false,
        title: '',
        message: '',
        errorObj: null,
        reasonHTML: '',
      });
      return;
    }
    if (translation.progress?.isOpen) {
      return; // Do not close while translation is actively processing
    }
    if (translation.isReviewModalOpen) {
      translation.setIsReviewModalOpen(false);
      return;
    }
    if (translation.isProviderModalOpen) {
      translation.setIsProviderModalOpen(false);
      return;
    }
    if (translation.isSourcePromptOpen) {
      const currentPostId =
        config.postId ||
        (typeof window !== 'undefined' &&
          window.TranslateSenseEditorData &&
          window.TranslateSenseEditorData.postId);
      if (currentPostId) {
        dismissInitialPrompt(currentPostId);
      }
      translation.setIsSourcePromptOpen(false);
      return;
    }
  };

  return (
    <div className="translatesense-page-app">
      {isAnyModalOpen && (
        <div
          className="ts-modal-overlay"
          onClick={handleOverlayClick}
          role="presentation"
        >
          {/* 1. Error Modal (highest priority) */}
          {translation.errorModal?.isOpen ? (
            <ErrorModal
              isOpen={true}
              title={translation.errorModal.title}
              message={translation.errorModal.message}
              reasonHTML={translation.errorModal.reasonHTML}
              icon={translation.errorModal.icon}
              onClose={() =>
                translation.setErrorModal({
                  isOpen: false,
                  title: '',
                  message: '',
                  errorObj: null,
                  reasonHTML: '',
                })
              }
            />
          ) : translation.isReviewModalOpen ? (
            /* 3. String Review Modal */
            <>
              <ReviewModal
                isOpen={true}
                onClose={() => translation.setIsReviewModalOpen(false)}
                strings={translation.strings}
                translationStats={translation.translationStats}
                onUpdateTranslation={handleUpdateTranslation}
                onResetTranslation={handleResetTranslation}
                isExtracting={translation.progress.isExtracting}
                progressIsOpen={translation.progress?.isOpen}
                progressPercent={translation.progress.percent}
                progressStatus={translation.progress.status}
                progressSubText={translation.progress.subText}
                progressTargetLang={translation.targetLang}
                progressLanguages={allLanguages}
                progressProviderTitle={providerTitle}
                isCustomFieldsSyncEnabled={translation.isCustomFieldsSyncEnabled}
                skippedCustomFieldsCount={translation.skippedCustomFieldsCount}
                showReTranslateAll={translation.showReTranslateAll}
                isRetrying={translation.isRetrying}
                isTranslationComplete={translation.isTranslationComplete}
                hideReviewNotice={translation.hideReviewNotice}
                onDismissReviewNotice={translation.handleDismissReviewNotice}
                onReTranslateAll={translation.retranslateFailed}
                onApply={handleApplyToPage}
              />
            </>
          ) : translation.isProviderModalOpen ? (
            /* 4. Provider Selection Modal */
            <ProviderModal
              isOpen={true}
              onClose={() => translation.setIsProviderModalOpen(false)}
              providers={translation.providers}
              selectedProvider={translation.selectedProvider}
              onSelectProvider={translation.setSelectedProvider}
              onStartTranslation={handleStartTranslation}
              onViewError={(p) =>
                translation.setErrorModal({
                  isOpen: true,
                  title: `${p.title} Notice`,
                  message: '',
                  reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
                  icon: p.logo,
                })
              }
            />
          ) : translation.isSourcePromptOpen ? (
            /* 5. Initial Page Load Guidance Modal */
            <SourcePrompt
              isOpen={true}
              onClose={() => {
                const currentPostId =
                  config.postId ||
                  (typeof window !== 'undefined' &&
                    window.TranslateSenseEditorData &&
                    window.TranslateSenseEditorData.postId);
                if (currentPostId) {
                  dismissInitialPrompt(currentPostId);
                }
                translation.setIsSourcePromptOpen(false);
              }}
              onConfirm={() => {
                const currentPostId =
                  config.postId ||
                  (typeof window !== 'undefined' &&
                    window.TranslateSenseEditorData &&
                    window.TranslateSenseEditorData.postId);
                if (currentPostId) {
                  dismissInitialPrompt(currentPostId);
                }
                translation.setIsSourcePromptOpen(false);
                handleOpenProvider();
              }}
              sourceLanguage={translation.sourceLang}
              targetLanguage={translation.targetLang}
              languages={allLanguages}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
