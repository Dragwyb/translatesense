/**
 * ProviderSelection Component (Bulk Step 2 Modal)
 */

import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { ProviderCard } from '../../components/ProviderCard';
import { WizardSteps } from './WizardSteps';
import { getLanguageFlag } from '../../utils/language';

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
}) {
  const postsCount = postIds.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="ts-bulk-wizard-modal"
      dataStep={2}
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
              disabled={!selectedProvider}
            >
              Start Bulk Translation
            </Button>
          </div>
        </ModalFooter>
      }
    >
      <div className="ts-bulk-step-content" id="ts-view-step-2">
        <WizardSteps currentStep={2} selectedLanguagesCount={selectedLanguages.length} />

        <div className="ts-summary-box">
          <div className="ts-summary-info">
            <span>
              Targeting <strong>{postsCount} {postsCount === 1 ? 'post' : 'posts'}</strong> across <strong>{selectedLanguages.length} languages</strong>:
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

        <div className="ts-bulk-field">
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
        </div>
      </div>
    </Modal>
  );
}
