// Script to generate an Excel with all investments and their ISIN/NIF status
// Usage: node scripts/generate_isin_excel.mjs

import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

import XLSX from "./lib/xlsx_compat.mjs";

// ── Load data ──────────────────────────────────────────────────────────────
const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dir, "..");

// Dynamic import of JS data modules
const { RAW_CC } = await import(pathToFileURL(path.join(root, "src/data/capital-calls.js")).href);
const { PRIVATE_ENTITIES_WORKBOOK } = await import(
  pathToFileURL(path.join(root, "src/generated/dashboard/privateEntitiesWorkbook.js")).href
);
const { PM_POSITIONS_RAW } = await import(
  pathToFileURL(path.join(root, "src/data/publicMarketsRaw.js")).href
);


// ── Matching logic (mirrors privateEntities.js) ────────────────────────────
const STOPWORDS = new Set([
  "a","an","and","capital","partner","partners","fund","funds","invest",
  "investment","investments","holding","holdings","group","global","private",
  "equity","program","class","corporation","corp","company","companies",
  "limited","ltd","llp","llc","lp","sl","slp","srl","sa","spa","scra","scr",
  "scsp","sicav","raif","fcr","fcre","ficc","u","ua",
]);
const EXACT_STOP = new Set(["sl","srl","ltd","lp","llp","llc","sa","scr","scsp","sicav","raif","fcr","fcre","ficc","ua"]);

const MANUAL_MAP = {
  "seedrocket 4founders": "V01799568",
  "adams street asp lux raif global secondary fund 7": "LUXB230846",
  "altamar x": "V88060843",
  "altamar x midmarket": "V88361027",
  "arcano earth": "A88609060",
  "arcano earth ii 2021 scr": "A16743569",
  "arcano pe secondaries 2024 scr": "A19792845",
  "arcano xii": "V88239660",
  "aurica growth fund capital iv": "V16732752",
  "aurica search fund": "A44662351",
  "capital dynamics mid market direct v": "LUXB145913",
  "cs climate innovation fund": "LUXB230684",
  "cs seasons global": "LUXB230623",
  "ebn pre ipo us ii": "V88491808",
  "ebn pre ipo us iii": "V05299128",
  "frontenac xiii parallel": "USA000187",
  "galdana asia": "LUX33463685",
  "galdana iii fcr": "V05376298",
  "invivo ventures iii parallel fund fcre": "V56509813",
  "jp morgan vintage 2018": "V88140660",
  "jp morgan vintage 2020": "V88545793",
  "jp morgan vintage 2022": "V67917724",
  "magnum capital iv": "LUXN0324347D",
  "naxicap investment opportunities iii": "FRA1491827022",
  "pictet coinvest iv": "LUX0000003",
  "pictet monte rosa coinvest v": "LUX0000002",
  "pictet monte rosa vi fcr": "LUX0000005",
  "pictet tech": "LUX0000006",
  "qualitas funds direct ii a scr": "A56502883",
  "samaipata ii": "V88350335",
  "seedrocket 4 founders": "V01799568",
  "arcblue": "A06876742",
  "itaca": "A02769602",
  "itaca acquisition partners": "A02769602",
  "greenfarm": "B09745837",
  "the extension fund scr pyme": "A02882843",
  "umai": "B01755917",
  "veritas ix": "LUXN0309067G",
};

const FORCE_FALLBACK = new Set(["main foundation iii cooperatief u a"]);

function stripDiacritics(v) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeName(v) {
  return stripDiacritics(v)
    .toLowerCase()
    .replace(/co[\s-]?inv(?:est(?:ment)?)?/g, "coinvest")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchKey(v) {
  return normalizeName(v)
    .split(/\s+/)
    .filter(t => t && !EXACT_STOP.has(t))
    .join(" ");
}

// Build workbook lookups
const byId = new Map(PRIVATE_ENTITIES_WORKBOOK.map(r => [r.id, r]));
const byNormalized = new Map();
for (const row of PRIVATE_ENTITIES_WORKBOOK) {
  const key = matchKey(row.workbookName);
  if (!byNormalized.has(key)) byNormalized.set(key, row);
}

function resolveWorkbook(name) {
  const normalized = normalizeName(name);
  if (FORCE_FALLBACK.has(normalized)) return null;
  const manualId = MANUAL_MAP[normalized];
  if (manualId && byId.has(manualId)) return { ...byId.get(manualId), matchType: "manual" };
  const match = byNormalized.get(matchKey(name));
  if (match) return { ...match, matchType: "normalized" };
  return null;
}

// ── Build private investments list ────────────────────────────────────────
// Get unique funds from RAW_CC with extra metadata
const fundMeta = new Map();
for (const row of RAW_CC) {
  if (!fundMeta.has(row.fons)) {
    fundMeta.set(row.fons, {
      fons: row.fons,
      vcpe: row.vcpe ?? "",
      est: row.est ?? "",
    });
  }
}

const privateRows = [];
for (const [fons, meta] of fundMeta) {
  const wb = resolveWorkbook(fons);
  privateRows.push({
    Fons: fons,
    VCPE: meta.vcpe,
    Estratègia: meta.est,
    NIF: wb ? wb.id : "",
    ISIN: wb?.isin ?? "",
    País: wb?.country ?? "",
    "Nom Workbook": wb?.workbookName ?? "",
    "Primera inversió": wb?.firstInvestmentDate ?? "",
    Comentaris: "",
  });
}

// ── Build companies/search-fund list from current capital-call source ──────
const companyRowsByName = new Map();
for (const row of RAW_CC) {
  const est = String(row.est ?? "").trim();
  if (est !== "Search Fund - Cerca" && est !== "Search Fund - Participada" && est !== "Participada (Altres)") continue;
  const name = String(row.fons ?? "").trim();
  if (!name || companyRowsByName.has(name)) continue;
  const wb = resolveWorkbook(name);
  companyRowsByName.set(name, {
    Nom: name,
    Tipus: est,
    Origen: row.vcpe ?? "",
    Segment: "",
    País: "",
    NIF: wb ? wb.id : "",
    ISIN: wb?.isin ?? "",
    "Nom Workbook": wb?.workbookName ?? "",
    "Primera inversió": wb?.firstInvestmentDate ?? "",
    Comentaris: "",
  });
}
const companyRows = [...companyRowsByName.values()];

const compWithNif  = companyRows.filter(r => r.NIF);
const compNoNif    = companyRows.filter(r => !r.NIF);
const alphaComp    = (a, b) => a.Nom.localeCompare(b.Nom);
compWithNif.sort(alphaComp);
compNoNif.sort(alphaComp);

// ── Build public markets list (unique by ISIN + nom) ─────────────────────
const pmSeen = new Map();
for (const pos of PM_POSITIONS_RAW) {
  const key = pos.isin ?? pos.nom;
  if (!pmSeen.has(key)) {
    pmSeen.set(key, {
      Nom: pos.nom,
      ISIN: pos.isin ?? "",
      Tipus: pos.tipus ?? "",
      Divisa: pos.divisa ?? "",
      Custodià: pos.custodian ?? "",
      Gestor: pos.gestor ?? "",
    });
  }
}
const pmRows = [...pmSeen.values()];

// ── Split private rows into sheets ────────────────────────────────────────
const withIsin    = privateRows.filter(r => r.ISIN);
const withNifOnly = privateRows.filter(r => r.NIF && !r.ISIN);
const noId        = privateRows.filter(r => !r.NIF && !r.ISIN);

// Sort each group alphabetically
const alpha = (a, b) => a.Fons.localeCompare(b.Fons);
withIsin.sort(alpha);
withNifOnly.sort(alpha);
noId.sort(alpha);
pmRows.sort((a, b) => a.Nom.localeCompare(b.Nom));

// ── Create workbook ───────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

function addSheet(name, rows) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-width columns
  const cols = Object.keys(rows[0]);
  ws["!cols"] = cols.map(col => {
    const maxLen = Math.max(
      col.length,
      ...rows.map(r => String(r[col] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 60) };
  });
  XLSX.utils.book_append_sheet(wb, ws, name);
}

addSheet("Fons - Amb ISIN", withIsin);
addSheet("Fons - Sense ISIN", withNifOnly);
addSheet("Fons - Sense NIF+ISIN", noId);
addSheet("Empreses - Amb NIF", compWithNif);
addSheet("Empreses - Sense NIF", compNoNif);
addSheet("Mercats Públics", pmRows);

// ── Write file ────────────────────────────────────────────────────────────
const outPath = path.join(root, "Inversions_ISIN_NIF.xlsx");
await XLSX.writeFile(wb, outPath);
console.log(`✓ Written: ${outPath}`);
console.log(`  Fons amb ISIN:            ${withIsin.length}`);
console.log(`  Fons sense ISIN:          ${withNifOnly.length}`);
console.log(`  Fons sense NIF+ISIN:      ${noId.length}`);
console.log(`  Empreses amb NIF:         ${compWithNif.length}`);
console.log(`  Empreses sense NIF:       ${compNoNif.length}`);
console.log(`  Mercats Públics:          ${pmRows.length}`);
