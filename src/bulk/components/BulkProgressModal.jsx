/**
 * BulkProgressModal Component (Bulk Step 3 Modal)
 * Encapsulates Progress Monitoring, Results Table, and Actions in its own Modal
 */

import { useState, useMemo } from '@wordpress/element';
import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { ReviewNotice } from '../../components/ReviewNotice';
import { BulkProgress } from './BulkProgress';
import { ProgressSummary } from './ProgressSummary';
import { TranslationResults } from './TranslationResults';
import { BulkProgressSkeleton } from './BulkProgressSkeleton';
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
  onTranslateAgain,
  showBackButton = false,
  onBack,
  canSkip = false,
  itemMeta = {},
  hideReviewNotice = true,
  onDismissReviewNotice = null,
  endpointLoading = null,
  emptyBatchesState = false,
}) {
  const [internalFilters, setInternalFilters] = useState([]);
  const activeFilters = Array.isArray(selectedFilters) ? selectedFilters : internalFilters;

  const { plural: itemPlural, pluralTitle: itemPluralTitle } = getBulkItemLabels(itemMeta);
  const isChromeAi = explicitIsChromeAi !== null ? Boolean(explicitIsChromeAi) : selectedProvider === 'chrome_ai';

  const failedCount = Number(statsSummary?.failed) || 0;
  const completedCount = Number(statsSummary?.completed) || 0;
  const skipExistCount =
    (Number(statsSummary?.alreadyExists) || 0) + (Number(statsSummary?.skipped) || 0);

  const hasFailedItems = useMemo(() => {
    if (!postResultsMap) return false;
    return Object.values(postResultsMap).some((post) =>
      Object.values(post.translations || {}).some(
        (t) =>
          t.status === 'failed' ||
          (t.status === 'skipped' && (t.error === 'no_language' || t.progressStatus === 'No Language'))
      )
    );
  }, [postResultsMap]);

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
            {hasFailedItems && !isTranslating && onTranslateAgain && (
              <Button
                variant="secondary"
                className="ts-translate-again-btn"
                onClick={onTranslateAgain}
                title="Retry and translate remaining failed items"
              >
                <span className="dashicons dashicons-update" />
                Translate Again
              </Button>
            )}
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
        {endpointLoading ? (
          <BulkProgressSkeleton
            type={endpointLoading}
            postIds={orderedPostIds}
            selectedLanguages={allLanguages}
          />
        ) : emptyBatchesState ? (
          <div className="ts-empty-batches-state">
            <div className="ts-empty-batches-icon">
              <span className="dashicons dashicons-translation" />
            </div>
            <h3 className="ts-empty-batches-title">No Active Batches Found</h3>
            <p className="ts-empty-batches-desc">
              There are no active translation batches right now. Follow these steps to start bulk translation:
            </p>

            <div className="ts-empty-steps-list">
              <div className="ts-empty-step-item">
                <div className="ts-empty-step-num-col">
                  <span className="ts-empty-step-num">1</span>
                </div>
                <div className="ts-empty-step-icon-col">
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 448 512"><path d="M384 32c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96C0 60.7 28.7 32 64 32l320 0zM342 145.7c-10.7-7.8-25.7-5.4-33.5 5.3L189.1 315.2 137 263.1c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l72 72c5 5 11.9 7.5 18.8 7s13.4-4.1 17.5-9.8L347.3 179.2c7.8-10.7 5.4-25.7-5.3-33.5z" /></svg>
                </div>
                <div className="ts-empty-step-content">
                  <h4 className="ts-empty-step-title">
                    Select {itemPluralTitle || 'Posts'}
                  </h4>
                  <p className="ts-empty-step-text">
                    Select the {(itemPlural || 'posts').toLowerCase()} you want to translate by clicking their checkboxes in the list table.
                  </p>
                </div>
              </div>

              <div className="ts-empty-step-item">
                <div className="ts-empty-step-num-col">
                  <span className="ts-empty-step-num">2</span>
                </div>
                <div className="ts-empty-step-icon-col">
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 448 512"><path d="M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z" /></svg>
                </div>
                <div className="ts-empty-step-content">
                  <h4 className="ts-empty-step-title">Bulk Translate</h4>
                  <p className="ts-empty-step-text">
                    Click the <span className="ts-empty-step-badge">Bulk Translate</span> button to select your target languages and translation provider, then start bulk translation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Modal>
  );
}
