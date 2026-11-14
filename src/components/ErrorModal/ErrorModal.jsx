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
  type = 'error',
  title = 'Translation Error',
  subtitle = '',
  heading = '',
  stepTip = '',
  message,
  reasonHTML = '',
  actionHtml = '',
  actionUrl = '',
  actionLabel = 'Edit',
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
      className={`ts-error-container ${type === 'no_language' ? 'ts-no-lang-modal' : ''}`}
      overlayClassName="ts-error-modal-overlay"
      header={
        <ModalHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          onClose={onClose}
          closeClass="ts-bulk-close"
        />
      }
      footer={
        <ModalFooter
          customHtml={actionHtml}
          align={actionHtml ? 'space-between' : 'right'}
        >
          <div className="ts-footer-buttons-group ts-error-footer-group">
            <Button variant="secondary" onClick={onClose} className="ts-error-close-btn">
              Close
            </Button>
            {actionUrl && (
              <a
                href={actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button-primary ts-btn ts-btn-primary"
              >
                <span>{actionLabel || 'Edit'}</span>
                <span className="dashicons dashicons-external" style={{ marginRight: '0px' }} />
              </a>
            )}
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
          </div>
        </ModalFooter>
      }
    >
      <div className="ts-error-content-body">
        {type === 'no_language' || heading ? (
          <div className="ts-no-lang-banner-card">
            <div className="ts-no-lang-banner-icon-col">
              <span className="ts-no-lang-circle-icon">
                <span className="dashicons dashicons-info" />
              </span>
            </div>
            <div className="ts-no-lang-banner-text-col">
              <h4 className="ts-no-lang-banner-title">
                {heading || `This item doesn't have a language assigned in Polylang.`}
              </h4>
              <p className="ts-no-lang-banner-message">
                {message || 'Assign a language before translating it. Open the editor to select the default language or choose another language.'}
              </p>
              {stepTip && (
                <div className="ts-no-lang-banner-step">
                  <span className="dashicons dashicons-arrow-right-alt" />
                  <span>{stepTip}</span>
                </div>
              )}
            </div>
          </div>
        ) : reasonHTML ? (
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
