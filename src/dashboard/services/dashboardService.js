/**
 * Dashboard Service
 * Handles all REST API requests for the Dashboard application
 */

import { apiRequest } from '../../services/api/apiClient';
import { ENDPOINTS } from '../../services/api/endpoints';

/**
 * Fetch builder widgets mapping data
 */
export async function fetchWidgets() {
  return await apiRequest(ENDPOINTS.WIDGETS, { method: 'GET' });
}

/**
 * Fetch XML configurations for builders
 * @param {'all'|'gutenberg'|'elementor'} builder
 */
export async function fetchXmlConfig(builder = 'all') {
  return await apiRequest(ENDPOINTS.XML_CONFIG, {
    method: 'GET',
    params: { builder },
  });
}

/**
 * Save XML configuration for a builder
 * @param {'all'|'gutenberg'|'elementor'} builder
 * @param {string} xml
 */
export async function saveXmlConfig(builder, xml) {
  return await apiRequest(ENDPOINTS.XML_CONFIG, {
    method: 'POST',
    data: { builder, xml },
  });
}

/**
 * Fetch plugin settings
 */
export async function fetchSettings() {
  return await apiRequest(ENDPOINTS.SETTINGS, { method: 'GET' });
}

/**
 * Save plugin settings
 * @param {Object} settings
 */
export async function saveSettings(settings) {
  return await apiRequest(ENDPOINTS.SETTINGS, {
    method: 'POST',
    data: settings,
  });
}

/**
 * Create a mapping test post sandbox
 * @param {string} builder
 * @param {string} widgetId
 */
export async function openMappingSandbox(builder, widgetId) {
  return await apiRequest(ENDPOINTS.OPEN_MAPPING_SANDBOX, {
    method: 'POST',
    data: { builder, widget_id: widgetId },
  });
}

/**
 * Fetch cache statistics
 */
export async function fetchCacheStats() {
  return await apiRequest(ENDPOINTS.CACHE_STATS, { method: 'GET' });
}

/**
 * Clear specific or all cache
 * @param {'translations'|'strings'|'packages'|'logs'|'all'} type
 */
export async function clearCache(type) {
  return await apiRequest(ENDPOINTS.CLEAR_CACHE, {
    method: 'POST',
    data: { type },
  });
}
