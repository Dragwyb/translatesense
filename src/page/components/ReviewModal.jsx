/**
 * ReviewModal Component
 */

import { useState } from '@wordpress/element';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { TranslationStats } from './TranslationStats';
import { ReviewTable } from './ReviewTable';
import { TranslationProgress } from './TranslationProgress';

export function ReviewModal({
  isOpen,
  onClose,
  strings = [],
  translationStats = {},
  progress = {},
  targetLang = 'es',
  languages = [],
  providerTitle = 'AI Provider',
  onUpdateTranslation,
  onResetTranslation,
  onReTranslate,
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

  const isExtracting = Boolean(progress && progress.isExtracting);
  const isProgressOpen = Boolean(progress && progress.isOpen);

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
              {strings.length} of {strings.length} strings
            </span>
          }
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {onReTranslate && (
              <Button
                variant="secondary"
                onClick={onReTranslate}
                disabled={isExtracting || isProgressOpen}
              >
                Re-Translate All
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApplyClick}
              loading={applying}
              disabled={isExtracting || isProgressOpen || strings.length === 0}
            >
              Apply to Page
            </Button>
          </div>
        </ModalFooter>
      }
    >
      <div className="ts-review-body-wrap" style={{ position: 'relative' }}>
        {/* Toolbar Row: Search + Metrics */}
        <div className="ts-review-toolbar">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source or translation..."
            disabled={isExtracting}
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

        {/* Progress Overlay */}
        <TranslationProgress
          isOpen={isProgressOpen}
          percent={progress.percent}
          status={progress.status}
          subText={progress.subText}
          targetLang={targetLang}
          languages={languages}
          providerTitle={providerTitle}
          isExtracting={isExtracting}
        />
      </div>
    </Modal>
  );
}

