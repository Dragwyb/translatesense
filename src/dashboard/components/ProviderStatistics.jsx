/**
 * ProviderStatistics Component
 */

export function ProviderStatistics({
  activeProviders = {},
  providerModels = {},
  settings = {},
  connectorsUrl = 'options-connectors.php',
}) {
  const providers = [
    {
      id: 'chrome_ai',
      name: 'Chrome Local AI',
      desc: 'On-device built-in translation model. Zero API cost, private.',
      status: 'Ready (On-Device)',
      statusClass: 'ready',
      model: 'Gemini Nano',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      desc: 'High-speed cloud neural models for extensive batch processing.',
      status: settings.openai_api_key || activeProviders.openai?.isConnected ? 'Connected' : 'Key Required',
      statusClass: settings.openai_api_key || activeProviders.openai?.isConnected ? 'connected' : 'unconfigured',
      model: settings.openai_model || 'gpt-4o-mini',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      desc: 'Multimodal cloud engine supporting high-context languages.',
      status: settings.gemini_api_key || activeProviders.gemini?.isConnected ? 'Connected' : 'Key Required',
      statusClass: settings.gemini_api_key || activeProviders.gemini?.isConnected ? 'connected' : 'unconfigured',
      model: settings.gemini_model || 'gemini-2.0-flash',
    },
  ];

  return (
    <div className="ts-dashboard-section ts-providers-status-card">
      <div className="ts-section-header">
        <div className="ts-section-title-wrap">
          <h2 className="ts-section-title">Translation Engines</h2>
          <p className="ts-section-subtitle">
            Status and configuration for active translation service providers
          </p>
        </div>
        <a
          href={connectorsUrl}
          className="button button-secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="dashicons dashicons-admin-plugins" /> Manage WP Connectors
        </a>
      </div>

      <div className="ts-provider-status-grid">
        {providers.map((p) => (
          <div key={p.id} className="ts-provider-status-item">
            <div className="ts-provider-status-top">
              <span className="ts-provider-item-name">{p.name}</span>
              <span className={`ts-status-badge ${p.statusClass}`}>{p.status}</span>
            </div>
            <p className="ts-provider-item-desc">{p.desc}</p>
            <div className="ts-provider-item-footer">
              <span className="ts-model-tag">
                <span className="dashicons dashicons-editor-code" /> {p.model}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

