/**
 * Common ReviewNotice Component for Translation Modals
 * Shared by Bulk Translation Progress Modal and Editor String Translation Modal.
 */

import { useState, useRef } from '@wordpress/element';
import {
  REVIEW_URL,
  REVIEW_NOTICE_BODY,
  REVIEW_NOTICE_LINK_TEXT,
  isReviewNoticeHidden,
  dismissReviewNotice,
} from '../../services/api/reviewService';

export function ReviewNotice({ isVisible = false, className = '' }) {
  const [isDismissed, setIsDismissed] = useState(() => isReviewNoticeHidden());
  const isSubmittingRef = useRef(false);

  if (!isVisible || isDismissed || isReviewNoticeHidden()) {
    return null;
  }

  const handleDismiss = (reviewAction) => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsDismissed(true);
    dismissReviewNotice(reviewAction);
  };

  return (
    <div
      className={`ts-review-notice ${className}`.trim()}
      role="region"
      aria-label="TranslateSense Review Notice"
    >
      <p className="ts-review-notice-text">
        <span dangerouslySetInnerHTML={{ __html: REVIEW_NOTICE_BODY }} />{' '}
        <a
          href={REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ts-review-notice-link"
        >
          {REVIEW_NOTICE_LINK_TEXT}
        </a>
      </p>

      <div className="ts-review-notice-actions">
        <button
          type="button"
          className="ts-review-notice-action"
          onClick={() => handleDismiss('already_reviewed')}
          style={{ borderLeftWidth: '0px' }}
        >
          Already Reviewed
        </button>

        <button
          type="button"
          className="ts-review-notice-action"
          onClick={() => handleDismiss('not_interested')}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
