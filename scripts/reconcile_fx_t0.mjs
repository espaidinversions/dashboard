/**
 * reconcile_fx_t0.mjs
 * ───────────────────
 * Retroactively re-computes stored capital-call FX conversions using T-0 semantics
 * (the ECB reference fixing observed ON the transaction date = close of day X),
 * correcting rows that were originally written with the old T-1 offset
 * (which used the close of day X-1 ≈ open of day X, one day stale).
 *
 * For each non-EUR row that has `amount_native` and `fx_rate`:
 *   newRate = ECB <DIVISA>/EUR fixing on the transaction date (T-0)
 *   newEur  = round(amount_native / newRate)
 *   updates fx_rate, eur, fx_source
 *
 * SAFETY:
 *   - Default is DRY RUN. Pass --apply to write.
 *   - Rows whose stored `eur` does NOT match round(amount_native / stored fx_rate)
 *     are treated as MANUAL OVERRIDES and skipped (reported for manual review),
 *     so we never clobber a hand-corrected amount.
 *   - Rows without `amount_native` cannot be reconciled and are reported/skipped.
 *
 * Usage:
 *   node scripts/reconcile_fx_t0.mjs            # dry run — shows the diff
 *   node scripts/reconcile_fx_t0.mjs --apply    # write the corrections
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        return [line.slice(0, index).trim(), value];
      }),
  );
}

const env = loadEnv(path.join(__dirname, "../.env.local"));
// Prefer a process env var (e.g. passed inline for a one-off run) over .env.local,
// so a fresh service-role key can be supplied without editing/committing any file.
// Sanitize: the Vercel-pulled .env.local carries a trailing literal "\n" on the URL.
const cleanUrl = (v) => String(v ?? "").replace(/\\[rn]/g, "").trim().replace(/\/+$/, "");
const SUPABASE_URL = cleanUrl(process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL);
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\[rn]/g, "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const round2 = (v) => Math.round(Number(v) * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ECB fetch (T-0): latest fixing on or before `dateStr` for <cur>/EUR ──────
const _rateCache = new Map(); // key: `${cur}:${dateStr}` → { rate, observedAt }

async function fetchEcbRate(cur, dateStr) {
  const key = `${cur}:${dateStr}`;
  if (_rateCache.has(key)) return _rateCache.get(key);
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${cur}.EUR.SP00.A?endPeriod=${encodeURIComponent(dateStr)}&lastNObservations=1&format=csvdata`;
  let retries = 0;
  while (true) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`ECB HTTP ${res.status} for ${cur} ${dateStr}`);
      const csv = await res.text();
      const lines = csv.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error(`ECB returned no data for ${cur} ${dateStr}`);
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const values = lines[lines.length - 1].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
      const rate = Number(row.OBS_VALUE);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
        throw new Error(`Implausible ECB rate ${rate} for ${cur} ${dateStr}`);
      }
      const result = { rate, observedAt: String(row.TIME_PERIOD ?? dateStr).slice(0, 10) };
      _rateCache.set(key, result);
      return result;
    } catch (err) {
      const transient = /HTTP 5|fetch/.test(err.message);
      if (transient && retries++ < 2) {
        console.warn(`  transient ECB error (${cur} ${dateStr}), retry in 2s...`);
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  console.log(APPLY ? "═══ APPLY MODE (writes to DB) ═══" : "═══ DRY RUN (no writes — pass --apply to commit) ═══");

  // SCOPE: only rows the T-1 bug actually produced — converted via the ECB path,
  // which stamps a non-null fx_rate AND fx_source='ecb:...'. Legacy/manual rows
  // (null fx_rate) were never touched by convertAmountToEurOnDate and must be left
  // alone (some have inconsistent amount_native and would be corrupted by a rewrite).
  const { data: rows, error } = await supabase
    .from("capital_calls")
    .select("id, data, eur, divisa, amount_native, fx_rate, fx_source")
    .not("divisa", "is", null)
    .neq("divisa", "EUR")
    .not("fx_rate", "is", null)
    .like("fx_source", "ecb:%")
    .order("data", { ascending: true });

  if (error) {
    console.error("Failed to fetch capital_calls:", error.message);
    process.exit(1);
  }

  const all = rows ?? [];
  console.log(`Fetched ${all.length} non-EUR capital-call rows.\n`);

  const updates = [];
  const skippedNoNative = [];
  const skippedManual = [];
  const suspicious = [];
  const unchanged = [];
  const failed = [];

  for (const row of all) {
    const dateStr = String(row.data).slice(0, 10);
    const cur = String(row.divisa).trim().toUpperCase();
    const amountNative = row.amount_native == null ? null : Number(row.amount_native);
    const oldRate = row.fx_rate == null ? null : Number(row.fx_rate);
    const oldEur = Number(row.eur);

    if (amountNative == null || !Number.isFinite(amountNative)) {
      skippedNoNative.push(row);
      continue;
    }
    // Manual-override guard: if stored eur doesn't match native/oldRate, don't touch eur.
    if (oldRate != null && Number.isFinite(oldRate) && oldRate > 0) {
      const derived = round2(amountNative / oldRate);
      if (Math.abs(derived - oldEur) > 0.02) {
        skippedManual.push({ ...row, derived });
        continue;
      }
    }

    let newRate, observedAt;
    try {
      ({ rate: newRate, observedAt } = await fetchEcbRate(cur, dateStr));
    } catch (err) {
      failed.push({ id: row.id, dateStr, cur, msg: err.message });
      continue;
    }

    const newEur = round2(amountNative / newRate);
    const rateChanged = oldRate == null || Math.abs(newRate - oldRate) > 1e-9;
    const eurChanged = Math.abs(newEur - oldEur) > 0.005;

    if (!rateChanged && !eurChanged) {
      unchanged.push(row);
      continue;
    }
    // Sanity guard: a T-0 vs T-1 shift is one day of FX drift (~<2%). A larger swing
    // means the row's amount_native/eur are inconsistent, not an FX-date error — skip.
    const relSwing = Math.abs(oldEur) > 1e-9 ? Math.abs(newEur - oldEur) / Math.abs(oldEur) : 0;
    if (relSwing > 0.05) {
      suspicious.push({ id: row.id, dateStr, cur, amountNative, oldRate, newRate, oldEur, newEur, relSwing });
      continue;
    }
    updates.push({
      id: row.id, dateStr, cur, amountNative,
      oldRate, newRate, oldEur, newEur,
      fxSource: `ecb:${observedAt}`,
    });
  }

  // ── Diff report ────────────────────────────────────────────────────────────
  if (updates.length) {
    console.log("CHANGES:");
    console.log("  id        date        cur   amtNative      oldRate → newRate      oldEur → newEur       Δeur");
    for (const u of updates) {
      const dEur = round2(u.newEur - u.oldEur);
      console.log(
        `  ${String(u.id).slice(0, 8).padEnd(8)}  ${u.dateStr}  ${u.cur.padEnd(3)}  ` +
        `${String(u.amountNative).padStart(12)}   ${String(u.oldRate ?? "—").padStart(8)} → ${String(round2(u.newRate)).padStart(8)}   ` +
        `${String(u.oldEur).padStart(11)} → ${String(u.newEur).padStart(11)}  ${String(dEur).padStart(9)}`,
      );
    }
  }
  const totalOld = updates.reduce((s, u) => s + u.oldEur, 0);
  const totalNew = updates.reduce((s, u) => s + u.newEur, 0);

  console.log("\n─────────────────────────────────────────────");
  console.log(`To update:            ${updates.length}`);
  console.log(`  net EUR delta:      ${round2(totalNew - totalOld)}  (old ${round2(totalOld)} → new ${round2(totalNew)})`);
  console.log(`Unchanged:            ${unchanged.length}`);
  console.log(`Skipped (no native):  ${skippedNoNative.length}${skippedNoNative.length ? "  ids: " + skippedNoNative.map((r) => String(r.id).slice(0, 8)).join(", ") : ""}`);
  console.log(`Skipped (manual eur): ${skippedManual.length}${skippedManual.length ? "  ids: " + skippedManual.map((r) => `${String(r.id).slice(0, 8)}(stored ${r.eur} vs derived ${r.derived})`).join(", ") : ""}`);
  console.log(`Skipped (>5% swing):  ${suspicious.length}${suspicious.length ? "  " + suspicious.map((r) => `${String(r.id).slice(0, 8)}(${r.dateStr} native=${r.amountNative} eur ${r.oldEur}→${r.newEur} ${(r.relSwing * 100).toFixed(0)}%)`).join(", ") : ""}`);
  if (failed.length) console.log(`ECB fetch failed:     ${failed.length}  ${failed.map((f) => `${f.cur} ${f.dateStr}`).join(", ")}`);

  if (!APPLY) {
    console.log("\nDRY RUN complete. Re-run with --apply to write these corrections.");
    return;
  }

  if (!updates.length) {
    console.log("\nNothing to apply.");
    return;
  }

  console.log(`\nApplying ${updates.length} updates...`);
  let ok = 0, err = 0;
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("capital_calls")
      .update({ fx_rate: u.newRate, eur: u.newEur, fx_source: u.fxSource })
      .eq("id", u.id);
    if (upErr) { err++; console.error(`  FAIL id=${u.id}: ${upErr.message}`); }
    else ok++;
  }
  console.log(`\nDone. Updated ${ok}, failed ${err}.`);
  if (err) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
