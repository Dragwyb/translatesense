/**
 * Centralized API Client for TranslateSense
 */

/**
 * Get localized configuration and nonce
 * @returns {{ restUrl: string, nonce: string }}
 */
export function getApiConfig() {
  if (typeof window === 'undefined') {
    return { restUrl: '/wp-json/translatesense/v1/', nonce: '' };
  }

  const globalConfig =
    window.TranslateSenseData ||
    window.TranslateSenseBulkData ||
    window.TranslateSenseEditorData ||
    {};

  let restUrl = globalConfig.restUrl || '/wp-json/translatesense/v1/';
  if (!restUrl.endsWith('/')) {
    restUrl += '/';
  }

  const nonce = globalConfig.nonce || (window.wpApiSettings && window.wpApiSettings.nonce) || '';

  return { restUrl, nonce };
}

/**
 * Standardized API error
 */
export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Performs a REST API request to TranslateSense
 *
 * @param {string} endpoint - API endpoint (without leading slash or namespace)
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET']
 * @param {Object|null} [options.data=null] - Request body (for POST/PUT)
 * @param {Object} [options.params={}] - Query parameters (for GET)
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', data = null, params = {}, signal } = options;
  const { restUrl, nonce } = getApiConfig();

  // If wp.apiFetch is available and we're in the WordPress admin
  if (typeof window !== 'undefined' && window.wp && typeof window.wp.apiFetch === 'function') {
    try {
      const cleanEndpoint = endpoint.replace(/^\/+/, '');
      const path = `/translatesense/v1/${cleanEndpoint}`;

      const fetchOptions = {
        path,
        method,
        signal,
      };

      if (data && method !== 'GET') {
        fetchOptions.data = data;
      }

      // Append query params if GET
      if (params && Object.keys(params).length > 0) {
        const queryStr = new URLSearchParams(params).toString();
        fetchOptions.path = `${path}?${queryStr}`;
      }

      return await window.wp.apiFetch(fetchOptions);
    } catch (err) {
      const message = err.message || err.code || 'API request failed';
      const status = err.status || (err.data && err.data.status) || 500;
      console.error(message, status, err);
    }
  }

  // Fallback to native fetch
  let fullUrl = `${restUrl}${endpoint.replace(/^\/+/, '')}`;
  if (params && Object.keys(params).length > 0) {
    const queryStr = new URLSearchParams(params).toString();
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryStr;
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-WP-Nonce': nonce,
  };

  const fetchConfig = {
    method,
    headers,
    signal,
  };

  if (data && method !== 'GET') {
    fetchConfig.body = JSON.stringify(data);
  }

  let response;
  try {
    response = await fetch(fullUrl, fetchConfig);
  } catch (netErr) {
    console.error(`Network error: ${netErr.message}`, 0, netErr);
  }

  let resData;
  try {
    resData = await response.json();
  } catch {
    resData = null;
  }

  if (!response.ok) {
    const errorMsg =
      (resData && (resData.message || resData.error)) ||
      `HTTP Error ${response.status}: ${response.statusText}`;
    console.error(errorMsg, response.status, resData);
  }

  return resData;
}

