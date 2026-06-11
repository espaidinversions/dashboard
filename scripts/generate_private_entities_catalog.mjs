import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "./lib/xlsx_compat.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKBOOK_PATH = path.resolve(__dirname, "../data/ID_Vehicles.xlsx");
const OUTPUT_PATH = path.resolve(__dirname, "../src/generated/dashboard/privateEntitiesWorkbook.js");

function asString(value) {
  return String(value ?? "").trim();
}

function headerKey(value) {
  return asString(value).replace(/\r\n/g, "\n");
}

const workbook = await xlsx.readFile(WORKBOOK_PATH, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
const header = rows[3]?.map((value) => headerKey(value)) ?? [];

const nifIndex        = header.indexOf("NIF (3)");
const nameIndex       = header.indexOf("Denominación\ndel emisor (5)");
const isinIndex       = header.indexOf("Codigo\nISIN (2)");
const dateIndex       = header.indexOf("Fecha primera inversion (Calculado para Audit PBC)");
const countryIndex    = header.indexOf("Domicilio\nsocial (9)");

if (nifIndex === -1 || nameIndex === -1) {
  throw new Error(`ID_Vehicles.xlsx is missing expected headers. Got: ${JSON.stringify(header)}`);
}

function parseDate(value) {
  if (!value) return null;
  const s = asString(value);
  if (!s) return null;
  // Excel serial number
  if (/^\d+$/.test(s)) {
    const d = xlsx.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  // Already a date string
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

const entities = rows
  .slice(4)
  .map((row) => {
    const entry = {
      id: asString(row[nifIndex]),
      workbookName: asString(row[nameIndex]),
    };
    const isin = isinIndex >= 0 ? asString(row[isinIndex]) : "";
    if (isin) entry.isin = isin;
    const date = dateIndex >= 0 ? parseDate(row[dateIndex]) : null;
    if (date) entry.firstInvestmentDate = date;
    const country = countryIndex >= 0 ? asString(row[countryIndex]) : "";
    if (country) entry.country = country;
    return entry;
  })
  .filter((row) => row.id && row.workbookName)
  .sort((a, b) => a.workbookName.localeCompare(b.workbookName, "en"));

const contents = `// Generated from ID_Vehicles.xlsx by scripts/generate_private_entities_catalog.mjs
export const PRIVATE_ENTITIES_WORKBOOK = ${JSON.stringify(entities, null, 2)};
`;

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, contents, "utf8");
