/**
 * Provider Registry Adapter
 */

import { getCoreInstance } from '../core/coreService';

/**
 * Get raw registered providers from Core or window registry
 * @param {boolean} [enabledOnly=true]
 * @returns {Array<Object>}
 */
export function getRegisteredProviders(enabledOnly = true) {
  const core = getCoreInstance();

  let list = core.getProviders(enabledOnly);
  if (list && list.length > 0) {
    return list;
  }

  return [];
}

