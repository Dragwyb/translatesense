/**
 * Provider Service
 * Evaluates provider availability, status badges, and options
 */

import { getRegisteredProviders } from './providerRegistry';

/**
 * Get plugin localized configuration
 */
function getConfig() {
  if (typeof window === 'undefined') return {};
  return (
    window.TranslateSenseEditorData ||
    window.TranslateSenseBulkData ||
    window.TranslateSenseData ||
    {}
  );
}

/**
 * Check single provider status metadata
 */
export function getProviderMeta(id, config = getConfig()) {
  const enabledProviders = config.enabledProviders || {};
  const settingsUrl = config.settingsUrl || 'admin.php?page=translatesense&tab=settings';
  const connectorsUrl = config.connectorsUrl || 'options-connectors.php';

  if (
    enabledProviders &&
    typeof enabledProviders === 'object' &&
    !Array.isArray(enabledProviders) &&
    enabledProviders[id]
  ) {
    const meta = enabledProviders[id];
    const isConn = meta.isConnected !== false;
    const isCore = Boolean(meta.connectors);
    const isInstall = meta.isProviderInstall !== undefined ? Boolean(meta.isProviderInstall) : true;
    const isActive = meta.isProviderActive !== undefined ? Boolean(meta.isProviderActive) : true;

    return {
      isConnected: isConn,
      connectors: isCore,
      isProviderInstall: isInstall,
      isProviderActive: isActive,
      targetUrl: isCore ? connectorsUrl : settingsUrl,
    };
  }

  const isMissing =
    id === 'openai' ? !config.hasOpenAiKey : id === 'gemini' ? !config.hasGeminiKey : false;

  return {
    isConnected: !isMissing,
    connectors: false,
    isProviderInstall: false,
    isProviderActive: false,
    targetUrl: settingsUrl,
  };
}

/**
 * Evaluates full provider list with support checks for language pair
 *
 * @param {string} [sourceLang='en']
 * @param {string} [targetLang='es']
 * @returns {Promise<Array<Object>>}
 */
export async function getEvaluatedProviders(sourceLang = 'en', targetLang = 'es') {
  const config = getConfig();
  let providers = getRegisteredProviders(true);
  if (providers.length === 0) {
    providers = getRegisteredProviders(false);
  }

  // Deep clone to avoid mutating registry
  const list = providers.map((p) => ({ ...p }));

  for (const p of list) {
    const isFrontend = p.id === 'chrome_ai' || p.id === 'chrome_local_ai';
    const statusMeta = getProviderMeta(p.id, config);
    p.statusMeta = statusMeta;

    if (isFrontend) {
      if (typeof p.checkAvailability === 'function') {
        try {
          p.isSupported = await p.checkAvailability(sourceLang, targetLang, true);
        } catch (e) {
          p.isSupported = { available: false, reason: e.message };
        }
      }
      p.isAvailable = !(p.isSupported && p.isSupported.available === false);
      p.badgeType = p.isAvailable ? 'on-device' : 'error';
      p.badgeText = p.isAvailable ? 'On-device' : 'View Error';
    } else if (statusMeta.connectors && statusMeta.isProviderInstall) {
      if (!statusMeta.isProviderActive) {
        p.isAvailable = false;
        p.badgeType = 'action';
        p.badgeText = 'Activate Provider';
        p.actionUrl = statusMeta.targetUrl;
      } else if (!statusMeta.isConnected) {
        p.isAvailable = false;
        p.badgeType = 'action';
        p.badgeText = 'API key required';
        p.actionUrl = statusMeta.targetUrl;
      } else {
        p.isAvailable = true;
        p.badgeType = 'connector';
        p.badgeText = 'WP Connector';
      }
    } else {
      // Direct API
      if (!statusMeta.isConnected) {
        p.isAvailable = false;
        p.badgeType = 'action';
        p.badgeText = 'API key required';
        p.actionUrl = statusMeta.targetUrl;
      } else {
        p.isAvailable = true;
        p.badgeType = 'ready';
        p.badgeText = 'Available';
      }
    }
  }

  return list;
}

