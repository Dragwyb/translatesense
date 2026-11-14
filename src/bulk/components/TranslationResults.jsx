/**
 * TranslationResults Component
 * Grouped accordion results list container
 */

import { PostResultItem } from './PostResultItem';

function matchesStatusFilters(status, selectedFilters) {
  const normalized = String(status || '').toLowerCase();
  return selectedFilters.some((filterKey) => {
    if (filterKey === 'failed') {
      return normalized === 'failed';
    }
    if (filterKey === 'completed') {
      return normalized === 'completed';
    }
    if (filterKey === 'skip_exist') {
      return normalized === 'already_exists' || normalized === 'skipped';
    }
    return false;
  });
}

export function TranslationResults({
  orderedPostIds = [],
  postResultsMap = {},
  allLanguages = [],
  isBackgroundMode = false,
  canSkip = false,
  activeBatchId = null,
  selectedFilters = [],
  filterOnlyFailed = false,
  onSkipPost,
  onErrorDetail,
  itemMeta = {},
}) {
  const activeFilters = Array.isArray(selectedFilters) ? selectedFilters : [];
  const postIdsList =
    orderedPostIds.length > 0
      ? orderedPostIds.filter((pid) => Boolean(postResultsMap[pid]))
      : Object.keys(postResultsMap);

  return (
    <div className="ts-results-container" id="ts-results-container">
      <div className="ts-results-list" id="ts-results-list">
        {postIdsList.map((pid) => {
          const postData = postResultsMap[pid];
          if (!postData) return null;

          let filteredPostData = postData;

          if (activeFilters.length > 0) {
            const matchingEntries = Object.entries(postData.translations || {}).filter(([, t]) =>
              matchesStatusFilters(t.status, activeFilters)
            );
            if (matchingEntries.length === 0) {
              return null;
            }
            filteredPostData = {
              ...postData,
              translations: Object.fromEntries(matchingEntries),
            };
          } else if (filterOnlyFailed) {
            const matchingEntries = Object.entries(postData.translations || {}).filter(
              ([, t]) => t.status !== 'completed' && t.status !== 'already_exists'
            );
            if (matchingEntries.length === 0) {
              return null;
            }
            filteredPostData = {
              ...postData,
              translations: Object.fromEntries(matchingEntries),
            };
          }

          return (
            <PostResultItem
              key={pid}
              postId={pid}
              postData={filteredPostData}
              allLanguages={allLanguages}
              isBackgroundMode={isBackgroundMode}
              canSkip={canSkip}
              activeBatchId={activeBatchId}
              onSkipPost={onSkipPost}
              onErrorDetail={onErrorDetail}
              itemMeta={itemMeta}
            />
          );
        })}
      </div>
    </div>
  );
}
