/**
 * RecentActivity Component
 */

export function RecentActivity({ onNavigateTab }) {
  const activities = [
    {
      id: 1,
      title: 'Bulk Translation completed',
      detail: '5 posts translated to Spanish, French, German',
      provider: 'OpenAI (gpt-4o-mini)',
      time: '15 mins ago',
      status: 'success',
    },
    {
      id: 2,
      title: 'String memory cache updated',
      detail: '142 strings indexed from Gutenberg Blocks',
      provider: 'Local Parser',
      time: '1 hour ago',
      status: 'info',
    },
    {
      id: 3,
      title: 'On-device translation executed',
      detail: 'About Page translated to Spanish',
      provider: 'Chrome Local AI',
      time: '3 hours ago',
      status: 'success',
    },
  ];

  return (
    <div className="ts-dashboard-section ts-recent-activity-card">
      <div className="ts-section-header">
        <div className="ts-section-title-wrap">
          <h2 className="ts-section-title">Recent Activity</h2>
          <p className="ts-section-subtitle">Latest translation operations and system events</p>
        </div>
        {onNavigateTab && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onNavigateTab('cache')}
          >
            <span className="dashicons dashicons-database" /> View Cache Logs
          </button>
        )}
      </div>

      <div className="ts-activity-list">
        {activities.map((act) => (
          <div key={act.id} className="ts-activity-row">
            <div className={`ts-activity-icon ${act.status}`}>
              <span
                className={`dashicons ${
                  act.status === 'success' ? 'dashicons-yes-alt' : 'dashicons-update'
                }`}
              />
            </div>
            <div className="ts-activity-content">
              <div className="ts-activity-title">{act.title}</div>
              <div className="ts-activity-detail">{act.detail}</div>
            </div>
            <div className="ts-activity-meta">
              <span className="ts-activity-provider">{act.provider}</span>
              <span className="ts-activity-time">{act.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

