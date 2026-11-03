/**
 * Reusable Badge Component
 */

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon = null,
  className = '',
  ...props
}) {
  return (
    <span className={`ts-badge ts-badge-${variant} ts-badge-${size} ${className}`} {...props}>
      {icon && <span className="ts-badge-icon">{icon}</span>}
      <span className="ts-badge-text">{children}</span>
    </span>
  );
}

