import { useEffect } from "react";

/**
 * Calls `fetcher` immediately on mount and then every `intervalMs` milliseconds.
 * Silently ignores errors. Cleans up the interval on unmount.
 *
 * IMPORTANT: Wrap `fetcher` in `useCallback` to avoid re-registering the interval
 * on every render.
 */
export function usePolling(
  fetcher: () => Promise<void>,
  intervalMs: number
): void {
  useEffect(() => {
    fetcher().catch(() => {});
    const id = setInterval(() => {
      fetcher().catch(() => {});
    }, intervalMs);
    return () => clearInterval(id);
    // fetcher intentionally excluded — wrap in useCallback at call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
