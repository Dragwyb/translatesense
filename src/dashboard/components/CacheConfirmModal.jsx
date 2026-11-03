/**
 * CacheConfirmModal Component - Clear Cache Confirmation Dialog
 */

import { DashboardIcons } from './DashboardIcons';

export function CacheConfirmModal({ modal, isClearing, onClose, onConfirm }) {
  if (!modal || !modal.isOpen) return null;

  const isTranslations = modal.type === 'translations';

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div
        className="ts-modal-container ts-cache-confirm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ts-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ts-modal-header-icon danger">
              {DashboardIcons.trash({ size: 16 })}
            </span>
            <h3>{modal.title || 'Clear Cache'}</h3>
          </div>
          <button className="ts-modal-close" onClick={onClose} aria-label="Close">
            {DashboardIcons.close({ size: 16 })}
          </button>
        </div>

        <div className="ts-modal-body">
          {/* Required Warning Alert Box */}
          <div className="ts-cache-alert-box">
            <div className="ts-cache-alert-icon">
              {DashboardIcons.alert({ size: 22 })}
            </div>
            <div className="ts-cache-alert-content">
              <h4 className="ts-cache-alert-title">Required Warning</h4>
              <p className="ts-cache-alert-text">{modal.warning}</p>
            </div>
          </div>

          {/* Count & Details */}
          <div className="ts-cache-impact-box">
            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
              {'You are about to permanently remove '}
              <strong style={{ color: '#0f172a' }}>
                {`${(modal.count || 0).toLocaleString()} cached records`}
              </strong>
              {' from your database. This action is irreversible.'}
            </p>
            {isTranslations && (
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#b45309', fontWeight: 500 }}>
                💡 Tip: Keeping your translation cache preserves your API tokens for repeated texts and makes retranslating pages much faster.
              </p>
            )}
          </div>
        </div>

        <div className="ts-modal-footer">
          <button
            type="button"
            className="ts-btn ts-btn-secondary"
            disabled={isClearing}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ts-btn ts-btn-danger"
            disabled={isClearing}
            onClick={onConfirm}
          >
            {isClearing ? 'Clearing Cache...' : 'Yes, Confirm & Clear Cache'}
          </button>
        </div>
      </div>
    </div>
  );
}

