/**
 * BulkWizard Component
 */

import { useCallback, useState, useEffect } from '@wordpress/element';
import { UnifiedBulkSelection } from './UnifiedBulkSelection';
import { LanguageSelection } from './LanguageSelection';
import { ProviderSelection } from './ProviderSelection';
import { BulkProgressModal } from './BulkProgressModal';
import { SkipConfirmation } from './SkipConfirmation';
import { ErrorModal } from '../../components/ErrorModal';
import { useIsCompact } from '../hooks/useIsCompact';

export function BulkWizard({
  isOpen,
  onClose,
  translationState,
  allLanguages = [],
  itemMeta = {},
}) {
  const {
    currentStep,
    setCurrentStep,
    postIds,
    selectedLanguages,
    setSelectedLanguages,
    selectedProvider,
    setSelectedProvider,
    providers,
    activeBatches,
    currentBatchId,
    setCurrentBatchId,
    postResultsMap,
    orderedPostIds,
    isTranslating,
    isCompleted,
    progressPercent,
    statusText,
    completedJobsCount,
    totalJobsCount,
    formattedTimer,
    humanReadableTimer,
    statsSummary,
    statusFilters,
    setStatusFilters,
    startTranslation,
    skipModal,
    setSkipModal,
    errorModal,
    setErrorModal,
    handleSkipPost,
    pollStatus,
    switchBatch,
    openBatchMonitor,
    progressSessionType,
    progressModalSource,
    isQueueChromeAi,
    hideReviewNotice,
    handleDismissReviewNotice,
  } = translationState;

  // Responsive breakpoint hook: <= 864px uses two-step flow, > 864px uses combined flow
  const isCompact = useIsCompact(864);
  const [compactStep, setCompactStep] = useState(1);

  // Reset compact step when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setCompactStep(1);
    }
  }, [isOpen]);

  const showBackButton =
    progressSessionType === 'existing_queue' &&
    progressModalSource === 'language_selection_view_progress';

  const canSkip = progressSessionType === 'existing_queue';

  const handleModalClose = useCallback(() => {
    setCompactStep(1);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleBackFromProgress = useCallback(() => {
    setCompactStep(1);
    setCurrentStep(1);
  }, [setCurrentStep]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target !== e.currentTarget) return;

    if (skipModal?.isOpen) {
      setSkipModal({ isOpen: false, postId: null, batchId: null });
      return;
    }
    if (errorModal?.isOpen) {
      setErrorModal({ isOpen: false, title: '', message: '', errorObj: null, reasonHTML: '' });
      return;
    }
    if (currentStep === 2 && isTranslating && isQueueChromeAi) {
      return; // Do not close while on-device translation is actively processing
    }
    handleModalClose();
  };

  return (
    <div
      className="ts-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      {/* 1. Skip Confirmation Dialog (highest priority overlay dialog) */}
      {skipModal?.isOpen ? (
        <SkipConfirmation
          isOpen={true}
          postId={skipModal.postId}
          itemMeta={itemMeta}
          onClose={() => setSkipModal({ isOpen: false, postId: null, batchId: null })}
          onConfirm={() => handleSkipPost(skipModal.postId, skipModal.batchId)}
        />
      ) : errorModal?.isOpen ? (
        /* 2. Error Details Modal */
        <ErrorModal
          isOpen={true}
          title={errorModal.title}
          message={errorModal.message}
          reasonHTML={errorModal.reasonHTML}
          icon={errorModal.icon}
          onClose={() =>
            setErrorModal({
              isOpen: false,
              title: '',
              message: '',
              errorObj: null,
              reasonHTML: '',
            })
          }
        />
      ) : currentStep === 1 ? (
        isCompact ? (
          compactStep === 1 ? (
            /* Compact Step 1: Language Selection Modal (<= 864px) */
            <LanguageSelection
              isOpen={true}
              onClose={handleModalClose}
              postIds={postIds}
              itemMeta={itemMeta}
              allLanguages={allLanguages}
              selectedLanguages={selectedLanguages}
              onLanguagesChange={setSelectedLanguages}
              onNext={() => setCompactStep(2)}
              activeBatches={activeBatches}
              onShowRunning={() => {
                const activeBatch = activeBatches && activeBatches[0] ? activeBatches[0] : null;
                if (openBatchMonitor) {
                  openBatchMonitor(
                    activeBatch ? activeBatch.batch_id : null,
                    activeBatch,
                    activeBatches,
                    {
                      sessionType: 'existing_queue',
                      modalSource: 'language_selection_view_progress',
                    }
                  );
                }
              }}
            />
          ) : (
            /* Compact Step 2: Provider Selection Modal (<= 864px) */
            <ProviderSelection
              isOpen={true}
              onClose={handleModalClose}
              postIds={postIds}
              itemMeta={itemMeta}
              allLanguages={allLanguages}
              selectedLanguages={selectedLanguages}
              providers={providers}
              selectedProvider={selectedProvider}
              onSelectProvider={setSelectedProvider}
              onBack={() => setCompactStep(1)}
              onStartTranslation={startTranslation}
              onViewError={(p) =>
                setErrorModal({
                  isOpen: true,
                  title: `${p.title} Notice`,
                  message: '',
                  reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
                  icon: p.logo,
                })
              }
              isTranslating={isTranslating}
            />
          )
        ) : (
          /* Desktop Combined Flow (> 864px) */
          <UnifiedBulkSelection
            isOpen={true}
            onClose={handleModalClose}
            postIds={postIds}
            itemMeta={itemMeta}
            allLanguages={allLanguages}
            selectedLanguages={selectedLanguages}
            onLanguagesChange={setSelectedLanguages}
            providers={providers}
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
            onStartTranslation={startTranslation}
            onViewError={(p) =>
              setErrorModal({
                isOpen: true,
                title: `${p.title} Notice`,
                message: '',
                reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
                icon: p.logo,
              })
            }
            activeBatches={activeBatches}
            onShowRunning={() => {
              const activeBatch = activeBatches && activeBatches[0] ? activeBatches[0] : null;
              if (openBatchMonitor) {
                openBatchMonitor(
                  activeBatch ? activeBatch.batch_id : null,
                  activeBatch,
                  activeBatches,
                  {
                    sessionType: 'existing_queue',
                    modalSource: 'language_selection_view_progress',
                  }
                );
              }
            }}
            isTranslating={isTranslating}
          />
        )
      ) : currentStep === 2 ? (
        /* Progress & Results Modal */
        <BulkProgressModal
          isOpen={true}
          onClose={handleModalClose}
          isTranslating={isTranslating}
          isCompleted={isCompleted}
          statusText={statusText}
          progressPercent={progressPercent}
          completedJobsCount={completedJobsCount}
          totalJobsCount={totalJobsCount}
          formattedTimer={formattedTimer}
          humanReadableTimer={humanReadableTimer}
          statsSummary={statsSummary}
          selectedProvider={selectedProvider}
          isChromeAi={isQueueChromeAi}
          activeBatches={activeBatches}
          currentBatchId={currentBatchId}
          onBatchChange={(id) => {
            if (switchBatch) {
              switchBatch(id);
            } else {
              setCurrentBatchId(id);
              pollStatus(id);
            }
          }}
          orderedPostIds={orderedPostIds}
          postResultsMap={postResultsMap}
          allLanguages={allLanguages}
          selectedFilters={statusFilters}
          onFilterChange={setStatusFilters}
          onSkipPost={(pId, bId) =>
            setSkipModal({ isOpen: true, postId: pId, batchId: bId })
          }
          onErrorDetail={(detail) =>
            setErrorModal({
              isOpen: true,
              title: detail.title,
              message: detail.message,
              errorObj: detail.errorObj,
              reasonHTML: detail.errorObj?.reasonHTML,
              icon: detail.icon || 'dashicons-warning'
            })
          }
          showBackButton={showBackButton}
          onBack={handleBackFromProgress}
          canSkip={canSkip}
          itemMeta={itemMeta}
          hideReviewNotice={hideReviewNotice}
          onDismissReviewNotice={handleDismissReviewNotice}
        />
      ) : null}
    </div>
  );
}
