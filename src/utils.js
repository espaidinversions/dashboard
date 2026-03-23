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
