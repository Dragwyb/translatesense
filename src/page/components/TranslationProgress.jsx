/**
 * TranslationProgress Component
 * Overlay on top of review modal with coffee visual
 */

import { getLanguageDisplay } from '../../utils/language';

export function TranslationProgress({
  isOpen = false,
  percent = 0,
  status = 'Translation in progress...',
  subText = '',
  targetLang = 'es',
  languages = [],
  providerTitle = 'AI Provider',
  isExtracting = false,
}) {
  if (!isOpen) return null;

  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div className="ts-review-progress-overlay">
      <div className="ts-progress-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ts-coffee-visual">
          <div className="ts-coffee-circle-bg" />
          <svg
            className="ts-coffee-svg"
            width="44"
            height="44"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 52C12 50.8954 12.8954 50 14 50H50C51.1046 50 52 50.8954 52 52C52 53.1046 51.1046 54 50 54H14C12.8954 54 12 53.1046 12 52Z"
              fill="#94A3B8"
            />
            <path
              d="M16 26H48V38C48 44.6274 42.6274 50 36 50H28C21.3726 50 16 44.6274 16 38V26Z"
              fill="url(#tsCoffeeGrad)"
            />
            <path
              d="M48 30H51C53.7614 30 56 32.2386 56 35C56 37.7614 53.7614 40 51 40H48"
              stroke="#4F46E5"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              className="ts-steam-line ts-steam-1"
              d="M26 20C25 17 27 14 26 11"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              className="ts-steam-line ts-steam-2"
              d="M32 21C31 17 33 13 32 9"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              className="ts-steam-line ts-steam-3"
              d="M38 20C37 17 39 14 38 11"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="tsCoffeeGrad" x1="16" y1="26" x2="48" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366F1" />
                <stop offset="1" stopColor="#4338CA" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="ts-progress-header-badge">
          <span>Translating to {getLanguageDisplay(targetLang, languages)}</span>
        </div>

        <h3 className="ts-progress-title">
          {isExtracting ? 'Extracting page content...' : 'Translation in progress...'}
        </h3>
        <p className="ts-progress-coffee-quote">
          Translation will take a few seconds or a minute, you can enjoy your coffee ☕ during this process.
        </p>

        <div className="ts-progress-section">
          <div className="ts-progress-meta-top">
            <span className="ts-progress-status-label">{status}</span>
            <span className="ts-progress-percent-badge">{clampedPercent}%</span>
          </div>
          <div className="ts-progress-track-wrap">
            <div className="ts-progress-track-fill" style={{ width: `${clampedPercent}%` }} />
          </div>
          <div className="ts-progress-sub-info">
            <span>{subText}</span>
            <span className="ts-progress-provider-tag">
              <span>⚡</span> {providerTitle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

