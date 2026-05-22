import { FUND_NAME_MAP } from "./fundNameMap.js";
import { RAW_CC as STATIC_CC } from "./capital-calls.js";
import { normalizeCapitalCallTipus } from "./capitalCallTipusModel.js";

const EXCLUDED_CASH_MODEL_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);

function stripLegalSuffix(name) {
  return name.replace(/\s+(A\s+)?S\.?L\.?$|\s+S\.?A\.?$|\s+SCR(,\s*S\.?A\.?)?$|\s+FCRE$/i, "").trim();
}

// Fund name PREFIXES whose entire family is RE (all static rows with these prefixes
// have vehicleTipus=RE and none are PE). Used for fuzzy matching when canonical names
// in the DB/forecast table strip trailing identifiers like " D" or " FICC".
const RE_FAMILY_PREFIXES = [
  "inveractiva",
  "meridia",
  "espaiactiu",
  "healthcare activos",
  "tectum",
];

// RE funds derived from static capital-calls.js (authoritative for vehicleTipus classification).
// Used as fallback when rawCapitalCalls (DB data) lacks vehicleTipus metadata.
const STATIC_RE_NAMES = (() => {
  const s = new Set();
  for (const row of STATIC_CC) {
    if (String(row?.vehicleTipus ?? "").trim() !== "RE") continue;
    const fund = String(row?.fons ?? "").trim();
    if (fund) {
      s.add(fund.toLowerCase());
      s.add(stripLegalSuffix(fund).toLowerCase());
    }
  }
  return s;
})();

// Committed amounts from static capital-calls.js.
// Keyed by BOTH the raw workbook name AND the mapped canonical name so the
// lookup succeeds regardless of which name the forecast table uses.
const STATIC_COMMITTED = (() => {
  const m = {};
  for (const row of STATIC_CC) {
    if (row?.cat !== "Compromís") continue;
    if (EXCLUDED_CASH_MODEL_TIPUS.has(normalizeCapitalCallTipus(row?.tipus))) continue;
    const rawFund = String(row?.fons ?? "").trim();
    if (!rawFund) continue;
    const mappedFund = FUND_NAME_MAP[rawFund];
    const amount = Math.abs(Number(row?.eur) || 0);
    m[rawFund] = (m[rawFund] ?? 0) + amount;
    if (mappedFund) m[mappedFund] = (m[mappedFund] ?? 0) + amount;
  }
  return m;
})();

export const PROSPECTIVE_CASH_USD_FUNDS = new Set([
  "Adams Street GSF7", "Alder III", "Alpine IX", "Altamar MidMarket", "Ara III",
  "CS Climate Innovation Fund", "CS Seasons Global IV",
  "Chicago Pacific Founders Fund IV", "EBN Pre-IPO II", "EBN Pre-IPO III",
  "Frontenac XIII", "G Squared V", "Galdana Asia I", "Hg Mercury 4",
  "JPM Vintage 2018", "JPM Vintage 2020", "JPM Vintage 2022",
  "K6 Private Investors", "Lee Equity IV", "Magnum Capital IV",
  "Main Capital VIII", "Main Foundation II", "Main Foundation III",
  "Nautic XI", "Norvestor IX", "Norvestor Nova", "Novacap Tech VII",
  "Oakley Origin II", "Pictet Co-Inv IV", "Pictet Co-Inv V",
  "Pictet Monte Rosa V", "Pictet Monte Rosa VI", "Pictet Tech",
  "RCP XIX", "RCP XX", "Veritas IX",
]);

export function forecastRowsToEditorData(rows) {
  const funds = {};
  const vehicleIds = {};
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const row of rows) {
    const fund = String(row.fons);
    if (!funds[fund]) {
      funds[fund] = { model_calls: {}, model_dist: {} };
      vehicleIds[fund] = row.vehicle_id;
    }
    const year = Number(row.year);
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;
    if (row.flow_type === "calls") {
      funds[fund].model_calls[year] = (funds[fund].model_calls[year] ?? 0) + amount;
    } else {
      funds[fund].model_dist[year] = (funds[fund].model_dist[year] ?? 0) + amount;
    }
    if (year < minYear) minYear = year;
    if (year > maxYear) maxYear = year;
  }

  const years =
    minYear === Infinity
      ? []
      : Array.from({ length: maxYear + 3 - minYear + 1 }, (_, i) => minYear + i);

  return { editorData: { years, funds }, vehicleIds };
}

export function editorDataToForecastRows(editorData, vehicleIds) {
  const rows = [];
  for (const [fons, data] of Object.entries(editorData.funds ?? {})) {
    const vehicle_id = vehicleIds[fons];
    if (!vehicle_id) continue;
    for (const [year, amount] of Object.entries(data.model_calls ?? {})) {
      if (Number(amount) > 0)
        rows.push({ vehicle_id, fons, flow_type: "calls", year: Number(year), amount: Number(amount) });
    }
    for (const [year, amount] of Object.entries(data.model_dist ?? {})) {
      if (Number(amount) > 0)
        rows.push({ vehicle_id, fons, flow_type: "dist", year: Number(year), amount: Number(amount) });
    }
  }
  return rows;
}

export function buildReFundMatcher(actualCapitalCalls = []) {
  // Start from the authoritative static set so RE detection works even when
  // rawCapitalCalls (DB data) is empty or lacks vcpe metadata.
  const reFundsNorm = new Set(STATIC_RE_NAMES);
  if (Array.isArray(actualCapitalCalls)) {
    for (const row of actualCapitalCalls) {
      if (String(row?.vehicleTipus ?? "").trim() === "RE") {
        const fund = String(row?.fons ?? "").trim();
        if (fund) {
          reFundsNorm.add(fund.toLowerCase());
          reFundsNorm.add(stripLegalSuffix(fund).toLowerCase());
        }
      }
    }
  }
  return (name) => {
    const norm = name.trim().toLowerCase();
    return reFundsNorm.has(norm) ||
      reFundsNorm.has(stripLegalSuffix(name.trim()).toLowerCase()) ||
      RE_FAMILY_PREFIXES.some((prefix) => norm.startsWith(prefix));
  };
}

export function deriveProspectiveCashRows(editorData, actualCapitalCalls = []) {
  const normalized = editorData && typeof editorData === "object" ? editorData : { years: [], funds: {} };

  const isReFund = buildReFundMatcher(actualCapitalCalls);

  const byFundYearType = new Map();
  const committed = deriveCommittedFromCapitalCalls(actualCapitalCalls);
  // Build a lowercase index so case differences between DB names and forecast names don't break lookup.
  const committedLower = {};
  for (const [k, v] of Object.entries(committed)) committedLower[k.trim().toLowerCase()] = v;
  const firstCall = {};
  const actuals = deriveActualsFromCapitalCalls(actualCapitalCalls);

  for (const [fund, fundData] of Object.entries(normalized.funds ?? {})) {
    if (isReFund(fund)) continue;
    if (!committed[fund]) committed[fund] = committedLower[fund.trim().toLowerCase()] ?? (Number(fundData.committed) || 0);
    const years = new Set();
    ["model_calls", "model_dist"].forEach((key) => {
      Object.keys(fundData[key] ?? {}).forEach((year) => years.add(Number(year)));
    });
    [...years].sort((a, b) => a - b).forEach((year) => {
      const modelCalls = numberAtYear(fundData.model_calls, year);
      const modelDist = numberAtYear(fundData.model_dist, year);
      if (modelCalls) setProspectiveRow(byFundYearType, { fund, year, type: "calls", model: modelCalls, real: 0 });
      if (modelDist) setProspectiveRow(byFundYearType, { fund, year, type: "dist", model: modelDist, real: 0 });
    });
  }

  actuals.forEach((actual) => {
    if (isReFund(actual.fund)) return;
    const key = rowKey(actual);
    const existing = byFundYearType.get(key);
    // Include actuals even when the fund is not yet present in the forecast table.
    const current = existing ?? { ...actual, model: 0, real: 0 };
    current.real += actual.real;
    byFundYearType.set(key, current);
    if (actual.type === "calls" && actual.real > 0 && (!firstCall[actual.fund] || actual.year < firstCall[actual.fund])) {
      firstCall[actual.fund] = actual.year;
    }
  });

  const rows = [...byFundYearType.values()]
    .filter((row) => row.model || row.real)
    .sort((a, b) => a.fund.localeCompare(b.fund) || a.year - b.year || a.type.localeCompare(b.type));

  return { rows, committed, firstCall, years: normalized.years ?? [] };
}

function numberAtYear(values, year) {
  if (!values) return 0;
  return Number(values[year] ?? values[String(year)] ?? 0) || 0;
}

function setProspectiveRow(map, row) {
  const key = rowKey(row);
  const current = map.get(key) ?? { ...row, model: 0, real: 0 };
  current.model += row.model;
  current.real += row.real;
  map.set(key, current);
}

function rowKey(row) {
  return `${row.fund}\0${row.year}\0${row.type}`;
}

function deriveActualsFromCapitalCalls(rows) {
  if (!Array.isArray(rows)) return [];
  const result = [];
  rows.forEach((row) => {
    const rawFund = String(row?.fons ?? "").trim();
    const fund = FUND_NAME_MAP[rawFund] ?? rawFund;
    const year = Number(row?.any ?? row?.year ?? String(row?.data ?? "").slice(0, 4));
    if (!fund || !year) return;

    // Exclude non-cash transfers/conversions from the cash model "real" side.
    const concept = normalizeCapitalCallTipus(row?.tipus);
    if (EXCLUDED_CASH_MODEL_TIPUS.has(concept)) return;

    const category = String(row?.cat ?? "").trim();
    const amount = Number(row?.eur) || 0;
    if (category === "Capital Call") {
      // "Capital cridat" in this model is Aportació-only (exclude fees/equalisation/etc.).
      // If tipus is missing/null but cat is Capital Call, assume it's a contribution.
      if (concept != null && concept !== "Aportació") return;
      result.push({ fund, year, type: "calls", model: 0, real: Math.abs(amount) });
    } else if (category === "Distribució" || category === "Retorn Capital") {
      result.push({ fund, year, type: "dist", model: 0, real: Math.abs(amount) });
    }
  });
  return result;
}

function deriveCommittedFromCapitalCalls(rows) {
  // Collect committed totals from the DB data.
  const fromDb = {};
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const rawFund = String(row?.fons ?? "").trim();
      const fund = FUND_NAME_MAP[rawFund] ?? rawFund;
      if (!fund || row?.cat !== "Compromís") return;
      if (EXCLUDED_CASH_MODEL_TIPUS.has(normalizeCapitalCallTipus(row?.tipus))) return;
      fromDb[fund] = (fromDb[fund] ?? 0) + Math.abs(Number(row?.eur) || 0);
    });
  }
  // DB data wins per fund; static provides fallback for funds not yet in DB.
  return { ...STATIC_COMMITTED, ...fromDb };
}
