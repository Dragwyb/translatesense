/**
 * SourcePrompt Component
 * Initial Page Load Translation Guidance Modal
 */

import { Modal, ModalHeader, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { getLanguageFlag } from '../../utils/language';

export function SourcePrompt({
  isOpen,
  onClose,
  onConfirm,
  sourceLanguage,
  targetLanguage,
  languages = [],
}) {
  if (!isOpen) return null;

  const srcLang = getLanguageFlag(sourceLanguage, languages);
  const tgtLang = getLanguageFlag(targetLanguage, languages);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      header={
        <ModalHeader
          title="Translate Page Content"
          subtitle="Automatic Page Translation"
          onClose={onClose}
        />
      }
      footer={
        <ModalFooter align="right">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" data-ad="ad-testing" onClick={onConfirm}>
            <span className="dashicons dashicons-translation" />
            Continue to Translation
          </Button>
        </ModalFooter>
      }
    >
      <div className="ts-source-guidance-content">
        <p className="ts-prompt-intro-text">
          Automatically translate this page with AI while keeping your design and formatting intact.
        </p>

        <div className="ts-prompt-languages-row">
          <div className="ts-prompt-lang-pill source">
            {srcLang.hasFlag && (
              <img src={srcLang.flagUrl} alt={srcLang.name} className="ts-lang-flag-img" />
            )}
            <span>{srcLang.name} ({srcLang.code})</span>
          </div>

          <div className="ts-prompt-arrow-wrap" aria-hidden="true">
            <svg viewBox="0 0 576 512"><path d="M566.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L466.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l434.7 0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128z" /></svg>
          </div>

          <div className="ts-prompt-lang-pill target">
            {tgtLang.hasFlag && (
              <img src={tgtLang.flagUrl} alt={tgtLang.name} className="ts-lang-flag-img" />
            )}
            <span>{tgtLang.name} ({tgtLang.code})</span>
          </div>
        </div>

        <div className="ts-prompt-steps-banner">
          <div className="ts-prompt-steps-list">
            <span className="ts-prompt-step-item">
              <span className="ts-prompt-step-num">1</span>
              <span>Select Provider</span>
            </span>
            <span className="ts-prompt-step-separator">&gt;</span>
            <span className="ts-prompt-step-item">
              <span className="ts-prompt-step-num">2</span>
              <span>Start Translation</span>
            </span>
            <span className="ts-prompt-step-separator">&gt;</span>
            <span className="ts-prompt-step-item">
              <span className="ts-prompt-step-num">3</span>
              <span>Apply to Page</span>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
