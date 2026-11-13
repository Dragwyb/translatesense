/**
 * BulkApp Component
 * Root component for Bulk Translation
 */

import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { BulkWizard } from './components/BulkWizard';
import { useBulkTranslation } from './hooks/useBulkTranslation';
import { getActiveBatches } from './services/batchService';

export function BulkApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasActiveJobs, setHasActiveJobs] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [isPrevRunningMode, setIsPrevRunningMode] = useState(false);

  const bgTimerRef = useRef(null);
  const isCheckingBgRef = useRef(false);

  const localizedData =
    (typeof window !== 'undefined' && window.TranslateSenseBulkData) || {};
  const allLanguages = Object.values(localizedData.languages || {});
  const itemType = localizedData.type === 'term' ? 'term' : 'post';
  const subtype = localizedData.subtype || '';
  const isTaxonomy = itemType === 'term';
  const itemSingular = localizedData.itemSingular || (isTaxonomy ? 'term' : 'post');
  const itemPlural = localizedData.itemPlural || (isTaxonomy ? 'terms' : 'posts');
  const itemLabel = localizedData.itemLabel || '';

  const translationState = useBulkTranslation(selectedPostIds, {
    isPreviouslyRunning: isPrevRunningMode,
    type: itemType,
    subtype,
  });

  // Query selected posts or taxonomy terms from DOM checkboxes
  const getCheckedPostIds = useCallback(() => {
    const selector = isTaxonomy
      ? '#posts-filter input[name="delete_tags[]"]:checked, input[name="delete_tags[]"]:checked'
      : 'input[name="post[]"]:checked, input[name="media[]"]:checked';
    const checkedBoxes = document.querySelectorAll(selector);
    const ids = [];
    const seen = new Set();
    checkedBoxes.forEach((cb) => {
      const val = parseInt(cb.value, 10);
      if (!isNaN(val) && val > 0 && !seen.has(val)) {
        seen.add(val);
        ids.push(val);
      }
    });
    return ids;
  }, [isTaxonomy]);

  // Update animated pulse dot on Bulk Translate buttons in table header/footer
  const updatePulseDot = useCallback((active) => {
    const buttons = document.querySelectorAll('.ts-filter-action-btn');
    buttons.forEach((btn) => {
      const dot = btn.querySelector('.ts-active-pulse-dot');
      if (dot) {
        dot.style.display = active ? 'inline-flex' : 'none';
      }
      btn.classList.toggle('ts-has-active-jobs', Boolean(active));
    });
  }, []);

  // On supported Polylang taxonomy listing pages (edit-tags.php), inject Bulk Translate buttons
  // into top and bottom tablenav matching edit.php markup and hooks.
  useEffect(() => {
    if (!isTaxonomy || typeof document === 'undefined') return undefined;

    const insertedWrappers = [];
    const positions = [
      { navSelector: '#posts-filter .tablenav.top', btnId: 'ts-quick-filter-translate-btn' },
      { navSelector: '#posts-filter .tablenav.bottom', btnId: 'ts-quick-filter-translate-btn-bottom' },
    ];

    positions.forEach(({ navSelector, btnId }) => {
      const tablenav = document.querySelector(navSelector);
      if (!tablenav || document.getElementById(btnId)) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'alignleft actions ts-bulk-tablenav-action';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = btnId;
      btn.className = 'button button-primary ts-filter-action-btn';

      const icon = document.createElement('span');
      icon.className = 'dashicons dashicons-translation';

      const labelText = document.createTextNode(' Bulk Translate ');

      const pulseDot = document.createElement('span');
      pulseDot.className = 'ts-active-pulse-dot';
      pulseDot.style.display = 'none';
      pulseDot.title = 'Background translations running';

      btn.appendChild(icon);
      btn.appendChild(labelText);
      btn.appendChild(pulseDot);
      wrapper.appendChild(btn);

      const bulkActions = tablenav.querySelector('.alignleft.actions.bulkactions');
      if (bulkActions) {
        bulkActions.insertAdjacentElement('afterend', wrapper);
      } else {
        tablenav.insertBefore(wrapper, tablenav.firstChild);
      }

      insertedWrappers.push(wrapper);
    });

    return () => {
      insertedWrappers.forEach((wrapper) => {
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
      });
    };
  }, [isTaxonomy]);

  // Keep pulse dot synced whenever active job state changes (including right after button injection)
  useEffect(() => {
    updatePulseDot(hasActiveJobs);
  }, [hasActiveJobs, updatePulseDot]);

  // Stop background polling timer cleanly
  const stopBgPolling = useCallback(() => {
    if (bgTimerRef.current) {
      clearTimeout(bgTimerRef.current);
      bgTimerRef.current = null;
    }
    isCheckingBgRef.current = false;
  }, []);

  // Check background jobs with conditional interval scheduling
  const checkBackgroundJobs = useCallback(async (shouldSchedule = false) => {
    if (isTaxonomy) {
      setHasActiveJobs(false);
      updatePulseDot(false);
      stopBgPolling();
      return [];
    }

    if (isCheckingBgRef.current) return [];
    isCheckingBgRef.current = true;

    try {
      const res = await getActiveBatches();
      const batches = res.batches || [];
      const active = batches.length > 0;
      setHasActiveJobs(active);
      updatePulseDot(active);

      // Clean up previous timer
      if (bgTimerRef.current) {
        clearTimeout(bgTimerRef.current);
        bgTimerRef.current = null;
      }

      // If active batches exist and scheduled polling is requested, poll again in 10s
      // If NO active batches exist, stop polling immediately (do not schedule another request)
      if (active && shouldSchedule) {
        bgTimerRef.current = setTimeout(() => checkBackgroundJobs(true), 10000);
      }
      return batches;
    } catch {
      setHasActiveJobs(false);
      updatePulseDot(false);
      return [];
    } finally {
      isCheckingBgRef.current = false;
    }
  }, [isTaxonomy, updatePulseDot, stopBgPolling]);

  // Initial check on mount: perform one fresh check for background post queues.
  // Continues polling only while active batches exist; stops immediately if empty.
  useEffect(() => {
    if (isTaxonomy) {
      return undefined;
    }
    checkBackgroundJobs(true);
    return () => stopBgPolling();
  }, [isTaxonomy, checkBackgroundJobs, stopBgPolling]);

  // Bind click listener to table action buttons
  useEffect(() => {
    const handleClick = async (e) => {
      const btn = e.target.closest('.ts-filter-action-btn');
      if (!btn) return;
      e.preventDefault();

      const ids = getCheckedPostIds();

      // Case B1: User has NOT selected any posts or terms
      if (ids.length === 0) {
        if (!isTaxonomy) {
          setIsPrevRunningMode(true);
          setSelectedPostIds([]);
          setIsOpen(true);
          translationState.openBatchMonitor(
            null,
            null,
            null,
            {
              sessionType: 'existing_queue',
              modalSource: 'bulk_button',
            }
          );
          return;
        }

        alert(`Please select ${itemPlural} first.`);
        return;
      }

      // Case B2 / Workflow A: User HAS selected posts or terms
      setIsPrevRunningMode(false);
      setSelectedPostIds(ids);
      translationState.setPostIds(ids);
      translationState.setProgressSessionType('new_queue');
      translationState.setProgressModalSource('provider_selection');
      translationState.setCurrentStep(1);

      if (!isTaxonomy) {
        // Perform one fresh check to see if background jobs are running, so Step 1 notice banner can show
        checkBackgroundJobs(false).then((batches) => {
          if (translationState.setActiveBatches) {
            translationState.setActiveBatches(batches || []);
          }
        });
      }

      setIsOpen(true);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [getCheckedPostIds, checkBackgroundJobs, updatePulseDot, translationState, isTaxonomy, itemPlural]);

  return (
    <BulkWizard
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setIsPrevRunningMode(false);
        if (translationState.stopPolling) {
          translationState.stopPolling();
        }
        if (!isTaxonomy) {
          // When modal is closed: perform one fresh check.
          // If active batches exist, resumes polling; if none, does not start polling.
          checkBackgroundJobs(true);
        }
      }}
      translationState={translationState}
      allLanguages={allLanguages}
      itemMeta={{
        type: itemType,
        isTaxonomy,
        subtype,
        itemLabel,
        itemSingular,
        itemPlural,
      }}
    />
  );
}
