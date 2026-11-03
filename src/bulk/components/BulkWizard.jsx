/**
 * BulkWizard Component
 * Renders the 3-step bulk translation wizard in a reusable Modal
 */

import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { LanguageSelection } from './LanguageSelection';
import { ProviderSelection } from './ProviderSelection';
import { BulkProgress } from './BulkProgress';
import { ProgressSummary } from './ProgressSummary';
import { TranslationResults } from './TranslationResults';
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

  const modalTitle =
    currentStep === 3
      ? 'TranslateSense Bulk Translation'
      : 'TranslateSense Bulk Translation';
  const modalSubtitle =
    currentStep === 1
      ? 'Fast & Accurate Multi-Language Content Localizer'
      : currentStep === 2
        ? 'Choose a translation provider'
        : 'Monitor translation progress';

  const isChromeAi = selectedProvider === 'chrome_ai';
  const hasFailedPosts = Object.values(postResultsMap).some((p) =>
    Object.values(p.translations || {}).some((t) => t.status === 'failed')
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={currentStep === 3 ? 'lg' : ''}
        className={`ts-bulk-wizard-modal ${currentStep === 3 ? 'ts-is-progress-step' : ''} ${(errorModal && errorModal.isOpen ? 'hide' : '')}`}
        dataStep={currentStep}
        header={
          <ModalHeader
            title={modalTitle}
            subtitle={modalSubtitle}
            onClose={onClose}
            closeClass="ts-bulk-close"
          />
        }
        footer={
          <ModalFooter align={currentStep === 3 ? 'space-between' : 'right'}>
            {currentStep === 1 && (
              <Button
                variant="primary"
                disabled={selectedLanguages.length === 0}
                onClick={() => setCurrentStep(2)}
              >
                Next: Choose Provider &rarr;
              </Button>
            )}

            {currentStep === 2 && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                  &larr; Back
                </Button>
                <Button
                  variant="primary"
                  onClick={startTranslation}
                  disabled={!selectedProvider}
                >
                  Start Bulk Translation
                </Button>
              </div>
            )}

            {currentStep === 3 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {hasFailedPosts && (
                    <label className="ts-footer-filter-label">
                      <input
                        type="checkbox"
                        checked={filterOnlyFailed}
                        onChange={(e) => setFilterOnlyFailed(e.target.checked)}
                      />
                      <span>Only show untranslated or failed items</span>
                    </label>
                  )}
                </div>

                <div className="ts-footer-buttons-group">
                  <Button
                    variant="primary"
                    disabled={isTranslating}
                    onClick={() => {
                      onClose();
                      if (isCompleted) {
                        window.location.reload();
                      }
                    }}
                  >
                    {isTranslating ? 'Translation In Progress...' : isCompleted ? 'Done (Reload)' : 'Close'}
                  </Button>
                </div>
              </>
            )}
          </ModalFooter>
        }
      >
        {currentStep === 1 && (
          <LanguageSelection
            postIds={postIds}
            allLanguages={allLanguages}
            selectedLanguages={selectedLanguages}
            onLanguagesChange={setSelectedLanguages}
          />
        )}

        {currentStep === 2 && (!errorModal || !errorModal.isOpen) && (
          <ProviderSelection
            postIds={postIds}
            allLanguages={allLanguages}
            selectedLanguages={selectedLanguages}
            providers={providers}
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
            onViewError={(p) =>
              setErrorModal({
                isOpen: true,
                title: `${p.title} Notice`,
                message: p.desc,
                reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
              })
            }
          />
        )}

        {currentStep === 3 && (
          <div className="ts-bulk-progress-view">
            {!isCompleted ? (
              <BulkProgress
                statusText={statusText}
                percent={progressPercent}
                completedPosts={completedJobsCount}
                totalPosts={totalJobsCount}
                timerText={formattedTimer}
                isChromeAi={isChromeAi}
                activeBatches={activeBatches}
                currentBatchId={currentBatchId}
                onBatchChange={(id) => {
                  setCurrentBatchId(id);
                  pollStatus(id);
                }}
              />
            ) : (
              statsSummary && (
                <ProgressSummary
                  completedCount={statsSummary.completed + statsSummary.alreadyExists}
                  failedCount={statsSummary.failed}
                  totalCharacters={statsSummary.completedCharacters}
                  totalCount={statsSummary.total}
                  elapsedTime={humanReadableTimer}
                />
              )
            )}

            <TranslationResults
              orderedPostIds={orderedPostIds}
              postResultsMap={postResultsMap}
              allLanguages={allLanguages}
              isBackgroundMode={!isChromeAi}
              activeBatchId={currentBatchId}
              filterOnlyFailed={filterOnlyFailed}
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
          </div>
        )}
      </Modal>

      {/* Skip Confirmation Dialog */}
      <SkipConfirmation
        isOpen={skipModal.isOpen}
        postId={skipModal.postId}
        onClose={() => setSkipModal({ isOpen: false, postId: null, batchId: null })}
        onConfirm={() => handleSkipPost(skipModal.postId, skipModal.batchId)}
      />

      {/* Error Details Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        reasonHTML={errorModal.reasonHTML}
        onClose={() =>
          setErrorModal({ isOpen: false, title: '', message: '', errorObj: null, reasonHTML: '' })
        }
      />
    </>
  );
}

