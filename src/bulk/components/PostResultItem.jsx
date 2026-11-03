/**
 * PostResultItem Component
 * Single post group card with accordion translation rows
 */

import { useState } from '@wordpress/element';
import { getLanguageFlag } from '../../utils/language';
import { getDisplayTitle, getStatusBadgeInfo } from '../utils/bulkFormatters';

export function PostResultItem({
  postId,
  postData,
  allLanguages = [],
  isBackgroundMode = false,
  activeBatchId = null,
  onSkipPost,
  onErrorDetail,
}) {
  const [expanded, setExpanded] = useState(true);

  const { postTitle = `Post #${postId}`, translations = {}, provider = '' } = postData;
  const transKeys = Object.keys(translations);

  let compCount = 0;
  let failCount = 0;
  let runCount = 0;
  let pendCount = 0;
  let skipCount = 0;

  transKeys.forEach((langSlug) => {
    const t = translations[langSlug];
    if (t.status === 'completed' || t.status === 'already_exists') {
      compCount++;
    } else if (t.status === 'failed') {
      failCount++;
    } else if (t.status === 'skipped') {
      skipCount++;
    } else if (t.status === 'running' || t.status === 'processing' || t.status === 'cancelling') {
      runCount++;
    } else {
      pendCount++;
    }
  });

  // Skip button strictly visible in background monitor mode for OpenAI/Gemini with pending/running items
  const isEligibleProvider = provider === 'openai' || provider === 'gemini';
  const hasActiveJobs = runCount > 0 || pendCount > 0;
  const showSkipBtn = isBackgroundMode && isEligibleProvider && hasActiveJobs;

  const handleSkipClick = (e) => {
    e.stopPropagation();
    if (onSkipPost) {
      onSkipPost(postId, activeBatchId);
    }
  };

  return (
    <div className={`ts-post-group-card ${expanded ? 'expanded extended' : ''}`}>
      <div
        className="ts-post-group-header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="ts-post-source-info">
          <div className="ts-post-icon-box">
            <span className="dashicons dashicons-media-text" />
          </div>
          <span className="ts-source-title-text">{postTitle}</span>
          <span className="ts-post-id-tag">#{postId}</span>
        </div>

        <div className="ts-post-header-right">
          {showSkipBtn && (
            <button
              type="button"
              className="ts-post-skip-btn button button-small"
              onClick={handleSkipClick}
              title="Skip remaining translations for this post"
            >
              <span className="dashicons dashicons-controls-skipforward" /> Skip
            </button>
          )}

          {failCount > 0 && (
            <span className="ts-post-status-pill failed">
              <span className="dashicons dashicons-dismiss" /> Failed ({failCount})
            </span>
          )}

          {skipCount > 0 && skipCount + compCount === transKeys.length && compCount === 0 && (
            <span className="ts-post-status-pill skipped">
              <span className="dashicons dashicons-controls-skipforward" /> Skipped
            </span>
          )}

          <span
            className={`ts-post-chevron dashicons ${expanded ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'
              }`}
          />
        </div>
      </div>

      {expanded && (
        <div className="ts-post-translations-list ts-translations-accordion-body">
          {transKeys.map((langSlug) => {
            const trans = translations[langSlug];
            const flagInfo = getLanguageFlag(langSlug, allLanguages);
            const displayTitle = getDisplayTitle(trans, postTitle, postId);
            const isDone = trans.status === 'completed' || trans.status === 'already_exists';
            const isFail = trans.status === 'failed';
            const isSkipped = trans.status === 'skipped';
            const isCancelling = trans.status === 'cancelling';
            const isRunning = trans.status === 'running' || trans.status === 'processing';

            const editUrl =
              trans.editUrl ||
              (trans.targetPostId
                ? trans.editorType === 'elementor'
                  ? `post.php?post=${trans.targetPostId}&action=elementor`
                  : `post.php?post=${trans.targetPostId}&action=edit`
                : '#');
            const viewUrl = trans.viewUrl || (trans.targetPostId ? `/?p=${trans.targetPostId}` : '#');

            const isUnsupported =
              trans.error &&
              (trans.error.toLowerCase().includes('not supported') ||
                trans.error.toLowerCase().includes('unavailable'));
            const failText = isUnsupported ? 'Language not supported' : 'Failed';

            return (
              <div key={langSlug} className={`ts-translation-item ${trans.status}`}>
                <div className="ts-trans-lang-col">
                  {flagInfo.hasFlag ? (
                    <img src={flagInfo.flagUrl} alt="" className="ts-lang-flag-img" />
                  ) : null}
                  <span className="ts-trans-lang-code">{flagInfo.code}</span>
                </div>

                <div className="ts-trans-title-col">
                  <span className="ts-trans-title-text" title={displayTitle}>
                    {displayTitle}
                  </span>
                </div>

                <div className="ts-trans-status-col">
                  {trans.status === 'already_exists' ? (
                    <span className="ts-row-status completed already-exists">
                      <span className="dashicons dashicons-yes-alt" /> Already exists
                    </span>
                  ) : trans.status === 'completed' ? (
                    <span className="ts-row-status completed">
                      <span className="dashicons dashicons-yes-alt" /> Completed
                    </span>
                  ) : isSkipped ? (
                    <span className="ts-row-status skipped">
                      <span className="dashicons dashicons-controls-skipforward" /> Skipped
                    </span>
                  ) : isCancelling ? (
                    <span className="ts-row-status cancelling">
                      <span className="ts-spinner-circle" /> Cancelling...
                    </span>
                  ) : isFail ? (
                    <button
                      type="button"
                      className="ts-row-status failed ts-error-detail-btn"
                      onClick={() =>
                        onErrorDetail &&
                        onErrorDetail({
                          title: `${flagInfo.name} (${flagInfo.code}) Error`,
                          message: trans.error || 'Translation failed.',
                          errorObj: trans.errorObj,
                        })
                      }
                      title="Click to view error details"
                    >
                      <span className="dashicons dashicons-dismiss" /> {failText}
                    </button>
                  ) : isRunning ? (
                    <span className="ts-row-status translating">
                      <span className="ts-spinner-circle" />
                      <span className="ts-translating-label">Translating</span>
                      <span className="ts-ellipsis-dots">
                        <span className="ts-dot" />
                        <span className="ts-dot" />
                        <span className="ts-dot" />
                      </span>
                    </span>
                  ) : (
                    <span className="ts-row-status pending">
                      <span className="dashicons dashicons-clock" /> Pending...
                    </span>
                  )}
                </div>

                <div className="ts-trans-actions-col">
                  {isDone ? (
                    <>
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ts-row-action-btn view"
                        title="View translated post on site"
                      >
                        <span className="dashicons dashicons-visibility" /> View
                      </a>
                      <a
                        href={editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ts-row-action-btn edit"
                        title="Edit translated post"
                      >
                        <span className="dashicons dashicons-edit" /> Edit
                      </a>
                    </>
                  ) : !isFail && !isSkipped ? (
                    <>
                      <span className="ts-row-action-btn view disabled">
                        <span className="dashicons dashicons-visibility" /> View
                      </span>
                      <span className="ts-row-action-btn edit disabled">
                        <span className="dashicons dashicons-edit" /> Edit
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

