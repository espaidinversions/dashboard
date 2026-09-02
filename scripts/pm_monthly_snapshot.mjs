#!/usr/bin/env node
/**
 * pm_monthly_snapshot.mjs
 *
 * Computes month-end portfolio values for the PM_MONTHLY static series.
 * Prices from price CSVs × unitats for CaixaBank / UBS / JPMorgan / Bankinter.
 * IB and WAM (Andbank) totals are provided as CLI arguments (manual).
 *
 * Usage:
 *   node scripts/pm_monthly_snapshot.mjs --date 2026-04-30 --ib 7100000 --wam 6000000
 *   node scripts/pm_monthly_snapshot.mjs --date 2026-06-30 --ib 7200000 --wam 5980000
 *
 * If --date is omitted, defaults to the last calendar day of the previous month.
 * If --ib or --wam are omitted, the script falls back to current valorMercat from the model.
 *
 * Output: a JS object literal ready to paste into src/data/publicMarkets.js PM_MONTHLY.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Load model ────────────────────────────────────────────────────────────────

const { PM_MODEL } = require("../src/data/publicMarketsModel.js");
const { WAM_POSITIONS } = require("../src/data/wamPositions.js");

const ACTIVE = PM_MODEL.holdings.active;

// ── Price directories ─────────────────────────────────────────────────────────

const PRICES_DIR      = join(ROOT, "Mercats Públics", "prices");
const FUND_PRICES_DIR = join(ROOT, "Mercats Públics", "fund_prices");

// ── Price cache: ISIN → sorted [{date, close}] ───────────────────────────────

const _priceCache = new Map();

function loadPriceFile(dir, isin) {
  const path = join(dir, `${isin}.csv`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map(line => {
      const cols  = line.split(",");
      const date  = cols[0]?.trim().slice(0, 10);
      // CSV columns: date, isin, name, close, source  (close is index 3)
      const close = parseFloat(cols[3]);
      return { date, close };
    })
    .filter(r => r.date && !isNaN(r.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getPriceOn(isin, dateStr) {
  if (!_priceCache.has(isin)) {
    const rows =
      loadPriceFile(PRICES_DIR, isin) ??
      loadPriceFile(FUND_PRICES_DIR, isin);
    _priceCache.set(isin, rows ?? []);
  }
  const rows = _priceCache.get(isin);
  // last row with date <= dateStr
  let best = null;
  for (const r of rows) {
    if (r.date <= dateStr) best = r;
    else break;
  }
  return best?.close ?? null;
}

// ── FX: convert non-EUR prices to EUR ─────────────────────────────────────────
//
// Price CSVs are in each instrument's listing currency, but every bucket total
// is in EUR. FX series live in Mercats Públics/fx/<PAIR>.csv (date,pair,close,
// source) where close = quote-currency units per 1 EUR (e.g. EURUSD = USD/EUR).
// Generate them with: python scripts/fetch_fx.py

const FX_DIR = join(ROOT, "Mercats Públics", "fx");
const _fxCache = new Map();
const _fxMissing = new Set();

function loadFxFile(pair) {
  const path = join(FX_DIR, `${pair}.csv`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map(line => {
      const cols = line.split(",");
      // CSV columns: date, pair, close, source  (close is index 2)
      return { date: cols[0]?.trim().slice(0, 10), close: parseFloat(cols[2]) };
    })
    .filter(r => r.date && !isNaN(r.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getFxOn(pair, dateStr) {
  if (!_fxCache.has(pair)) _fxCache.set(pair, loadFxFile(pair) ?? []);
  const rows = _fxCache.get(pair);
  let best = null;
  for (const r of rows) {
    if (r.date <= dateStr) best = r;
    else break;
  }
  return best?.close ?? null;
}

// Convert an amount in the instrument's native currency to EUR on dateStr.
// Returns { eur, ok } — ok=false means conversion was required but unavailable.
function toEur(amount, divisa, dateStr) {
  const cur = String(divisa ?? "EUR").trim().toUpperCase();
  if (!cur || cur === "EUR") return { eur: amount, ok: true };
  const rate = getFxOn(`EUR${cur}`, dateStr); // quote units per 1 EUR
  if (rate == null || !(rate > 0)) {
    _fxMissing.add(cur);
    return { eur: amount, ok: false };
  }
  return { eur: amount / rate, ok: true };
}

// ── ETF detection (mirrors PublicMarketsShared.jsx isEtfPosition) ─────────────

function isEtf(pos) {
  const nom = (pos?.nom ?? "").toUpperCase();
  return nom.includes("ETF") || nom.includes("ISHARES") || nom.includes("XETRA");
}

// ── Bucket mapping ────────────────────────────────────────────────────────────
//
//  caixaRV  = CaixaBank non-ETF managed funds, tipus RV
//  caixaRF  = CaixaBank non-ETF managed funds, tipus RF
//  ubsRV    = UBS + JPMorgan non-ETF managed funds, tipus RV
//  ubsRF    = UBS + JPMorgan non-ETF managed funds, tipus RF
//  abelBK   = CaixaBank ETFs + Bankinter (all) + IB (manual via --ib)
//  andbank  = WAM/Andbank total (manual via --wam)
//
//  ETFs at CaixaBank and UBS go into abelBK — consistent with the
//  hand-maintained historical series.

function bucketFor(pos) {
  const c = pos.custodian;
  const t = pos.tipus ?? "RV";
  if (c === "CaixaBank") {
    if (isEtf(pos)) return "abelBK";
    return t === "RF" ? "caixaRF" : "caixaRV";
  }
  if (c === "UBS" || c === "JPMorgan") return t === "RF" ? "ubsRF" : "ubsRV";
  if (c === "Bankinter") return "abelBK";
  return null; // IB and WAM handled separately
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

function lastDayOfPrevMonth() {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

const dateStr = getArg("--date") ?? lastDayOfPrevMonth();
const ibArg   = getArg("--ib");
const wamArg  = getArg("--wam");

// ── Compute bucket values ─────────────────────────────────────────────────────

const buckets = { caixaRV: 0, caixaRF: 0, ubsRV: 0, ubsRF: 0, abelBK: 0 };
const missing = [];

for (const pos of ACTIVE) {
  const bucket = bucketFor(pos);
  if (!bucket) continue;

  if (!pos.isin || !pos.unitats) {
    process.stderr.write(`WARN: no isin/unitats for "${pos.nom}" (${pos.custodian}) — using valorMercat\n`);
    buckets[bucket] += pos.valorMercat ?? 0;
    continue;
  }

  const price = getPriceOn(pos.isin, dateStr);

  if (price == null) {
    missing.push(pos);
    buckets[bucket] += pos.valorMercat ?? 0;
    continue;
  }

  const nativeValue = pos.unitats * price;
  const { eur, ok } = toEur(nativeValue, pos.divisa, dateStr);
  // If a non-EUR position has no FX rate, fall back to its EUR valorMercat
  // rather than adding a native-currency amount into the EUR bucket.
  buckets[bucket] += ok ? eur : (pos.valorMercat ?? 0);
}

if (_fxMissing.size) {
  process.stderr.write(`\nWARN: no FX series for ${[..._fxMissing].join(", ")} — used EUR valorMercat fallback for those positions. Run: python scripts/fetch_fx.py\n`);
}

if (missing.length) {
  process.stderr.write(`\nWARN: no price found on/before ${dateStr} for ${missing.length} position(s) — using current valorMercat:\n`);
  missing.forEach(p => process.stderr.write(`  ${p.isin}  ${p.nom}  (${p.custodian})\n`));
  process.stderr.write("\n");
}

// IB and WAM: use CLI args or fall back to model current values
const ibTotal = ibArg != null
  ? parseFloat(ibArg)
  : ACTIVE.filter(p => p.custodian === "Interactive Brokers").reduce((s, p) => s + (p.valorMercat ?? 0), 0);

const wamTotal = wamArg != null
  ? parseFloat(wamArg)
  : WAM_POSITIONS.reduce((s, p) => s + (p.valorMercat ?? 0), 0);

buckets.abelBK += ibTotal;
const andbank = Math.round(wamTotal);

// ── Month label ───────────────────────────────────────────────────────────────

const CA_MONTHS = ["Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];
const [yr, mo]  = dateStr.slice(0, 7).split("-");
const label     = `${CA_MONTHS[Number(mo) - 1]} '${yr.slice(2)}`;
const monthKey  = dateStr.slice(0, 7);

// ── Output ────────────────────────────────────────────────────────────────────

const r = Object.fromEntries(
  Object.entries(buckets).map(([k, v]) => [k, Math.round(v)])
);

const line = `  { date:"${monthKey}", label:"${label}", caixaRV:${r.caixaRV}, caixaRF:${r.caixaRF}, ubsRV:${r.ubsRV}, ubsRF:${r.ubsRF}, abelBK:${r.abelBK}, andbank:${andbank} },`;

process.stdout.write(line + "\n");

process.stderr.write(`\nMonth: ${label}  (date: ${dateStr})\n`);
process.stderr.write(`  caixaRV : ${r.caixaRV.toLocaleString("ca-ES")}\n`);
process.stderr.write(`  caixaRF : ${r.caixaRF.toLocaleString("ca-ES")}\n`);
process.stderr.write(`  ubsRV   : ${r.ubsRV.toLocaleString("ca-ES")}  (UBS + JPMorgan)\n`);
process.stderr.write(`  ubsRF   : ${r.ubsRF.toLocaleString("ca-ES")}\n`);
process.stderr.write(`  abelBK  : ${r.abelBK.toLocaleString("ca-ES")}  (Bankinter computed + IB ${ibArg ? "--ib arg" : "model fallback"})\n`);
process.stderr.write(`  andbank : ${andbank.toLocaleString("ca-ES")}  (${wamArg ? "--wam arg" : "model fallback"})\n`);
process.stderr.write(`  TOTAL   : ${(r.caixaRV + r.caixaRF + r.ubsRV + r.ubsRF + r.abelBK + andbank).toLocaleString("ca-ES")}\n`);
