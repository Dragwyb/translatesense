/**
 * useIsCompact Hook
 * Responsive hook to detect screen width <= breakpoint (default: 864px)
 */

import { useState, useEffect } from '@wordpress/element';

export function useIsCompact(breakpoint = 864) {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= breakpoint;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const query = `(max-width: ${breakpoint}px)`;
    const mediaQueryList = window.matchMedia ? window.matchMedia(query) : null;

    const updateState = () => {
      setIsCompact(window.innerWidth <= breakpoint);
    };

    updateState();

    if (mediaQueryList) {
      if (mediaQueryList.addEventListener) {
        mediaQueryList.addEventListener('change', updateState);
      } else if (mediaQueryList.addListener) {
        mediaQueryList.addListener(updateState);
      }
    }

    window.addEventListener('resize', updateState);

    return () => {
      if (mediaQueryList) {
        if (mediaQueryList.removeEventListener) {
          mediaQueryList.removeEventListener('change', updateState);
        } else if (mediaQueryList.removeListener) {
          mediaQueryList.removeListener(updateState);
        }
      }
      window.removeEventListener('resize', updateState);
    };
  }, [breakpoint]);

  return isCompact;
}

