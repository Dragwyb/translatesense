/**
 * ReviewModal Component
 * Review and edit translations before applying to the page.
 */

import { useState } from '@wordpress/element';
import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { TranslationStats } from './TranslationStats';
import { ReviewTable } from './ReviewTable';

export function ReviewModal({
  isOpen,
  onClose,
  strings = [],
  translationStats = {},
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
                disabled={applying}
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
              disabled={applying || strings.length === 0}
            >
              Apply to Page
            </Button>
          </div>
        </ModalFooter>
      }
    >
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
          isExtracting={false}
          onUpdateTranslation={onUpdateTranslation}
          onResetTranslation={onResetTranslation}
        />
      </div>
    </Modal>
  );
}
