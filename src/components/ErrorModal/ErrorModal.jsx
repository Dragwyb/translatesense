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
    if (!toolTip) return;

    if (toolTip.parentElement) {
      toolTip.parentElement.style.position = 'relative';
    }

    toolTip.innerHTML = `
      <span class="ts-tooltip-arrow" aria-hidden="true"></span>
      <span class="ts-copy-spinner" aria-hidden="true"></span>
      <span class="ts-copy-text">Copied!</span>
    `;

    // Trigger smooth translation effect on entrance
    requestAnimationFrame(() => {
      toolTip.classList.add('ts-tooltip-visible');
    });
  };

  const hideToolTip = (toolTip) => {
    if (!toolTip) return;

    // Trigger smooth translation effect on exit
    toolTip.classList.remove('ts-tooltip-visible');
    toolTip.classList.add('ts-tooltip-hiding');

    setTimeout(() => {
      if (toolTip.parentNode) {
        toolTip.remove();
      }
    }, 220);
  };

  useEffect(() => {
    const copyBtns = Array.from(document.querySelectorAll('.ts-copy-clipboard'));

    const handleCopyClick = (e) => {
      e.preventDefault();
      if (!e.target) return;

      const targetEle = e.target.classList.contains('ts-copy-clipboard')
        ? e.target
        : e.target.closest('.ts-copy-clipboard');

      if (targetEle) {
        const copyText = targetEle.dataset.copyText;

        if (copyText && copyText !== '') {
          const existingToolTip = targetEle.querySelector('.ts-copy-tooltip');
          if (existingToolTip) {
            existingToolTip.remove();
          }

          const toolTIp = document.createElement('div');
          toolTIp.className = 'ts-copy-tooltip';
          targetEle.append(toolTIp);

          copyToClipboard({
            value: copyText,
            onClose: () => {
              addToolTip(toolTIp);
            },
            onCopy: () => {
              addToolTip(toolTIp);
            },
            onSuccess: () => {
              hideToolTip(toolTIp);
            },
          });
        }
      }
    };

    if (copyBtns.length > 0) {
      copyBtns.forEach((ele) => ele.addEventListener('click', handleCopyClick));
    }

    return () => {
      if (copyBtns.length > 0) {
        copyBtns.forEach((ele) => ele.removeEventListener('click', handleCopyClick));
      }
    };
  }, [reasonHTML, message]);

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
            <span
              className={`dashicons ${typeof icon === 'string' && icon.startsWith('dashicons-')
                ? icon
                : 'dashicons-warning'
                }`}
            />
            <p className="ts-error-text">{message}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
