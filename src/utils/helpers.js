/**
 * Generic helper utilities
 */

/**
 * Promise-based delay helper
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deep clones a simple object/array
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generates UTM parameter URL for TranslateSense documentation and promotional links
 * @param {string} baseUrl
 * @param {string} campaign
 * @param {string} medium
 * @returns {string}
 */
export function generateUTMUrl(baseUrl, campaign = 'plugin_dashboard', medium = 'wp_admin') {
  if (!baseUrl) return '';
  const url = new URL(baseUrl, 'https://translatesense.com');
  url.searchParams.set('utm_source', 'translatesense_plugin');
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}

