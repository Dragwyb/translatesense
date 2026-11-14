/**
 * BulkProgressSkeleton Component
 * Endpoint-specific skeleton loading for Bulk Translation progress view
 */

export function BulkProgressSkeleton({
  type = 'start_bulk',
  postIds = [],
  selectedLanguages = [],
}) {
  // Determine placeholder card count and rows
  const cardCount =
    type === 'start_bulk' && Array.isArray(postIds) && postIds.length > 0
      ? Math.min(postIds.length, 5)
      : 3;

  const langCount =
    type === 'start_bulk' && Array.isArray(selectedLanguages) && selectedLanguages.length > 0
      ? Math.min(selectedLanguages.length, 4)
      : 2;

  const cards = Array.from({ length: cardCount }, (_, i) => (postIds[i] !== undefined ? postIds[i] : i + 1));
  const rows = Array.from({ length: langCount }, (_, i) => i);

  return (
    <div
      className={`ts-bulk-skeleton-wrap ts-skeleton-endpoint-${type}`}
      aria-busy="true"
      aria-live="polite"
      aria-label={
        type === 'start_bulk'
          ? 'Initiating translation batch...'
          : 'Retrieving active translation batches...'
      }
    >
      {/* Top Progress Card Skeleton */}
      <div className="ts-progress-card ts-skeleton-progress-card">
        <div className="ts-progress-header">
          <div className="ts-skeleton-shimmer ts-skeleton-status-bar" />
          <div className="ts-progress-meta">
            <div className="ts-skeleton-shimmer ts-skeleton-meta-count" />
            <div className="ts-skeleton-shimmer ts-skeleton-meta-timer" />
          </div>
        </div>
        <div className="ts-progress-bar-bg">
          <div className="ts-skeleton-shimmer ts-skeleton-progress-fill" />
        </div>
      </div>

      {/* Accordion List Skeleton */}
      <div className="ts-results-container ts-skeleton-results-container">
        <div className="ts-results-list">
          {cards.map((pid, idx) => (
            <div
              key={`sk-card-${pid}-${idx}`}
              className="ts-post-group-card ts-skeleton-post-card expanded extended"
            >
              <div className="ts-post-group-header">
                <div className="ts-post-source-info">
                  <div className="ts-skeleton-shimmer ts-skeleton-icon-box" />
                  <div className="ts-skeleton-shimmer ts-skeleton-title-bar" />
                  <div className="ts-skeleton-shimmer ts-skeleton-id-badge" />
                </div>
                <div className="ts-post-header-right">
                  <div className="ts-skeleton-shimmer ts-skeleton-pill" />
                  <div className="ts-skeleton-shimmer ts-skeleton-chevron" />
                </div>
              </div>

              <div className="ts-post-translations-list ts-translations-accordion-body">
                {rows.map((rowIdx) => (
                  <div key={`sk-row-${rowIdx}`} className="ts-translation-item ts-skeleton-row-item">
                    <div className="ts-trans-lang-col">
                      <div className="ts-skeleton-shimmer ts-skeleton-flag" />
                      <div className="ts-skeleton-shimmer ts-skeleton-lang-code" />
                    </div>
                    <div className="ts-trans-title-col">
                      <div className="ts-skeleton-shimmer ts-skeleton-row-title" />
                    </div>
                    <div className="ts-trans-status-col">
                      <div className="ts-skeleton-shimmer ts-skeleton-status-pill" />
                    </div>
                    <div className="ts-trans-actions-col">
                      <div className="ts-skeleton-shimmer ts-skeleton-action-btn" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

