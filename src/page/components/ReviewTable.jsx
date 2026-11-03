/**
 * ReviewTable Component
 */

import { ReviewRow } from './ReviewRow';

export function ReviewTable({
  strings = [],
  filterQuery = '',
  isExtracting = false,
  onUpdateTranslation,
  onResetTranslation,
}) {
  if (isExtracting) {
    return (
      <div className="ts-table-card">
        <table className="ts-strings-table">
          <thead>
            <tr>
              <th style={{ width: '48%' }}>SOURCE TEXT</th>
              <th style={{ width: '52%' }}>TRANSLATED TEXT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="2" style={{ textAlign: 'center', padding: '18px 20px', background: '#f8fafc' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <div className="ts-circle-spinner" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                    Extracting page content & translatable strings...
                  </span>
                </div>
              </td>
            </tr>
            {[1, 2, 3].map((_, i) => (
              <tr key={i} className="ts-skeleton-row">
                <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                  <div
                    className="ts-skeleton-shimmer"
                    style={{ width: i % 2 === 0 ? '78%' : '60%', height: '16px' }}
                  />
                </td>
                <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                  <div
                    className="ts-skeleton-shimmer"
                    style={{ width: '100%', height: '38px', borderRadius: '4px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const q = (filterQuery || '').toLowerCase().trim();
  const filtered = strings
    .map((item, idx) => ({ ...item, originalIndex: idx }))
    .filter((item) => {
      if (!q) return true;
      const src = String(item.value || '').toLowerCase();
      const trans = String(item.translated || '').toLowerCase();
      return src.includes(q) || trans.includes(q);
    });

  return (
    <div className="ts-table-card">
      <table className="ts-strings-table">
        <thead>
          <tr>
            <th style={{ width: '48%' }}>SOURCE TEXT</th>
            <th style={{ width: '52%' }}>TRANSLATED TEXT</th>
          </tr>
        </thead>
        <tbody id="ts-review-table-tbody">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan="2" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                <div>
                  No matching strings found for "<strong>{filterQuery}</strong>".
                </div>
              </td>
            </tr>
          ) : (
            filtered.map((item) => (
              <ReviewRow
                key={item.hash || item.originalIndex}
                item={item}
                index={item.originalIndex}
                onUpdateTranslation={onUpdateTranslation}
                onResetTranslation={onResetTranslation}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

