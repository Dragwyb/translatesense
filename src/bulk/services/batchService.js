/**
 * Batch Polling and Monitoring Service
 */

import { apiRequest } from '../../services/api/apiClient';
import { ENDPOINTS } from '../../services/api/endpoints';

/**
 * Fetch batch status and progress
 * @param {string} batchId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function getBatchStatus(batchId, signal) {
  return await apiRequest(ENDPOINTS.BULK_STATUS, {
    method: 'GET',
    params: { batch_id: batchId },
    signal,
  });
}

/**
 * Fetch currently running active batches
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ batches: Array<Object> }>}
 */
export async function getActiveBatches(signal) {
  return await apiRequest(ENDPOINTS.BULK_ACTIVE_BATCHES, {
    method: 'GET',
    signal,
  });
}

