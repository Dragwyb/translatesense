/**
 * LanguageSelection Component (Bulk Step 1 Modal)
 */

import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { LanguageSelector } from '../../components/LanguageSelector';
import { WizardSteps } from './WizardSteps';

export function LanguageSelection({
  isOpen = true,
  onClose,
  postIds = [],
  allLanguages = [],
  selectedLanguages = [],
  onLanguagesChange,
  onNext,
  activeBatches = [],
  onShowRunning,
}) {
  const postsCount = postIds.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="ts-bulk-wizard-modal"
      dataStep={1}
      header={
        <ModalHeader
          title="Bulk Translation"
          subtitle="Fast & Accurate Multi-Language Content Localizer"
          onClose={onClose}
          closeClass="ts-bulk-close"
        />
      }
      footer={
        <ModalFooter align="right">
          <Button
            variant="primary"
            disabled={selectedLanguages.length === 0}
            onClick={onNext}
          >
            Next: Choose Provider &rarr;
          </Button>
        </ModalFooter>
      }
    >
      <div className="ts-bulk-step-content" id="ts-view-step-1">
        <WizardSteps currentStep={1} selectedLanguagesCount={selectedLanguages.length} />

        {activeBatches && activeBatches.length > 0 && (
          <div className="ts-previous-active-notice" id="ts-previous-active-notice">
            <div className="ts-notice-inner">
              <span className="ts-notice-icon" aria-hidden="true">⚡</span>
              <div className="ts-notice-text">
                <strong className="ts-notice-title">Background translations are running</strong>
                <span className="ts-notice-desc">
                  {activeBatches.length === 1
                    ? 'There is 1 active translation batch in progress.'
                    : `There are ${activeBatches.length} active translation batches in progress.`}
                </span>
              </div>
            </div>
            {onShowRunning && (
              <button
                type="button"
                className="button button-secondary ts-show-running-btn"
                onClick={onShowRunning}
              >
                View Progress
              </button>
            )}
          </div>
        )}

        <div className="ts-lang-info-banner">
          <span className="ts-info-icon" aria-hidden="true">ℹ️</span>
          <span>
            Targeting <strong className="ts-highlight-tag">{postsCount} {postsCount === 1 ? 'post' : 'posts'}</strong>. Choose target language(s) to translate into:
          </span>
        </div>

        <LanguageSelector
          languages={allLanguages}
          selectedLanguages={selectedLanguages}
          onChange={onLanguagesChange}
        />
      </div>
    </Modal>
  );
}
