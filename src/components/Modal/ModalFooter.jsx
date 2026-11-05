/**
 * ModalFooter Component
 */

import { Button } from '../Button';

export function ModalFooter({
  children,
  buttons = [],
  customHtml = null,
  align = 'right', // 'right' | 'space-between' | 'center'
  className = '',
  style = {},
  id = '',
}) {
  return (
    <div
      id={id || undefined}
      className={`ts-modal-footer ts-common-footer ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'space-between' ? 'space-between' : align === 'center' ? 'center' : 'flex-end',
        ...style,
      }}
    >
      {customHtml && (
        <div className="ts-footer-custom-content">
          {typeof customHtml === 'string' ? (
            <span dangerouslySetInnerHTML={{ __html: customHtml }} />
          ) : (
            customHtml
          )}
        </div>
      )}

      {children}

      {buttons.length > 0 && (
        <div className="ts-footer-buttons-group">
          {buttons.map((btn, idx) => (
            <Button
              key={btn.id || btn.label || idx}
              id={btn.id}
              variant={btn.variant || (btn.primary ? 'primary' : 'secondary')}
              disabled={btn.disabled}
              loading={btn.loading}
              onClick={btn.onClick}
              title={btn.title}
              className={btn.className || btn.class}
              {...(btn.attributes || {})}
            >
              {typeof btn.label === 'string' && btn.label.includes('&') ? (
                <span dangerouslySetInnerHTML={{ __html: btn.label }} />
              ) : (
                btn.label
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

