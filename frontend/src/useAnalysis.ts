import { useEffect, useState } from "react";
import type { CachedReport } from "./types";

interface Meta {
  created_at: string;
  stale: boolean;
}

/** Persistence + freshness for a cached AI analysis. Loads the saved result on mount (so
 *  insights are permanent across navigation and restarts), exposes whether the data room
 *  changed since (`meta.stale`), and a `regenerate()` that re-runs and re-caches. */
export function useAnalysis<T>(
  fetchCached: () => Promise<CachedReport<T> | null>,
  run: () => Promise<T>,
  deps: unknown[] = []
) {
  const [report, setReport] = useState<T | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetchCached()
      .then((c) => {
        if (!active) return;
        if (c) {
          setReport(c.payload);
          setMeta({ created_at: c.created_at, stale: c.stale });
        } else {
          setReport(null);
          setMeta(null);
        }
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  async function regenerate() {
    setBusy(true);
    setErr(null);
    try {
      const r = await run();
      setReport(r);
      setMeta({ created_at: new Date().toISOString(), stale: false });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return { report, meta, busy, err, loaded, regenerate };
}
