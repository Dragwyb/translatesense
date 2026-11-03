/**
 * Reusable ErrorModal Component
 */

import { useEffect } from '@wordpress/element';
import { Modal, ModalHeader, ModalFooter } from '../Modal';
import { Button } from '../Button';
import copyToClipboard from '../CopyToClipbord';

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

  const addToolTip = (toolTip) => {

  }

  const hideToolTip = (toolTip) => {

  }


  useEffect(() => {
    const copyBtns = Array.from(document.querySelectorAll('.ts-copy-clipboard'));

    if (copyBtns.length > 0) {
      copyBtns.forEach(ele => ele.addEventListener('click', (e) => {
        e.preventDefault();

        if (!e.target) return;

        const targetEle = e.target.classList.contains('ts-copy-clipboard') ? e.target : e.target.closest('.ts-copy-clipboard');

        if (targetEle) {
          const copyText = targetEle.dataset.copyText;

          if (copyText && '' !== copyText) {

            const toolTIp = document.createElement('div');
            toolTIp.className = 'ts-copy-tooltip';
            targetEle.append(toolTIp);
            copyToClipboard({ value: copyText, onClose: () => { addToolTip(toolTIp) }, onSuccess: () => { hideToolTip(toolTIp) } });
          }
        }

      }));
    }

    return () => {
      if (copyBtns.length > 0) {
        copyBtns.forEach(ele => ele.removeEventListener('click'));
      }
    }
  }, [])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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

