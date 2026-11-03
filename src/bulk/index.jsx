/**
 * TranslateSense Bulk Translation Entry Point
 */

import { createRoot } from '@wordpress/element';
import { BulkApp } from './BulkApp';
import '../styles/bulk.scss';

function initBulk() {
  let rootEl = document.getElementById('translatesense-bulk-modal-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'translatesense-bulk-modal-root';
    document.body.appendChild(rootEl);
  }

  if (rootEl && !rootEl._tsReactRoot) {
    const root = createRoot(rootEl);
    rootEl._tsReactRoot = root;
    root.render(<BulkApp />);
  }
}

(function (window, document) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulk);
  } else {
    initBulk();
  }
})(window, document);

