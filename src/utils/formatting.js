/**
 * Formatting utilities for TranslateSense
 */

/**
 * Format numbers with compact K/M notation or locale string
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return n.toLocaleString();
}

/**
 * Format seconds into mm:ss or Xm Ys
 * @param {number} seconds
 * @param {boolean} humanReadable
 * @returns {string}
 */
export function formatDuration(seconds, humanReadable = false) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;

  if (humanReadable) {
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format elapsed milliseconds into human time
 * @param {number} ms
 * @returns {string}
 */
export function formatMs(ms) {
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

