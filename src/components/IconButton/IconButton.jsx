/**
 * Reusable IconButton Component
 */

export function IconButton({
  icon,
  label,
  onClick,
  className = '',
  disabled = false,
  variant = 'text',
  size = 'md',
  ...props
}) {
  return (
    <button
      type="button"
      className={`ts-icon-btn ts-icon-btn-${variant} ts-icon-btn-${size} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}

