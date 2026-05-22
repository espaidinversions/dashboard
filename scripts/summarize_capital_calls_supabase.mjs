/**
 * Summarize current Supabase capital_calls into Compromis / Called (Aportacio) / Other outflows
 * using the same concept filters as TxSection / cash model.
 *
 * Usage:
 *   node scripts/summarize_capital_calls_supabase.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeCapitalCallTipus } from "../src/data/capitalCallTipusModel.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dir, "../.env.local");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        const key = l.slice(0, i).trim();
        const val = l.slice(i + 1).trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
        return [key, val];
      }),
  );
}

function fmtM(n) {
  const v = Number(n) || 0;
  return `${(v / 1e6).toFixed(2)}M€`;
}

const EXCLUDED_KPI_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);

function isExcluded(row) {
  return EXCLUDED_KPI_TIPUS.has(normalizeCapitalCallTipus(row?.tipus));
}

function isAportacio(row) {
  return normalizeCapitalCallTipus(row?.tipus) === "Aportació";
}

function scopeOf(vcpe) {
  const v = String(vcpe ?? "").trim();
  if (v === "RE") return "real-estate";
  if (v === "PC" || v === "SF") return "companies";
  return "funds";
}

function agg(rows) {
  let committed = 0;
  let called = 0;
  let otherOutflows = 0;
  for (const r of rows) {
    if (isExcluded(r)) continue;
    const eur = Math.abs(Number(r?.eur) || 0);
    if (!eur) continue;
    if (r.cat === "Compromís") committed += eur;
    else if (r.cat === "Capital Call") {
      if (isAportacio(r)) called += eur;
      else otherOutflows += eur;
    }
  }
  const calledAll = called + otherOutflows;
  return { committed, called, otherOutflows, calledAll };
}

async function fetchAllCapitalCalls(sb) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("capital_calls")
      .select("vehicle_id, fons, tipus, cat, vcpe, eur, data")
      .order("data")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function main() {
  const env = loadEnv(envPath);
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAllCapitalCalls(sb);

  const funds = rows.filter((r) => scopeOf(r.vcpe) === "funds");
  const re = rows.filter((r) => scopeOf(r.vcpe) === "real-estate");
  const companies = rows.filter((r) => scopeOf(r.vcpe) === "companies");

  const a = agg(funds);
  const b = agg(re);
  const c = agg(companies);
  const all = agg(rows);

  console.log(`rows total: ${rows.length}`);
  console.log(`Funds:     committed=${fmtM(a.committed)} called(aport)=${fmtM(a.called)} called(all)=${fmtM(a.calledAll)} other=${fmtM(a.otherOutflows)} gap(aport)=${fmtM(a.committed - a.called)}`);
  console.log(`RE:        committed=${fmtM(b.committed)} called(aport)=${fmtM(b.called)} called(all)=${fmtM(b.calledAll)} other=${fmtM(b.otherOutflows)} gap(aport)=${fmtM(b.committed - b.called)}`);
  console.log(`Companies: committed=${fmtM(c.committed)} called(aport)=${fmtM(c.called)} called(all)=${fmtM(c.calledAll)} other=${fmtM(c.otherOutflows)} gap(aport)=${fmtM(c.committed - c.called)}`);
  console.log(`ALL:       committed=${fmtM(all.committed)} called(aport)=${fmtM(all.called)} called(all)=${fmtM(all.calledAll)} other=${fmtM(all.otherOutflows)} gap(aport)=${fmtM(all.committed - all.called)}`);
}

main().catch((err) => {
  console.error("summarize_capital_calls_supabase failed:", err?.message || String(err));
  process.exit(1);
});
