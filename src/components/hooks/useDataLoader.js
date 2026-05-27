import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Standardizes the common load / loading / error / retry pattern.
 *
 * @template T
 * @param {object} params
 * @param {() => Promise<T>} params.load
 * @param {any[]} [params.deps]
 * @param {boolean} [params.auto]
 * @param {T} [params.initialData]
 * @param {(error: Error) => void} [params.onError]
 * @returns {{ data: T, setData: (next: any) => void, loading: boolean, error: Error|null, reload: () => Promise<void> }}
 */
export function useDataLoader({
  load,
  deps = [],
  auto = true,
  initialData,
  onError,
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(auto));
  const [error, setError] = useState(null);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const runIdRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reload = useCallback(async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loadRef.current();
      if (!mountedRef.current || runId !== runIdRef.current) return;
      setData(result);
    } catch (e) {
      if (!mountedRef.current || runId !== runIdRef.current) return;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      if (typeof onErrorRef.current === "function") onErrorRef.current(err);
    } finally {
      if (!mountedRef.current || runId !== runIdRef.current) return;
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  return { data, setData, loading, error, reload };
}
