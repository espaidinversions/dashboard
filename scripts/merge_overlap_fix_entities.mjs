/**
 * Merge private_entities rows with match_type="overlap_fix" into their best counterpart.
 *
 * Intended use: after running the overlap separation script, later entity catalog improvements
 * may create a better canonical entity (manual/workbook/normalized). This script merges the
 * overlap_fix placeholder into that canonical counterpart so IDs stay clean.
 *
 * Safety:
 * - Dry run by default.
 * - Only merges within the same `kind` ("company" or "vehicle") and same dedupeKey(name).
 *
 * Usage:
 *   node scripts/merge_overlap_fix_entities.mjs --dry-run
 *   node scripts/merge_overlap_fix_entities.mjs --apply
 *   node scripts/merge_overlap_fix_entities.mjs --apply --limit 50
 *   node scripts/merge_overlap_fix_entities.mjs --dry-run --suggest
 *   node scripts/merge_overlap_fix_entities.mjs --apply --apply-suggested --threshold=0.92 --margin=0.05
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function stripDiacritics(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const DEDUPE_STOPWORDS = new Set([
  "a", "an", "and", "capital", "partner", "partners", "fund", "funds", "invest", "investment", "investments",
  "holding", "holdings", "group", "global", "private", "equity", "program", "class", "corporation", "corp",
  "company", "companies", "limited", "ltd", "llp", "llc", "lp", "sl", "slp", "srl", "sa", "spa", "scra", "scr",
  "scsp", "sicav", "raif", "fcr", "fcre", "ficc", "u", "ua",
]);

function dedupeKey(name) {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/co[\s-]?inv(?:est(?:ment)?)?/g, "coinvest")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t && !DEDUPE_STOPWORDS.has(t))
    .sort()
    .join(" ");
}

function matchWeight(matchType) {
  const m = String(matchType ?? "").trim();
  switch (m) {
    case "manual": return 0;
    case "workbook_id": return 1;
    case "normalized": return 2;
    case "local": return 3;
    case "fallback": return 6;
    case "overlap_fix": return 9;
    default: return 4;
  }
}

function idPenalty(id) {
  const s = String(id ?? "");
  if (s.startsWith("MOCKNIF:")) return 3;
  if (s.startsWith("VEHICLE:") || s.startsWith("COMPANY:")) return 2;
  return 0;
}

function pickKeeper(candidates) {
  return [...candidates].sort((a, b) => {
    const aw = matchWeight(a.match_type) + idPenalty(a.id);
    const bw = matchWeight(b.match_type) + idPenalty(b.id);
    if (aw !== bw) return aw - bw;
    return String(a.canonical_name ?? "").localeCompare(String(b.canonical_name ?? ""), "ca", { sensitivity: "base" });
  })[0] ?? null;
}

function normalizeForCompare(s) {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const COMPARE_STOPWORDS = new Set([
  "a", "an", "and", "of", "the",
  "capital", "partner", "partners", "fund", "funds",
  "invest", "investment", "investments",
  "holding", "holdings", "group", "global",
  "private", "equity",
  "corporation", "corp", "company", "companies",
  "limited", "ltd", "llp", "llc", "lp",
  "sl", "slp", "srl", "sa", "spa", "scra", "scr", "scsp", "sicav", "raif",
  "fcr", "fcre", "ficc", "u", "ua",
]);

function tokenizeForCompare(name) {
  const n = normalizeForCompare(name);
  if (!n) return [];
  return n.split(" ").filter((t) => t && !COMPARE_STOPWORDS.has(t));
}

function jaccard(aTokens, bTokens) {
  if (!aTokens.length && !bTokens.length) return 1;
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function containment(aTokens, bTokens) {
  if (!aTokens.length && !bTokens.length) return 1;
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return Math.min(inter / a.size, inter / b.size);
}

function bigrams(s) {
  const n = normalizeForCompare(s).replace(/\s+/g, "");
  if (n.length <= 1) return [];
  const out = [];
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
  return out;
}

function diceCoefficient(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length && !B.length) return 1;
  if (!A.length || !B.length) return 0;
  const counts = new Map();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);
  let matches = 0;
  for (const g of B) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      matches += 1;
      counts.set(g, c - 1);
    }
  }
  return (2 * matches) / (A.length + B.length);
}

function nameSimilarity(aName, bName) {
  const aT = tokenizeForCompare(aName);
  const bT = tokenizeForCompare(bName);
  const j = jaccard(aT, bT);
  const c = containment(aT, bT);
  const d = diceCoefficient(aName, bName);
  return (0.55 * d) + (0.35 * j) + (0.10 * c);
}

async function fetchAll(sb, table, select, orderCol = "id") {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order(orderCol)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function resolveSupabaseUrl() {
  const env = loadEnv(envPath);
  const direct = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (direct) return String(direct).trim();

  // Fallback: fetch production bundle and extract the Supabase project URL.
  const indexRes = await fetch("https://turtle-capital-dashboard.vercel.app");
  if (!indexRes.ok) throw new Error(`Failed to fetch production index.html (${indexRes.status})`);
  const html = await indexRes.text();
  const supabaseAsset = html.match(/\/assets\/supabase-[^"']+\.js/iu)?.[0] ?? null;
  if (!supabaseAsset) throw new Error("Could not find supabase-*.js asset in production index.html");

  const assetRes = await fetch(`https://turtle-capital-dashboard.vercel.app${supabaseAsset}`);
  if (!assetRes.ok) throw new Error(`Failed to fetch ${supabaseAsset} (${assetRes.status})`);
  const js = await assetRes.text();
  const url = js.match(/https:\/\/[a-z0-9-]+\.supabase\.co/iu)?.[0] ?? null;
  if (!url) throw new Error("Could not extract Supabase URL from production bundle");
  return url;
}

async function mergeEntities(sb, fromId, toId) {
  // Fetch keeper entity to get canonical name for denormalized fons column
  const { data: toEntity, error: toErr } = await sb
    .from("private_entities")
    .select("canonical_name, vehicle_est")
    .eq("id", toId)
    .maybeSingle();
  if (toErr) throw toErr;
  if (!toEntity) throw new Error(`Target entity not found: ${toId}`);

  const { data: fromEntity, error: fromErr } = await sb
    .from("private_entities")
    .select("vehicle_est")
    .eq("id", fromId)
    .maybeSingle();
  if (fromErr) throw fromErr;

  const toName = toEntity.canonical_name;

  // 1. Reassign capital_calls
  {
    const { error } = await sb
      .from("capital_calls")
      .update({ vehicle_id: toId, fons: toName })
      .eq("vehicle_id", fromId);
    if (error) throw error;
  }

  // 2. Reassign portfolio_companies
  {
    const { error } = await sb
      .from("portfolio_companies")
      .update({ entity_id: toId })
      .eq("entity_id", fromId);
    if (error) throw error;
  }

  // 3. Merge fund_meta: patch keeper's nulls with source values, then delete source row
  {
    const [{ data: fromMeta, error: fm1Err }, { data: toMeta, error: fm2Err }] = await Promise.all([
      sb.from("fund_meta").select("*").eq("vehicle_id", fromId).maybeSingle(),
      sb.from("fund_meta").select("*").eq("vehicle_id", toId).maybeSingle(),
    ]);
    if (fm1Err) throw fm1Err;
    if (fm2Err) throw fm2Err;
    if (fromMeta) {
      if (!toMeta) {
        const { error } = await sb.from("fund_meta")
          .update({ vehicle_id: toId, fons: toName })
          .eq("vehicle_id", fromId);
        if (error) throw error;
      } else {
        const patch = {};
        for (const key of ["tvpi", "irr", "fi_end", "committed_override"]) {
          if (toMeta[key] == null && fromMeta[key] != null) patch[key] = fromMeta[key];
        }
        if (Object.keys(patch).length > 0) {
          const { error } = await sb.from("fund_meta").update(patch).eq("vehicle_id", toId);
          if (error) throw error;
        }
        const { error } = await sb.from("fund_meta").delete().eq("vehicle_id", fromId);
        if (error) throw error;
      }
    }
  }

  // 3.5 Merge private_entities vehicle_est if keeper is null.
  if ((toEntity.vehicle_est == null || toEntity.vehicle_est === "") && fromEntity?.vehicle_est) {
    const { error } = await sb
      .from("private_entities")
      .update({ vehicle_est: fromEntity.vehicle_est })
      .eq("id", toId);
    if (error) throw error;
  }

  // 4. Delete the source entity
  {
    const { error } = await sb
      .from("private_entities")
      .delete()
      .eq("id", fromId);
    if (error) throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const applySuggested = args.includes("--apply-suggested");
  const suggest = args.includes("--suggest") || applySuggested;
  const dryRun = !apply || args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit"));
  const limit = limitArg ? Number(limitArg.split("=")[1] ?? "") : null;
  const thresholdArg = args.find((a) => a.startsWith("--threshold"));
  const threshold = thresholdArg ? Number(thresholdArg.split("=")[1] ?? "") : 0.92;
  const marginArg = args.find((a) => a.startsWith("--margin"));
  const margin = marginArg ? Number(marginArg.split("=")[1] ?? "") : 0.05;

  const env = loadEnv(envPath);
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const url = await resolveSupabaseUrl();
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const entities = await fetchAll(
    sb,
    "private_entities",
    "id, kind, canonical_name, match_type",
    "id",
  );

  const groups = new Map(); // `${kind}::${key}` -> entities[]
  for (const e of entities) {
    const kind = String(e.kind ?? "").trim();
    const key = dedupeKey(e.canonical_name);
    if (!kind || !key) continue;
    const gk = `${kind}::${key}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(e);
  }

  const planned = [];
  for (const group of groups.values()) {
    const overlap = group.filter((e) => String(e.match_type ?? "") === "overlap_fix");
    if (overlap.length === 0) continue;
    const keepers = group.filter((e) => String(e.match_type ?? "") !== "overlap_fix");
    if (keepers.length === 0) continue;
    const keeper = pickKeeper(keepers);
    if (!keeper) continue;

    for (const from of overlap) {
      if (from.id === keeper.id) continue;
      planned.push({
        fromId: String(from.id),
        toId: String(keeper.id),
        kind: String(from.kind),
        fromName: from.canonical_name,
        toName: keeper.canonical_name,
        fromMatch: from.match_type ?? "",
        toMatch: keeper.match_type ?? "",
      });
    }
  }

  const overlapAll = entities.filter((e) => e.match_type === "overlap_fix");
  const uniqueFrom = new Set(planned.map((p) => p.fromId));
  const uniqueTo = new Set(planned.map((p) => p.toId));
  console.log(`Found overlap_fix entities: ${overlapAll.length}`);
  console.log(`Planned merges: ${planned.length} (from=${uniqueFrom.size} into=${uniqueTo.size})${limit ? ` limit=${limit}` : ""}`);

  const limited = limit ? planned.slice(0, limit) : planned;
  limited.slice(0, 25).forEach((p) => {
    console.log(`- [${p.kind}] ${p.fromId} (${p.fromMatch}) -> ${p.toId} (${p.toMatch}) :: "${p.fromName}" -> "${p.toName}"`);
  });
  if (limited.length > 25) console.log(`… +${limited.length - 25} more`);

  if (suggest) {
    const remaining = overlapAll
      .filter((e) => !uniqueFrom.has(String(e.id)))
      .map((e) => ({ ...e, id: String(e.id) }));

    const byKindCandidates = new Map();
    for (const e of entities) {
      if (String(e.match_type ?? "") === "overlap_fix") continue;
      const k = String(e.kind ?? "");
      if (!byKindCandidates.has(k)) byKindCandidates.set(k, []);
      byKindCandidates.get(k).push(e);
    }

    const suggestions = [];
    for (const from of remaining) {
      const candidates = byKindCandidates.get(String(from.kind ?? "")) ?? [];
      const scored = candidates
        .map((c) => ({
          toId: String(c.id),
          toName: c.canonical_name,
          toMatch: c.match_type ?? "",
          score: nameSimilarity(from.canonical_name, c.canonical_name),
        }))
        .sort((a, b) => b.score - a.score);

      const top = scored.slice(0, 3);
      if (top.length) {
        console.log(`\nSuggestions for [${from.kind}] ${from.id} ("${from.canonical_name}"):`);
        top.forEach((t) => {
          console.log(`- score=${t.score.toFixed(3)} -> ${t.toId} (${t.toMatch}) :: "${t.toName}"`);
        });
      }

      const best = top[0];
      const second = top[1];
      if (!best) continue;
      if (best.score < threshold) continue;
      if (second && (best.score - second.score) < margin) continue;
      suggestions.push({
        fromId: from.id,
        toId: best.toId,
        kind: String(from.kind ?? ""),
        fromName: from.canonical_name,
        toName: best.toName,
        fromMatch: from.match_type ?? "",
        toMatch: best.toMatch ?? "",
        score: best.score,
      });
    }

    console.log(`\nAuto-suggested merges: ${suggestions.length} (threshold=${threshold} margin=${margin})`);
    suggestions.slice(0, 25).forEach((s) => {
      console.log(`- score=${s.score.toFixed(3)} [${s.kind}] ${s.fromId} -> ${s.toId} :: "${s.fromName}" -> "${s.toName}"`);
    });
    if (suggestions.length > 25) console.log(`… +${suggestions.length - 25} more`);

    if (dryRun) {
      console.log("\nDRY RUN: no changes applied. Add --apply to execute.");
      return;
    }
    if (!applySuggested) {
      console.log("\nRefusing to apply suggestions without --apply-suggested (safety).");
      return;
    }

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      await mergeEntities(sb, s.fromId, s.toId);
      if ((i + 1) % 20 === 0) process.stdout.write(`\rMerged ${i + 1}/${suggestions.length}...`);
    }
    if (suggestions.length) process.stdout.write(`\rMerged ${suggestions.length}/${suggestions.length}...\n`);
    console.log("Done.");
    return;
  }

  if (dryRun) {
    console.log("\nDRY RUN: no changes applied. Re-run with --apply to execute.");
    return;
  }

  for (let i = 0; i < limited.length; i++) {
    const p = limited[i];
    await mergeEntities(sb, p.fromId, p.toId);
    if ((i + 1) % 20 === 0) process.stdout.write(`\rMerged ${i + 1}/${limited.length}...`);
  }
  if (limited.length) process.stdout.write(`\rMerged ${limited.length}/${limited.length}...\n`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("merge_overlap_fix_entities failed:", err?.message || String(err));
  process.exit(1);
});
