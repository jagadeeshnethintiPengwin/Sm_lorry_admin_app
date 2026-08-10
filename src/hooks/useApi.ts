import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * One way for a screen to read from the API.
 *
 * Every list in this app used to draw a literal array declared at the top of
 * its own file, so the panel showed the same forty-two lorries on every device
 * and never changed. Replacing those one screen at a time invites four
 * different opinions about what "still loading" looks like, so the fetching,
 * the failure and the empty case live here instead and each screen only says
 * what to call and how to draw a row.
 *
 * `refetch` is exposed for pull-to-refresh, and the data is re-read whenever
 * the screen comes back into focus — a driver added on another screen should
 * be on the roster when you navigate back to it, not after a restart.
 */
export type ApiState<T> = {
  data: T | null;
  /** True only for the first load; a refresh keeps the previous data on screen. */
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => void;
};

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = [],
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The fetcher is almost always an inline arrow, which is a new function on
   * every render. Holding it in a ref keeps it out of the effect's dependency
   * list, so the screen re-reads when its *filters* change and not on every
   * keystroke that happens to re-render it.
   */
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // A reply that arrives after the screen has gone must not set state on it.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (alive.current) {
        setData(result);
      }
    } catch (caught) {
      if (alive.current) {
        setError(
          caught instanceof Error ? caught.message : 'Could not load this',
        );
      }
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /*
   * The caller's dependencies, compared by value rather than by identity.
   *
   * They arrive as an array this hook cannot name in advance, which a literal
   * dependency list cannot express — and spreading them defeats the lint rule
   * that checks the list is honest. Serialising them to one key sidesteps
   * both: the effect has a real, checkable dependency list, and it re-runs
   * exactly when a filter's *value* changes rather than on every render that
   * rebuilds the array.
   */
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    run(false);
  }, [depsKey, run]);

  // Coming back to a list re-reads it, but quietly — the rows already on
  // screen stay put rather than flashing a spinner over themselves.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      run(true);
    }, [run]),
  );

  const refetch = useCallback(() => {
    run(true);
  }, [run]);

  return { data, loading, refreshing, error, refetch };
}
