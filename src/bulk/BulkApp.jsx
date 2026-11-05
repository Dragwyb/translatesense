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

  const translationState = useBulkTranslation(selectedPostIds, {
    isPreviouslyRunning: isPrevRunningMode,
  });

  // Query selected posts from DOM checkboxes
  const getCheckedPostIds = useCallback(() => {
    const checkedBoxes = document.querySelectorAll(
      'input[name="post[]"]:checked, input[name="media[]"]:checked'
    );
    const ids = [];
    checkedBoxes.forEach((cb) => {
      const val = parseInt(cb.value, 10);
      if (!isNaN(val) && val > 0) ids.push(val);
    });
    return ids;
  }, []);

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
  }, [updatePulseDot]);

  // Initial check on mount: perform one fresh check.
  // Continues polling only while active batches exist; stops immediately if empty.
  useEffect(() => {
    checkBackgroundJobs(true);
    return () => stopBgPolling();
  }, [checkBackgroundJobs, stopBgPolling]);

  // Bind click listener to table action buttons
  useEffect(() => {
    const handleClick = async (e) => {
      const btn = e.target.closest('.ts-filter-action-btn');
      if (!btn) return;
      e.preventDefault();

      const ids = getCheckedPostIds();

      // Case B1: User has NOT selected any posts
      if (ids.length === 0) {
        let latestBatches = [];
        try {
          const res = await getActiveBatches();
          latestBatches = res.batches || [];
        } catch {
          latestBatches = [];
        }

        const active = latestBatches.length > 0;
        setHasActiveJobs(active);
        updatePulseDot(active);

        if (active) {
          setIsPrevRunningMode(true);
          setSelectedPostIds([]);
          const activeBatch = latestBatches[0];
          translationState.openBatchMonitor(
            activeBatch.batch_id,
            activeBatch,
            latestBatches,
            {
              sessionType: 'existing_queue',
              modalSource: 'bulk_button',
            }
          );
          setIsOpen(true);
          return;
        }

        alert('Please select posts first.');
        return;
      }

      // Case B2 / Workflow A: User HAS selected posts
      setIsPrevRunningMode(false);
      setSelectedPostIds(ids);
      translationState.setPostIds(ids);
      translationState.setProgressSessionType('new_queue');
      translationState.setProgressModalSource('provider_selection');
      translationState.setCurrentStep(1);

      // Default all languages selected excluding default language on modal open
      const defaultTargets = allLanguages
        .filter((l) => l && l.slug && l.slug !== localizedData.defaultLanguage && !l.is_default)
        .map((l) => l.slug);
      translationState.setSelectedLanguages(defaultTargets);

      // Perform one fresh check to see if background jobs are running, so Step 1 notice banner can show
      checkBackgroundJobs(false).then((batches) => {
        if (translationState.setActiveBatches) {
          translationState.setActiveBatches(batches || []);
        }
      });

      setIsOpen(true);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [getCheckedPostIds, checkBackgroundJobs, updatePulseDot, translationState]);

  return (
    <BulkWizard
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setIsPrevRunningMode(false);
        if (translationState.stopPolling) {
          translationState.stopPolling();
        }
        // When modal is closed: perform one fresh check.
        // If active batches exist, resumes polling; if none, does not start polling.
        checkBackgroundJobs(true);
      }}
      translationState={translationState}
      allLanguages={allLanguages}
    />
  );
}
