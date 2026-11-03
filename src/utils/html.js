/**
 * HTML and String Sanitization utilities
 */

/**
 * Escapes HTML characters for safe DOM insertion
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strips HTML tags from text
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '');
}

/**
 * Trims linebreaks at start/end of contenteditable edits
 * @param {string} str
 * @returns {string}
 */
export function cleanContentEditable(str) {
  if (!str) return '';
  return String(str).replace(/^\r?\n+|\r?\n+$/g, '');
}

