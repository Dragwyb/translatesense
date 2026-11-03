/**
 * Validation utilities
 */

/**
 * Check if a string represents an email address, URL, or URL-related file path.
 * Used to avoid sending URLs or assets to AI for translation.
 * @param {string} str
 * @returns {boolean}
 */
export function isEmailOrUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();
  if (!clean) return false;

  // 1. Email or mailto:
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /^mailto:/i.test(clean)) return true;

  // 2. Protocols and schemes
  if (/^(https?:\/\/|ftp:\/\/|\/\/|www\.|tel:|sms:|javascript:|callto:|whatsapp:)/i.test(clean)) return true;

  // 3. Media or asset paths
  if (/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i.test(clean)) {
    return true;
  }

  // 4. Domain-like strings
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]*$/i.test(clean)) return true;

  return false;
}

