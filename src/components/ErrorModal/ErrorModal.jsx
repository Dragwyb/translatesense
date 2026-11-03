/**
 * Reusable ErrorModal Component
 */

import { Modal, ModalHeader, ModalBody, ModalFooter } from '../Modal';
import { Button } from '../Button';

export function ErrorModal({
  isOpen,
  onClose,
  title = 'Translation Error',
  message,
  reasonHTML = '',
  actionHtml = '',
  icon = 'dashicons-warning',
  onRetry = null,
  retryLabel = 'Retry',
}) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="ts-error-container"
      overlayClassName="ts-error-modal-overlay"
      header={
        <ModalHeader
          icon={icon}
          title={title}
          onClose={onClose}
          closeClass="ts-bulk-close"
        />
      }
      footer={
        <ModalFooter
          customHtml={actionHtml}
          align={actionHtml ? 'space-between' : 'right'}
        >
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      }
    >
      <div className="ts-error-content-body">
        {reasonHTML ? (
          <div
            className="ts-error-message"
            dangerouslySetInnerHTML={{ __html: reasonHTML }}
          />
        ) : message ? (
          <div className="ts-error-notice-card">
            <span className="dashicons dashicons-warning" />
            <p className="ts-error-text">{message}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

