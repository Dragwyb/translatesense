/**
 * Language utilities for TranslateSense
 */

/**
 * Get language display name with optional uppercase code
 * @param {string|Object} langInput
 * @param {Array|Object} allLanguages
 * @returns {string}
 */
export function getLanguageDisplay(langInput, allLanguages = []) {
  if (!langInput) return '';

  const langsList = Array.isArray(allLanguages)
    ? allLanguages
    : (allLanguages && typeof allLanguages === 'object' ? Object.values(allLanguages) : []);

  if (typeof langInput === 'object' && langInput !== null) {
    const code = (langInput.code || langInput.slug || '').toUpperCase();
    const name = langInput.name || code;
    return `${name} (${code})`;
  }

  const slug = String(langInput).toLowerCase();
  const found = langsList.find(
    (l) => (l.slug && l.slug.toLowerCase() === slug) || (l.code && l.code.toLowerCase() === slug)
  );

  if (found) {
    const code = (found.code || found.slug || slug).toUpperCase();
    return `${found.name || code} (${code})`;
  }

  return slug.toUpperCase();
}

/**
 * Get language flag URL or fallback code
 * @param {string|Object} langInput
 * @param {Array|Object} allLanguages
 * @returns {{ hasFlag: boolean, flagUrl: string, code: string, name: string }}
 */
export function getLanguageFlag(langInput, allLanguages = []) {
  const langsList = Array.isArray(allLanguages)
    ? allLanguages
    : (allLanguages && typeof allLanguages === 'object' ? Object.values(allLanguages) : []);

  let code = '';
  let flag = '';
  let name = '';

  if (typeof langInput === 'object' && langInput !== null) {
    code = (langInput.code || langInput.slug || '').toUpperCase();
    flag = langInput.flag || '';
    name = langInput.name || code;
  } else {
    const slug = String(langInput).toLowerCase();
    const found = langsList.find(
      (l) => (l.slug && l.slug.toLowerCase() === slug) || (l.code && l.code.toLowerCase() === slug)
    );
    if (found) {
      code = (found.code || found.slug || slug).toUpperCase();
      flag = found.flag || '';
      name = found.name || code;
    } else {
      code = slug.toUpperCase();
      name = code;
    }
  }

  return {
    hasFlag: Boolean(flag),
    flagUrl: flag,
    code,
    name,
  };
}

