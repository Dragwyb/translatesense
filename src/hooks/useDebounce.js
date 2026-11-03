import { useState, useEffect } from '@wordpress/element';

/**
 * Hook to debounce value changes
 * @template T
 * @param {T} value
 * @param {number} [delayMs=300]
 * @returns {T}
 */
export function useDebounce(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

