// ── Helpers ───────────────────────────────────────────────
export function fmtM(n) {
  const a=Math.abs(n);
  if(a>=1e6) return (n/1e6).toFixed(2)+"M€";
  if(a>=1e3) return (n/1e3).toFixed(0)+"K€";
  return n.toFixed(0)+"€";
}
export function fmtS(n) {
  const a=Math.abs(n);
  if(a>=1e6) return (n/1e6).toFixed(1)+"M€";
  if(a>=1e3) return (n/1e3).toFixed(0)+"K€";
  return n.toFixed(0)+"€";
}
const _CAT_MONTHS = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];
// Accepts "YYYY-MM" (legacy PM_MONTHLY) or "YYYY-MM-DD" (bi-weekly PM_VALUES)
export function fmtMonth(s) {
  if (!s) return "";
  const parts = s.split("-");
  const y = parts[0], m = parts[1], d = parts[2];
  const label = `${_CAT_MONTHS[+m]} '${y.slice(2)}`;
  // For bi-weekly dates, prefix the day number
  return d && +d !== 1 ? `${+d} ${label}` : label;
}

// ── CSV Parsers ───────────────────────────────────────────
function parseCSVRows(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    // Handle quoted fields
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur); cur = ""; }
      else { cur += ch; }
    }
    fields.push(cur);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (fields[i] ?? "").trim(); });
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

/**
 * Like useState but syncs with localStorage.
 * Pass isSet:true for Set values (serialised as sorted array).
 */
export function usePersistedState(key, defaultValue, { isSet = false } = {}) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed = JSON.parse(raw);
      return isSet ? new Set(parsed) : parsed;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      const toStore = isSet ? [...value].sort() : value;
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch {}
  }, [key, value, isSet]);

  return [value, setValue];
}

// ── Excel export ──────────────────────────────────────────
export async function exportXLSX(rows, sheetName, filename) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
  return rows.map(r => ({
    fons:   String(r["Fons"] ?? ""),
    tipus:  String(r["Tipus"] ?? ""),
    cat:    String(r["Categoria"] ?? ""),
    data:   String(r["Data"] ?? ""),
    mes:    Number(r["Mes"]),
    any:    Number(r["Any"]),
    fy:     String(r["FY"] ?? ""),
    vcpe:   String(r["VCPE"] ?? ""),
    est:    String(r["Estructura"] ?? ""),
    eur:    Number(r["Import (€)"]),
    divisa: String(r["Divisa"] ?? ""),
  }));
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

/** Returns the number of years between an ISO date string and now. */
export function yearsHeld(dataCompra) {
  if (!dataCompra) return 0;
  return (Date.now() - new Date(dataCompra).getTime()) / (365.25 * 24 * 3600 * 1000);
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
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (cols[i] || "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });
}
