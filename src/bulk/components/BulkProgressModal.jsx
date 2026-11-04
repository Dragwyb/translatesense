/**
 * BulkProgressModal Component (Bulk Step 3 Modal)
 * Encapsulates Progress Monitoring, Results Table, and Actions in its own Modal
 */

import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { BulkProgress } from './BulkProgress';
import { ProgressSummary } from './ProgressSummary';
import { TranslationResults } from './TranslationResults';

export function BulkProgressModal({
  isOpen = true,
  onClose,
  isTranslating = false,
  isCompleted = false,
  statusText = '',
  progressPercent = 0,
  completedJobsCount = 0,
  totalJobsCount = 0,
  formattedTimer = '',
  humanReadableTimer = '',
  statsSummary = null,
  selectedProvider = '',
  activeBatches = [],
  currentBatchId = null,
  onBatchChange,
  orderedPostIds = [],
  postResultsMap = {},
  allLanguages = [],
  filterOnlyFailed = false,
  onFilterChange,
  onSkipPost,
  onErrorDetail,
}) {
  const isChromeAi = selectedProvider === 'chrome_ai';
  const hasFailedPosts = Object.values(postResultsMap).some((p) =>
    Object.values(p.translations || {}).some((t) => t.status === 'failed')
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="ts-bulk-wizard-modal ts-is-progress-step"
      dataStep={3}
      header={
        <ModalHeader
          title="Bulk Translation"
          subtitle="Monitor translation progress"
          onClose={onClose}
          closeClass="ts-bulk-close"
        />
      }
      footer={
        <ModalFooter align="space-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {hasFailedPosts && (
              <label className="ts-footer-filter-label">
                <input
                  type="checkbox"
                  checked={filterOnlyFailed}
                  onChange={(e) => onFilterChange && onFilterChange(e.target.checked)}
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
        </ModalFooter>
      }
    >
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
            onBatchChange={onBatchChange}
            isTranslating={isTranslating}
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
          onSkipPost={onSkipPost}
          onErrorDetail={onErrorDetail}
        />
      </div>
    </Modal>
  );
}

