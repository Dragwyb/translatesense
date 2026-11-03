/**
 * ProviderSelection Component (Bulk Step 2)
 */

import { ProviderCard } from '../../components/ProviderCard';
import { WizardSteps } from './WizardSteps';
import { getLanguageFlag } from '../../utils/language';

export function ProviderSelection({
  postIds = [],
  allLanguages = [],
  selectedLanguages = [],
  providers = [],
  selectedProvider = '',
  onSelectProvider,
  onViewError,
}) {
  const postsCount = postIds.length;

  return (
    <div className="ts-bulk-step-content" id="ts-view-step-2">
      <WizardSteps currentStep={2} selectedLanguagesCount={selectedLanguages.length} />

      <div className="ts-summary-box">
        <div className="ts-summary-info">
          <span>Targeting <strong>{postsCount} {postsCount === 1 ? 'post' : 'posts'}</strong> across <strong>{selectedLanguages.length} languages</strong>:</span>
          <div className="ts-summary-langs-tags">
            {selectedLanguages.map((slug) => {
              const flagInfo = getLanguageFlag(slug, allLanguages);
              return (
                <span key={slug} className="ts-summary-lang-pill">
                  {flagInfo.hasFlag && <img src={flagInfo.flagUrl} alt="" className="ts-pill-flag" />}{` (${flagInfo.code})`}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ts-bulk-field">
        <div className="ts-provider-list" id="ts-bulk-provider-list">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isSelected={selectedProvider === p.id}
              onSelect={onSelectProvider}
              onViewError={onViewError}
              name="ts_bulk_provider"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

