/**
 * LanguageSelection Component (Bulk Step 1)
 */

import { LanguageSelector } from '../../components/LanguageSelector';
import { WizardSteps } from './WizardSteps';

export function LanguageSelection({
  postIds = [],
  allLanguages = [],
  selectedLanguages = [],
  onLanguagesChange,
}) {
  const postsCount = postIds.length;

  return (
    <div className="ts-bulk-step-content" id="ts-view-step-1">
      <WizardSteps currentStep={1} selectedLanguagesCount={selectedLanguages.length} />

      <div className="ts-lang-info-banner">
        <span className="ts-info-icon" aria-hidden="true">ℹ️</span>
        <span>
          Targeting <strong className="ts-highlight-tag">{postsCount} {postsCount === 1 ? 'post' : 'posts'}</strong>. Choose target language(s) to translate into:
        </span>
      </div>

      <LanguageSelector
        languages={allLanguages}
        selectedLanguages={selectedLanguages}
        onChange={onLanguagesChange}
      />
    </div>
  );
}

