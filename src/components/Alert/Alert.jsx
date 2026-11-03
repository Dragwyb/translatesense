/**
 * Alert Component
 */

export function Alert({
  type = 'info', // 'info' | 'warning' | 'error' | 'success'
  title = '',
  children,
  action = null,
  onClose = null,
  className = '',
}) {
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✓',
  };

  return (
    <div className={`ts-alert ts-alert-${type} ${className}`}>
      <div className="ts-alert-inner">
        <span className="ts-alert-icon" aria-hidden="true">
          {icons[type] || 'ℹ️'}
        </span>
        <div className="ts-alert-content">
          {title && <strong className="ts-alert-title">{title}</strong>}
          <div className="ts-alert-message">{children}</div>
        </div>
      </div>
      {action && <div className="ts-alert-action">{action}</div>}
      {onClose && (
        <button
          type="button"
          className="ts-alert-close"
          onClick={onClose}
          aria-label="Dismiss alert"
        >
          &times;
        </button>
      )}
    </div>
  );
}

