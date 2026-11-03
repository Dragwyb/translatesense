/**
 * FooterBar Component - Fixed/Sticky Footer Status & Actions
 */

export function FooterBar({ activeTab, onSaveSettings, isSaving, pluginUrl = '' }) {
  const logoSrc = pluginUrl ? `${pluginUrl}assets/img/dragwyb.png` : 'assets/img/dragwyb.png';

  return (
    <footer className="ts-footer-bar">
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
  );
}

