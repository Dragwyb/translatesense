/**
 * Reusable Header Component
 */

export function Header({ title, subtitle = '', children, className = '' }) {
  return (
    <header className={`ts-app-header ${className}`}>
      <div className="ts-app-header-title-wrap">
        <h1 className="ts-app-header-title">{title}</h1>
        {subtitle && <p className="ts-app-header-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="ts-app-header-actions">{children}</div>}
    </header>
  );
}

