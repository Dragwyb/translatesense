/**
 * Cache Management Service
 */

import { apiRequest } from '../api/apiClient';
import { ENDPOINTS } from '../api/endpoints';

/**
 * Fetch current cache stats counts
 * @returns {Promise<{ counts: { strings: number, translations: number, packages: number, logs: number } }>}
 */
export async function getCacheStats() {
  return await apiRequest(ENDPOINTS.CACHE_STATS, { method: 'GET' });
}

/**
 * Clear a specific cache or all caches
 * @param {'translations'|'strings'|'packages'|'logs'|'all'} type
 * @returns {Promise<{ success: boolean, counts: Object, message: string }>}
 */
export async function clearCache(type) {
  return await apiRequest(ENDPOINTS.CLEAR_CACHE, {
    method: 'POST',
    data: { type },
  });
}

