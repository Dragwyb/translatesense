/**
 * CacheTab Component - Cache & Memory Management Panel
 */

import { useState } from '@wordpress/element';
import { CacheConfirmModal } from './CacheConfirmModal';
import { DashboardIcons } from './DashboardIcons';

export function CacheTab({
  cacheCounts = {},
  onRefreshCache,
  isRefreshing = false,
  onClearCache,
}) {
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'all',
    title: '',
    warning: '',
    count: 0,
  });
  const [isClearing, setIsClearing] = useState(false);

  const totalCache =
    (cacheCounts.strings || 0) +
    (cacheCounts.translations || 0) +
    (cacheCounts.packages || 0) +
    (cacheCounts.logs || 0);

  const handleOpenModal = (type) => {
    let title = 'Clear Cache';
    let warning = 'Are you sure you want to proceed?';
    let count = 0;

    if (type === 'translations') {
      title = 'Clear Translations Cache (Memory)';
      warning = 'Removing this cache means repeated texts and previously translated sentences will call AI again, incurring additional token usage.';
      count = cacheCounts.translations || 0;
    } else if (type === 'strings') {
      title = 'Clear Central Source Strings Cache';
      warning = 'Removes extracted source strings from local memory index. Strings will be re-extracted when editing posts.';
      count = cacheCounts.strings || 0;
    } else if (type === 'logs') {
      title = 'Clear Translation Logs & Batches';
      warning = 'Permanently clears historical background batch logs, error reports, and translation execution time records.';
      count = cacheCounts.logs || 0;
    } else if (type === 'packages') {
      title = 'Clear Block & Widget Packages';
      warning = 'Removes post-level widget mapping packages. Layouts will be re-parsed when editor is opened.';
      count = cacheCounts.packages || 0;
    } else if (type === 'all') {
      title = 'Clear Entire TranslateSense Cache';
      warning = 'Permanently purges ALL translated sentences, extracted source strings, widget mapping packages, and bulk batch logs.';
      count = totalCache;
    }

    setModal({
      isOpen: true,
      type,
      title,
      warning,
      count,
    });
  };

  const handleCloseModal = () => {
    setModal({ isOpen: false, type: 'all', title: '', warning: '', count: 0 });
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (onClearCache) {
        await onClearCache(modal.type);
      }
    } finally {
      setIsClearing(false);
      handleCloseModal();
    }
  };

  return (
    <div className="ts-cache-container">
      {/* Header Bar */}
      <div className="ts-cache-header">
        <div className="ts-cache-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="ts-cache-header-icon">{DashboardIcons.database({ size: 22 })}</div>
            <h2 className="ts-cache-title">Cache &amp; Translation Memory Manager</h2>
          </div>
          <p className="ts-cache-desc">
            TranslateSense stores translation hashes, raw source strings, execution logs, and widget mappings locally. Managing your cache helps you balance token economy and database storage.
          </p>
        </div>
        <div className="ts-cache-header-actions">
          <button
            type="button"
            className="ts-btn ts-btn-secondary ts-btn-sm"
            disabled={isRefreshing}
            onClick={onRefreshCache}
            title="Refresh cache counts from database"
          >
            <span
              className={`ts-refresh-icon ${isRefreshing ? 'spinning' : ''}`}
              style={{ display: 'inline-flex', marginRight: '5px' }}
            >
              {DashboardIcons.refresh({ size: 14 })}
            </span>
            {isRefreshing ? 'Refreshing...' : 'Refresh Counts'}
          </button>
          <button
            type="button"
            className="ts-btn ts-btn-danger-outline ts-btn-sm"
            onClick={() => handleOpenModal('all')}
            title="Clear all stored strings, translations, packages, and logs"
          >
            <span style={{ display: 'inline-flex', marginRight: '5px' }}>
              {DashboardIcons.trash({ size: 13 })}
            </span>
            Clear All Caches
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="ts-cache-summary-card">
        <div className="ts-cache-summary-main">
          <div className="ts-cache-summary-label">TOTAL CACHED DATABASE RECORDS</div>
          <div className="ts-cache-summary-number">{totalCache.toLocaleString()}</div>
          <div className="ts-cache-summary-sub">
            Across Translation Memory, Source Strings, Bulk Logs &amp; Widget Packages
          </div>
        </div>
        <div className="ts-cache-summary-breakdown">
          <div className="ts-summary-pill">
            <span className="ts-pill-dot green" />
            <span className="ts-pill-lbl">Translations:</span>
            <strong>{(cacheCounts.translations || 0).toLocaleString()}</strong>
          </div>
          <div className="ts-summary-pill">
            <span className="ts-pill-dot blue" />
            <span className="ts-pill-lbl">Strings:</span>
            <strong>{(cacheCounts.strings || 0).toLocaleString()}</strong>
          </div>
          <div className="ts-summary-pill">
            <span className="ts-pill-dot purple" />
            <span className="ts-pill-lbl">Packages:</span>
            <strong>{(cacheCounts.packages || 0).toLocaleString()}</strong>
          </div>
          <div className="ts-summary-pill">
            <span className="ts-pill-dot orange" />
            <span className="ts-pill-lbl">Logs:</span>
            <strong>{(cacheCounts.logs || 0).toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* 4 Options Grid */}
      <div className="ts-cache-grid">
        {/* Option 1: Translations Cache (AI Translation Memory) */}
        <div className="ts-cache-card highlight-token">
          <div className="ts-cache-card-top">
            <div className="ts-cache-card-info">
              <div className="ts-cache-card-icon green">{DashboardIcons.globe({ size: 20 })}</div>
              <div>
                <h3 className="ts-cache-card-title">Translations Cache</h3>
                <span className="ts-cache-card-sub">AI Translation Memory</span>
              </div>
            </div>
            <span className={`ts-cache-status-badge ${cacheCounts.translations > 0 ? 'active' : 'empty'}`}>
              {cacheCounts.translations > 0 ? 'Active & Caching' : 'Empty'}
            </span>
          </div>
          <div className="ts-cache-card-stat">
            <span className="ts-cache-big-num">{(cacheCounts.translations || 0).toLocaleString()}</span>
            <span className="ts-cache-unit">translated string pairs</span>
          </div>
          <p className="ts-cache-card-desc">
            Stores previously translated sentences mapped to target languages and MD5 hashes. Eliminates duplicate AI queries when retranslating pages or encountering repeated texts.
          </p>
          <div className="ts-cache-card-actions">
            <button
              type="button"
              className="ts-btn-cache-danger"
              disabled={!cacheCounts.translations}
              onClick={() => handleOpenModal('translations')}
            >
              <span style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.trash({ size: 13 })}
              </span>
              Clear Translations Cache
            </button>
          </div>
        </div>

        {/* Option 2: Strings Cache (Central Source Memory) */}
        <div className="ts-cache-card">
          <div className="ts-cache-card-top">
            <div className="ts-cache-card-info">
              <div className="ts-cache-card-icon blue">{DashboardIcons.document({ size: 20 })}</div>
              <div>
                <h3 className="ts-cache-card-title">Strings Cache</h3>
                <span className="ts-cache-card-sub">Central Translation Memory</span>
              </div>
            </div>
            <span className={`ts-cache-status-badge ${cacheCounts.strings > 0 ? 'active' : 'empty'}`}>
              {cacheCounts.strings > 0 ? 'Active & Indexed' : 'Empty'}
            </span>
          </div>
          <div className="ts-cache-card-stat">
            <span className="ts-cache-big-num">{(cacheCounts.strings || 0).toLocaleString()}</span>
            <span className="ts-cache-unit">unique source strings</span>
          </div>
          <p className="ts-cache-card-desc">
            Stores normalized source strings extracted from your blocks and widgets with their respective MD5 hashes as central Translation Memory index references.
          </p>
          <div className="ts-cache-card-actions">
            <button
              type="button"
              className="ts-btn-cache-danger"
              disabled={!cacheCounts.strings}
              onClick={() => handleOpenModal('strings')}
            >
              <span style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.trash({ size: 13 })}
              </span>
              Clear Strings Cache
            </button>
          </div>
        </div>

        {/* Option 3: Translation Logs & Queue */}
        <div className="ts-cache-card">
          <div className="ts-cache-card-top">
            <div className="ts-cache-card-info">
              <div className="ts-cache-card-icon orange">{DashboardIcons.clock({ size: 20 })}</div>
              <div>
                <h3 className="ts-cache-card-title">Translation Logs &amp; Queue</h3>
                <span className="ts-cache-card-sub">Bulk History &amp; Batches</span>
              </div>
            </div>
            <span className={`ts-cache-status-badge ${cacheCounts.logs > 0 ? 'active' : 'empty'}`}>
              {cacheCounts.logs > 0 ? 'Logged' : 'No Logs'}
            </span>
          </div>
          <div className="ts-cache-card-stat">
            <span className="ts-cache-big-num">{(cacheCounts.logs || 0).toLocaleString()}</span>
            <span className="ts-cache-unit">queue &amp; history records</span>
          </div>
          <p className="ts-cache-card-desc">
            Stores bulk translation batch entries, execution time statistics, completed/failed statuses, and background queue records for historical auditing.
          </p>
          <div className="ts-cache-card-actions">
            <button
              type="button"
              className="ts-btn-cache-danger"
              disabled={!cacheCounts.logs}
              onClick={() => handleOpenModal('logs')}
            >
              <span style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.trash({ size: 13 })}
              </span>
              Clear Translation Logs
            </button>
          </div>
        </div>

        {/* Option 4: Packages Cache (Widget & Block Mappings) */}
        <div className="ts-cache-card">
          <div className="ts-cache-card-top">
            <div className="ts-cache-card-info">
              <div className="ts-cache-card-icon purple">{DashboardIcons.package({ size: 20 })}</div>
              <div>
                <h3 className="ts-cache-card-title">Packages Cache</h3>
                <span className="ts-cache-card-sub">Block &amp; Widget Mapping Context</span>
              </div>
            </div>
            <span className={`ts-cache-status-badge ${cacheCounts.packages > 0 ? 'active' : 'empty'}`}>
              {cacheCounts.packages > 0 ? 'Active & Linked' : 'Empty'}
            </span>
          </div>
          <div className="ts-cache-card-stat">
            <span className="ts-cache-big-num">{(cacheCounts.packages || 0).toLocaleString()}</span>
            <span className="ts-cache-unit">mapped field packages</span>
          </div>
          <p className="ts-cache-card-desc">
            Maintains associations between specific post IDs, editor types, widget keys, and string hashes. Allows instant reconstruction of translated layouts without reparsing.
          </p>
          <div className="ts-cache-card-actions">
            <button
              type="button"
              className="ts-btn-cache-danger"
              disabled={!cacheCounts.packages}
              onClick={() => handleOpenModal('packages')}
            >
              <span style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.trash({ size: 13 })}
              </span>
              Clear Packages Cache
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <CacheConfirmModal
        modal={modal}
        isClearing={isClearing}
        onClose={handleCloseModal}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}
