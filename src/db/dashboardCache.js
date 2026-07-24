// Browser-side cache for the dashboard bundle.
//
// We cache the RAW PostgREST rows (pure JSON — strings, numbers, null, arrays),
// never the mapped domain objects. The mapping (mapDashboardBundle) runs fresh
// on every read, so there is no risk of a Date/Map/class instance surviving a
// JSON round-trip in a broken state.
//
// The cache enables a stale-while-revalidate first paint: render the last known
// data instantly, then revalidate against Supabase in the background.
//
// Keys are registered in src/utils/storage.js TC_LS_KEYS so they are wiped on
// sign-out and idle timeout (shared-machine safety).

const BUNDLE_KEY = "tc_cache_bundle_v1";
const EURUSD_KEY = "tc_cache_eurusd_v1";

// Bump when the raw-row shape or mapping changes in a way that makes old cache
// entries produce wrong output. A mismatch is treated as a cache miss.
const CACHE_VERSION = 1;

/**
 * @returns {{ rows: object, savedAt: number } | null}
 */
export function readDashboardCache() {
  try {
    const raw = localStorage.getItem(BUNDLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== CACHE_VERSION || !parsed.rows) return null;
    return { rows: parsed.rows, savedAt: parsed.savedAt ?? null };
  } catch {
    return null;
  }
}

/**
 * @param {object} rows Raw row bundle from fetchRawDashboardRows()
 */
export function writeDashboardCache(rows) {
  if (!rows) return;
  try {
    localStorage.setItem(
      BUNDLE_KEY,
      JSON.stringify({ v: CACHE_VERSION, savedAt: Date.now(), rows }),
    );
  } catch {
    // Quota exceeded or serialization failure — caching is best-effort.
    // Drop any stale entry so we never read a half-written value.
    try { localStorage.removeItem(BUNDLE_KEY); } catch { /* ignore */ }
  }
}

export function clearDashboardCache() {
  try { localStorage.removeItem(BUNDLE_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(EURUSD_KEY); } catch { /* ignore */ }
}

// ── EUR/USD rate cache ────────────────────────────────────────────────
// The /api/eur-usd endpoint is a Vercel serverless function that cold-starts
// (~2s on the Hobby plan). We cache the rate client-side so the dashboard never
// blocks on it: read the cached rate instantly, refresh in the background only
// when it is stale.

const EURUSD_TTL_MS = 12 * 60 * 60 * 1000; // 12h

/**
 * @returns {{ rate: number, fresh: boolean } | null}
 */
export function readEurUsdCache() {
  try {
    const raw = localStorage.getItem(EURUSD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rate = Number(parsed?.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const savedAt = Number(parsed?.savedAt) || 0;
    return { rate, fresh: Date.now() - savedAt < EURUSD_TTL_MS };
  } catch {
    return null;
  }
}

/**
 * @param {number} rate
 */
export function writeEurUsdCache(rate) {
  if (!Number.isFinite(rate) || rate <= 0) return;
  try {
    localStorage.setItem(EURUSD_KEY, JSON.stringify({ rate, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}
