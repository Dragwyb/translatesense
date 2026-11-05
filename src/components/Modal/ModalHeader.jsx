/**
 * ModalHeader Component
 */

export function ModalHeader({
  title,
  subtitle = '',
  icon = null,
  onClose,
  showClose = true,
  className = '',
  closeId = '',
  closeClass = '',
}) {
  if (!icon || icon === '') {
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    if (config && config.pluginUrl) {
      icon = config.pluginUrl + '/assets/img/logo.png';
    }
  }

  return (
    <div className={`ts-modal-header ts-common-header ${className}`}>
      <div className="ts-header-title-group">
        {icon && (
          <div className="ts-header-icon-box">
            {typeof icon === 'string' && (icon.startsWith('http') || icon.endsWith('.png') || icon.endsWith('.svg')) ? (
              <img src={icon} alt="" className="ts-header-icon-img" />
            ) : typeof icon === 'string' && icon.startsWith('dashicons-') ? (
              <span className={`dashicons ${icon}`} />
            ) : (
              icon
            )}
          </div>
        )}
        <div className="ts-header-text-wrap">
          <h2 className="ts-modal-title ts-common-title">{title}</h2>
          {subtitle && <p className="ts-modal-subtitle ts-common-subtitle">{subtitle}</p>}
        </div>
      </div>
      {showClose && onClose && (
        <button
          type="button"
          id={closeId || undefined}
          className={`ts-modal-close-btn ts-bulk-close ${closeClass}`}
          onClick={onClose}
          aria-label="Close modal"
          title="Close modal"
        >
          &times;
        </button>
      )}
    </div>
  );
}

