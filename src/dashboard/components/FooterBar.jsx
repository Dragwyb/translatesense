/**
 * FooterBar Component - Fixed/Sticky Footer Status & Actions
 */

import { useState } from 'react';
import { DashboardIcons } from './DashboardIcons';
import { CacheConfirmModal } from './CacheConfirmModal';

export function FooterBar({
  activeTab,
  onSaveSettings,
  isSaving,
  cacheCounts,
  onRefreshCache,
  isRefreshing = false,
  onClearCache,
  pluginUrl = ''
}) {
  const logoSrc = pluginUrl ? `${pluginUrl}assets/img/dragwyb.png` : 'assets/img/dragwyb.png';

  const [modal, setModal] = useState({
    isOpen: false,
    type: 'all',
    title: '',
    warning: '',
    count: 0,
  });
  const [isClearing, setIsClearing] = useState(false);

  const handleOpenModal = (type) => {
    const title = 'Clear Entire TranslateSense Cache';
    const warning = 'Permanently purges ALL translated sentences, extracted source strings, widget mapping packages, and bulk batch logs.';
    const count = (cacheCounts.strings || 0) +
      (cacheCounts.translations || 0) +
      (cacheCounts.packages || 0) +
      (cacheCounts.logs || 0);;

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
    <>
      <footer className={`ts-footer-bar ${['settings', 'cache'].includes(activeTab) ? 'ts-footer-sticky' : ''}`}>
        <div className="ts-footer-left">
          <span className="ts-footer-logo">
            <img
              className="ts-footer-logo-img"
              src={logoSrc}
              alt="Dragwyb Logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            Dragwyb
          </span>
          <span>Built with ❤️ by Dragwyb</span>
        </div>

        {activeTab === 'cache' &&
          <div className="ts-footer-right">
            <button
              type="button"
              className="ts-btn ts-btn-secondary ts-btn-md"
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
              className="ts-btn ts-btn-danger-outline ts-btn-md"
              onClick={() => handleOpenModal('all')}
              title="Clear all stored strings, translations, packages, and logs"
            >
              <span style={{ display: 'inline-flex', marginRight: '5px' }}>
                {DashboardIcons.trash({ size: 13 })}
              </span>
              Clear All Caches
            </button>
          </div>
        }

        {activeTab === 'settings' && (
          <div className="ts-footer-right">
            <div className="ts-save-status">
              Tip: Press <kbd className="ts-kbd-shortcut">Ctrl + S</kbd>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveSettings}
              className="ts-btn ts-btn-primary button-primary"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </footer>

      {/* Confirmation Modal */}
      <CacheConfirmModal
        modal={modal}
        isClearing={isClearing}
        onClose={handleCloseModal}
        onConfirm={handleConfirmClear}
      />
    </>
  );
}

