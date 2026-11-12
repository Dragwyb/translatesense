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
 * Parse `hideReviewNotice` safely from an API response (/bulk-start or /get-page-content).
 * Missing or invalid values are treated as hidden (`true`) until a valid boolean is returned.
 *
 * @param {Object|null|undefined} responseData
 * @returns {boolean}
 */
export function parseHideReviewNotice(responseData) {
  if (responseData && typeof responseData.hideReviewNotice === 'boolean') {
    return responseData.hideReviewNotice;
  }
  return true;
}

/**
 * Update in-memory localized dashboard config after successful dismissal.
 */
function markReviewNoticeHiddenInMemory() {
  const configs = getLocalizedConfigs();
  configs.forEach((cfg) => {
    if ('hideReviewNotice' in cfg) {
      cfg.hideReviewNotice = true;
    }
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
    const success = Boolean(response.ok && json && json.success);
    if (success) {
      markReviewNoticeHiddenInMemory();
    }
    return { success };
  } catch (err) {
    console.warn('[TranslateSense] Could not dismiss review notice:', err);
    return { success: false };
  }
}

