/**
 * Reusable Modal Container Component
 * Renders the modal container with accessibility attributes, header, body, and footer.
 */

import { useEffect, useRef } from '@wordpress/element';
import { ModalHeader } from './ModalHeader';
import { ModalBody } from './ModalBody';
import { ModalFooter } from './ModalFooter';

export function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  icon,
  children,
  header,
  footer,
  buttons,
  size = '', // 'sm' | 'md' | 'lg' | 'xl' | 'custom'
  maxWidth = null,
  closeOnEscape = true,
  className = '',
  dataStep = null,
}) {
  const containerRef = useRef(null);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: { maxWidth: '420px' },
    md: { maxWidth: '580px' },
    lg: { maxWidth: '820px' },
    xl: { maxWidth: '1040px' },
  };

  const containerStyle = {
    ...(maxWidth ? { maxWidth } : sizeStyles[size] || ''),
  };

  return (
    <div
      ref={containerRef}
      className={`ts-modal-container ${className}`}
      style={containerStyle}
      data-step={dataStep || undefined}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {header !== undefined ? (
        header
      ) : title ? (
        <ModalHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
          onClose={onClose}
        />
      ) : null}

      <ModalBody>{children}</ModalBody>

      {footer !== undefined ? (
        footer
      ) : buttons && buttons.length > 0 ? (
        <ModalFooter buttons={buttons} />
      ) : null}
    </div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
