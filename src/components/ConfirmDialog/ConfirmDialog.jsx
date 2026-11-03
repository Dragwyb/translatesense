/**
 * Reusable Confirmation Dialog Component
 */

import { Modal } from '../Modal';
import { Button } from '../Button';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  loading = false,
  icon = 'dashicons-warning',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      size="sm"
      className="ts-confirm-dialog"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
    >
      <div className="ts-confirm-dialog-content">
        <div className="ts-confirm-icon-wrap">
          <span className={`dashicons ${icon} ${isDanger ? 'text-danger' : 'text-warning'}`} />
        </div>
        <div className="ts-confirm-text-wrap">
          <h3 className="ts-confirm-title">{title}</h3>
          {message && <div className="ts-confirm-message">{message}</div>}
        </div>
      </div>

      <div className="ts-confirm-actions">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={isDanger ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

