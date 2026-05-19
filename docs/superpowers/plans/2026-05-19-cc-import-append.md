# Capital Calls Append Import Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `scripts/cc_import_append.mjs` — a Node.js script that reads a new capital calls Excel (two sheets: funds + companies), deduplicates against existing DB rows, and INSERT-only appends new transactions.

**Architecture:** Single ESM script alongside the existing `cc_import.mjs`. Imports pure-function helpers from `src/data/capitalCallTipusModel.js` directly (both are ESM). Reads Equivalència Conceptes Excel at runtime to build a type→concept override map layered on top of the existing model. Fetches `private_entities` and existing `capital_calls` from Supabase once each before processing rows.

**Tech Stack:** Node.js ESM, `xlsx` (already in devDeps via `createRequire`), `@supabase/supabase-js`, `node:test` for unit tests.

---

## File Structure

| File | Role |
|------|------|
| `scripts/cc_import_append.mjs` | New script — full pipeline |
| `scripts/cc_import_append.test.mjs` | Unit tests for pure functions |

No changes to any existing file.

---

> **Column index note:** The existing `cc_import.mjs` uses 0-based indices from `sheet_to_json` with `header: 1`. The correct indices (matching the existing script) are: `r[2]`=fons, `r[3]`=tipus, `r[5]`=date serial, `r[6]`=importLocal, `r[7]`=divisa, `r[13]`=vcpe, `r[15]`=importEur, `r[16]`=est. The spec table used different numbers — these actual indices are the source of truth.

---

### Task 1: Script scaffold — CLI parsing, env loading, Supabase client

**Files:**
- Create: `scripts/cc_import_append.mjs`

- [ ] **Step 1: Create the file with imports, env loading, CLI parsing, and Supabase init**

```js
/**
 * Capital Calls append import — reads two sheets from a new Excel and
 * INSERT-only appends rows not already in capital_calls.
 *
 * Usage:
 *   node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import {
  normalizeCapitalCallTipus,
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
} from "../src/data/capitalCallTipusModel.js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dir = path.dirname(fileURLToPath(import.meta.url));
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

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args[0] || args[0] === "--help") {
  console.log('Ús: node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]');
  process.exit(args[0] === "--help" ? 0 : 1);
}

const excelArg = args[0];
const dryRun = args.includes("--dry-run");
const eqIdx = args.indexOf("--equivalencia");
const equivalenciaArg = eqIdx !== -1 ? args[eqIdx + 1] : null;

const absExcelPath = path.isAbsolute(excelArg) ? excelArg : path.join(process.cwd(), excelArg);
if (!fs.existsSync(absExcelPath)) {
  console.error("Fitxer no trobat:", absExcelPath);
  process.exit(1);
}

const defaultEqPath = path.join(__dir, "../260424_Equivalència_Conceptes.xlsx");
const absEqPath = equivalenciaArg
  ? (path.isAbsolute(equivalenciaArg) ? equivalenciaArg : path.join(process.cwd(), equivalenciaArg))
  : defaultEqPath;

// ── Supabase client ───────────────────────────────────────────────────────────
const env = loadEnv(envPath);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

- [ ] **Step 2: Verify the file runs without crashing on `--help`**

```bash
node scripts/cc_import_append.mjs --help
```

Expected output: `Ús: node scripts/cc_import_append.mjs ...` and exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/cc_import_append.mjs
git commit -m "feat(scripts): scaffold cc_import_append with CLI parsing and Supabase init"
```

---

### Task 2: Equivalència Conceptes parser

**Files:**
- Modify: `scripts/cc_import_append.mjs`
- Create: `scripts/cc_import_append.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/cc_import_append.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

// We'll test buildTipusConceptMap by calling it with mock XLSX worksheet data.
// Since it depends on XLSX.utils.sheet_to_json, we mock the input.

// Import the function under test once it's exported.
// For now just verify the test file runs.
test("placeholder — buildTipusConceptMap exists", () => {
  assert.ok(true);
});
```

Run: `node --test scripts/cc_import_append.test.mjs`

Expected: PASS (placeholder).

- [ ] **Step 2: Implement `buildTipusConceptMap` and export it**

Add to `scripts/cc_import_append.mjs` after the Supabase section:

```js
// ── Slugify (mirrors capitalCallTipusModel.js) ────────────────────────────────
function slugifyTipus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// ── Parse Equivalència Conceptes ──────────────────────────────────────────────
export function buildTipusConceptMap(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("⚠ Equivalència Conceptes not found at", filePath, "— using model fallback only");
    return new Map();
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  const map = new Map();
  for (const row of raw) {
    const rawType = String(row[0] ?? "").trim();
    const concept = String(row[1] ?? "").trim();
    if (rawType && concept) map.set(slugifyTipus(rawType), concept);
  }
  return map;
}

// Normalize a raw type string using the Equivalència override map first,
// then falling back to the existing model's normalizeCapitalCallTipus.
export function resolveConceptFromTipus(rawTipus, tipusConceptMap) {
  const slug = slugifyTipus(rawTipus);
  if (tipusConceptMap.has(slug)) return tipusConceptMap.get(slug);
  return normalizeCapitalCallTipus(rawTipus);
}
```

- [ ] **Step 3: Update the test to verify `buildTipusConceptMap` and `resolveConceptFromTipus`**

Replace contents of `scripts/cc_import_append.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTipusConceptMap, resolveConceptFromTipus } from "./cc_import_append.mjs";

test("buildTipusConceptMap returns empty map when file does not exist", () => {
  const map = buildTipusConceptMap("/nonexistent/path.xlsx");
  assert.equal(map.size, 0);
});

test("resolveConceptFromTipus falls back to model when map is empty", () => {
  const map = new Map();
  assert.equal(resolveConceptFromTipus("Aportació", map), "Aportació");
  assert.equal(resolveConceptFromTipus("Distribució", map), "Distribució");
});

test("resolveConceptFromTipus uses override map when entry present", () => {
  const map = new Map([["aportacio", "Aportació Custom"]]);
  assert.equal(resolveConceptFromTipus("Aportació", map), "Aportació Custom");
});

test("resolveConceptFromTipus is accent-insensitive via slugify", () => {
  const map = new Map([["aportacio", "Aportació"]]);
  // "aportació" slugifies to "aportacio" — should match
  assert.equal(resolveConceptFromTipus("aportació", map), "Aportació");
});
```

- [ ] **Step 4: Run tests**

```bash
node --test scripts/cc_import_append.test.mjs
```

Expected: 4 passing. If the import triggers the Supabase init code and crashes, see Step 5.

- [ ] **Step 5: Guard Supabase init behind a main-check**

The test file imports from `cc_import_append.mjs` which runs the Supabase credential check at module level. Wrap the credential check and Supabase client creation so they only run when the script is executed directly (not imported as a module):

```js
// Replace the bare credential check with:
const isMain = process.argv[1]?.endsWith("cc_import_append.mjs");

let sb;
if (isMain) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Also wrap the CLI arg check and `fs.existsSync` calls under `if (isMain) { ... }`.

Rerun: `node --test scripts/cc_import_append.test.mjs` — 4 passing.

- [ ] **Step 6: Commit**

```bash
git add scripts/cc_import_append.mjs scripts/cc_import_append.test.mjs
git commit -m "feat(scripts): add Equivalència Conceptes parser with tests"
```

---

### Task 3: Excel sheet parser

**Files:**
- Modify: `scripts/cc_import_append.mjs`
- Modify: `scripts/cc_import_append.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/cc_import_append.test.mjs`:

```js
import { parseSheets } from "./cc_import_append.mjs";

test("parseSheets — blank fons row is skipped", () => {
  // Build minimal synthetic XLSX workbook in memory
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const XLSX = require("xlsx");

  // Row layout (0-based): r[2]=fons, r[3]=tipus, r[5]=dateSerial, r[6]=importLocal,
  //   r[7]=divisa, r[13]=vcpe, r[15]=importEur, r[16]=est
  // Header at row index 7, data from row 8 → array indices 7 and 8+
  const makeRow = (fons, tipus, dateSerial, importLocal, divisa, vcpe, importEur, est) => {
    const r = new Array(17).fill("");
    r[2] = fons; r[3] = tipus; r[5] = dateSerial; r[6] = importLocal;
    r[7] = divisa; r[13] = vcpe; r[15] = importEur; r[16] = est;
    return r;
  };
  const headerRow = makeRow("Fons", "Tipus", "Data", "ImportLocal", "Divisa", "VCPE", "ImportEur", "Est");
  const dataRow = makeRow("Test Fund", "Aportació", 45000, 1000, "EUR", "PE", 1000, "Fons Primari");
  const blankRow = makeRow("", "Aportació", 45000, 500, "EUR", "PE", 500, "");

  // Build an in-memory workbook with 2 sheets
  const ws1 = XLSX.utils.aoa_to_sheet([
    ...Array(8).fill(Array(17).fill("")), // rows 0-7 (header at row 7)
    dataRow,
    blankRow,  // blank fons — should inherit lastFons
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ...Array(8).fill(Array(17).fill("")),
    makeRow("Company A", "Aportació", 45000, 500, "EUR", "SF", 500, ""),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");
  XLSX.utils.book_append_sheet(wb, ws2, "Sheet2");

  const { fundsRows, companiesRows } = parseSheets(wb);

  // dataRow + blankRow (inherited fons) = 2 rows in fundsRows
  assert.equal(fundsRows.length, 2);
  assert.equal(fundsRows[1].fons, "Test Fund"); // inherited
  // companies sheet forces vcpe = "PC"
  assert.equal(companiesRows[0].vcpe, "PC");
});

test("parseSheets — row with non-finite eur is skipped", () => {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const XLSX = require("xlsx");

  const makeRow = (fons, tipus, dateSerial, importLocal, divisa, vcpe, importEur, est) => {
    const r = new Array(17).fill("");
    r[2] = fons; r[3] = tipus; r[5] = dateSerial; r[6] = importLocal;
    r[7] = divisa; r[13] = vcpe; r[15] = importEur; r[16] = est;
    return r;
  };

  const ws = XLSX.utils.aoa_to_sheet([
    ...Array(8).fill(Array(17).fill("")),
    makeRow("Fund A", "Aportació", 45000, 1000, "EUR", "PE", 1000, ""),
    makeRow("Fund A", "Aportació", 45000, "", "EUR", "PE", "", ""), // non-finite eur
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([...Array(8).fill(Array(17).fill(""))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.utils.book_append_sheet(wb, ws2, "Sheet2");

  const { fundsRows } = parseSheets(wb);
  assert.equal(fundsRows.length, 1);
});
```

Run: `node --test scripts/cc_import_append.test.mjs` — expect FAIL (parseSheets not defined).

- [ ] **Step 2: Implement `excelDateToISO` and `parseSheets`**

Add to `scripts/cc_import_append.mjs`:

```js
// ── Date conversion ───────────────────────────────────────────────────────────
function excelDateToISO(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2010) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

// ── Parse both sheets ─────────────────────────────────────────────────────────
// Returns { fundsRows, companiesRows } where each row is:
// { fons, tipus, data, importLocal, divisa, vcpe, eur, est }
// Rows with blank fons inherit the previous row's fons (Excel subtable pattern).
// Rows where eur is not a finite number are skipped (subtotal/blank rows).
export function parseSheets(wb) {
  const HEADER_ROW = 7;

  function parseSheet(ws, forceVcpe) {
    const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
    const rows = [];
    let lastFons = "";

    for (let i = HEADER_ROW + 1; i < raw.length; i++) {
      const r = raw[i];

      const cellFons = String(r[2] ?? "").trim();
      if (cellFons) lastFons = cellFons;
      if (!lastFons) continue;

      const eur = Number(r[15]);
      if (!Number.isFinite(eur) || eur === 0) continue;

      const dateSerial = r[5];
      if (!dateSerial || typeof dateSerial !== "number") continue;
      const data = excelDateToISO(dateSerial);
      if (!data) continue;

      const tipus = String(r[3] ?? "").trim();
      const importLocal = Number(r[6]) || 0;
      const divisa = String(r[7] || "EUR").trim();
      const vcpe = forceVcpe ?? String(r[13] ?? "").trim();
      const est = String(r[16] ?? "").trim() || null;

      rows.push({ fons: lastFons, tipus, data, importLocal, divisa, vcpe, eur, est });
    }
    return rows;
  }

  const ws0 = wb.Sheets[wb.SheetNames[0]];
  const ws1 = wb.Sheets[wb.SheetNames[1]];
  return {
    fundsRows: ws0 ? parseSheet(ws0, null) : [],
    companiesRows: ws1 ? parseSheet(ws1, "PC") : [],
  };
}
```

Also add a top-level `parseSheetsFromFile` for use in the main pipeline:

```js
function parseSheetsFromFile(filePath) {
  let wb;
  try {
    wb = XLSX.readFile(filePath);
  } catch (err) {
    console.error("No s'ha pogut llegir l'Excel:", err.message);
    process.exit(1);
  }
  if (wb.SheetNames.length < 2) {
    console.error(`L'Excel ha de tenir almenys 2 fulles. Trobades: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  return parseSheets(wb);
}
```

- [ ] **Step 3: Run the tests**

```bash
node --test scripts/cc_import_append.test.mjs
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add scripts/cc_import_append.mjs scripts/cc_import_append.test.mjs
git commit -m "feat(scripts): add Excel sheet parser with column mapping and tests"
```

---

### Task 4: Name resolution

**Files:**
- Modify: `scripts/cc_import_append.mjs`
- Modify: `scripts/cc_import_append.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/cc_import_append.test.mjs`:

```js
import { resolveEntityId } from "./cc_import_append.mjs";

test("resolveEntityId — exact match", () => {
  const exactMap = new Map([["fons innovation iv", "uuid-1"]]);
  const entities = [{ id: "uuid-1", canonical_name: "Fons Innovation IV" }];
  assert.equal(resolveEntityId("Fons Innovation IV", exactMap, entities), "uuid-1");
});

test("resolveEntityId — case-insensitive exact match", () => {
  const exactMap = new Map([["fons innovation iv", "uuid-1"]]);
  const entities = [{ id: "uuid-1", canonical_name: "Fons Innovation IV" }];
  assert.equal(resolveEntityId("fons innovation iv", exactMap, entities), "uuid-1");
});

test("resolveEntityId — prefix match (DB name starts with input)", () => {
  const exactMap = new Map([["fons innovation iv (sicav)", "uuid-2"]]);
  const entities = [{ id: "uuid-2", canonical_name: "Fons Innovation IV (SICAV)" }];
  assert.equal(resolveEntityId("Fons Innovation IV", exactMap, entities), "uuid-2");
});

test("resolveEntityId — prefix match (input starts with DB name)", () => {
  const exactMap = new Map([["fons innovation", "uuid-3"]]);
  const entities = [{ id: "uuid-3", canonical_name: "Fons Innovation" }];
  assert.equal(resolveEntityId("Fons Innovation Extended Name", exactMap, entities), "uuid-3");
});

test("resolveEntityId — no match returns null", () => {
  const exactMap = new Map();
  const entities = [];
  assert.equal(resolveEntityId("Nonexistent Fund", exactMap, entities), null);
});
```

Run: `node --test scripts/cc_import_append.test.mjs` — expect FAIL.

- [ ] **Step 2: Implement `buildNameToIdMap` and `resolveEntityId`**

Add to `scripts/cc_import_append.mjs`:

```js
// ── Name resolution ───────────────────────────────────────────────────────────
export function resolveEntityId(fons, exactMap, entities) {
  const needle = fons.trim().toLowerCase();
  if (exactMap.has(needle)) return exactMap.get(needle);
  // Prefix fallback: DB name starts with input, or input starts with DB name (without suffix)
  for (const e of entities) {
    const dbName = e.canonical_name.trim().toLowerCase();
    const dbBase = dbName.split(" (")[0];
    if (dbName.startsWith(needle) || needle.startsWith(dbBase)) return e.id;
  }
  return null;
}

async function buildNameToIdMap(supabase) {
  const { data, error } = await supabase
    .from("private_entities")
    .select("id, canonical_name");
  if (error) throw new Error("Failed to load private_entities: " + error.message);
  const exactMap = new Map();
  for (const e of data) {
    exactMap.set(e.canonical_name.trim().toLowerCase(), e.id);
  }
  return { exactMap, entities: data };
}
```

- [ ] **Step 3: Run the tests**

```bash
node --test scripts/cc_import_append.test.mjs
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add scripts/cc_import_append.mjs scripts/cc_import_append.test.mjs
git commit -m "feat(scripts): add entity name resolution with tests"
```

---

### Task 5: Row normalization

**Files:**
- Modify: `scripts/cc_import_append.mjs`
- Modify: `scripts/cc_import_append.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/cc_import_append.test.mjs`:

```js
import { normalizeRow } from "./cc_import_append.mjs";

test("normalizeRow — capital call is positive, cat=Capital Call", () => {
  const tipusMap = new Map();
  const raw = { fons: "Fund A", tipus: "Aportació", data: "2024-03-01", importLocal: 1000, divisa: "EUR", vcpe: "PE", eur: 1000, est: "Fons Primari" };
  const row = normalizeRow(raw, "uuid-1", tipusMap);
  assert.equal(row.vehicle_id, "uuid-1");
  assert.equal(row.tipus, "Aportació");
  assert.equal(row.cat, "Capital Call");
  assert.ok(row.eur > 0);
  assert.ok(row.amountNative > 0);
});

test("normalizeRow — distribution is negative, cat=Distribució", () => {
  const tipusMap = new Map();
  const raw = { fons: "Fund A", tipus: "Distribució", data: "2024-03-01", importLocal: 500, divisa: "EUR", vcpe: "PE", eur: 500, est: null };
  const row = normalizeRow(raw, "uuid-1", tipusMap);
  assert.equal(row.cat, "Distribució");
  assert.ok(row.eur < 0);
  assert.ok(row.amountNative < 0);
});

test("normalizeRow — tipusMap override takes effect", () => {
  const tipusMap = new Map([["capital call", "Aportació"]]);
  const raw = { fons: "Fund A", tipus: "Capital Call", data: "2024-03-01", importLocal: 1000, divisa: "EUR", vcpe: "PE", eur: 1000, est: null };
  const row = normalizeRow(raw, "uuid-1", tipusMap);
  assert.equal(row.tipus, "Aportació");
});
```

Run: `node --test scripts/cc_import_append.test.mjs` — expect FAIL.

- [ ] **Step 2: Implement `normalizeRow`**

Add to `scripts/cc_import_append.mjs`:

```js
// ── Row normalization ─────────────────────────────────────────────────────────
// Returns a capital_calls-ready DB object.
export function normalizeRow(raw, vehicleId, tipusConceptMap) {
  const resolvedTipus = resolveConceptFromTipus(raw.tipus, tipusConceptMap) ?? raw.tipus;
  const signedEur = normalizeCapitalCallSignedAmount(resolvedTipus, raw.eur);
  const signedNative = normalizeCapitalCallSignedAmount(resolvedTipus, raw.importLocal);
  const cat = inferCapitalCallCategoryFromTipus(resolvedTipus, signedEur);
  return {
    vehicle_id: vehicleId,
    fons: raw.fons,
    tipus: resolvedTipus,
    cat,
    vcpe: raw.vcpe || null,
    est: raw.est || null,
    divisa: raw.divisa || "EUR",
    data: raw.data,
    eur: signedEur,
    amountNative: signedNative,
    fxRate: null,
    fxSource: null,
  };
}
```

- [ ] **Step 3: Run the tests**

```bash
node --test scripts/cc_import_append.test.mjs
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add scripts/cc_import_append.mjs scripts/cc_import_append.test.mjs
git commit -m "feat(scripts): add row normalization with tests"
```

---

### Task 6: Deduplication

**Files:**
- Modify: `scripts/cc_import_append.mjs`
- Modify: `scripts/cc_import_append.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/cc_import_append.test.mjs`:

```js
import { buildDedupSet, buildDedupKey } from "./cc_import_append.mjs";

test("buildDedupKey produces consistent key", () => {
  const row = { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000.005 };
  const key = buildDedupKey(row);
  assert.equal(key, "uuid-1|Aportació|2024-03-01|100001");
});

test("buildDedupSet returns set of keys from existing rows", () => {
  const existing = [
    { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000 },
    { vehicle_id: "uuid-2", tipus: "Distribució", data: "2024-04-01", eur: -500 },
  ];
  const set = buildDedupSet(existing);
  assert.equal(set.size, 2);
  assert.ok(set.has("uuid-1|Aportació|2024-03-01|100000"));
  assert.ok(set.has("uuid-2|Distribució|2024-04-01|-50000"));
});

test("a normalized new row matches its existing counterpart", () => {
  const existingRow = { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000 };
  const set = buildDedupSet([existingRow]);
  const newRow = { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000 };
  assert.ok(set.has(buildDedupKey(newRow)));
});
```

Run: `node --test scripts/cc_import_append.test.mjs` — expect FAIL.

- [ ] **Step 2: Implement `buildDedupKey` and `buildDedupSet`**

Add to `scripts/cc_import_append.mjs`:

```js
// ── Deduplication ─────────────────────────────────────────────────────────────
export function buildDedupKey(row) {
  return `${row.vehicle_id}|${row.tipus}|${row.data}|${Math.round(row.eur * 100)}`;
}

export function buildDedupSet(existingRows) {
  return new Set(existingRows.map(buildDedupKey));
}

async function fetchExistingDedupSet(supabase) {
  const { data, error } = await supabase
    .from("capital_calls")
    .select("vehicle_id, tipus, data, eur");
  if (error) throw new Error("Failed to load capital_calls: " + error.message);
  return buildDedupSet(data);
}
```

- [ ] **Step 3: Run the tests**

```bash
node --test scripts/cc_import_append.test.mjs
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add scripts/cc_import_append.mjs scripts/cc_import_append.test.mjs
git commit -m "feat(scripts): add deduplication logic with tests"
```

---

### Task 7: Main pipeline — wire it all together

**Files:**
- Modify: `scripts/cc_import_append.mjs`

- [ ] **Step 1: Add the main pipeline function at the bottom of the file**

```js
// ── Main ──────────────────────────────────────────────────────────────────────
if (isMain) {
  if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

  // 1. Parse Equivalència Conceptes
  const tipusConceptMap = buildTipusConceptMap(absEqPath);
  console.log(`✓ Loaded ${tipusConceptMap.size} type mappings from Equivalència Conceptes`);

  // 2. Parse Excel sheets
  console.log("\nReading sheets...");
  const { fundsRows, companiesRows } = parseSheetsFromFile(absExcelPath);
  console.log(`  funds:     ${String(fundsRows.length).padStart(4)} rows`);
  console.log(`  companies: ${String(companiesRows.length).padStart(4)} rows`);
  const allRaw = [...fundsRows, ...companiesRows];

  // 3. Resolve entity names
  console.log("\nResolving names...");
  const { exactMap, entities } = await buildNameToIdMap(sb);

  const unmatched = [];
  const resolvedRows = [];
  for (const raw of allRaw) {
    const vehicleId = resolveEntityId(raw.fons, exactMap, entities);
    if (!vehicleId) {
      unmatched.push(raw.fons);
      continue;
    }
    resolvedRows.push(normalizeRow(raw, vehicleId, tipusConceptMap));
  }

  const matchedCount = resolvedRows.length;
  console.log(`  ✓ matched ${matchedCount} / ${allRaw.length} rows`);
  if (unmatched.length) {
    const uniqueUnmatched = [...new Set(unmatched)];
    console.log(`  ✗ unmatched (${unmatched.length} rows skipped):`);
    uniqueUnmatched.forEach(name => console.log(`      "${name}" — no match in private_entities`));
  }

  // 4. Deduplicate
  console.log("\nDeduplicating against existing rows...");
  const dedupSet = await fetchExistingDedupSet(sb);
  console.log(`  Deduplicating against ${dedupSet.size.toLocaleString()} existing rows...`);

  const newRows = resolvedRows.filter(row => !dedupSet.has(buildDedupKey(row)));
  const dupCount = resolvedRows.length - newRows.length;
  console.log(`  new: ${newRows.length} / duplicate: ${dupCount}`);

  if (dryRun) {
    console.log(`\n[DRY RUN — no changes made]`);
    console.log(`  Would insert: ${newRows.length} rows`);
    if (newRows.length > 0) {
      console.log("\nSample rows (first 3):");
      newRows.slice(0, 3).forEach(r => console.log(" ", JSON.stringify(r)));
    }
    console.log(`\nSummary: ${allRaw.length} read · ${unmatched.length} unmatched · ${dupCount} duplicate · ${newRows.length} would insert`);
    process.exit(0);
  }

  // 5. Insert in batches of 200
  if (newRows.length === 0) {
    console.log("\nNo new rows to insert.");
    console.log(`Summary: ${allRaw.length} read · ${unmatched.length} unmatched · ${dupCount} duplicate · 0 inserted`);
    process.exit(0);
  }

  console.log(`\nInserting ${newRows.length} rows...`);
  const BATCH = 200;
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    const { error } = await sb.from("capital_calls").insert(batch);
    if (error) {
      console.error(`  ✗ Batch ${i}-${i + batch.length} failed: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r  ${inserted + failed}/${newRows.length}...`);
  }
  console.log(" done.");

  console.log(`\nSummary: ${allRaw.length} read · ${unmatched.length} unmatched · ${dupCount} duplicate · ${inserted} inserted${failed ? ` · ${failed} failed` : ""}`);
  if (failed > 0) process.exit(1);
}
```

- [ ] **Step 2: Verify with `--dry-run` against a real Excel (if available)**

```bash
node scripts/cc_import_append.mjs "path/to/new_excel.xlsx" --dry-run
```

Expected: reads sheets, prints summary, exits 0 with "DRY RUN — no changes made". No DB writes.

If no Excel is available yet, verify the script still exits cleanly with a missing file:

```bash
node scripts/cc_import_append.mjs nonexistent.xlsx --dry-run
```

Expected: "Fitxer no trobat: ..." and exit 1.

- [ ] **Step 3: Run all tests one final time**

```bash
node --test scripts/cc_import_append.test.mjs
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add scripts/cc_import_append.mjs
git commit -m "feat(scripts): complete cc_import_append main pipeline with dry-run and batch insert"
```

---

## Self-Review

**Spec coverage:**
- [x] CLI: `<excel> [--equivalencia] [--dry-run]` — Task 1
- [x] Two sheets parsed, companies vcpe forced to "PC" — Task 3
- [x] Equivalència Conceptes override map with model fallback — Task 2
- [x] Name resolution: exact + prefix match, unmatched logged and skipped — Task 4
- [x] Row normalization: tipus, cat, eur sign, amountNative — Task 5
- [x] Dedup set from existing capital_calls, integer cents key — Task 6
- [x] Batch INSERT, dry-run, partial failure handling, summary report — Task 7
- [x] Exit 1 on missing credentials, unparseable Excel — Task 1 + Task 3
- [x] Exit 0 when all rows are duplicates or unmatched — Task 7

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:**
- `resolveConceptFromTipus` defined in Task 2, used in Task 5 `normalizeRow` ✓
- `buildDedupKey` defined in Task 6, used in Task 7 ✓
- `parseSheets(wb)` takes a workbook object; `parseSheetsFromFile(path)` takes a path — used correctly in Task 7 ✓
- `buildNameToIdMap` returns `{ exactMap, entities }` — destructured correctly in Task 7 ✓
