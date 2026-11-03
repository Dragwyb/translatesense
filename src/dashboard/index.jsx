/**
 * TranslateSense Dashboard Entry Point
 */

import { createRoot } from '@wordpress/element';
import { DashboardApp } from './DashboardApp';
import '../styles/dashboard.scss';

function initDashboard() {
  const rootEl = document.getElementById('translatesense-admin-root');
  if (rootEl && !rootEl._tsReactRoot) {
    const root = createRoot(rootEl);
    rootEl._tsReactRoot = root;
    root.render(<DashboardApp />);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
