/**
 * Bulk Translation Service
 */

import { apiRequest } from '../../services/api/apiClient';
import { ENDPOINTS } from '../../services/api/endpoints';

/**
 * Start a bulk translation batch
 * @param {Object} payload
 * @param {number[]} payload.post_ids
 * @param {string[]} payload.target_languages
 * @param {string} payload.provider
 * @returns {Promise<{ batch_id: string, jobs: Array, total_jobs: number }>}
 */
export async function startBulkTranslation(payload) {
  return await apiRequest(ENDPOINTS.BULK_START, {
    method: 'POST',
    data: payload,
  });
}

/**
 * Update an individual bulk translation job
 * @param {number} jobId
 * @param {Object} data
 * @returns {Promise<{ success: boolean }>}
 */
export async function updateBulkJob(jobId, data) {
  return await apiRequest(ENDPOINTS.BULK_UPDATE_JOB, {
    method: 'POST',
    data: {
      job_id: jobId,
      data,
    },
  });
}

/**
 * Skip remaining translations for a post in a batch
 * @param {string} batchId
 * @param {number} postId
 * @returns {Promise<{ success: boolean, skipped_count: number }>}
 */
export async function skipBulkPost(batchId, postId) {
  return await apiRequest(ENDPOINTS.BULK_SKIP_POST, {
    method: 'POST',
    data: {
      batch_id: batchId,
      post_id: Number(postId),
    },
  });
}

