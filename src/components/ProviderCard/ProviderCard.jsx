/**
 * Reusable ProviderCard Component
 */

export function ProviderCard({
  provider,
  isSelected = false,
  onSelect,
  onViewError,
  name = 'ts_provider_choice',
  className = '',
}) {
  const { id, title, logo, desc, isAvailable, badgeType, badgeText, actionUrl, isSupported } = provider;
  const isDisabled = !isAvailable;
  const hasErrorModal = isSupported && isSupported.available === false && isSupported.reason;

  const handleCardClick = (e) => {
    if (id === 'chrome_ai' && (badgeType === 'error' || hasErrorModal)) {
      handleErrorBtnClick(e);
      return;
    }
    if (isDisabled || !onSelect) return;
    onSelect(id);
  };

  const handleActionClick = (e) => {
    e.stopPropagation();
  };

  const handleErrorBtnClick = (e) => {
    e.stopPropagation();
    if (onViewError) {
      onViewError(provider);
    }
  };

  const hasError = badgeType === 'error' || hasErrorModal;

  if ('' !== className) {
    className = ' ' + className;
  }

  if (hasError) {
    className += ' ts-provider-error-btn';
  }

  if (isSelected && !isDisabled) {
    className += ' selected';
  }

  if (isDisabled) {
    className += ' disabled';
  }

  return (
    <div
      className={`ts-provider-row${className}`}
      data-provider={id}
      data-disabled={isDisabled ? 'true' : undefined}
      onClick={handleCardClick}
    >
      <div className="ts-provider-card-top">
        <div className="ts-provider-icon-box">
          {logo && <img src={logo} alt={title} className="ts-provider-logo-img" />}
        </div>
        <div className="ts-provider-header-content">
          <div className="ts-provider-name">{title}</div>
          <div className="ts-provider-badge-wrap">
            {hasError ? (
              <button
                type="button"
                className="ts-provider-badge error-badge ts-provider-error-btn"
                title={desc}
                onClick={handleErrorBtnClick}
              >
                ⚠️ View Error
              </button>
            ) : actionUrl ? (
              <a
                href={actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ts-provider-badge error-badge api-required"
                onClick={handleActionClick}
                title={badgeText}
              >
                {badgeText}
              </a>
            ) : (
              <span className={`ts-provider-badge ${badgeType}`}>{badgeText}</span>
            )}
          </div>
        </div>
        <div className="ts-provider-radio-wrap">
          <input
            type="radio"
            id={`ts-provider-${id}`}
            name={name}
            value={id}
            checked={isSelected}
            disabled={isDisabled}
            onChange={() => onSelect && onSelect(id)}
            className="ts-provider-radio-input"
          />
          <span className="ts-provider-custom-radio" />
        </div>
      </div>
      {desc && <p className="ts-provider-caption">{desc}</p>}
    </div>
  );
}

