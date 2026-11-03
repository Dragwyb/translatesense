/**
 * Adapter Service for TranslateSenseCore
 *
 * Wraps window.TranslateSenseCore so components do not access globals directly.
 */
import TranslateSenseCore from './coreInstance';

let coreInstance = null;

/**
 * Returns the singleton TranslateSenseCore instance
 * @returns {Object|null}
 */
export function getCoreInstance() {
  if (coreInstance) {
    return coreInstance;
  }

  coreInstance = new TranslateSenseCore();
  return coreInstance;
}

/**
 * Reset core instance (e.g. for testing)
 */
export function resetCoreInstance() {
  coreInstance = null;
}
