/**
 * BulkProgressModal Component (Bulk Step 3 Modal)
 * Encapsulates Progress Monitoring, Results Table, and Actions in its own Modal
 */

import { useState } from '@wordpress/element';
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
  selectedFilters,
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
  const [internalFilters, setInternalFilters] = useState([]);
  const activeFilters = Array.isArray(selectedFilters) ? selectedFilters : internalFilters;

  const { plural: itemPlural } = getBulkItemLabels(itemMeta);
  const isChromeAi = explicitIsChromeAi !== null ? Boolean(explicitIsChromeAi) : selectedProvider === 'chrome_ai';

  const failedCount = Number(statsSummary?.failed) || 0;
  const completedCount = Number(statsSummary?.completed) || 0;
  const skipExistCount =
    (Number(statsSummary?.alreadyExists) || 0) + (Number(statsSummary?.skipped) || 0);

  const filterOptions = [
    failedCount > 0 ? { key: 'failed', label: 'Show Failed' } : null,
    completedCount > 0 ? { key: 'completed', label: 'Show Completed' } : null,
    skipExistCount > 0 ? { key: 'skip_exist', label: 'Show Skip/Exist' } : null,
  ].filter(Boolean);

  const showStatusFilters = filterOptions.length >= 2;

  const handleToggleFilter = (filterKey) => {
    const nextFilters = activeFilters.includes(filterKey)
      ? activeFilters.filter((key) => key !== filterKey)
      : [...activeFilters, filterKey];

    if (onFilterChange) {
      onFilterChange(nextFilters);
    } else {
      setInternalFilters(nextFilters);
    }
  };

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
            {showStatusFilters && (
              <div className="ts-footer-filter-wrap">
                {filterOptions.map((option) => (
                  <label key={option.key} className="ts-footer-filter-label">
                    <input
                      type="checkbox"
                      checked={activeFilters.includes(option.key)}
                      onChange={() => handleToggleFilter(option.key)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
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
          selectedFilters={showStatusFilters ? activeFilters : []}
          onSkipPost={onSkipPost}
          onErrorDetail={onErrorDetail}
          itemMeta={itemMeta}
        />
      </div>
    </Modal>
  );
}
