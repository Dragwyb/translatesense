/**
 * Prompt Service
 * Centralized service to manage initial Auto Translate prompt modal state and meta deletion.
 */

import { apiRequest } from './apiClient';
import { ENDPOINTS } from './endpoints';

const dismissedPosts = new Set();

/**
 * Dismiss the initial prompt modal by deleting the _show_initial_prompt_modal post meta key via REST API.
 *
 * @param {number|string} postId
 * @returns {Promise<any>}
 */
export async function dismissInitialPrompt(postId) {
  const id = parseInt(postId, 10);
  if (!id || id <= 0) return Promise.resolve();

  if (dismissedPosts.has(id)) {
    return Promise.resolve();
  }
  dismissedPosts.add(id);

  // Update in-memory localized configuration in the current session
  if (typeof window !== 'undefined') {
    if (window.TranslateSenseEditorData) {
      window.TranslateSenseEditorData.showInitialPromptModal = false;
    }
    if (window.TranslateSenseEditorModalData) {
      window.TranslateSenseEditorModalData.showInitialPromptModal = false;
    }
  }

  try {
    return await apiRequest(ENDPOINTS.DISMISS_INITIAL_PROMPT, {
      method: 'POST',
      data: { post_id: id },
    });
  } catch (err) {
    console.warn('[TranslateSense] Could not dismiss initial prompt:', err);
  }
}

// Expose on window so scripts without module bundling can reuse the centralized helper
if (typeof window !== 'undefined') {
  window.TranslateSenseDismissInitialPrompt = dismissInitialPrompt;
}

