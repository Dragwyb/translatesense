/**
 * ReviewRow Component
 * Single translatable string comparison & editing row
 */

import { useRef, useLayoutEffect } from '@wordpress/element';
import { cleanContentEditable } from '../../utils/html';

export function ReviewRow({
  item,
  index,
  onUpdateTranslation,
  onResetTranslation,
}) {
  const textRef = useRef(null);
  const sourceVal = item.value || item.source || '';
  const transVal = item.translated || '';
  const providerVal = item.providerTranslated !== undefined ? item.providerTranslated : transVal;
  const hasChanged = Boolean(providerVal && transVal !== providerVal);

  // Synchronize DOM text with transVal without disturbing caret if user is actively typing
  useLayoutEffect(() => {
    if (textRef.current) {
      const currentDomVal = cleanContentEditable(textRef.current.innerText || '');
      const isFocused = document.activeElement === textRef.current;
      if (currentDomVal !== transVal && !isFocused) {
        textRef.current.innerText = transVal;
      }
    }
  }, [transVal]);

  const handleInput = (e) => {
    const val = cleanContentEditable(e.currentTarget.innerText || '');
    if (onUpdateTranslation) {
      onUpdateTranslation(index, val);
    }
  };

  const handleBlur = (e) => {
    const val = cleanContentEditable(e.currentTarget.innerText || '');
    if (val !== transVal && onUpdateTranslation) {
      onUpdateTranslation(index, val);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput(e);
    }
  };

  const handleFocusClick = () => {
    if (textRef.current) {
      textRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const handleReset = (e) => {
    e.stopPropagation();
    if (onResetTranslation) {
      onResetTranslation(index);
    }
    if (textRef.current) {
      textRef.current.innerText = providerVal;
    }
  };

  const widgetName = (widget) => {
    if (widget.startsWith('custom_field>')) {
      return widget.replace('custom_field>', '');
    }

    return widget;

  }

  return (
    <tr data-idx={index}>
      <td>
        <div className="ts-source-text">{sourceVal}</div>
        <div className="ts-widget-tag">
          <span className="ts-tag-symbol">&lt;&gt;</span>
          <span>{widgetName(item.name || 'block')}</span>
        </div>
      </td>
      <td>
        <div className="ts-trans-cell-wrap">
          <div
            className={`ts-trans-box ${!transVal ? 'ts-trans-empty' : ''} ${item.status === 'Failed' ? 'ts-trans-failed' : ''}`}
            title={item.status === 'Failed' && item.error ? item.error : undefined}
          >
            <div
              ref={textRef}
              className="ts-trans-text"
              contentEditable="plaintext-only"
              suppressContentEditableWarning={true}
              onInput={handleInput}
              onBlur={handleBlur}
              onPaste={handlePaste}
              data-placeholder="Enter translation..."
            />
            {hasChanged && (
              <button
                type="button"
                className="ts-trans-reset-btn"
                onClick={handleReset}
                title="Reset to provider translation"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            className="ts-row-edit-btn"
            onClick={handleFocusClick}
            title="Edit translation"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
