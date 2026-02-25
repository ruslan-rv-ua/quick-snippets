import { useEffect, useState } from 'react';

/**
 * Returns the debounced version of `value` — updates only after
 * `delay` ms have passed without a new value arriving.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
