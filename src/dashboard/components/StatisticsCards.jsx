/**
 * StatisticsCards Component
 */

import { formatNumber } from '../../utils/formatting';

export function StatisticsCards({ stats = {} }) {
  const cards = [
    {
      id: 'packages',
      label: 'Total Packages',
      value: formatNumber(stats.total_packages || 0),
      icon: 'dashicons-archive',
      color: 'blue',
      desc: 'Extracted content block packages',
    },
    {
      id: 'cache',
      label: 'Cached Results',
      value: formatNumber(stats.cached_results || 0),
      icon: 'dashicons-database',
      color: 'green',
      desc: 'Token-saving reusable memory',
    },
    {
      id: 'posts',
      label: 'Translated Posts',
      value: formatNumber(stats.total_posts || 0),
      icon: 'dashicons-media-document',
      color: 'purple',
      desc: 'Pages, posts, and custom types',
    },
    {
      id: 'characters',
      label: 'Characters Translated',
      value: formatNumber(stats.total_characters || 0),
      icon: 'dashicons-editor-textcolor',
      color: 'orange',
      desc: 'Source text volume processed',
    },
    {
      id: 'time',
      label: 'Processing Time',
      value: stats.time_taken || '0s',
      icon: 'dashicons-clock',
      color: 'cyan',
      desc: 'Cumulative AI inference time',
    },
  ];

  return (
    <div className="ts-stats-cards-grid">
      {cards.map((card) => (
        <div key={card.id} className={`ts-metric-card ts-card-${card.color}`}>
          <div className="ts-metric-top">
            <span className="ts-metric-label">{card.label}</span>
            <div className={`ts-metric-icon-box ${card.color}`}>
              <span className={`dashicons ${card.icon}`} />
            </div>
          </div>
          <div className="ts-metric-value">{card.value}</div>
          <p className="ts-metric-desc">{card.desc}</p>
        </div>
      ))}
    </div>
  );
}

