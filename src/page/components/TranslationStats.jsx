/**
 * TranslationStats Component (Review Modal Toolbar Metrics)
 */

import { formatNumber } from '../../utils/formatting';

export function TranslationStats({ stats = {} }) {
  const timeTaken = stats.timeTaken || '0.0s';
  const totalChars = stats.totalChars || 0;
  const stringCount = stats.stringCount || 0;

  return (
    <div className="ts-review-stats-group">
      <div className="ts-stat-card time-card">
        <span className="ts-stat-card-icon time" aria-hidden="true">⏱️</span>
        <div className="ts-stat-card-meta">
          <span className="ts-stat-card-lbl">Time</span>
          <span className="ts-stat-card-val">{timeTaken}</span>
        </div>
      </div>

      <div className="ts-stat-card chars-card">
        <span className="ts-stat-card-icon chars" aria-hidden="true">📄</span>
        <div className="ts-stat-card-meta">
          <span className="ts-stat-card-lbl">Characters</span>
          <span className="ts-stat-card-val">{formatNumber(totalChars)}</span>
        </div>
      </div>

      <div className="ts-stat-card strings-card">
        <span className="ts-stat-card-icon-tt" aria-hidden="true">Tt</span>
        <div className="ts-stat-card-meta">
          <span className="ts-stat-card-lbl">Strings</span>
          <span className="ts-stat-card-val">{stringCount}</span>
        </div>
      </div>
    </div>
  );
}

