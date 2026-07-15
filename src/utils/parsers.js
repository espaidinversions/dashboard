import {
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
  normalizeCapitalCallTipus,
} from "../data/capitalCallTipusModel.js";

// ── CSV row parser ────────────────────────────────────────
function parseCSVRows(text) {
  const s = String(text ?? "").trim();
  if (!s) return [];
  const rows = [];
  let row = [], cur = "", inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], next = s[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ",") { row.push(cur); cur = ""; continue; }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
      continue;
    }
    cur += ch;
  }
  row.push(cur); rows.push(row);
  const [headerRow, ...dataRows] = rows.filter(r => r.some(c => String(c ?? "").trim() !== ""));
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
    fons: r.fons, tipus: r.tipus, cat: r.cat, data: r.data,
    mes: parseInt(r.mes, 10), any: parseInt(r.any, 10), fy: r.fy,
    est: r.est, eur: parseFloat(r.eur), divisa: r.divisa,
  }));
}

export function parsePipelineCSV(text) {
  return parseCSVRows(text).map(r => ({
    id: parseInt(r.id, 10), name: r.name, amount: parseFloat(r.amount),
    currency: r.currency, geography: r.geography, strategy: r.strategy,
    sector: r.sector, status: r.status, canal: r.canal,
    active: r.active === "true" || r.active === "1",
  }));
}

export function parseSearchersCSV(text) {
  return parseCSVRows(text);
}

// ── XLSX / Excel date helper ──────────────────────────────
function excelSerialToIsoDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text || /pendent desemborsar/i.test(text)) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmyMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]), month = Number(dmyMatch[2]), year = Number(dmyMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
      return `${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

// ── Row mappers ───────────────────────────────────────────
export function mapCapitalCallsRows(rows) {
  return rows.map(r => {
    const data = excelSerialToIsoDate(r["Data"]);
    const yearFromDate = data ? Number(data.slice(0, 4)) : NaN;
    const monthFromDate = data ? Number(data.slice(5, 7)) : NaN;
    const any = Number(r["Any"]), mes = Number(r["Mes"]);
    const fy = String(r["FY"] ?? "").trim();
    const tipus = normalizeCapitalCallTipus(r["Tipus"]) ?? String(r["Tipus"] ?? "");
    const eur = normalizeCapitalCallSignedAmount(tipus, Number(r["Import (€)"]));
    return {
      fons: String(r["Fons"] ?? ""), tipus,
      cat: String(r["Categoria"] ?? "") || inferCapitalCallCategoryFromTipus(tipus, eur),
      data,
      mes: Number.isFinite(mes) && mes > 0 ? mes : monthFromDate,
      any: Number.isFinite(any) && any > 0 ? any : yearFromDate,
      fy: fy || (Number.isFinite(yearFromDate) ? `FY ${yearFromDate}` : ""),
      est: String(r["Estructura"] ?? ""), eur,
      divisa: String(r["Divisa"] ?? ""),
    };
  });
}

export function mapLegacySearchFundRows(rows) {
  return rows.map(row => {
    const data = excelSerialToIsoDate(row["Data"]);
    const tipus = normalizeCapitalCallTipus(row["Tipus"]) ?? "Aportació";
    const eur = normalizeCapitalCallSignedAmount(tipus, Number(row["Import"] ?? 0));
    if (!data || !Number.isFinite(eur) || eur === 0) return null;
    const year = Number(row["Any"]) || Number(data.slice(0, 4));
    const mes = Number(row["Mes"]) || Number(data.slice(5, 7));
    return {
      fons: String(row["Startup"] ?? "").trim(), tipus,
      cat: inferCapitalCallCategoryFromTipus(tipus, eur),
      data, mes, any: year, fy: `FY ${year}`,
      est: null, eur,
      divisa: String(row["Divisa"] ?? "").trim() || "EUR",
    };
  }).filter(Boolean);
}

export function mergeCapitalCallRows(baseRows, extraRows) {
  const merged = [], seen = new Set();
  const add = (row) => {
    if (!row) return;
    // Identity is (fons, cat, data, eur). tipus wording and est classification
    // drift between imports ("Aportació capital" vs "Aportació"; est gets
    // reclassified by migrations), so keying on them let the 2026-05 import
    // re-add 26 existing calls (cleaned up by migration 20260715000000).
    // Base rows are added first, so on a collision the stored row wins.
    const key = [row.fons ?? "", row.cat ?? "", row.data ?? "", Number(row.eur ?? 0)].join("|");
    if (seen.has(key)) return;
    seen.add(key); merged.push(row);
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
    id: Number(r["ID"]), name: String(r["Nom"] ?? ""),
    amount: Number(r["Import"]) || 0, currency: String(r["Divisa"] ?? "EUR"),
    geography: String(r["Geo"] ?? ""), strategy: String(r["Estratègia"] ?? ""),
    sector: String(r["Sector"] ?? ""), status: String(r["Status"] ?? ""),
    canal: String(r["Canal"] ?? ""), active: String(r["Actiu"]) === "1",
  }));
}

export function mapCompanyRows(rows) {
  return rows.map(r => ({
    nom: String(r["Nom"] ?? ""), tipus: String(r["Tipus"] ?? ""),
    segment: String(r["Segment"] ?? ""), entrepreneurs: String(r["Entrepreneurs"] ?? ""),
    origen: String(r["Origen"] ?? ""), geo: String(r["Geo"] ?? ""),
    ticket: r["Ticket (€M)"] ? Number(r["Ticket (€M)"]) * 1e6 : 0,
    tvpi: r["TVPI"] !== "" && r["TVPI"] != null ? Number(r["TVPI"]) : null,
    rev: r["Ingressos (€M)"] ? Number(r["Ingressos (€M)"]) * 1e6 : null,
    ebitda: r["EBITDA (€M)"] ? Number(r["EBITDA (€M)"]) * 1e6 : null,
    dataCompr: String(r["Data Compromís"] ?? ""),
    mesosOperant: r["Mesos Operant"] != null && r["Mesos Operant"] !== "" ? Number(r["Mesos Operant"]) : null,
  }));
}

export function mapSearcherRows(rows) {
  return rows.map(r => ({
    nom: String(r["Nom"] ?? ""), statusScreening: String(r["Status"] ?? ""),
    formEntrada: String(r["Forma Entrada"] ?? ""), geo: String(r["Geo"] ?? ""),
    ticket: r["Ticket (€M)"] ? Number(r["Ticket (€M)"]) * 1e6 : null,
    dataInici: String(r["Data Inici"] ?? ""), modalitat: String(r["Modalitat"] ?? ""),
  }));
}

export function mapFundMetaRows(rows) {
  return rows.map(r => ({
    fons: String(r["Fons"] ?? ""),
    tvpi: r["TVPI"] !== "" && r["TVPI"] != null ? Number(r["TVPI"]) : null,
    irr: r["IRR"] !== "" && r["IRR"] != null ? Number(r["IRR"]) : null,
  }));
}

export function mapKpiRows(rows) {
  const KPI_MAP = {
    "Ingressos (€M)": "rev", "Ing. Pressupost (€M)": "revBudget",
    "EBITDA (€M)": "ebitda", "EBITDA Pres. (€M)": "ebitdaBudget",
    "Deute Net (€M)": "dfn", "DFN Pres. (€M)": "dfnBudget",
  };
  const byNom = new Map();
  rows.forEach(r => {
    const nom = String(r["Nom"] ?? "");
    const qMap = new Map();
    Object.entries(r).forEach(([col, val]) => {
      const sep = col.indexOf(" | ");
      if (sep === -1) return;
      const q = col.slice(0, sep), metric = col.slice(sep + 3);
      const key = KPI_MAP[metric];
      if (!key) return;
      if (!qMap.has(q)) qMap.set(q, { q });
      qMap.get(q)[key] = val !== "" && val != null ? Number(val) * 1e6 : null;
    });
    byNom.set(nom, [...qMap.values()].sort((a, b) => {
      const [, qa, ya] = a.q.match(/Q(\d) (\d+)/) || [, "0", "0"];
      const [, qb, yb] = b.q.match(/Q(\d) (\d+)/) || [, "0", "0"];
      return (+ya * 4 + +qa) - (+yb * 4 + +qb);
    }));
  });
  return byNom;
}

export function normalizeOptionValue(value) {
  return String(value ?? "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function dedupeOptionValues(values) {
  const seen = new Map();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return;
    const key = normalizeOptionValue(raw);
    if (!seen.has(key)) seen.set(key, raw);
  });
  return [...seen.values()].sort((a, b) => String(a).localeCompare(String(b), "ca", { sensitivity: "base" }));
}
