/**
 * Bulk Translation UI Formatters
 */

import { escapeHtml } from '../../utils/html';

/**
 * Get status badge CSS class and dashicon for a translation status
 * @param {string} status
 * @returns {{ className: string, icon: string, label: string }}
 */
export function getStatusBadgeInfo(status) {
  const s = String(status || 'pending').toLowerCase();
  switch (s) {
    case 'completed':
      return { className: 'completed', icon: 'dashicons-yes-alt', label: 'Completed' };
    case 'already_exists':
      return { className: 'completed already-exists', icon: 'dashicons-yes-alt', label: 'Already exists' };
    case 'skipped':
      return { className: 'skipped', icon: 'dashicons-controls-skipforward', label: 'Skipped' };
    case 'cancelling':
      return { className: 'cancelling', icon: 'ts-spinner-circle', label: 'Cancelling...' };
    case 'failed':
      return { className: 'failed', icon: 'dashicons-dismiss', label: 'Failed' };
    case 'running':
    case 'processing':
    case 'translating':
      return { className: 'translating', icon: 'ts-spinner-circle', label: 'Translating' };
    case 'pending':
    default:
      return { className: 'pending', icon: 'dashicons-clock', label: 'Pending...' };
  }
}

/**
 * Safe title display for a translation
 */
export function getDisplayTitle(trans, postTitle, postId) {
  if (trans.targetTitle) return trans.targetTitle;
  if (trans.status === 'already_exists' || trans.status === 'completed') {
    return postTitle || `Post #${postId}`;
  }
  if (trans.status === 'failed') return `Post #${postId}`;
  if (trans.status === 'running' || trans.status === 'processing') return 'Translating content...';
  return 'Waiting in queue';
}

