/**
 * Reusable Footer Component
 */

export function Footer({ children, className = '' }) {
  return <footer className={`ts-app-footer ${className}`}>{children}</footer>;
}

