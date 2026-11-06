/**
 * HomeGuidePanel Component - Overview / Home Dashboard View
 */

import { TranslationGuide } from './TranslationGuide';
import { DashboardIcons } from './DashboardIcons';

export function HomeGuidePanel({
  onNavigateTab,
  activeBuilders = {},
  languages = {},
  polylangActive = true,
  bulkTranslateUrl = 'edit.php',
}) {

  const isWelcomeRedrect = new URLSearchParams(window.location.search).get('welcome')

  return (
    <div className="ts-guide-container">
      {/* Hero Welcome Card */}
      {isWelcomeRedrect && isWelcomeRedrect === '1' &&
        <div className="ts-guide-hero">
          <div className="ts-guide-hero-content">
            <div className="ts-guide-hero-badge-wrap">
              <span className="ts-guide-pill primary">Documentation &amp; Workflow Guide</span>
              <span className={`ts-guide-pill ${polylangActive ? 'success' : 'warning'}`}>
                {polylangActive
                  ? `Polylang Connected (${Object.keys(languages).length} Languages)`
                  : 'Polylang Inactive'}
              </span>
            </div>

            <h2 className="ts-guide-hero-title">Welcome to TranslateSense 👋</h2>
            <p className="ts-guide-hero-desc">
              TranslateSense is a high-performance automated translation suite built for WordPress &amp; Polylang.
              It preserves your exact layout and styling across Gutenberg, Classic Editor &amp; Elementor while
              utilizing a 4-tier database cache to eliminate duplicate AI token costs.
            </p>
          </div>
        </div>
      }

      {/* Interactive Step-by-Step Translation Guide */}
      <TranslationGuide />

      {/* Pro Tips & Architecture Card */}
      <div className="ts-guide-tips-card">
        <div className="ts-guide-tips-header">
          <span className="ts-tips-icon">{DashboardIcons.bolt()}</span>
          <h3 className="ts-tips-title">TranslateSense Architecture &amp; Token Savings</h3>
        </div>
        <div className="ts-guide-tips-grid">
          <div className="ts-tip-box">
            <h4>Database Translation Memory</h4>
            <p>
              Every unique sentence is hashed (MD5) and cached in your MySQL database. If the same paragraph
              appears across 50 posts, AI is called only once, saving thousands of tokens.
            </p>
          </div>
          <div className="ts-tip-box">
            <h4>Structural Tag Protection</h4>
            <p>
              HTML tags, block comments, and shortcodes are shielded before translation, preventing AI from
              breaking your styling, links, or Elementor widgets.
            </p>
          </div>
          <div className="ts-tip-box">
            <h4>Cache &amp; Memory Management</h4>
            <p>
              Use the Cache tab to inspect and clean your translation memory. Note that removing translation cache
              means repeated text will be sent to AI again.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="ts-guide-quick-actions">
        <button
          type="button"
          className="ts-btn ts-btn-secondary"
          onClick={() => onNavigateTab('settings')}
        >
          Configure AI Settings
        </button>

        {activeBuilders.gutenberg && (
          <button
            type="button"
            className="ts-btn ts-btn-secondary"
            onClick={() => onNavigateTab('gutenberg')}
          >
            View Gutenberg Blocks
          </button>
        )}

        {activeBuilders.elementor && (
          <button
            type="button"
            className="ts-btn ts-btn-secondary"
            onClick={() => onNavigateTab('elementor')}
          >
            View Elementor Widgets
          </button>
        )}

        <button
          type="button"
          className="ts-btn ts-btn-secondary"
          onClick={() => onNavigateTab('cache')}
        >
          <span style={{ display: 'inline-flex', marginRight: '6px' }}>
            {DashboardIcons.database({ size: 14 })}
          </span>
          Manage Cache &amp; Memory
        </button>

        <a href={bulkTranslateUrl} className="ts-btn ts-btn-secondary">
          Go to Posts (Bulk Translate) ↗
        </a>
      </div>
    </div>
  );
}

