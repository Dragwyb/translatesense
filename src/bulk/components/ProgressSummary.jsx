/**
 * ProgressSummary Component
 * 4 metric summary cards displayed upon batch completion
 */

import { formatNumber } from '../../utils/formatting';

export function ProgressSummary({
  completedCount = 0,
  failedCount = 0,
  totalCharacters = 0,
  totalCount = 0,
  elapsedTime = '0s',
}) {
  return (
    <div className="ts-summary-stats-grid">
      <div className="ts-stat-card green">
        <div className="ts-stat-icon-box green">
          <span className="dashicons dashicons-yes-alt" />
        </div>
        <div className="ts-stat-info">
          <div className="ts-stat-label">Completed Posts</div>
          <div className="ts-stat-val">
            {completedCount} / {totalCount}
          </div>
        </div>
      </div>

      <div className="ts-stat-card red">
        <div className="ts-stat-icon-box red">
          <span className="dashicons dashicons-dismiss" />
        </div>
        <div className="ts-stat-info">
          <div className="ts-stat-label">Failed Posts</div>
          <div className="ts-stat-val">
            {failedCount} / {totalCount}
          </div>
        </div>
      </div>

      <div className="ts-stat-card blue">
        <div className="ts-stat-icon-box blue">
          <span className="dashicons dashicons-editor-textcolor" />
        </div>
        <div className="ts-stat-info">
          <div className="ts-stat-label">Total Characters</div>
          <div className="ts-stat-val" title={`${totalCharacters.toLocaleString()} characters`}>
            {formatNumber(totalCharacters)}
          </div>
        </div>
      </div>

      <div className="ts-stat-card orange">
        <div className="ts-stat-icon-box orange">
          <span className="dashicons dashicons-clock" />
        </div>
        <div className="ts-stat-info">
          <div className="ts-stat-label">Elapsed Time</div>
          <div className="ts-stat-val">{elapsedTime}</div>
        </div>
      </div>
    </div>
  );
}

