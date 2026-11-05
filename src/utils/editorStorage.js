/**
 * TranslateSense - Editor Navigation Storage Utilities
 * Manages localStorage state when navigating between editors (e.g. Classic/Gutenberg to Elementor)
 */

export const EDITOR_OPEN_STORAGE_KEY = 'translateSenseEditorOpen';
export const EDITOR_OPEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generates composite key from source post ID and target language.
 * Format: `${sourcePostId}_${targetLanguage}`
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 * @returns {string}
 */
export function getEditorOpenKey(sourcePostId, targetLang) {
  const id = parseInt(sourcePostId, 10);
  if (!id || !targetLang) return '';
  return `${id}_${String(targetLang).trim().toLowerCase()}`;
}

/**
 * Sets an entry in `translateSenseEditorOpen` with 5 minutes.
 * Multiple posts are kept in the same object. Expired entries are pruned.
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 */
export function setEditorOpenFlag(sourcePostId, targetLang) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const itemKey = getEditorOpenKey(sourcePostId, targetLang);
  if (!itemKey) return;

  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    let store = {};
    if (raw) {
      try {
        store = JSON.parse(raw) || {};
      } catch (e) {
        store = {};
      }
    }

    const cleaned = {};
    for (const [k, v] of Object.entries(store)) {
      const itemExpiry = v?.expiresAt;
      if (itemExpiry && itemExpiry > now) {
        cleaned[k] = v;
      }
    }

    cleaned[itemKey] = {
      sourcePostId: parseInt(sourcePostId, 10),
      targetLanguage: String(targetLang).trim().toLowerCase(),
      expiresAt: now + EDITOR_OPEN_EXPIRY_MS,
    };

    window.localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('[TranslateSense] Could not set editor open flag in localStorage:', err);
  }
}

/**
 * Checks and consumes the editor open flag for the current post in Elementor editor.
 * If found and not expired:
 * - Deletes this specific post's key from the object.
 * - Prunes any other expired entries.
 * - If the object has no items left, completely deletes the localStorage key.
 * - Returns true.
 *
 * If not found or expired:
 * - Prunes any expired entries.
 * - If empty, removes the localStorage key.
 * - Returns false.
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 * @returns {boolean}
 */
export function checkAndConsumeEditorOpenFlag(sourcePostId, targetLang) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const itemKey = getEditorOpenKey(sourcePostId, targetLang);
  if (!itemKey) return false;

  try {
    const raw = window.localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    if (!raw) return false;

    let store = {};
    try {
      store = JSON.parse(raw) || {};
    } catch (e) {
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
      return false;
    }

    const now = Date.now();
    let hasMatch = false;
    const cleaned = {};

    for (const [k, v] of Object.entries(store)) {
      const itemExpiry = v?.expiresAt;
      // Skip expired items
      if (!itemExpiry || itemExpiry <= now) {
        continue;
      }

      if (k === itemKey) {
        // Matched! Consume and delete it by not copying to cleaned
        hasMatch = true;
      } else {
        cleaned[k] = v;
      }
    }

    // If cleaned still has remaining unexpired items for other posts, update storage
    if (Object.keys(cleaned).length > 0) {
      window.localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, JSON.stringify(cleaned));
    } else {
      // Once object doesn't have any items, delete the localStorage key entirely
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
    }

    return hasMatch;
  } catch (err) {
    console.warn('[TranslateSense] Error checking editor open flag:', err);
    return false;
  }
}

/**
 * Removes the editor open flag for a given post if navigation was aborted or failed.
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 */
export function removeEditorOpenFlag(sourcePostId, targetLang) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const itemKey = getEditorOpenKey(sourcePostId, targetLang);
  if (!itemKey) return;

  try {
    const raw = window.localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    if (!raw) return;

    let store = {};
    try {
      store = JSON.parse(raw) || {};
    } catch (e) {
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
      return;
    }

    delete store[itemKey];

    const now = Date.now();
    const cleaned = {};
    for (const [k, v] of Object.entries(store)) {
      const itemExpiry = v?.expiresAt;
      if (itemExpiry && itemExpiry > now) {
        cleaned[k] = v;
      }
    }

    if (Object.keys(cleaned).length > 0) {
      window.localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, JSON.stringify(cleaned));
    } else {
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
    }
  } catch (e) { }
}

