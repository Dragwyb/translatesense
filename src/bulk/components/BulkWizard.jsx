/**
 * BulkWizard Component
 */

import { LanguageSelection } from './LanguageSelection';
import { ProviderSelection } from './ProviderSelection';
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
  } = translationState;

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
    if (currentStep === 3 && isTranslating) {
      return; // Do not close while translation is actively processing
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
        /* 3. Step 1: Language Selection Modal */
        <LanguageSelection
          isOpen={true}
          onClose={onClose}
          postIds={postIds}
          allLanguages={allLanguages}
          selectedLanguages={selectedLanguages}
          onLanguagesChange={setSelectedLanguages}
          onNext={() => setCurrentStep(2)}
        />
      ) : currentStep === 2 ? (
        /* 4. Step 2: Provider Selection Modal */
        <ProviderSelection
          isOpen={true}
          onClose={onClose}
          postIds={postIds}
          allLanguages={allLanguages}
          selectedLanguages={selectedLanguages}
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
          onBack={() => setCurrentStep(1)}
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
        />
      ) : currentStep === 3 ? (
        /* 5. Step 3: Progress & Results Modal */
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
          activeBatches={activeBatches}
          currentBatchId={currentBatchId}
          onBatchChange={(id) => {
            setCurrentBatchId(id);
            pollStatus(id);
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
        />
      ) : null}
    </div>
  );
}
