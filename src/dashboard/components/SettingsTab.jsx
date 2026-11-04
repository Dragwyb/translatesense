/**
 * SettingsTab Component - General Settings Panel
 */

import { useState, useEffect } from '@wordpress/element';
import { DashboardIcons } from './DashboardIcons';

export function SettingsTab({
  settings,
  setSettings,
  languages = {},
  showNotice,
  activeProviders = {},
  connectorsUrl = 'options-connectors.php',
  providerModels = {},
}) {
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const enabledProviders = settings.enabled_providers || ['chrome_ai', 'openai', 'gemini'];
  const currentDefaultProvider = settings.provider || '';

  const getProviderStatus = (id) => {
    if (activeProviders && typeof activeProviders === 'object' && activeProviders[id]) {
      const meta = activeProviders[id];
      return {
        isConnected: meta.isConnected !== false,
        connectors: Boolean(meta.connectors),
        isProviderInstall: meta.isProviderInstall !== undefined ? Boolean(meta.isProviderInstall) : true,
        isProviderActive: meta.isProviderActive !== undefined ? Boolean(meta.isProviderActive) : true,
      };
    }
    const isKeyConfigured =
      id === 'openai'
        ? Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key)
        : id === 'gemini'
          ? Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key)
          : true;
    return {
      isConnected: isKeyConfigured,
      connectors: false,
      isProviderInstall: false,
      isProviderActive: false,
    };
  };

  const openAiStatus = getProviderStatus('openai');
  const geminiStatus = getProviderStatus('gemini');

  const defaultOpenAiModels = [
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini ( Fast & Cost-Effective )' },
    { id: 'gpt-4o', name: 'gpt-4o ( Flagship Reasoning )' },
    { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo ( Legacy )' },
  ];
  const defaultGeminiModels = [
    { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash ( High Speed & Quality )' },
    { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash ( Fast & Efficient )' },
    { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro ( Deep Context )' },
  ];

  const openAiModels =
    providerModels && Array.isArray(providerModels.openai) && providerModels.openai.length > 0
      ? providerModels.openai
      : defaultOpenAiModels;

  const geminiModels =
    providerModels && Array.isArray(providerModels.gemini) && providerModels.gemini.length > 0
      ? providerModels.gemini
      : providerModels && Array.isArray(providerModels.google) && providerModels.google.length > 0
        ? providerModels.google
        : defaultGeminiModels;

  const toggleProvider = (providerId) => {
    let updated;
    if (enabledProviders.includes(providerId)) {
      if (enabledProviders.length === 1) {
        if (showNotice) showNotice('At least one translation provider must remain enabled.', 'error');
        return;
      }
      updated = enabledProviders.filter((p) => p !== providerId);
    } else {
      updated = [...enabledProviders, providerId];
    }
    setSettings({ ...settings, enabled_providers: updated });
  };

  const insertTag = (tag) => {
    const textarea = document.getElementById('ts-custom-prompt-editor');
    const currentVal =
      settings.custom_prompt !== undefined && settings.custom_prompt !== ''
        ? settings.custom_prompt
        : settings.default_prompt || '';

    if (!textarea) {
      setSettings({ ...settings, custom_prompt: `${currentVal} ${tag}` });
      return;
    }

    const start = textarea.selectionStart || currentVal.length;
    const end = textarea.selectionEnd || currentVal.length;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    setSettings({ ...settings, custom_prompt: newVal });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const copyPromptToClipboard = () => {
    const val =
      settings.custom_prompt !== undefined && settings.custom_prompt !== ''
        ? settings.custom_prompt
        : settings.default_prompt || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(val);
      if (showNotice) showNotice('Prompt template copied to clipboard!');
    }
  };

  const getTemperatureLabel = (temp) => {
    const t = parseFloat(temp);
    if (t <= 0.25) return '0.0 - 0.25: Highly Precise & Literal (Best for UI & Technical Terms)';
    if (t <= 0.6) return '0.3 - 0.6: Balanced & Natural (Recommended)';
    return '0.7 - 1.0: Creative & Fluid (More expressive variation)';
  };

  const currentPromptVal =
    settings.custom_prompt !== undefined && settings.custom_prompt !== ''
      ? settings.custom_prompt
      : settings.default_prompt || '';

  const getProviderLogo = (providerId) => {
    const pluginUrl =
      typeof window !== 'undefined' && window.TranslateSenseData && window.TranslateSenseData.pluginUrl
        ? window.TranslateSenseData.pluginUrl
        : '';
    return pluginUrl ? `${pluginUrl}assets/img/providers/${providerId}.png` : '';
  };

  // Determine OpenAI badge tag class, label & action button
  let openAiTagClass = 'offline';
  let openAiTagText = 'Disabled';
  let openAiConnectorDesc = '';
  let openAiConnectorBtnText = '';

  if (enabledProviders.includes('openai')) {
    if (openAiStatus.connectors && openAiStatus.isProviderInstall) {
      if (!openAiStatus.isProviderActive) {
        openAiTagClass = 'setup-connector';
        openAiTagText = 'Activate Provider';
        openAiConnectorDesc = 'WordPress AI Connector plugin for OpenAI is installed but inactive.';
        openAiConnectorBtnText = 'Activate in WP Connectors ↗';
      } else if (!openAiStatus.isConnected) {
        openAiTagClass = 'key-needed';
        openAiTagText = 'API Key Needed';
        openAiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed.';
        openAiConnectorBtnText = 'Connect in WP Connectors ↗';
      } else {
        openAiTagClass = 'wp-connector';
        openAiTagText = 'WP Connector Active';
        openAiConnectorDesc = 'Managed natively via WordPress AI Client.';
        openAiConnectorBtnText = 'Manage in WP Connectors ↗';
      }
    } else {
      const hasOpenAiKey = Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key);
      openAiTagClass = hasOpenAiKey ? 'ready' : 'key-needed';
      openAiTagText = hasOpenAiKey ? 'Configured' : 'API Key Needed';
    }
  }

  // Determine Gemini badge tag class, label & action button
  let geminiTagClass = 'offline';
  let geminiTagText = 'Disabled';
  let geminiConnectorDesc = '';
  let geminiConnectorBtnText = '';

  if (enabledProviders.includes('gemini')) {
    if (geminiStatus.connectors && geminiStatus.isProviderInstall) {
      if (!geminiStatus.isProviderActive) {
        geminiTagClass = 'setup-connector';
        geminiTagText = 'Activate Provider';
        geminiConnectorDesc = 'WordPress AI Connector plugin for Google Gemini is installed but inactive.';
        geminiConnectorBtnText = 'Activate in WP Connectors ↗';
      } else if (!geminiStatus.isConnected) {
        geminiTagClass = 'key-needed';
        geminiTagText = 'API Key Needed';
        geminiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed.';
        geminiConnectorBtnText = 'Connect in WP Connectors ↗';
      } else {
        geminiTagClass = 'wp-connector';
        geminiTagText = 'WP Connector Active';
        geminiConnectorDesc = 'Managed natively via WordPress AI Client (Google).';
        geminiConnectorBtnText = 'Manage in WP Connectors ↗';
      }
    } else {
      const hasGeminiKey = Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key);
      geminiTagClass = hasGeminiKey ? 'ready' : 'key-needed';
      geminiTagText = hasGeminiKey ? 'Configured' : 'API Key Needed';
    }
  }

  const isOpenAiConnected = openAiStatus.isConnected || Boolean(settings.openai_api_key);
  const isGeminiConnected = geminiStatus.isConnected || Boolean(settings.gemini_api_key);

  const curStatus = ['draft', 'publish'].includes(settings.post_status) ? settings.post_status : 'draft';
  const curSlugMode = ['keep_orignal', 'title_based', 'slug_translate'].includes(settings.slug_translation)
    ? settings.slug_translation
    : 'slug_translate';

  return (
    <div className="ts-settings-panel">
      {/* 1. AI Translation Engines Card */}
      <div className="ts-settings-card">
        <div className="ts-settings-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="ts-settings-globe-icon">{DashboardIcons.globe()}</div>
            <div className="ts-settings-card-title-group">
              <h3>AI Translation Engines &amp; Models</h3>
              <p>Configure active translation engines, API authentication keys, and target neural models.</p>
            </div>
          </div>
          <div className="ts-default-engine-wrap">
            <span className="ts-default-engine-label">Default Engine:</span>
            <div className="ts-default-engine-select-box">
              {currentDefaultProvider && (
                <img
                  src={getProviderLogo(currentDefaultProvider)}
                  alt={currentDefaultProvider}
                  className="ts-default-engine-logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <select
                className="ts-default-engine-select"
                value={currentDefaultProvider}
                onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
              >
                <option value="">— Select Default —</option>
                <option value="chrome_ai">Chrome Built-in AI</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="gemini">Google Gemini AI</option>
              </select>
            </div>
          </div>
        </div>

        {/* Providers 3-Card Grid */}
        <div className="ts-providers-grid">
          {/* OpenAI Card */}
          <div className={`ts-provider-card openai ${enabledProviders.includes('openai') ? 'enabled' : ''} ${currentDefaultProvider === 'openai' ? 'default-provider' : ''}`}>
            <div className="ts-provider-card-top">
              <div className="ts-provider-info">
                <div className="ts-provider-icon">
                  <img
                    src={getProviderLogo('openai')}
                    alt="OpenAI"
                    className="ts-provider-logo-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
                    }}
                  />
                </div>
                <div>
                  <h4 className="ts-provider-name">OpenAI (ChatGPT)</h4>
                  <span className={`ts-provider-tag ${openAiTagClass}`}>{openAiTagText}</span>
                </div>
              </div>
              <label className="ts-modern-switch" title="Enable/Disable OpenAI">
                <input
                  type="checkbox"
                  checked={enabledProviders.includes('openai')}
                  onChange={() => toggleProvider('openai')}
                />
                <span className="ts-modern-slider" />
              </label>
            </div>
            <p className="ts-provider-desc">
              Industry standard high-accuracy neural machine translation with strict HTML tags and attribute preservation.
            </p>
            <div className="ts-provider-body">
              {openAiStatus.connectors && openAiStatus.isProviderInstall ? (
                <div className="ts-connector-box">
                  <div className="ts-connector-header">
                    <span className="ts-connector-icon">{DashboardIcons.bolt({ size: 12 })}</span>
                    <span className="ts-connector-title">WordPress AI Connector</span>
                  </div>
                  <p className="ts-connector-desc">{openAiConnectorDesc}</p>
                  <a
                    href={connectorsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ts-btn-connector"
                  >
                    {openAiConnectorBtnText}
                  </a>
                </div>
              ) : (
                <div className="ts-input-group">
                  <label>
                    <span>OpenAI API Key</span>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ts-input-link"
                    >
                      Get Key ↗
                    </a>
                  </label>
                  <div className="ts-input-password-wrap">
                    <input
                      type={showOpenAiKey ? 'text' : 'password'}
                      className="ts-form-input"
                      value={typeof settings.openai_api_key === 'string' ? settings.openai_api_key : ''}
                      placeholder="sk-proj-..."
                      disabled={!enabledProviders.includes('openai')}
                      onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value.trim() })}
                    />
                    <button
                      type="button"
                      className="ts-pw-toggle-btn"
                      title={showOpenAiKey ? 'Hide key' : 'Show key'}
                      onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                    >
                      {showOpenAiKey ? DashboardIcons.eyeOff() : DashboardIcons.eye()}
                    </button>
                  </div>
                </div>
              )}

              {isOpenAiConnected && (
                <div className="ts-input-group">
                  <label>
                    <span>Translation Model</span>
                  </label>
                  <select
                    className="ts-form-select"
                    value={settings.openai_model || (openAiModels[0] && openAiModels[0].id) || 'gpt-4o-mini'}
                    disabled={!enabledProviders.includes('openai')}
                    onChange={(e) => setSettings({ ...settings, openai_model: e.target.value })}
                  >
                    {openAiModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name ? (m.name === m.id ? m.id : m.name) : m.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Gemini Card */}
          <div className={`ts-provider-card gemini ${enabledProviders.includes('gemini') ? 'enabled' : ''} ${currentDefaultProvider === 'gemini' ? 'default-provider' : ''}`}>
            <div className="ts-provider-card-top">
              <div className="ts-provider-info">
                <div className="ts-provider-icon">
                  <img
                    src={getProviderLogo('gemini')}
                    alt="Google Gemini AI"
                    className="ts-provider-logo-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
                    }}
                  />
                </div>
                <div>
                  <h4 className="ts-provider-name">Google Gemini AI</h4>
                  <span className={`ts-provider-tag ${geminiTagClass}`}>{geminiTagText}</span>
                </div>
              </div>
              <label className="ts-modern-switch" title="Enable/Disable Gemini">
                <input
                  type="checkbox"
                  checked={enabledProviders.includes('gemini')}
                  onChange={() => toggleProvider('gemini')}
                />
                <span className="ts-modern-slider" />
              </label>
            </div>
            <p className="ts-provider-desc">
              Ultra-fast contextual multilingual models by Google with massive token windows and excellent localization fluency.
            </p>
            <div className="ts-provider-body">
              {geminiStatus.connectors && geminiStatus.isProviderInstall ? (
                <div className="ts-connector-box">
                  <div className="ts-connector-header">
                    <span className="ts-connector-icon">{DashboardIcons.bolt({ size: 12 })}</span>
                    <span className="ts-connector-title">WordPress AI Connector</span>
                  </div>
                  <p className="ts-connector-desc">{geminiConnectorDesc}</p>
                  <a
                    href={connectorsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ts-btn-connector"
                  >
                    {geminiConnectorBtnText}
                  </a>
                </div>
              ) : (
                <div className="ts-input-group">
                  <label>
                    <span>Gemini API Key</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ts-input-link"
                    >
                      Get Key ↗
                    </a>
                  </label>
                  <div className="ts-input-password-wrap">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      className="ts-form-input"
                      value={typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key : ''}
                      placeholder="AIzaSy..."
                      disabled={!enabledProviders.includes('gemini')}
                      onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value.trim() })}
                    />
                    <button
                      type="button"
                      className="ts-pw-toggle-btn"
                      title={showGeminiKey ? 'Hide key' : 'Show key'}
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                    >
                      {showGeminiKey ? DashboardIcons.eyeOff() : DashboardIcons.eye()}
                    </button>
                  </div>
                </div>
              )}

              {isGeminiConnected && (
                <div className="ts-input-group">
                  <label>
                    <span>Translation Model</span>
                  </label>
                  <select
                    className="ts-form-select"
                    value={settings.gemini_model || 'gemini-2.0-flash'}
                    disabled={!enabledProviders.includes('gemini')}
                    onChange={(e) => setSettings({ ...settings, gemini_model: e.target.value })}
                  >
                    {geminiModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name ? (m.name === m.id ? m.id : m.name) : m.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Chrome AI Card */}
          <div className={`ts-provider-card chrome_ai ${enabledProviders.includes('chrome_ai') ? 'enabled' : ''} ${currentDefaultProvider === 'chrome_ai' ? 'default-provider' : ''}`}>
            <div className="ts-provider-card-top">
              <div className="ts-provider-info">
                <div className="ts-provider-icon">
                  <img
                    src={getProviderLogo('chrome_ai')}
                    alt="Chrome Built-in AI"
                    className="ts-provider-logo-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
                    }}
                  />
                </div>
                <div>
                  <h4 className="ts-provider-name">Chrome Built-in AI</h4>
                  <span className="ts-provider-tag local">Local &amp; Free</span>
                </div>
              </div>
              <label className="ts-modern-switch" title="Enable/Disable Chrome Built-in AI">
                <input
                  type="checkbox"
                  checked={enabledProviders.includes('chrome_ai')}
                  onChange={() => toggleProvider('chrome_ai')}
                />
                <span className="ts-modern-slider" />
              </label>
            </div>
            <p className="ts-provider-desc">
              100% private on-device local translation using Chrome 128+ built-in Translation API. Zero cloud latency and zero API cost.
            </p>
            <div className="ts-provider-body">
              <div className="ts-chrome-features-wrap">
                <div className="ts-feature-item">
                  <div className="ts-feature-icon-circle blue">
                    <span className="dashicons dashicons-shield" />
                  </div>
                  <div className="ts-feature-text">
                    <span className="ts-feature-title">On-Device Processing</span>
                    <span className="ts-feature-subtext">No API keys required. Operates directly in supporting browsers.</span>
                  </div>
                </div>
                <div className="ts-feature-item">
                  <div className="ts-feature-icon-circle green">
                    <span className="dashicons dashicons-lock" />
                  </div>
                  <div className="ts-feature-text">
                    <span className="ts-feature-title">100% Local Processing</span>
                    <span className="ts-feature-subtext">Your data stays on your device.</span>
                  </div>
                </div>
                <div className="ts-feature-item">
                  <div className="ts-feature-icon-circle amber">
                    {DashboardIcons.bolt({ size: 14 })}
                  </div>
                  <div className="ts-feature-text">
                    <span className="ts-feature-title">Zero Latency &amp; Zero Cost</span>
                    <span className="ts-feature-subtext">Fast, private and always available.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI Performance & Execution Controls */}
      <div className="ts-settings-card">
        <div className="ts-settings-card-header">
          <div className="ts-settings-card-title-group">
            <h3>AI Performance &amp; Execution Controls</h3>
            <p>Tune batching concurrency, token allocation, timeouts, and translation creativity.</p>
          </div>
        </div>
        <div className="ts-params-grid">
          {/* Batch Size */}
          <div className="ts-param-card">
            <div className="ts-param-header">
              <span className="ts-param-title">Batch Size</span>
              <span className="ts-param-badge">{`${settings.batch_size || 25} items`}</span>
            </div>
            <p className="ts-param-desc">Translatable strings packaged per single AI request.</p>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              className="ts-param-slider"
              value={settings.batch_size || 25}
              onChange={(e) => setSettings({ ...settings, batch_size: parseInt(e.target.value, 10) })}
            />
          </div>

          {/* Response Timeout */}
          <div className="ts-param-card">
            <div className="ts-param-header">
              <span className="ts-param-title">Timeout Wait</span>
              <span className="ts-param-badge">{`${settings.response_timeout || 30}s`}</span>
            </div>
            <p className="ts-param-desc">Maximum wait limit before retrying API translation.</p>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              className="ts-param-slider"
              value={settings.response_timeout || 30}
              onChange={(e) => setSettings({ ...settings, response_timeout: parseInt(e.target.value, 10) })}
            />
          </div>

          {/* Max Tokens */}
          <div className="ts-param-card">
            <div className="ts-param-header">
              <span className="ts-param-title">Max Tokens</span>
              <span className="ts-param-badge">{(settings.max_tokens || 4096).toLocaleString()}</span>
            </div>
            <p className="ts-param-desc">Max output tokens allocated for JSON translated responses.</p>
            <input
              type="range"
              min={512}
              max={16384}
              step={512}
              className="ts-param-slider"
              value={settings.max_tokens || 4096}
              onChange={(e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value, 10) })}
            />
          </div>

          {/* Temperature */}
          <div className="ts-param-card">
            <div className="ts-param-header">
              <span className="ts-param-title">Temperature</span>
              <span className="ts-param-badge">
                {(settings.temperature !== undefined ? parseFloat(settings.temperature) : 0.2).toFixed(2)}
              </span>
            </div>
            <p className="ts-param-desc">{getTemperatureLabel(settings.temperature !== undefined ? settings.temperature : 0.2)}</p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="ts-param-slider"
              value={settings.temperature !== undefined ? settings.temperature : 0.2}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* 3. Create Post Settings Card */}
      <div className="ts-settings-card">
        <div className="ts-settings-card-header">
          <div className="ts-settings-card-title-group">
            <h3>Create Post Settings</h3>
            <p>Configure default post status and URL slug handling applied during bulk translation.</p>
          </div>
        </div>
        <div className="ts-params-grid">
          {/* Post Status */}
          <div className="ts-param-card">
            <div className="ts-param-header">
              <span className="ts-param-title">Post Status</span>
              <span className="ts-param-badge">{curStatus.toUpperCase()}</span>
            </div>
            <p className="ts-param-desc">Status for created posts in bulk translation (Draft or Publish).</p>
            <select
              className="ts-form-select"
              value={curStatus}
              onChange={(e) => {
                const val = String(e.target.value || '').trim().toLowerCase();
                if (['draft', 'publish'].includes(val)) {
                  setSettings({ ...settings, post_status: val });
                }
              }}
            >
              <option value="draft">Draft (Default)</option>
              <option value="publish">Publish</option>
            </select>
          </div>

          {/* Slug Translation Mode */}
          <div className="ts-param-card">
            <div className="ts-param-header">
              <span className="ts-param-title">Slug Translation</span>
              <span className="ts-param-badge">
                {curSlugMode === 'keep_orignal'
                  ? 'KEEP ORIGINAL'
                  : curSlugMode === 'title_based'
                    ? 'TITLE BASED'
                    : 'TRANSLATE SLUG'}
              </span>
            </div>
            <p className="ts-param-desc">How URL permalinks/slugs are generated for translated posts.</p>
            <select
              className="ts-form-select"
              value={curSlugMode}
              onChange={(e) => {
                const val = String(e.target.value || '').trim().toLowerCase();
                if (['keep_orignal', 'title_based', 'slug_translate'].includes(val)) {
                  setSettings({ ...settings, slug_translation: val });
                }
              }}
            >
              <option value="slug_translate">Translate Slug (Default)</option>
              <option value="title_based">Generate from Translated Title</option>
              <option value="keep_orignal">Keep Original Slug</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Custom AI Prompt Engineering Studio Card */}
      <div className="ts-settings-card">
        <div className="ts-settings-card-header">
          <div className="ts-settings-card-title-group">
            <h3>AI Prompt Engineering Studio</h3>
            <p>Customize system instructions, tone, and HTML formatting constraints delivered to OpenAI and Gemini.</p>
          </div>
        </div>
        <div className="ts-prompt-studio">
          <div className="ts-chips-container">
            <span className="ts-chips-title">Click to insert token:</span>
            {['{source_lang}', '{target_lang}', '{count}', '{json_strings}'].map((token) => (
              <button
                key={token}
                type="button"
                className="ts-chip-btn"
                title={`Insert ${token} into prompt template`}
                onClick={() => insertTag(token)}
              >
                {`+ ${token}`}
              </button>
            ))}
          </div>
          <div className="ts-prompt-editor-wrap">
            <textarea
              id="ts-custom-prompt-editor"
              className="ts-prompt-textarea"
              value={currentPromptVal}
              placeholder="Enter custom prompt instructions..."
              onChange={(e) => setSettings({ ...settings, custom_prompt: e.target.value })}
              spellCheck="false"
            />
          </div>
          <div className="ts-prompt-footer">
            <span>
              {`${currentPromptVal.length} characters • ${currentPromptVal.split('\n').length} lines`}
            </span>
            <div className="ts-prompt-actions">
              <button
                type="button"
                className="ts-btn ts-btn-secondary ts-btn-md"
                onClick={copyPromptToClipboard}
              >
                Copy Prompt
              </button>
              <button
                type="button"
                className="ts-btn ts-btn-primary ts-btn-sm"
                onClick={() => setSettings({ ...settings, custom_prompt: '' })}
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Multilingual Setup (Polylang) Overview Card */}
      {languages && Object.keys(languages).length > 0 && (
        <div className="ts-settings-card">
          <div className="ts-settings-card-header">
            <div className="ts-settings-card-title-group">
              <h3>Multilingual Setup (Polylang)</h3>
              <p>Active languages detected from Polylang integration for full-site automatic and editor translations.</p>
            </div>
            <a href="admin.php?page=mlang" className="ts-btn ts-btn-secondary ts-btn-md">
              Manage Languages ↗
            </a>
          </div>
          <div className="ts-lang-tags-container">
            {Object.keys(languages).map((key) => (
              <div
                key={languages[key].slug || languages[key].code}
                className={`ts-lang-tag ${languages[key].is_default ? 'default' : ''}`}
              >
                {languages[key].flag ? (
                  <img src={languages[key].flag} alt={languages[key].name || languages[key].slug} />
                ) : (
                  <span className="ts-lang-fallback">{languages[key].code ? languages[key].code.toUpperCase() : ''}</span>
                )}
                <span>{languages[key].name || languages[key].slug}</span>
                <span style={{ opacity: 0.6, fontSize: '11px', fontFamily: 'monospace' }}>
                  {`(${languages[key].slug || languages[key].code})`}
                </span>
                {languages[key].is_default && <span className="ts-lang-badge-default">DEFAULT</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
