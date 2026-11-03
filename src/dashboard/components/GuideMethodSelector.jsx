/**
 * GuideMethodSelector Component - Single Row Option Switcher
 */

import { DashboardIcons } from './DashboardIcons';

export const METHODS_CONFIG = [
  { id: 'gutenberg', label: 'Gutenberg' },
  { id: 'classic', label: 'Classic' },
  { id: 'elementor', label: 'Elementor' },
  { id: 'bulk', label: 'Bulk Translation' },
];

export function GuideMethodSelector({ activeTab, onChange }) {
  const handleKeyDown = (e, index) => {
    let nextIndex = null;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % METHODS_CONFIG.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + METHODS_CONFIG.length) % METHODS_CONFIG.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = METHODS_CONFIG.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const nextTab = METHODS_CONFIG[nextIndex];
      onChange(nextTab.id);
      const nextBtn = document.getElementById(`ts-method-card-${nextTab.id}`);
      if (nextBtn) nextBtn.focus();
    }
  };

  return (
    <div className="ts-guide-options-row" role="radiogroup" aria-label="Translation method">
      {METHODS_CONFIG.map((method, index) => {
        const isActive = activeTab === method.id;
        return (
          <button
            key={method.id}
            id={`ts-method-card-${method.id}`}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`ts-method-card ${isActive ? 'active' : ''}`}
            onClick={() => onChange(method.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            aria-controls={`ts-guide-panel-${method.id}`}
          >
            {isActive ? DashboardIcons.radioChecked() : DashboardIcons.radioUnchecked()}
            <span className="ts-method-card-label">{method.label}</span>
          </button>
        );
      })}
    </div>
  );
}

