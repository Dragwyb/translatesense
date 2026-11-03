/**
 * Reusable ProgressBar Component
 */

export function ProgressBar({
  percent = 0,
  status = '',
  subText = '',
  meta = null,
  showBadge = true,
  className = '',
}) {
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent || 0)));

  return (
    <div className={`ts-progress-component ${className}`}>
      {(status || showBadge || meta) && (
        <div className="ts-progress-header">
          {status && <span className="ts-progress-status">{status}</span>}
          <div className="ts-progress-meta">
            {showBadge && <span className="ts-progress-percent">{clampedPercent}%</span>}
            {meta}
          </div>
        </div>
      )}

      <div className="ts-progress-bar-bg">
        <div
          className="ts-progress-bar-fill"
          style={{ width: `${clampedPercent}%` }}
          role="progressbar"
          aria-valuenow={clampedPercent}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>

      {subText && <div className="ts-progress-sub-info">{subText}</div>}
    </div>
  );
}

