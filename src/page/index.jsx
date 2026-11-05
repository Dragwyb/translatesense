/**
 * TranslateSense Universal Page Editor Entry Point
 */

import { createRoot } from '@wordpress/element';
import { PageApp } from './PageApp';
import '../styles/page.scss';

function initPageEditor() {
  let rootEl = document.getElementById('translatesense-editor-portal-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'translatesense-editor-portal-root';
    document.body.appendChild(rootEl);
  }

  if (rootEl && !rootEl._tsReactRoot) {
    const root = createRoot(rootEl);
    rootEl._tsReactRoot = root;
    root.render(<PageApp />);
  }
}

if (window?.TranslateSenseEditorData && window?.TranslateSenseEditorData?.editorType === 'elementor') {
  jQuery(window).on('elementor:init', function () {
    elementor.on('document:loaded', initPageEditor);
  });
} else {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageEditor);
  } else {
    initPageEditor();
  }
}