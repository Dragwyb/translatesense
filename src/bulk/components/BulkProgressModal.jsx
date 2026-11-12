/**
 * BulkProgressModal Component (Bulk Step 3 Modal)
 * Encapsulates Progress Monitoring, Results Table, and Actions in its own Modal
 */

import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { ReviewNotice } from '../../components/ReviewNotice';
import { BulkProgress } from './BulkProgress';
import { ProgressSummary } from './ProgressSummary';
import { TranslationResults } from './TranslationResults';
import { getBulkItemLabels } from '../utils/bulkFormatters';

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
  isChromeAi: explicitIsChromeAi = null,
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
  showBackButton = false,
  onBack,
  canSkip = false,
  itemMeta = {},
  hideReviewNotice = true,
  onDismissReviewNotice = null,
}) {
  const { plural: itemPlural } = getBulkItemLabels(itemMeta);
  const isChromeAi = explicitIsChromeAi !== null ? Boolean(explicitIsChromeAi) : selectedProvider === 'chrome_ai';

  const shouldShowReviewNotice = Boolean(
    !hideReviewNotice &&
    isCompleted &&
    statsSummary &&
    statsSummary.completedCharacters > 1000 &&
    statsSummary.completed > 0
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
            {showBackButton && (
              <Button
                variant="secondary"
                onClick={onBack}
                id="ts-progress-back-btn"
                className="ts-bulk-progress-back-btn"
              >
                &larr; Back
              </Button>
            )}
            {statsSummary && statsSummary.failed && (statsSummary.alreadyExists > 0 || statsSummary.completed > 0) && (
              <label className="ts-footer-filter-label">
                <input
                  type="checkbox"
                  checked={filterOnlyFailed}
                  onChange={(e) => onFilterChange && onFilterChange(e.target.checked)}
                />
                <span>Show failed</span>
              </label>
            )}
          </div>

          <div className="ts-footer-buttons-group">
            <Button
              variant="primary"
              disabled={isTranslating && isChromeAi}
              onClick={() => {
                onClose();
                if (isCompleted) {
                  window.location.reload();
                }
              }}
            >
              {isTranslating && isChromeAi
                ? 'Translation In Progress...'
                : isCompleted
                  ? 'Done (Reload)'
                  : 'Close'}
            </Button>
          </div>
        </ModalFooter>
      }
    >
      <div className="ts-bulk-progress-view">
        <ReviewNotice
          isVisible={shouldShowReviewNotice}
          onDismiss={onDismissReviewNotice}
          className="ts-modal-review-notice"
        />

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
            itemPlural={itemPlural}
          />
        ) : (
          statsSummary && (
            <ProgressSummary
              completedCount={statsSummary.completed}
              skippedCount={statsSummary.alreadyExists + statsSummary.skipped}
              failedCount={statsSummary.failed}
              totalCharacters={statsSummary.completedCharacters}
              totalCount={statsSummary.total}
              elapsedTime={humanReadableTimer}
              itemMeta={itemMeta}
            />
          )
        )}

        <TranslationResults
          orderedPostIds={orderedPostIds}
          postResultsMap={postResultsMap}
          allLanguages={allLanguages}
          isBackgroundMode={!isChromeAi}
          canSkip={canSkip}
          activeBatchId={currentBatchId}
          filterOnlyFailed={filterOnlyFailed}
          onSkipPost={onSkipPost}
          onErrorDetail={onErrorDetail}
          itemMeta={itemMeta}
        />
      </div>
    </Modal>
  );
}
