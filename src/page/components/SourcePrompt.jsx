/**
 * SourcePrompt Component
 * Initial Page Load Translation Guidance Modal
 */

import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../components/Modal';
import { Button } from '../../components/Button';
import { getLanguageDisplay } from '../../utils/language';

export function SourcePrompt({
  isOpen,
  onClose,
  onConfirm,
  sourceLanguage,
  targetLanguage,
  languages = [],
}) {
  if (!isOpen) return null;

  const srcDisplay = sourceLanguage
    ? `from ${getLanguageDisplay(sourceLanguage, languages)} `
    : '';
  const tgtDisplay = getLanguageDisplay(targetLanguage, languages);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      header={
        <ModalHeader
          title="Translate Page Content"
          onClose={onClose}
        />
      }
      footer={
        <ModalFooter align="right">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Continue to Translation
          </Button>
        </ModalFooter>
      }
    >
      <div className="ts-source-guidance-content">
        <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#334155', margin: 0 }}>
          If you want to translate this post automatically {srcDisplay}to{' '}
          <strong>{tgtDisplay}</strong>, click continue or close this modal.
        </p>
      </div>
    </Modal>
  );
}

