/**
 * Reusable Button Component
 */

export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'text' | 'disabled'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  title = '',
  ...props
}) {
  const isDisabled = disabled || loading || variant === 'disabled';

  let variantClass = 'ts-btn-primary button-primary';
  if (variant === 'secondary') {
    variantClass = 'ts-btn-secondary button-secondary';
  } else if (variant === 'danger') {
    variantClass = 'ts-btn-danger button-danger';
  } else if (variant === 'text') {
    variantClass = 'ts-btn-text';
  } else if (variant === 'disabled') {
    variantClass = 'ts-btn-disabled';
  }

  const sizeClass = size === 'sm' ? 'ts-btn-sm' : size === 'lg' ? 'ts-btn-lg' : '';

  return (
    <button
      type={type}
      className={`ts-btn ${variantClass} ${sizeClass} ${loading ? 'is-loading' : ''} ${className}`}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      title={title}
      {...props}
    >
      {loading ? (
        <span className="ts-btn-spinner-wrap">
          <span className="ts-spinner-circle" aria-hidden="true" />
          {children}
        </span>
      ) : (
        <>
          {icon && <span className="ts-btn-icon">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}

