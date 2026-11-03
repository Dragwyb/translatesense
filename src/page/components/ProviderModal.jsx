/**
 * ProviderModal Component (Page Editor)
 */

import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../components/Modal';
import { ProviderCard } from '../../components/ProviderCard';
import { Button } from '../../components/Button';

export function ProviderModal({
  isOpen,
  onClose,
  providers = [],
  selectedProvider = '',
  onSelectProvider,
  onStartTranslation,
  onViewError,
}) {
  if (!isOpen) return null;

  const hasAvailable = providers.some((p) => p.isAvailable);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="ts-provider-modal-container"
      header={
        <ModalHeader
          title="Choose Translation Provider"
          subtitle="Choose a translation provider"
          onClose={onClose}
        />
      }
      footer={
        <ModalFooter align="right">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={hasAvailable ? 'primary' : 'disabled'}
            disabled={!hasAvailable || !selectedProvider}
            onClick={onStartTranslation}
          >
            Start Translation
          </Button>
        </ModalFooter>
      }
    >
      <div className="ts-provider-list">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isSelected={selectedProvider === p.id}
            onSelect={onSelectProvider}
            onViewError={onViewError}
          />
        ))}
      </div>
    </Modal>
  );
}

