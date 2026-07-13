import { useState, useEffect } from "react";
import { downloadMultiSheetXlsx } from "./xlsx.js";

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

/** Export multiple sheets to a single .xlsx file. */
export async function exportMultiXLSX(sheets, filename) {
  await downloadMultiSheetXlsx({
    sheets,
    filename: `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  });
}

const TC_LS_KEYS = [
  "tc_rawCC", "tc_fundMeta", "tc_portfolioCompanies", "tc_allSearchers",
  "tc_funds0", "tc_loadedAt",
  "ui_tab", "ui_excluded", "ui_navItem", "ui_sidebarCollapsed",
  "ui_alt_include_companies", "ui_alt_show_dpi",
  "ui_fFy", "ui_fVcpe", "ui_fEst", "ui_fCat", "ui_fTipus", "ui_txSearch",
  "ui_sortFons", "ui_sortFonsDir",
  "pl_cur", "pl_fGeo", "pl_fStr", "pl_fStat", "pl_fCanal",
  "pl_fSec", "pl_fAct", "pl_sk", "pl_sd",
];

export function clearTurtleCapitalLS() {
  TC_LS_KEYS.forEach(k => localStorage.removeItem(k));
}
