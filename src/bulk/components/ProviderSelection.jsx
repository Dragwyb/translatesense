/**
 * ProviderSelection Component (Bulk Step 2 Modal)
 */

import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { ProviderCard } from '../../components/ProviderCard';
import { getLanguageFlag } from '../../utils/language';
import { getBulkItemLabels } from '../utils/bulkFormatters';

export function ProviderSelection({
  isOpen = true,
  onClose,
  postIds = [],
  allLanguages = [],
  selectedLanguages = [],
  providers = [],
  selectedProvider = '',
  onSelectProvider,
  onBack,
  onStartTranslation,
  onViewError,
  isTranslating = false,
  itemMeta = {},
}) {
  const postsCount = postIds.length;
  const { singular: itemSingular, plural: itemPlural } = getBulkItemLabels(itemMeta);
  const selectedProviderObj = providers.find((p) => p.id === selectedProvider);
  const isProviderAvailable = Boolean(selectedProviderObj?.isAvailable);
  const isTranslateDisabled = !selectedProvider || !isProviderAvailable || isTranslating;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="ts-bulk-wizard-modal"
      dataStep={2}
      maxWidth="530px"
      header={
        <ModalHeader
          title="Bulk Translation"
          subtitle="Choose a translation provider"
          onClose={onClose}
          closeClass="ts-bulk-close"
        />
      }
      footer={
        <ModalFooter align="right">
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" onClick={onBack}>
              &larr; Back
            </Button>
            <Button
              variant="primary"
              onClick={onStartTranslation}
              disabled={isTranslateDisabled}
            >
              Start Bulk Translation
            </Button>
          </div>
        </ModalFooter>
      }
    >
      <div className="ts-summary-box">
        <div className="ts-summary-info">
          <span>
            Targeting <strong>{postsCount} {postsCount === 1 ? itemSingular : itemPlural}</strong> across <strong>{selectedLanguages.length} languages</strong>:
          </span>
          <div className="ts-summary-langs-tags">
            {selectedLanguages.map((slug) => {
              const flagInfo = getLanguageFlag(slug, allLanguages);
              return (
                <span key={slug} className="ts-summary-lang-pill">
                  {flagInfo.hasFlag && (
                    <img src={flagInfo.flagUrl} alt="" className="ts-pill-flag" />
                  )}
                  {` (${flagInfo.code})`}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ts-provider-list" id="ts-bulk-provider-list">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isSelected={selectedProvider === p.id}
            onSelect={onSelectProvider}
            onViewError={onViewError}
            name="ts_bulk_provider"
          />
        ))}
      </div>
    </Modal>
  );
}

