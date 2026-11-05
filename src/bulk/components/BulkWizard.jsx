/**
 * BulkWizard Component
 */

import { useCallback } from '@wordpress/element';
import { UnifiedBulkSelection } from './UnifiedBulkSelection';
import { BulkProgressModal } from './BulkProgressModal';
import { SkipConfirmation } from './SkipConfirmation';
import { ErrorModal } from '../../components/ErrorModal';

export function BulkWizard({
  isOpen,
  onClose,
  translationState,
  allLanguages = [],
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
    filterOnlyFailed,
    setFilterOnlyFailed,
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
  } = translationState;

  const showBackButton =
    progressSessionType === 'existing_queue' &&
    progressModalSource === 'language_selection_view_progress';

  const canSkip = progressSessionType === 'existing_queue';

  const handleBackFromProgress = useCallback(() => {
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
    if (currentStep === 3 && isTranslating && isQueueChromeAi) {
      return; // Do not close while on-device translation is actively processing
    }
    if (onClose) {
      onClose();
    }
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
        /* 3. Unified Bulk Translation Modal (Replaces old Steps 1 & 2) */
        <UnifiedBulkSelection
          isOpen={true}
          onClose={onClose}
          postIds={postIds}
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
              message: p.desc,
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
      ) : currentStep === 2 ? (
        /* 4. Step 3: Progress & Results Modal */
        <BulkProgressModal
          isOpen={true}
          onClose={onClose}
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
          filterOnlyFailed={filterOnlyFailed}
          onFilterChange={setFilterOnlyFailed}
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
            })
          }
          showBackButton={showBackButton}
          onBack={handleBackFromProgress}
          canSkip={canSkip}
        />
      ) : null}
    </div>
  );
}
