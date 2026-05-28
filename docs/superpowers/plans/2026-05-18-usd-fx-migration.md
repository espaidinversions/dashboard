# USD FX Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix legacy USD capital calls that store raw USD amounts in the `eur` column, add T-1 ECB rate semantics, and support future-dated calls with auto-resolving estimated EUR amounts.

**Architecture:** Backfill script (`scripts/backfill_usd_fx.mjs`) fixes stored data using the Supabase service-role key + direct ECB API calls. `src/fx.js` gains a `subtractOneCalendarDay` helper and updated USD conversion logic (T-1 semantics, future-date `ecb:estimated:` tag). `useDashboardData.js` gains an auto-resolve function that re-fetches real ECB rates for estimated rows once their transaction date has passed. `TxSection.jsx` shows a `~` prefix on estimated EUR amounts.

**Tech Stack:** Node.js ESM scripts, Supabase JS client (`@supabase/supabase-js`), ECB data API (direct fetch, no auth), React JSX, `node:test` + `node:assert/strict` for unit tests.

---

## Pre-flight: Run SQL Verification in Supabase Dashboard

**Before writing any code**, run these three queries in the Supabase SQL editor. Do not proceed if anything looks wrong.

```sql
-- 1. Count and inspect legacy USD rows (these are what the backfill fixes)
SELECT id, data, eur AS stored_usd_amount, divisa, fx_source
FROM capital_calls
WHERE divisa = 'USD' AND amount_native IS NULL AND fx_rate IS NULL
ORDER BY data;

-- 2. Check for non-USD, non-EUR currencies (blocks Task 2 generalisation if any found)
SELECT DISTINCT divisa, COUNT(*) AS count
FROM capital_calls
WHERE divisa NOT IN ('USD', 'EUR')
GROUP BY divisa;

-- 3. Sanity: flag suspect rows (PE drawdowns below $10,000 are unusual — verify manually)
SELECT id, data, eur AS suspect_value
FROM capital_calls
WHERE divisa = 'USD' AND amount_native IS NULL AND fx_rate IS NULL AND eur < 10000;
```

**Back up first:** Supabase dashboard → Database → Backups → create manual backup before running any migration.

If Query 2 returns any rows: stop and open `src/fx.js` — the `if (divisa === "USD")` block in `convertAmountToEurOnDate` must be generalised to handle those additional currencies before proceeding with Task 2.

---

## Task 1: Add `subtractOneCalendarDay` to `src/fx.js` and test it

**Files:**
- Modify: `src/fx.js`
- Create: `test/fx.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/fx.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

// subtractOneCalendarDay is not exported yet — this import will fail
import { subtractOneCalendarDay } from "../src/fx.js";

test("subtractOneCalendarDay: subtracts one day from a normal date", () => {
  assert.equal(subtractOneCalendarDay("2026-05-18"), "2026-05-17");
});

test("subtractOneCalendarDay: handles month boundary", () => {
  assert.equal(subtractOneCalendarDay("2026-05-01"), "2026-04-30");
});

test("subtractOneCalendarDay: handles year boundary", () => {
  assert.equal(subtractOneCalendarDay("2026-01-01"), "2025-12-31");
});

test("subtractOneCalendarDay: handles leap year Feb 29", () => {
  assert.equal(subtractOneCalendarDay("2024-03-01"), "2024-02-29");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/fx.test.js
```

Expected: `SyntaxError` or `ERR_MODULE_NOT_FOUND` — `subtractOneCalendarDay` is not exported yet.

- [ ] **Step 3: Add `subtractOneCalendarDay` to `src/fx.js` and export it**

Add this function at the top of `src/fx.js`, before `roundCurrency`:

```js
export function subtractOneCalendarDay(isoDate) {
  // Use noon UTC to avoid DST-edge midnight ambiguity when converting back to ISO.
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test test/fx.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fx.js test/fx.test.js
git commit -m "feat(fx): add subtractOneCalendarDay helper with tests"
```

---

## Task 2: Update `convertAmountToEurOnDate` for T-1 semantics and future dates

**Files:**
- Modify: `src/fx.js`
- Modify: `test/fx.test.js`

- [ ] **Step 1: Add failing tests for the updated USD conversion**

Append to `test/fx.test.js`. These use `node:test`'s `mock.module()` to avoid real API calls:

```js
import { mock } from "node:test";

// mock.module must be called before the module under test is imported.
// Using a dynamic import after mocking.
const MOCK_RATE = 0.92;
const MOCK_OBSERVED_AT = "2026-05-17";

mock.module("../src/apiClient.js", {
  namedExports: {
    apiFetchJson: async (_url) => ({ rate: MOCK_RATE, observedAt: MOCK_OBSERVED_AT, source: "ecb" }),
  },
});

// Dynamic import so mock.module takes effect first
const { convertAmountToEurOnDate } = await import("../src/fx.js");

test("convertAmountToEurOnDate: EUR identity — no conversion", async () => {
  const result = await convertAmountToEurOnDate({ amount: 1000, currency: "EUR", date: "2026-05-18" });
  assert.equal(result.eur, 1000);
  assert.equal(result.fxSource, "identity");
  assert.equal(result.fxRate, 1);
});

test("convertAmountToEurOnDate: USD past date uses T-1 ECB rate", async () => {
  // date = 2026-05-18 → rateDate = 2026-05-17
  const result = await convertAmountToEurOnDate({ amount: 1000, currency: "USD", date: "2026-05-18" });
  assert.equal(result.eur, Math.round(1000 * MOCK_RATE * 100) / 100);
  assert.equal(result.amountNative, 1000);
  assert.equal(result.fxRate, MOCK_RATE);
  // fxSource encodes the ECB observation date (T-1), not the transaction date
  assert.equal(result.fxSource, `ecb:${MOCK_OBSERVED_AT}`);
});

test("convertAmountToEurOnDate: USD future date uses estimated tag", async () => {
  const futureDate = "2099-12-31";
  const result = await convertAmountToEurOnDate({ amount: 1000, currency: "USD", date: futureDate });
  assert.equal(result.amountNative, 1000);
  assert.match(result.fxSource, /^ecb:estimated:/);
  // Estimated fxSource must NOT contain the future transaction date
  assert.ok(!result.fxSource.includes(futureDate), "fxSource should use rate date, not future tx date");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/fx.test.js
```

Expected: the three new USD tests fail — `convertAmountToEurOnDate` still uses old behavior.

- [ ] **Step 3: Verify ECB API behavior for future dates**

Run this curl to confirm ECB returns data (not empty) for a far-future `endPeriod`:

```bash
curl -s "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?endPeriod=2099-12-31&lastNObservations=1&format=csvdata" | head -5
```

Expected: CSV with 2 lines (header + one data row with the most recent rate).

If the response has fewer than 2 lines: the design is sound — we cap `endPeriod` to yesterday, which `subtractOneCalendarDay(todayUtc)` already does for future dates.

- [ ] **Step 4: Replace the USD block in `convertAmountToEurOnDate`**

In `src/fx.js`, replace lines 42–49 (the `if (divisa === "USD") { ... }` block):

**Before:**
```js
if (divisa === "USD") {
  const fxRate = await getHistoricalFxRate(date, "USD", "EUR");
  return {
    eur: roundCurrency(nativeAmount * fxRate),
    amountNative: roundCurrency(nativeAmount),
    fxRate,
    fxSource: `ecb:${String(date).slice(0, 10)}`,
  };
}
```

**After:**
```js
if (divisa === "USD") {
  // All dates in UTC to avoid timezone shift at midnight.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const isFuture = date > todayUtc;

  // T-1 semantics: use the ECB rate from the business day BEFORE the transaction date.
  // For future dates, use yesterday's rate (latest available).
  // ECB's lastNObservations=1 skips weekends/holidays automatically.
  const rateDate = subtractOneCalendarDay(isFuture ? todayUtc : date);
  const { rate: fxRate, observedAt } = await getEcbRateWithObservedAt(rateDate, "USD", "EUR");

  return {
    eur: roundCurrency(nativeAmount * fxRate),
    amountNative: roundCurrency(nativeAmount),
    fxRate,
    // fxSource encodes the ECB observation date (not the transaction date).
    fxSource: isFuture ? `ecb:estimated:${observedAt}` : `ecb:${observedAt}`,
  };
}
```

- [ ] **Step 5: Add `getEcbRateWithObservedAt` helper in `src/fx.js`**

The existing `getHistoricalFxRate` returns only the rate number. Add a helper that also returns `observedAt`:

```js
async function getEcbRateWithObservedAt(date, baseCurrency, quoteCurrency = "EUR") {
  const base = String(baseCurrency ?? "").trim().toUpperCase();
  const quote = String(quoteCurrency ?? "").trim().toUpperCase();
  if (!base || !quote || base === quote) return { rate: 1, observedAt: date };
  const isoDate = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("Valid FX date is required");
  }
  const data = await apiFetchJson(
    `/api/fx-rate?date=${encodeURIComponent(isoDate)}&base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}`
  );
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX rate for ${base}/${quote} on ${isoDate}`);
  }
  return { rate, observedAt: String(data.observedAt ?? isoDate).slice(0, 10) };
}
```

Update the mock in `test/fx.test.js` — `apiFetchJson` now needs to return `observedAt`:

```js
mock.module("../src/apiClient.js", {
  namedExports: {
    apiFetchJson: async (_url) => ({ rate: MOCK_RATE, observedAt: MOCK_OBSERVED_AT, source: "ecb" }),
  },
});
```

(It already returns `observedAt` in the mock above — no change needed.)

- [ ] **Step 6: Run test to verify it passes**

```bash
node --test test/fx.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Verify `getHistoricalFxRate` is still used elsewhere or remove it**

```bash
grep -n "getHistoricalFxRate" src/fx.js
```

If nothing uses it any more, delete it. If something else calls it, leave it. (The old function is private — only used inside `fx.js`.)

- [ ] **Step 8: Commit**

```bash
git add src/fx.js test/fx.test.js
git commit -m "feat(fx): T-1 ECB rate semantics + future-date estimated tag"
```

---

## Task 3: Write the USD legacy backfill script

**Files:**
- Create: `scripts/backfill_usd_fx.mjs`

This script reads legacy USD rows (those with `amount_native IS NULL AND fx_rate IS NULL`) directly from Supabase using the service-role key, fetches the correct ECB rate per row at T-1, and updates each row. Run with `--dry-run` first.

- [ ] **Step 1: Create `scripts/backfill_usd_fx.mjs`**

```js
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Env loading (same pattern as other backfill scripts) ---
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = loadEnv(path.join(__dirname, "../.env.local"));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Helpers ---
function subtractOneCalendarDay(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function fetchEcbUsdEur(dateStr) {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?endPeriod=${encodeURIComponent(dateStr)}&lastNObservations=1&format=csvdata`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ECB HTTP ${res.status} for date ${dateStr}`);
  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error(`ECB returned no data for date ${dateStr}`);
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const values = lines[lines.length - 1].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
  const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  const rate = Number(row.OBS_VALUE);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
    throw new Error(`Implausible ECB rate ${rate} for date ${dateStr}`);
  }
  return { rate, observedAt: String(row.TIME_PERIOD ?? dateStr).slice(0, 10) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main ---
console.log(DRY_RUN ? "DRY RUN — no writes will happen" : "LIVE RUN — writing to Supabase");

const { data: rows, error: fetchErr } = await supabase
  .from("capital_calls")
  .select("id, data, eur, divisa, fx_source")
  .eq("divisa", "USD")
  .is("amount_native", null)
  .is("fx_rate", null)
  .order("data", { ascending: true });

if (fetchErr) {
  console.error("Failed to fetch rows:", fetchErr.message);
  process.exit(1);
}

console.log(`Found ${rows.length} legacy USD rows to backfill.`);

if (rows.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Sanity check: flag any row where eur is < 10,000 (unusual for PE drawdowns)
const suspects = rows.filter((r) => Number(r.eur) < 10_000);
if (suspects.length > 0) {
  console.warn(`\nWARNING: ${suspects.length} row(s) have eur < 10,000. Verify manually before running without --dry-run:`);
  suspects.forEach((r) => console.warn(`  id=${r.id} data=${r.data} eur=${r.eur}`));
  console.warn("");
}

let successCount = 0;
let errorCount = 0;

for (const row of rows) {
  const rateDate = subtractOneCalendarDay(String(row.data).slice(0, 10));
  try {
    const { rate, observedAt } = await fetchEcbUsdEur(rateDate);
    const amountNative = Number(row.eur); // legacy: raw USD stored in eur column
    const eur = Math.round(amountNative * rate * 100) / 100;
    console.log(
      `id=${row.id} data=${row.data} rateDate=${rateDate} observedAt=${observedAt} ` +
      `USD ${amountNative} → EUR ${eur} (rate ${rate})`
    );
    if (!DRY_RUN) {
      const { error: updateErr } = await supabase
        .from("capital_calls")
        .update({ amount_native: amountNative, fx_rate: rate, eur, fx_source: `ecb:${observedAt}` })
        .eq("id", row.id);
      if (updateErr) throw new Error(updateErr.message);
    }
    successCount++;
  } catch (err) {
    // Distinguish transient vs permanent errors
    const isTransient = err.message.includes("ECB HTTP 5") || err.message.includes("fetch");
    if (isTransient) {
      console.error(`  RETRYING id=${row.id}: ${err.message}`);
      await sleep(2000);
      try {
        const { rate, observedAt } = await fetchEcbUsdEur(rateDate);
        const amountNative = Number(row.eur);
        const eur = Math.round(amountNative * rate * 100) / 100;
        if (!DRY_RUN) {
          await supabase
            .from("capital_calls")
            .update({ amount_native: amountNative, fx_rate: rate, eur, fx_source: `ecb:${observedAt}` })
            .eq("id", row.id);
        }
        successCount++;
        continue;
      } catch (retryErr) {
        console.error(`  FAILED (retry) id=${row.id}: ${retryErr.message}`);
      }
    } else {
      // No rate available for this date (pre-ECB series, holiday gap, etc.) — skip
      console.warn(`  SKIP id=${row.id} data=${row.data}: ${err.message}`);
    }
    errorCount++;
  }
  await sleep(60); // ~16 req/s — well under ECB soft limit
}

console.log(`\nDone. Success: ${successCount} / ${rows.length}. Errors: ${errorCount}.`);
if (errorCount > 0) process.exit(1);
```

- [ ] **Step 2: Run in dry-run mode first**

```bash
node scripts/backfill_usd_fx.mjs --dry-run
```

Expected output: a line per row showing `USD X → EUR Y (rate Z)`. Review each line. If any rate looks wrong (e.g. implausibly different from ~0.85–1.20), investigate before continuing.

- [ ] **Step 3: Run live (off-hours, when no one is editing)**

```bash
node scripts/backfill_usd_fx.mjs
```

Expected: `Done. Success: N / N. Errors: 0.` If any errors, check the logged messages.

- [ ] **Step 4: Verify in Supabase SQL editor**

```sql
-- Should return 0 rows after successful backfill
SELECT COUNT(*) FROM capital_calls
WHERE divisa = 'USD' AND amount_native IS NULL AND fx_rate IS NULL;

-- Spot-check: EUR should be ~8% less than the original USD amount
SELECT id, data, amount_native AS usd, eur, fx_rate, fx_source
FROM capital_calls
WHERE divisa = 'USD'
ORDER BY data;
```

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill_usd_fx.mjs
git commit -m "feat(scripts): backfill legacy USD capital_calls with real ECB T-1 rates"
```

---

## Task 4: Add `resolveEstimatedFxRates` to `useDashboardData.js`

**Files:**
- Modify: `src/components/hooks/useDashboardData.js`

This function runs after `loadAll()` resolves. It finds any capital calls where `fx_source` starts with `ecb:estimated:` and the transaction date has now passed, then re-fetches the real ECB rate and updates the row. Processes at most 10 rows per load (so large backlogs drain over multiple sessions without blocking UI).

- [ ] **Step 1: Add `resolveEstimatedFxRates` function**

Add this function in `useDashboardData.js`, after `syncSearchersFromCapitalCalls` (around line 86):

```js
async function resolveEstimatedFxRates(rows) {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const stale = rows.filter(
    (row) =>
      typeof row.fxSource === "string" &&
      row.fxSource.startsWith("ecb:estimated:") &&
      String(row.data ?? "").slice(0, 10) <= todayUtc,
  );
  if (!stale.length) return;

  // isLegacyUsdRow(null) returns false because the guard is `row?.divisa === 'USD' && ...`
  // — null short-circuits the chain. Verified: passing null as existingRow forces
  // fresh conversion in prepareCapitalCallPayload.
  const batch = stale.slice(0, 10);
  const results = await Promise.allSettled(
    batch.map(async (row) => {
      const payload = await prepareCapitalCallPayload(
        { ...row, eur: row.amountNative },
        null,
      );
      await updateCapitalCall(row.id, payload);
    }),
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`[resolveEstimatedFxRates] row ${batch[i].id} failed:`, r.reason);
    }
  });
}
```

- [ ] **Step 2: Call `resolveEstimatedFxRates` after `loadAll` resolves**

In the `useEffect` that calls `loadAll()` (around line 102), add the call after `setRawCC`:

```js
useEffect(() => {
  loadAll()
    .then(async (data) => {
      if (!data) return;
      const now = new Date().toLocaleDateString("ca-ES");
      if (Array.isArray(data.rawCC)) {
        setRawCC(data.rawCC);
        writeStoredJSON(LS_CC, data.rawCC);
        // Auto-resolve estimated FX rates whose transaction date has now passed.
        // Runs silently; errors are logged but do not block the rest of load.
        resolveEstimatedFxRates(data.rawCC).catch((err) =>
          console.warn("[resolveEstimatedFxRates] unexpected error:", err),
        );
      }
      // ... rest of the data.funds0, data.companies, etc. handling unchanged ...
```

Keep all existing lines from `data.funds0` onward unchanged. Only the `if (Array.isArray(data.rawCC))` block gains the `resolveEstimatedFxRates` call.

- [ ] **Step 3: Commit**

```bash
git add src/components/hooks/useDashboardData.js
git commit -m "feat(data): auto-resolve estimated FX rates after transaction date passes"
```

---

## Task 5: Show estimated label in `TxSection.jsx`

**Files:**
- Modify: `src/components/TxSection.jsx`

The EUR amount cell is rendered at line 299: `{fmtSignedM(row.eur)}`. Rows with `fxSource` starting with `ecb:estimated:` need a `~` prefix and a tooltip.

- [ ] **Step 1: Update the EUR amount cell**

Find this block in `TxSection.jsx` (around line 298–300):

```jsx
<td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isIn ? tc.navy : tc.green }}>
  {fmtSignedM(row.eur)}
</td>
```

Replace with:

```jsx
<td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isIn ? tc.navy : tc.green }}>
  {row.fxSource?.startsWith("ecb:estimated:") ? (
    <span
      title="Tipus de canvi estimat — s'actualitzarà quan arribi la data de la transacció"
      style={{ cursor: "help", borderBottom: "1px dashed currentColor" }}
    >
      ~{fmtSignedM(row.eur)}
    </span>
  ) : (
    fmtSignedM(row.eur)
  )}
</td>
```

- [ ] **Step 2: Verify `row.fxSource` is available in TxSection rows**

The rows passed to `TxSection` come from `useDashboardData`. Check that `fxSource` (camelCase) is present on each row by grepping how `rawCC` rows are mapped:

```bash
grep -n "fxSource\|fx_source" src/db.js | head -20
```

Expected: `db.js` maps `fx_source` → `fxSource` in the row objects returned by `loadCapitalCalls`. If the field is missing, add it to the mapping in `db.js` (look for where `amount_native` is mapped to `amountNative` — the `fxSource` mapping should be adjacent).

- [ ] **Step 3: Smoke-test in the browser**

Start the dev server:

```bash
npm run dev
```

1. Open the dashboard → navigate to a tab with capital calls.
2. Enter a new USD capital call with a future date (e.g. 3 months from today). Save.
3. Confirm: the new row shows `~€XXX` with a dashed underline and tooltip on hover.
4. Enter a USD capital call with a past date. Save.
5. Confirm: the past-date row shows `€XXX` with no `~`.

- [ ] **Step 4: Commit**

```bash
git add src/components/TxSection.jsx
git commit -m "feat(ui): show ~ prefix and tooltip for estimated EUR amounts on future-dated calls"
```

---

## Task 6: Remove `isLegacyUsdRow` guard

**Files:**
- Modify: `src/components/hooks/useDashboardData.js`

**Only do this AFTER Task 3 (backfill) has run successfully and Query 1 from Pre-flight returns 0 rows.**

The `isLegacyUsdRow` early-return in `prepareCapitalCallPayload` (lines 49–57) preserved the broken behavior for legacy rows. Now that all those rows have `amount_native` populated, the guard is dead code that would silently skip conversion on any row that happened to match its conditions.

- [ ] **Step 1: Verify backfill is complete**

```sql
SELECT COUNT(*) FROM capital_calls
WHERE divisa = 'USD' AND amount_native IS NULL AND fx_rate IS NULL;
```

Expected: 0. If not 0, do not continue — run Task 3 first.

- [ ] **Step 2: Remove the guard**

In `useDashboardData.js`, delete:

```js
function isLegacyUsdRow(row) {
  return row?.divisa === "USD" && row?.amountNative == null && row?.fxRate == null;
}
```

And delete the early-return block (lines 49–57):

```js
if (existingRow && isLegacyUsdRow(existingRow) && sameVisibleAmount && sameCurrency && sameDate) {
  return {
    ...sanitized,
    eur: rawAmount,
    amountNative: null,
    fxRate: null,
    fxSource: null,
  };
}
```

After deletion, `prepareCapitalCallPayload` should flow directly to the `convertAmountToEurOnDate` call for all rows.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass. (The `fx.test.js` from Task 1+2 covers the conversion logic.)

- [ ] **Step 4: Commit**

```bash
git add src/components/hooks/useDashboardData.js
git commit -m "chore(fx): remove isLegacyUsdRow guard — all USD rows now have amount_native"
```

---

## Self-Review

**Spec coverage:**
- ✅ Legacy USD rows backfilled with real ECB T-1 rates (Task 3)
- ✅ T-1 semantics for all USD conversions (Task 2, `subtractOneCalendarDay`)
- ✅ Future-dated calls get estimated EUR with `ecb:estimated:` tag (Task 2)
- ✅ Auto-resolve on app load when date passes (Task 4)
- ✅ UI label `~` with tooltip (Task 5)
- ✅ `isLegacyUsdRow` removed (Task 6)
- ✅ Backfill uses service-role key (not `/api/fx-rate`) — auth gap addressed
- ✅ ECB future-date verification step included (Task 2, Step 3)
- ✅ Suspect-row sanity check in backfill (Task 3, Step 1)
- ✅ Edit-during-migration lockout documented (pre-flight, off-hours)

**Type consistency:**
- `subtractOneCalendarDay` is exported from `src/fx.js` and used in both `fx.js` (production) and `scripts/backfill_usd_fx.mjs` (script has its own copy to avoid import path complexity)
- `getEcbRateWithObservedAt` is internal to `fx.js` — not exported
- `resolveEstimatedFxRates` calls `prepareCapitalCallPayload` with `row.amountNative` as `values.eur` — correct because `prepareCapitalCallPayload` calls `normalizeCapitalCallSignedAmount(tipus, parseFloat(values.eur))`, treating this as the native amount to re-convert
- `row.fxSource` in TxSection is camelCase from db.js mapping — verify mapping exists (Task 5, Step 2)
