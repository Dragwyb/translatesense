/**
 * DashboardHeader Component
 */

export function DashboardHeader({
  activeTab,
  onTabChange,
  activeBuilders,
  docsUrl = 'https://docs.dragwyb.com/',
  pluginUrl = '',
  version = '1.0.0',
}) {
  const tabs = [
    { id: 'home', label: 'Overview', icon: 'dashicons-dashboard' },
    { id: 'settings', label: 'Settings', icon: 'dashicons-admin-generic' },
    {
      id: 'gutenberg',
      label: 'Gutenberg Blocks',
      icon: 'dashicons-block-default',
      badge: activeBuilders.gutenberg ? 'Active' : 'Disabled',
      badgeClass: activeBuilders.gutenberg ? 'active' : 'disabled',
    },
    {
      id: 'elementor',
      label: 'Elementor Widgets',
      icon: 'dashicons-layout',
      badge: activeBuilders.elementor ? 'Active' : 'Disabled',
      badgeClass: activeBuilders.elementor ? 'active' : 'disabled',
    },
    { id: 'cache', label: 'Cache & Memory', icon: 'dashicons-database' },
  ];

  const logoSrc = pluginUrl ? `${pluginUrl}assets/img/logo.png` : 'assets/img/logo.png';

  return (
    <div className="ts-dashboard-header">
      <div className="ts-dashboard-brand">
        <div className="ts-brand-logo-wrap">
          <img
            src={logoSrc}
            alt="TranslateSense Logo"
            className="ts-brand-logo"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <span className="dashicons dashicons-translation ts-brand-fallback-icon" />
        </div>
        <div className="ts-brand-info">
          <div className="ts-brand-title-wrap">
            <h1 className="ts-brand-name">TranslateSense</h1>
            <span className="ts-version-tag">v{version}</span>
          </div>
          <p className="ts-brand-subtitle">
            Next-Gen Multilingual Content Translation for WordPress
          </p>
        </div>
        <div className="ts-brand-actions">
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary ts-docs-btn"
          >
            <span className="dashicons dashicons-book-alt" /> Documentation
          </a>
        </div>
      </div>

      <nav className="ts-nav-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`ts-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={`dashicons ${tab.icon}`} />
            <span className="ts-tab-label">{tab.label}</span>
            {tab.badge && (
              <span className={`ts-tab-badge ${tab.badgeClass}`}>{tab.badge}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

