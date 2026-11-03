/**
 * Reusable EmptyState Component
 */

export function EmptyState({
  icon = '🔍',
  title = 'No items found',
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={`ts-empty-state ${className}`}>
      <div className="ts-empty-state-icon">{icon}</div>
      <h3 className="ts-empty-state-title">{title}</h3>
      {description && <p className="ts-empty-state-desc">{description}</p>}
      {action && <div className="ts-empty-state-action">{action}</div>}
    </div>
  );
}

