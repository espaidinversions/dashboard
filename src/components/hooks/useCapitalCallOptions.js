import { useCallback, useMemo } from "react";
import {
  CAPITAL_CALL_TIPUS_OPTIONS,
  CAPITAL_CALL_TIPUS_GROUPED,
} from "../../config.js";
import { normalizeOptionValue, dedupeOptionValues } from "../../utils.js";

/**
 * Derives the capital-call option lists and per-fund pools consumed by the
 * capital-call modals. Extracted from Dashboard.jsx to keep the God Component
 * thin; memo/callback dependency arrays are intentionally unchanged.
 *
 * @param {{
 *   rawCC: Array<Record<string, unknown>>,
 *   companiesData: Array<Record<string, unknown>>,
 *   searchersData: Array<Record<string, unknown>>,
 *   textColor: string,
 * }} params
 */
export function useCapitalCallOptions({ rawCC, companiesData, searchersData, textColor }) {
  const ccNameOptions = useMemo(() => dedupeOptionValues([
    ...rawCC.map((row) => row.fons),
    ...companiesData.map((row) => row.nom),
    ...searchersData.map((row) => row.nom),
  ]), [companiesData, rawCC, searchersData]);

  const ccTipusOptions = useMemo(() => {
    const known = new Set(CAPITAL_CALL_TIPUS_OPTIONS.map(v => String(v).trim().toLowerCase()));
    const extras = [...new Set(rawCC.map(r => r.tipus).filter(Boolean))]
      .filter(v => !known.has(String(v).trim().toLowerCase()));
    return extras.length > 0 ? [...CAPITAL_CALL_TIPUS_GROUPED, ...extras] : CAPITAL_CALL_TIPUS_GROUPED;
  }, [rawCC]);

  const vehicleCurrencyMap = useMemo(() => {
    const map = new Map();
    rawCC.forEach((row) => {
      const key = normalizeOptionValue(row?.fons);
      const currency = String(row?.divisa ?? "").trim();
      if (key && currency && !map.has(key)) map.set(key, currency);
    });
    return map;
  }, [rawCC]);

  const recallablePoolByFund = useMemo(() => {
    const map = {};
    for (const r of rawCC) {
      const fund = r.fons;
      if (!fund) continue;
      if (!map[fund]) map[fund] = 0;
      if (r.cat === "Distribució" && r.recallable) {
        map[fund] += Number(r.recallable);
      }
      if (r.cat === "Capital Call" && r.from_recallable) {
        map[fund] -= Number(r.from_recallable);
      }
    }
    for (const k of Object.keys(map)) {
      map[k] = Math.round(map[k] * 100) / 100;
    }
    return map;
  }, [rawCC]);

  const uncalledByFund = useMemo(() => {
    const map = {};
    for (const r of rawCC) {
      const fund = r.fons;
      if (!fund) continue;
      if (!map[fund]) map[fund] = { compromis: 0, calls: 0 };
      if (r.cat === "Compromís") map[fund].compromis += Number(r.eur);
      if (r.cat === "Capital Call") map[fund].calls += Number(r.eur);
    }
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, Math.max(0, Math.round((v.compromis - v.calls) * 100) / 100)])
    );
  }, [rawCC]);

  const defaultVehicleCurrency = useCallback((vehicleName) => {
    const key = normalizeOptionValue(vehicleName);
    return vehicleCurrencyMap.get(key) ?? "EUR";
  }, [vehicleCurrencyMap]);

  const amountInputStyle = useCallback((values) => {
    const raw = String(values?.eur ?? "").trim();
    if (!raw) return null;
    const amount = Number(raw);
    if (Number.isNaN(amount) || amount === 0) return null;
    return amount < 0
      ? { background: "#FDECEC", borderColor: "#E5B7B7", color: "#8F1D1D" }
      : { background: "#ECF8EE", borderColor: "#B7DEBD", color: textColor };
  }, [textColor]);

  return {
    ccNameOptions,
    ccTipusOptions,
    recallablePoolByFund,
    uncalledByFund,
    defaultVehicleCurrency,
    amountInputStyle,
  };
}
