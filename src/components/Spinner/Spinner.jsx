/**
 * Reusable Spinner Component
 */

export function Spinner({ size = 'md', className = '', label = '' }) {
  return (
    <div className={`ts-spinner-container ts-spinner-${size} ${className}`} role="status">
      <div className="ts-circle-spinner" />
      {label && <span className="ts-spinner-label">{label}</span>}
    </div>
  );
}

