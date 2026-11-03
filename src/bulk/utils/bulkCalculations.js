/**
 * Pure calculation functions for Bulk Translation progress and statistics
 */

/**
 * Calculates progress percentage for a single post item.
 *
 * @param {Object} item
 * @param {string} [item.status]
 * @param {number} [item.total_strings]
 * @param {number} [item.completed_strings]
 * @param {number} [item.progress_percent]
 * @returns {number} Integer between 0 and 100
 */
export function getPostProgress(item) {
  if (!item || typeof item !== 'object') return 0;

  const status = String(item.status || '').toLowerCase();

  // Terminal states represent 100% resolution of that specific job
  if (status === 'completed' || status === 'already_exists' || status === 'skipped' || status === 'failed') {
    return 100;
  }

  // If explicit progress_percent is provided by server
  if (typeof item.progress_percent === 'number' && !isNaN(item.progress_percent)) {
    return Math.max(0, Math.min(100, Math.round(item.progress_percent)));
  }

  const total = Number(item.total_strings) || 0;
  const completed = Number(item.completed_strings) || 0;

  if (total > 0) {
    const calculated = Math.round((completed / total) * 100);
    // While in progress, clamp below 100 until fully completed
    return Math.max(status === 'running' || status === 'processing' ? 5 : 0, Math.min(99, calculated));
  }

  if (status === 'running' || status === 'processing') {
    return 15;
  }

  return 0;
}

/**
 * Calculate post-weighted overall progress percentage across all batch items.
 *
 * @param {Array<Object>} items
 * @returns {number} Integer between 0 and 100
 */
export function getOverallProgress(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  let totalWeightedProgress = 0;

  for (let i = 0; i < items.length; i++) {
    totalWeightedProgress += getPostProgress(items[i]);
  }

  const overall = Math.round(totalWeightedProgress / items.length);
  return Math.max(0, Math.min(100, overall));
}

/**
 * Aggregates statistics across an array of batch jobs or translations.
 *
 * @param {Array<Object>} items
 * @returns {{
 *   total: number,
 *   completed: number,
 *   failed: number,
 *   skipped: number,
 *   alreadyExists: number,
 *   pending: number,
 *   running: number,
 *   totalCharacters: number,
 *   completedCharacters: number
 * }}
 */
export function calculateBatchStats(items) {
  const stats = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    alreadyExists: 0,
    pending: 0,
    running: 0,
    totalCharacters: 0,
    completedCharacters: 0,
  };

  if (!Array.isArray(items)) return stats;

  stats.total = items.length;

  for (const item of items) {
    const status = String(item.status || 'pending').toLowerCase();
    const chars = Number(item.total_characters || item.totalCharacters) || (item.total_strings ? item.total_strings * 45 : 0);
    const compChars = Number(item.completed_characters || item.completedCharacters) || (item.completed_strings ? item.completed_strings * 45 : 0);

    stats.totalCharacters += chars;

    if (status === 'completed') {
      stats.completed++;
      stats.completedCharacters += (compChars || chars);
    } else if (status === 'already_exists') {
      stats.alreadyExists++;
      stats.completedCharacters += (compChars || chars);
    } else if (status === 'failed') {
      stats.failed++;
    } else if (status === 'skipped') {
      stats.skipped++;
    } else if (status === 'running' || status === 'processing' || status === 'cancelling') {
      stats.running++;
      stats.completedCharacters += compChars;
    } else {
      stats.pending++;
    }
  }

  if (stats.totalCharacters < stats.completedCharacters) {
    stats.totalCharacters = stats.completedCharacters;
  }

  return stats;
}

