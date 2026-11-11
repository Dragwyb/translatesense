/**
 * Page Editor Translation Service
 */

import { apiRequest } from '../../services/api/apiClient';
import { ENDPOINTS } from '../../services/api/endpoints';

/**
 * Extract translatable strings from post content
 */
export async function extractPostStrings(postId, builder, targetLang) {
  return await apiRequest(ENDPOINTS.EXTRACT_STRINGS, {
    method: 'POST',
    data: {
      post_id: Number(postId),
      builder,
      target_lang: targetLang,
      include_taxonomies: false,
    },
  });
}

/**
 * Save mark-translated status and statistics to WordPress
 */
export async function markPostTranslated(payload) {
  return await apiRequest(ENDPOINTS.MARK_TRANSLATED, {
    method: 'POST',
    data: payload,
  });
}

/**
 * Fallback server translation of post
 */
export async function translatePostServer(postId, targetLang, provider) {
  return await apiRequest(ENDPOINTS.TRANSLATE_POST, {
    method: 'POST',
    data: {
      post_id: Number(postId),
      target_lang: targetLang,
      provider,
      include_taxonomies: false,
    },
  });
}

