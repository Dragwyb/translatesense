import { useState, useEffect, useRef, useCallback } from '@wordpress/element';

/**
 * Hook to track elapsed time in seconds with mm:ss formatting
 */
export function useElapsedTimer(isRunning = false) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now() - elapsedSeconds * 1000;

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const secs = Math.floor((now - startTimeRef.current) / 1000);
      setElapsedSeconds(secs);
    }, 1000);
  }, [elapsedSeconds]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setElapsedSeconds(0);
    startTimeRef.current = null;
  }, [stopTimer]);

  useEffect(() => {
    if (isRunning) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, startTimer, stopTimer]);

  const m = Math.floor(elapsedSeconds / 60);
  const s = elapsedSeconds % 60;
  const formattedTimer = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} elapsed`;
  const humanReadable = m > 0 ? `${m}m ${s}s` : `${s}s`;

  return {
    elapsedSeconds,
    formattedTimer,
    humanReadable,
    startTimer,
    stopTimer,
    resetTimer,
  };
}

