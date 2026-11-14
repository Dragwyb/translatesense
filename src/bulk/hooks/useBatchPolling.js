import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { getBatchStatus } from '../services/batchService';

/**
 * Hook for managing background batch status polling
 */
export function useBatchPolling(batchId, enabled = false, onBatchUpdate, onBatchComplete) {
  const [currentBatch, setCurrentBatch] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!batchId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsPolling(true);

    abortControllerRef.current = new AbortController();

    try {
      const data = await getBatchStatus(batchId, abortControllerRef.current.signal);
      setCurrentBatch(data);

      if (onBatchUpdate) {
        onBatchUpdate(data);
      }

      const status = data.overall_status;
      if (status === 'completed' || status === 'failed' || status === 'skipped') {
        stopPolling();
        setIsPolling(false);
        if (onBatchComplete) {
          onBatchComplete(data);
        }
      } else {
        // Schedule next poll sequentially after 5 seconds
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[TranslateSense] Batch status polling error:', err);
        // Continue polling on error after 5s
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [batchId, onBatchUpdate, onBatchComplete, stopPolling]);

  useEffect(() => {
    if (enabled && batchId) {
      poll();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, batchId, poll, stopPolling]);

  return {
    currentBatch,
    isPolling,
    pollNow: poll,
    stopPolling,
  };
}

