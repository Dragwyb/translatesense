/**
 * PageApp Component
 * Root component for Universal Page Editor Application (Gutenberg, Elementor, Classic)
 */

import { useCallback } from '@wordpress/element';
import { usePageTranslation } from './hooks/usePageTranslation';
import { usePageEditor } from './hooks/usePageEditor';
import { SourcePrompt } from './components/SourcePrompt';
import { ProviderModal } from './components/ProviderModal';
import { ReviewModal } from './components/ReviewModal';
import { ErrorModal } from '../components/ErrorModal';

export function PageApp() {
  const config =
    (typeof window !== 'undefined' && window.TranslateSenseEditorData) || {};

  const translation = usePageTranslation(config);

  const handleOpenProvider = useCallback(() => {
    translation.loadProviders();
    translation.setIsProviderModalOpen(true);
  }, [translation]);

  const handleShowInitialPrompt = useCallback(() => {
    if (translation.isProviderModalOpen || translation.isReviewModalOpen) return;
    if (null === translation.isSourcePromptOpen) {
      translation.setIsSourcePromptOpen(true);
    }
  }, [translation]);

  const { markButtonsApplied } = usePageEditor({
    onOpenProviderModal: handleOpenProvider,
    onShowInitialPrompt: handleShowInitialPrompt,
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
        updated[index] = {
          ...updated[index],
          translated: newVal,
          status: 'Custom',
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
        updated[index] = {
          ...updated[index],
          translated: provVal,
          status: 'Completed',
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

  return (
    <div className="translatesense-page-app">
      {/* 1. Initial Page Load Guidance Modal */}
      <SourcePrompt
        isOpen={translation.isSourcePromptOpen}
        onClose={() => translation.setIsSourcePromptOpen(false)}
        onConfirm={() => {
          translation.setIsSourcePromptOpen(false);
          handleOpenProvider();
        }}
        sourceLanguage={translation.sourceLang}
        targetLanguage={translation.targetLang}
        languages={allLanguages}
      />

      {/* 2. Provider Selection Modal */}
      {!translation.errorModal || !translation.errorModal.isOpen &&
        <ProviderModal
          isOpen={translation.isProviderModalOpen}
          onClose={() => translation.setIsProviderModalOpen(false)}
          providers={translation.providers}
          selectedProvider={translation.selectedProvider}
          onSelectProvider={translation.setSelectedProvider}
          onStartTranslation={handleStartTranslation}
          onViewError={(p) =>
            translation.setErrorModal({
              isOpen: true,
              title: `${p.title} Notice`,
              message: p.desc,
              reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
            })
          }
        />
      }

      {/* 3. String Review Modal */}
      <ReviewModal
        isOpen={translation.isReviewModalOpen}
        onClose={() => translation.setIsReviewModalOpen(false)}
        strings={translation.strings}
        translationStats={translation.translationStats}
        progress={translation.progress}
        targetLang={translation.targetLang}
        languages={allLanguages}
        providerTitle={providerTitle}
        onUpdateTranslation={handleUpdateTranslation}
        onResetTranslation={handleResetTranslation}
        onReTranslate={() => translation.extractAndTranslate(translation.selectedProvider)}
        onApply={handleApplyToPage}
      />

      {/* 4. Error Modal */}
      <ErrorModal
        isOpen={translation.errorModal.isOpen}
        title={translation.errorModal.title}
        message={translation.errorModal.message}
        reasonHTML={translation.errorModal.reasonHTML}
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
    </div>
  );
}

