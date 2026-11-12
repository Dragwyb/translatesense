/**
 * Review Notice Service
 * Shared constants, global visibility helper, and authenticated AJAX dismissal helper.
 */

export const REVIEW_URL = 'https://wordpress.org/support/plugin/translatesense/reviews/#new-post';

export const REVIEW_NOTICE_BODY = "If <strong class='ts-review-notice-lead'>TranslateSense</strong> making your translation work easier,";

export const REVIEW_NOTICE_LINK_TEXT = 'leave a review on WordPress.org.';

const ALLOWED_ACTIONS = new Set(['not_interested', 'already_reviewed']);

function getLocalizedConfigs() {
  if (typeof window === 'undefined') {
    return [];
  }

  return [
    window.TranslateSenseData,
    window.TranslateSenseBulkData,
    window.TranslateSenseEditorData,
  ].filter((cfg) => cfg && typeof cfg === 'object');
}

/**
 * Check whether the review notice has been globally dismissed in localized script data.
 *
 * @returns {boolean}
 */
export function isReviewNoticeHidden() {
  const configs = getLocalizedConfigs();
  return configs.some((cfg) => Boolean(cfg.hideReviewNotice));
}

/**
 * Update in-memory localized configs so closing/reopening modals in the same page session
 * keeps the review notice hidden without a reload.
 */
function markReviewNoticeHiddenInMemory() {
  const configs = getLocalizedConfigs();
  configs.forEach((cfg) => {
    cfg.hideReviewNotice = true;
    if ('showReviewNotice' in cfg) {
      cfg.showReviewNotice = false;
    }
  });
}

/**
 * Dismiss the review notice globally via authenticated WordPress AJAX.
 *
 * @param {'not_interested'|'already_reviewed'} reviewAction
 * @returns {Promise<{ success: boolean }>}
 */
export async function dismissReviewNotice(reviewAction) {
  if (!ALLOWED_ACTIONS.has(reviewAction)) {
    return { success: false };
  }

  markReviewNoticeHiddenInMemory();

  const configs = getLocalizedConfigs();
  const activeConfig = configs.find((cfg) => cfg.ajaxUrl && cfg.reviewNonce) || configs[0] || {};
  const ajaxUrl = activeConfig.ajaxUrl || (typeof window !== 'undefined' ? window.ajaxurl : '');
  const nonce = activeConfig.reviewNonce || '';

  if (!ajaxUrl || !nonce) {
    return { success: false };
  }

  try {
    const body = new URLSearchParams({
      action: 'translatesense_dismiss_review',
      nonce,
      review_action: reviewAction,
    });

    const response = await fetch(ajaxUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body.toString(),
    });

    const json = await response.json().catch(() => null);
    return { success: Boolean(response.ok && json && json.success) };
  } catch (err) {
    console.warn('[TranslateSense] Could not dismiss review notice:', err);
    return { success: false };
  }
}

