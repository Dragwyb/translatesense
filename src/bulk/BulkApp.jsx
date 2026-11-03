/**
 * BulkApp Component
 * Root component for Bulk Translation
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { BulkWizard } from './components/BulkWizard';
import { useBulkTranslation } from './hooks/useBulkTranslation';
import { getActiveBatches } from './services/batchService';

export function BulkApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasActiveJobs, setHasActiveJobs] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [isPrevRunningMode, setIsPrevRunningMode] = useState(false);

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

  // Check background jobs
  const checkBackgroundJobs = useCallback(async () => {
    try {
      const res = await getActiveBatches();
      const batches = res.batches || [];
      const active = batches.length > 0;
      setHasActiveJobs(active);
      updatePulseDot(active);
      return active;
    } catch {
      return false;
    }
  }, [updatePulseDot]);

  // Initial check & interval polling
  useEffect(() => {
    checkBackgroundJobs();
    const interval = setInterval(checkBackgroundJobs, 10000);
    return () => clearInterval(interval);
  }, [checkBackgroundJobs]);

  // Bind click listener to table action buttons
  useEffect(() => {
    const handleClick = async (e) => {
      const btn = e.target.closest('.ts-filter-action-btn');
      if (!btn) return;
      e.preventDefault();

      const ids = getCheckedPostIds();
      if (ids.length === 0) {
        const active = hasActiveJobs || (await checkBackgroundJobs());
        if (active) {
          setIsPrevRunningMode(true);
          setSelectedPostIds([]);
          translationState.setCurrentStep(3);
          setIsOpen(true);
          return;
        }
        alert('Please select posts first.');
        return;
      }

      setIsPrevRunningMode(false);
      setSelectedPostIds(ids);
      translationState.setPostIds(ids);
      translationState.setCurrentStep(1);
      setIsOpen(true);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [getCheckedPostIds, hasActiveJobs, checkBackgroundJobs, translationState]);

  return (
    <BulkWizard
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        checkBackgroundJobs();
      }}
      translationState={translationState}
      allLanguages={allLanguages}
    />
  );
}

