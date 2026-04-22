// ── Helpers ───────────────────────────────────────────────
export function fmtM(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  const a=Math.abs(n);
  if(a>=1e6) return (n/1e6).toFixed(2)+"M€";
  if(a>=1e3) return (n/1e3).toFixed(0)+"K€";
  return n.toFixed(0)+"€";
}
export function fmtS(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  const a=Math.abs(n);
  if(a>=1e6) return (n/1e6).toFixed(1)+"M€";
  if(a>=1e3) return (n/1e3).toFixed(0)+"K€";
  return n.toFixed(0)+"€";
}
const _CAT_MONTHS = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];
// Accepts "YYYY-MM" or "YYYY-MM-DD".
export function fmtMonth(s) {
  if (!s) return "";
  const parts = s.split("-");
  const y = parts[0], m = parts[1], d = parts[2];
  const label = `${_CAT_MONTHS[+m]} '${y.slice(2)}`;
  // For bi-weekly dates, prefix the day number
  return d && +d !== 1 ? `${+d} ${label}` : label;
}

/** Format a "YYYY-MM" month key → e.g. "Mar '26" */
export function fmtMonthKey(v) {
  if (!v) return "";
  return fmtMonth(v.length === 7 ? v + "-01" : v);
}

// ── CSV Parsers ───────────────────────────────────────────
function parseCSVRows(text) {
  const s = String(text ?? "").trim();
  if (!s) return [];

  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === ",")) {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  const [headerRow, ...dataRows] = rows.filter(r => r.some(cell => String(cell ?? "").trim() !== ""));
  if (!headerRow) return [];

  const headers = headerRow.map(h => String(h ?? "").trim());
  return dataRows.map(fields => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = String(fields[i] ?? "").trim(); });
    return obj;
  });
}

export function parseCapitalCallsCSV(text) {
  return parseCSVRows(text).map(r => ({
    fons:   r.fons,
    tipus:  r.tipus,
    cat:    r.cat,
    data:   r.data,
    mes:    parseInt(r.mes, 10),
    any:    parseInt(r.any, 10),
    fy:     r.fy,
    vcpe:   r.vcpe,
    est:    r.est,
    eur:    parseFloat(r.eur),
    divisa: r.divisa,
  }));
}

export function parsePipelineCSV(text) {
  return parseCSVRows(text).map(r => ({
    id:        parseInt(r.id, 10),
    name:      r.name,
    amount:    parseFloat(r.amount),
    currency:  r.currency,
    geography: r.geography,
    strategy:  r.strategy,
    sector:    r.sector,
    status:    r.status,
    canal:     r.canal,
    active:    r.active === "true" || r.active === "1",
  }));
}



// ── Persisted state hook ───────────────────────────────────
import { useState, useEffect } from "react";

export function readStoredJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStoredJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readStoredFlag(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return Boolean(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function writeStoredFlag(key, value) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

export function formatIsoDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ca-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatIsoDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ca-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatIsoDateDMY(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function formatMultiple(v) {
  return v != null ? `${v.toFixed(2)}×` : "—";
}

export function multipleColor(v, tc) {
  if (v == null) return tc?.textLight ?? "#999";
  if (v < 1) return tc?.red ?? "#C62828";
  if (v < 1.5) return tc?.warning ?? "#7A6000";
  return tc?.green ?? "#1C6B1D";
}

/**
 * Like useState but syncs with localStorage.
 * Pass isSet:true for Set values (serialised as sorted array).
 */
export function usePersistedState(key, defaultValue, { isSet = false } = {}) {
  const [value, setValue] = useState(() => {
    const parsed = readStoredJSON(key, undefined);
    if (parsed === undefined) return defaultValue;
    return isSet ? new Set(parsed) : parsed;
  });

  useEffect(() => {
    const toStore = isSet ? [...value].sort() : value;
    writeStoredJSON(key, toStore);
  }, [key, value, isSet]);

  return [value, setValue];
}

// sheets: [{ name, rows }]
export async function exportMultiXLSX(sheets, filename) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Slug utility ──────────────────────────────────────────
export function slugify(str) {
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── TVPI colour helpers ────────────────────────────────────
export function tvpiColor(t) {
  if (t == null) return "#999";
  if (t < 1.0)  return "#C62828";
  if (t < 1.5)  return "#7A6000";
  return "#1C6B1D";
}
export function tvpiBg(t) {
  if (t == null) return "#F5F5F5";
  if (t < 1.0)  return "#FDECEA";
  if (t < 1.5)  return "#FFF8E1";
  return "#E8F8E8";
}

// ── Mesos cercant helpers ──────────────────────────────────
export function calcMesos(iso) {
  if (!iso) return 0;
  const today = new Date();
  const d = new Date(iso);
  return Math.max(0, (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth()));
}
export function mesosColor(m) {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,38%)`;
}
export function mesosBg(m) {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,94%)`;
}

// ── XLSX row mappers ───────────────────────────────────────
export function mapCapitalCallsRows(rows) {
  return rows.map(r => {
    const data = excelSerialToIsoDate(r["Data"]);
    const yearFromDate = data ? Number(data.slice(0, 4)) : NaN;
    const monthFromDate = data ? Number(data.slice(5, 7)) : NaN;
    const any = Number(r["Any"]);
    const mes = Number(r["Mes"]);
    const fy = String(r["FY"] ?? "").trim();
    return {
      fons:   String(r["Fons"] ?? ""),
      tipus:  String(r["Tipus"] ?? ""),
      cat:    String(r["Categoria"] ?? ""),
      data,
      mes:    Number.isFinite(mes) && mes > 0 ? mes : monthFromDate,
      any:    Number.isFinite(any) && any > 0 ? any : yearFromDate,
      fy:     fy || (Number.isFinite(yearFromDate) ? `FY ${yearFromDate}` : ""),
      vcpe:   String(r["VCPE"] ?? ""),
      est:    String(r["Estructura"] ?? ""),
      eur:    Number(r["Import (€)"]),
      divisa: String(r["Divisa"] ?? ""),
    };
  });
}

function excelSerialToIsoDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + Math.round(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text || /pendent desemborsar/i.test(text)) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmyMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function inferCapitalCallCategory(tipus, eur) {
  if (Number(eur) >= 0) return "Capital Call";
  const label = String(tipus ?? "").toLowerCase();
  return /capital/.test(label) ? "Retorn Capital" : "Distribució";
}

export function mapLegacySearchFundRows(rows) {
  return rows
    .map((row) => {
      const data = excelSerialToIsoDate(row["Data"]);
      const eur = Number(row["Import"] ?? 0);
      if (!data || !Number.isFinite(eur) || eur === 0) return null;
      const year = Number(row["Any"]) || Number(data.slice(0, 4));
      const mes = Number(row["Mes"]) || Number(data.slice(5, 7));
      return {
        fons: String(row["Startup"] ?? "").trim(),
        tipus: String(row["Tipus"] ?? "").trim() || "Aportació",
        cat: inferCapitalCallCategory(row["Tipus"], eur),
        data,
        mes,
        any: year,
        fy: `FY ${year}`,
        vcpe: String(row["VC/PE"] ?? "").trim() || null,
        est: null,
        eur,
        divisa: String(row["Divisa"] ?? "").trim() || "EUR",
      };
    })
    .filter(Boolean);
}

export function mergeCapitalCallRows(baseRows, extraRows) {
  const merged = [];
  const seen = new Set();
  const add = (row) => {
    if (!row) return;
    const key = [
      row.fons ?? "",
      row.tipus ?? "",
      row.cat ?? "",
      row.data ?? "",
      Number(row.eur ?? 0),
      row.vcpe ?? "",
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  };
  (Array.isArray(baseRows) ? baseRows : []).forEach(add);
  (Array.isArray(extraRows) ? extraRows : []).forEach(add);
  return merged.sort((a, b) => {
    const byDate = String(a?.data ?? "").localeCompare(String(b?.data ?? ""));
    if (byDate !== 0) return byDate;
    const byFund = String(a?.fons ?? "").localeCompare(String(b?.fons ?? ""), "ca", { sensitivity: "base" });
    if (byFund !== 0) return byFund;
    return Number(a?.eur ?? 0) - Number(b?.eur ?? 0);
  });
}

export function mapPipelineRows(rows) {
  return rows.map(r => ({
    id:        Number(r["ID"]),
    name:      String(r["Nom"] ?? ""),
    amount:    Number(r["Import"]) || 0,
    currency:  String(r["Divisa"] ?? "EUR"),
    geography: String(r["Geo"] ?? ""),
    strategy:  String(r["Estratègia"] ?? ""),
    sector:    String(r["Sector"] ?? ""),
    status:    String(r["Status"] ?? ""),
    canal:     String(r["Canal"] ?? ""),
    active:    String(r["Actiu"]) === "1",
  }));
}

export function mapCompanyRows(rows) {
  return rows.map(r => ({
    nom:           String(r["Nom"] ?? ""),
    tipus:         String(r["Tipus"] ?? ""),
    segment:       String(r["Segment"] ?? ""),
    entrepreneurs: String(r["Entrepreneurs"] ?? ""),
    origen:        String(r["Origen"] ?? ""),
    geo:           String(r["Geo"] ?? ""),
    ticket:        r["Ticket (€M)"] ? Number(r["Ticket (€M)"]) * 1e6 : 0,
    tvpi:          r["TVPI"] !== "" && r["TVPI"] != null ? Number(r["TVPI"]) : null,
    rev:           r["Ingressos (€M)"] ? Number(r["Ingressos (€M)"]) * 1e6 : null,
    ebitda:        r["EBITDA (€M)"] ? Number(r["EBITDA (€M)"]) * 1e6 : null,
    dataCompr:     String(r["Data Compromís"] ?? ""),
    mesosOperant:  r["Mesos Operant"] != null && r["Mesos Operant"] !== "" ? Number(r["Mesos Operant"]) : null,
  }));
}

export function mapSearcherRows(rows) {
  return rows.map(r => ({
    nom:             String(r["Nom"] ?? ""),
    statusScreening: String(r["Status"] ?? ""),
    formEntrada:     String(r["Forma Entrada"] ?? ""),
    geo:             String(r["Geo"] ?? ""),
    ticket:          r["Ticket (€M)"] ? Number(r["Ticket (€M)"]) * 1e6 : null,
    dataInici:       String(r["Data Inici"] ?? ""),
    modalitat:       String(r["Modalitat"] ?? ""),
  }));
}

export function mapFundMetaRows(rows) {
  return rows.map(r => ({
    fons: String(r["Fons"] ?? ""),
    tvpi: r["TVPI"] !== "" && r["TVPI"] != null ? Number(r["TVPI"]) : null,
  }));
}

export function mapKpiRows(rows) {
  const KPI_MAP = {
    "Ingressos (€M)":       "rev",
    "Ing. Pressupost (€M)": "revBudget",
    "EBITDA (€M)":          "ebitda",
    "EBITDA Pres. (€M)":    "ebitdaBudget",
    "Deute Net (€M)":       "dfn",
    "DFN Pres. (€M)":       "dfnBudget",
  };
  const byNom = new Map();
  rows.forEach(r => {
    const nom = String(r["Nom"] ?? "");
    const qMap = new Map();
    Object.entries(r).forEach(([col, val]) => {
      const sep = col.indexOf(" | ");
      if (sep === -1) return;
      const q = col.slice(0, sep);
      const metric = col.slice(sep + 3);
      const key = KPI_MAP[metric];
      if (!key) return;
      if (!qMap.has(q)) qMap.set(q, { q });
      const v = val !== "" && val != null ? Number(val) * 1e6 : null;
      qMap.get(q)[key] = v;
    });
    byNom.set(nom, [...qMap.values()].sort((a, b) => {
      const [, qa, ya] = a.q.match(/Q(\d) (\d+)/) || [, "0", "0"];
      const [, qb, yb] = b.q.match(/Q(\d) (\d+)/) || [, "0", "0"];
      return (+ya * 4 + +qa) - (+yb * 4 + +qb);
    }));
  });
  return byNom;
}

/** Returns the number of years between an ISO date string and a reference date. */
export function yearsHeld(dataCompra, asOf = new Date()) {
  if (!dataCompra) return 0;
  const end = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  return (end - new Date(dataCompra).getTime()) / (365.25 * 24 * 3600 * 1000);
}

/**
 * Annualized CAGR from a total return % and holding years.
 * For single-entry positions (no interim cash flows) this equals the MWR (IRR).
 */
export function cagr(rendPct, yearsHeld) {
  if (rendPct == null || yearsHeld <= 0) return null;
  return (Math.pow(1 + rendPct / 100, 1 / yearsHeld) - 1) * 100;
}

export function parseSearchersCSV(text) {
  return parseCSVRows(text);
}

// ── Turtle Capital LocalStorage keys ──────────────────────
const TC_LS_KEYS = [
  "tc_rawCC",
  "tc_fundMeta",
  "tc_portfolioCompanies",
  "tc_allSearchers",
];

export function clearTurtleCapitalLS() {
  TC_LS_KEYS.forEach(k => localStorage.removeItem(k));
}
