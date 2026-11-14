/**
 * ReviewModal Component
 * Review and edit translations before applying to the page.
 */

import { useState } from '@wordpress/element';
import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { ReviewNotice } from '../../components/ReviewNotice';
import { TranslationStats } from './TranslationStats';
import { ReviewTable } from './ReviewTable';
import { TranslationProgress } from './TranslationProgress';

export function ReviewModal({
  isOpen,
  onClose,
  strings = [],
  translationStats = {},
  onUpdateTranslation,
  onResetTranslation,
  isExtracting,
  progressIsOpen,
  progressPercent,
  progressStatus,
  progressSubText,
  progressTargetLang,
  progressLanguages,
  progressProviderTitle,
  isCustomFieldsSyncEnabled = false,
  skippedCustomFieldsCount = 0,
  showReTranslateAll = false,
  isRetrying = false,
  isTranslationComplete = false,
  hideReviewNotice = true,
  onDismissReviewNotice = null,
  onReTranslateAll,
  onApply,
}) {
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState(false);

  if (!isOpen) return null;

  const handleApplyClick = async () => {
    setApplying(true);
    try {
      if (onApply) {
        await onApply();
      }
    } finally {
      setApplying(false);
    }
  };

  const translatedCount = strings.filter(
    (s) => s.translated !== null && s.translated !== undefined && String(s.translated).trim() !== ''
  ).length;

  const shouldShowReviewNotice = Boolean(
    !hideReviewNotice &&
    isTranslationComplete &&
    !isExtracting &&
    !progressIsOpen &&
    !isRetrying &&
    !showReTranslateAll &&
    translationStats.totalChars > 1000
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="ts-review-container"
      header={
        <ModalHeader
          title="Review Translations"
          subtitle="Review and edit translations before applying to the page."
          onClose={onClose}
          closeId="ts-review-modal-close"
        />
      }
      footer={
        <ModalFooter
          align="space-between"
          customHtml={
            <span className="ts-footer-string-counter">
              {translatedCount} of {strings.length} strings translated
            </span>
          }
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {showReTranslateAll && onReTranslateAll && (
              <Button
                variant="secondary"
                onClick={onReTranslateAll}
                loading={isRetrying}
                disabled={applying || isRetrying}
                title="Re-Translate only failed or untranslated strings"
              >
                Re-Translate
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={isRetrying || applying}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApplyClick}
              loading={applying}
              disabled={applying || isRetrying || strings.length === 0}
            >
              Apply to Page
            </Button>
          </div>
        </ModalFooter>
      }
    >
      {isCustomFieldsSyncEnabled && skippedCustomFieldsCount > 0 && (
        <div
          className="ts-table-sync-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            color: '#1e40af',
            fontSize: '12.5px',
            marginBottom: '14px',
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontSize: '14px', flexShrink: 0 }}>ℹ️</span>
          <span>
            <strong>{skippedCustomFieldsCount} custom fields found:</strong> Not translated because Polylang Custom Fields Synchronization is enabled.
          </span>
        </div>
      )}

      <ReviewNotice
        isVisible={shouldShowReviewNotice}
        onDismiss={onDismissReviewNotice}
        className="ts-modal-review-notice"
      />

      <div className="ts-review-body-wrap">
        {/* Toolbar Row: Search + Metrics */}
        <div className="ts-review-toolbar">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source or translation..."
          />
          <TranslationStats stats={translationStats} />
        </div>

        {/* Table */}
        <ReviewTable
          strings={strings}
          filterQuery={search}
          isExtracting={isExtracting}
          onUpdateTranslation={onUpdateTranslation}
          onResetTranslation={onResetTranslation}
        />
      </div>
      {progressIsOpen && (
        /* 2. Translation Progress Modal (Coffee Cup Visual) */
        <div className="ts-review-progress-overlay">
          <TranslationProgress
            isOpen={true}
            percent={progressPercent}
            status={progressStatus}
            subText={progressSubText}
            targetLang={progressTargetLang}
            languages={progressLanguages}
            providerTitle={progressProviderTitle}
          />
        </div>
      )}
    </Modal>
  );
}
