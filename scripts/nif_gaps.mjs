/**
 * NIF gaps tool — export and import mock NIFs for searchers, vehicles, and companies.
 *
 * Usage:
 *   node scripts/nif_gaps.mjs export          → writes nif_gaps_YYYY-MM-DD.xlsx
 *   node scripts/nif_gaps.mjs import <file>   → reads filled Excel and updates DB
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (service role bypasses RLS).
 */

import { createClient }  from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path              from "path";
import fs                from "fs";

import XLSX from "./lib/xlsx_compat.mjs";

// ── Config ─────────────────────────────────────────────────────────────────
const __dir  = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dir, "../.env.local");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const env = loadEnv(envPath);
const SUPABASE_URL     = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("Add:  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isMock = id => !id || String(id).startsWith("MOCKNIF:");

// ── EXPORT ─────────────────────────────────────────────────────────────────
async function exportGaps() {
  // 1. Invested searchers with null or mock NIF
  const INVESTED_STATUSES = [
    "Invertit en fase de cerca",
    "Invertit en fase d'adquisició",
  ];
  const { data: searchers, error: se } = await sb
    .from("searchers")
    .select("id, nom, nif, status_screening, form_entrada, geo, ticket")
    .in("status_screening", INVESTED_STATUSES)
    .order("nom");
  if (se) { console.error("Error loading searchers:", se.message); process.exit(1); }
  const searcherRows = searchers
    .filter(r => isMock(r.nif))
    .map(r => ({
      id:          r.id,
      nom:         r.nom ?? "",
      nif_actual:  r.nif ?? "",
      nif_nou:     "",
      status:      r.status_screening ?? "",
      entrada:     r.form_entrada ?? "",
      geo:         r.geo ?? "",
      ticket:      r.ticket ?? "",
    }));

  // 2. All entities — mock ones to fill + real vehicles to cross-reference
  const { data: allEntities, error: ee } = await sb
    .from("private_entities")
    .select("id, kind, canonical_name, match_type, country")
    .order("canonical_name");
  if (ee) { console.error("Error loading private_entities:", ee.message); process.exit(1); }

  // Build lookup: for each company name, find a real vehicle whose canonical_name
  // starts with that company name (handles "Company (Search Fund)" vehicle names)
  const realVehicles = allEntities.filter(e => e.kind === "vehicle" && !e.id.startsWith("MOCKNIF:"));

  function findVehicleNifForCompany(companyName) {
    const needle = companyName.trim().toLowerCase();
    // 1. Exact match
    const exact = realVehicles.find(v => v.canonical_name.toLowerCase() === needle);
    if (exact) return exact.id;
    // 2. Vehicle name starts with company name (e.g. "Adinor (Aeqor Partners)" → "Adinor")
    const prefix = realVehicles.find(v => v.canonical_name.toLowerCase().startsWith(needle + " (") || v.canonical_name.toLowerCase().startsWith(needle + "("));
    if (prefix) return prefix.id;
    return null;
  }

  const entities = allEntities.filter(e => e.id.startsWith("MOCKNIF:"));

  const vehicleRows = entities
    .filter(e => e.kind === "vehicle")
    .map(e => ({
      id_actual:      e.id,
      canonical_name: e.canonical_name ?? "",
      nif_nou:        "",
      country:        e.country ?? "",
    }));

  const companyRows = entities
    .filter(e => e.kind === "company")
    .map(e => ({
      id_actual:          e.id,
      canonical_name:     e.canonical_name ?? "",
      canonical_name_nou: "",   // e.g. "Adinor (Aeqor Partners)"
      nif_nou:            findVehicleNifForCompany(e.canonical_name ?? "") ?? "",
      country:            e.country ?? "",
    }));

  // 3. Build workbook
  const wb = XLSX.utils.book_new();

  const wsSearchers = XLSX.utils.json_to_sheet(searcherRows.length ? searcherRows : [{ id:"", nom:"(cap)", nif_actual:"", nif_nou:"", status:"", entrada:"", geo:"", ticket:"" }]);
  wsSearchers["!cols"] = [{ wch:6 },{ wch:40 },{ wch:30 },{ wch:20 },{ wch:30 },{ wch:16 },{ wch:6 },{ wch:10 }];
  XLSX.utils.book_append_sheet(wb, wsSearchers, "Searchers");

  const wsVehicles = XLSX.utils.json_to_sheet(vehicleRows.length ? vehicleRows : [{ id_actual:"(cap)", canonical_name:"", nif_nou:"", country:"" }]);
  wsVehicles["!cols"] = [{ wch:40 },{ wch:40 },{ wch:20 },{ wch:8 }];
  XLSX.utils.book_append_sheet(wb, wsVehicles, "Vehicles (Fons)");

  const wsCompanies = XLSX.utils.json_to_sheet(companyRows.length ? companyRows : [{ id_actual:"(cap)", canonical_name:"", canonical_name_nou:"", nif_nou:"", country:"" }]);
  wsCompanies["!cols"] = [{ wch:40 },{ wch:40 },{ wch:40 },{ wch:20 },{ wch:8 }];
  XLSX.utils.book_append_sheet(wb, wsCompanies, "Companies");

  const outFile = path.join(__dir, `../nif_gaps_${new Date().toISOString().slice(0,10)}.xlsx`);
  await XLSX.writeFile(wb, outFile);

  console.log(`✓ Exportat: ${outFile}`);
  console.log(`  Searchers sense NIF: ${searcherRows.length}`);
  console.log(`  Vehicles mock:       ${vehicleRows.length}`);
  console.log(`  Companies mock:      ${companyRows.length}`);
  console.log();
  console.log("Omple la columna nif_nou i executa:");
  console.log(`  node scripts/nif_gaps.mjs import ${path.basename(outFile)}`);
}

// ── IMPORT ─────────────────────────────────────────────────────────────────
async function importGaps(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) { console.error("Fitxer no trobat:", absPath); process.exit(1); }

  const wb = await XLSX.read(fs.readFileSync(absPath), { type: "buffer" });

  let okS = 0, failS = 0, okE = 0, failE = 0;

  // Build vehicle name → nif_nou map from the Vehicles sheet (for company cross-fetch)
  const vehicleNifByName = new Map();
  const wsVehiclesImport = wb.Sheets["Vehicles (Fons)"];
  if (wsVehiclesImport) {
    XLSX.utils.sheet_to_json(wsVehiclesImport, { defval: "" }).forEach(r => {
      const nif = String(r.nif_nou ?? "").trim();
      const name = String(r.canonical_name ?? "").trim().toLowerCase();
      if (nif && name) vehicleNifByName.set(name, nif);
    });
  }

  function resolveCompanyNif(companyName, explicitNif) {
    if (explicitNif) return explicitNif;
    const needle = companyName.trim().toLowerCase();
    // Exact match
    if (vehicleNifByName.has(needle)) return vehicleNifByName.get(needle);
    // Vehicle name starts with company name: "Adinor (SF)" → "adinor"
    for (const [vName, vNif] of vehicleNifByName) {
      if (vName.startsWith(needle + " (") || vName.startsWith(needle + "(")) return vNif;
    }
    return null;
  }

  // ── Searchers ──────────────────────────────────────────────────────────
  const wsS = wb.Sheets["Searchers"];
  if (wsS) {
    const rows = XLSX.utils.sheet_to_json(wsS, { defval: "" });
    for (const row of rows) {
      const nif = String(row.nif_nou ?? "").trim();
      if (!nif) continue;
      const id = Number(row.id);
      if (!id) { failS++; continue; }
      const { error } = await sb.from("searchers").update({ nif }).eq("id", id);
      if (error) { console.error(`  Searcher id=${id}: ${error.message}`); failS++; }
      else okS++;
    }
  }

  // ── Vehicles & Companies (private_entities) ────────────────────────────
  // Updating a PK with FK references requires: update capital_calls + portfolio_companies + fund_meta, then update private_entities.
  for (const sheetName of ["Vehicles (Fons)", "Companies"]) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    for (const row of rows) {
      let oldId = String(row.id_actual ?? "").trim();
      const explicitNif = String(row.nif_nou ?? "").trim();
      const companyName = String(row.canonical_name ?? "").trim();
      const newId = sheetName === "Companies"
        ? (resolveCompanyNif(companyName, explicitNif) ?? "")
        : explicitNif;
      if (!newId) continue;

      // Fallback: resolve id_actual from canonical_name if missing
      if (!oldId) {
        const name = String(row.canonical_name ?? "").trim();
        if (!name) continue;
        const { data: found } = await sb
          .from("private_entities")
          .select("id")
          .eq("canonical_name", name)
          .like("id", "MOCKNIF:%")
          .maybeSingle();
        if (!found) { console.warn(`  Skipped (no match): "${name}"`); continue; }
        oldId = found.id;
      }

      const newCanonicalCheck = String(row.canonical_name_nou ?? "").trim();
      if (oldId === newId) {
        // NIF unchanged but canonical_name might need updating
        if (newCanonicalCheck) {
          await sb.from("private_entities").update({ canonical_name: newCanonicalCheck }).eq("id", oldId);
          okE++;
        }
        continue;
      }

      // Strategy: insert new entity row → update FK refs → delete old row.
      // This avoids FK violations that occur when updating the PK directly.

      // 1. Fetch old entity data
      const { data: oldEntity, error: fetchErr } = await sb
        .from("private_entities")
        .select("*")
        .eq("id", oldId)
        .maybeSingle();
      if (fetchErr || !oldEntity) {
        // Already updated in a previous run — skip silently
        if (!oldEntity && !fetchErr) continue;
        console.error(`  Entity ${oldId} → fetch failed: ${fetchErr?.message}`);
        failE++; continue;
      }

      // Apply canonical_name_nou if provided (e.g. "Adinor (Aeqor Partners)")
      const newCanonical = String(row.canonical_name_nou ?? "").trim();
      const newEntity = { ...oldEntity, id: newId };
      if (newCanonical) newEntity.canonical_name = newCanonical;

      // 2. Insert new entity with real NIF as PK
      //    If the NIF already exists (e.g. company shares NIF with its vehicle),
      //    skip the insert and just redirect FKs + delete the old mock row.
      const { error: insertErr } = await sb
        .from("private_entities")
        .insert(newEntity);
      if (insertErr) {
        const isDupe = insertErr.message.includes("duplicate key");
        if (!isDupe) {
          console.error(`  Entity ${oldId} → insert ${newId} failed: ${insertErr.message}`);
          failE++; continue;
        }
        // NIF already exists — just reroute FKs and drop the mock
      }

      // 3. Update FK references to point to new PK
      const updates = [
        sb.from("capital_calls").update({ vehicle_id: newId }).eq("vehicle_id", oldId),
        sb.from("fund_meta").update({ vehicle_id: newId }).eq("vehicle_id", oldId),
        sb.from("portfolio_companies").update({ entity_id: newId }).eq("entity_id", oldId),
      ];
      const results = await Promise.all(updates);
      const fkErrors = results.filter(r => r.error).map(r => r.error.message);
      if (fkErrors.length) {
        console.error(`  Entity ${oldId} → FK update failed: ${fkErrors.join(", ")}`);
        // Rollback: delete the new entity we just inserted
        await sb.from("private_entities").delete().eq("id", newId);
        failE++; continue;
      }

      // 4. Delete old entity row
      const { error: delErr } = await sb.from("private_entities").delete().eq("id", oldId);
      if (delErr) {
        console.error(`  Entity ${oldId} → delete old failed: ${delErr.message}`);
        failE++;
      } else {
        okE++;
      }
    }
  }

  console.log(`✓ Importació completada`);
  console.log(`  Searchers actualitzats: ${okS}${failS ? `, ${failS} errors` : ""}`);
  console.log(`  Entitats actualitzades: ${okE}${failE ? `, ${failE} errors` : ""}`);
}

// ── Entry point ─────────────────────────────────────────────────────────────
const [,, mode, file] = process.argv;
if (mode === "export") {
  await exportGaps();
} else if (mode === "import" && file) {
  await importGaps(file);
} else {
  console.log("Ús:");
  console.log("  node scripts/nif_gaps.mjs export");
  console.log("  node scripts/nif_gaps.mjs import nif_gaps_YYYY-MM-DD.xlsx");
  process.exit(1);
}
