/**
 * TranslationResults Component
 * Grouped accordion results list container
 */

import { PostResultItem } from './PostResultItem';

export function TranslationResults({
  orderedPostIds = [],
  postResultsMap = {},
  allLanguages = [],
  isBackgroundMode = false,
  canSkip = false,
  activeBatchId = null,
  filterOnlyFailed = false,
  onSkipPost,
  onErrorDetail,
  itemMeta = {},
}) {
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

          // If filterOnlyFailed is active, check if any translations are non-completed
          if (filterOnlyFailed) {
            const hasUntranslatedOrFailed = Object.values(postData.translations || {}).some(
              (t) => t.status !== 'completed' && t.status !== 'already_exists'
            );
            if (!hasUntranslatedOrFailed) {
              return null;
            }
          }

          return (
            <PostResultItem
              key={pid}
              postId={pid}
              postData={postData}
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
