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

export function deriveProspectiveCashRows(editorData, actualCapitalCalls = []) {
  const normalized = editorData && typeof editorData === "object" ? editorData : { years: [], funds: {} };
  const byFundYearType = new Map();
  const committed = deriveCommittedFromCapitalCalls(actualCapitalCalls);
  const firstCall = {};
  const actuals = deriveActualsFromCapitalCalls(actualCapitalCalls);

  for (const [fund, fundData] of Object.entries(normalized.funds ?? {})) {
    if (!committed[fund]) committed[fund] = Number(fundData.committed) || 0;
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
    const key = rowKey(actual);
    const current = byFundYearType.get(key) ?? { ...actual, model: 0, real: 0 };
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
  return `${row.fund} ${row.year} ${row.type}`;
}

function deriveActualsFromCapitalCalls(rows) {
  if (!Array.isArray(rows)) return [];
  const result = [];
  rows.forEach((row) => {
    const fund = String(row?.fons ?? "").trim();
    const year = Number(row?.any ?? row?.year ?? String(row?.data ?? "").slice(0, 4));
    if (!fund || !year) return;
    const category = String(row?.cat ?? "").trim();
    const amount = Number(row?.eur) || 0;
    if (category === "Capital Call") {
      result.push({ fund, year, type: "calls", model: 0, real: Math.abs(amount) });
    } else if (category === "Distribució" || category === "Retorn Capital") {
      result.push({ fund, year, type: "dist", model: 0, real: Math.abs(amount) });
    }
  });
  return result;
}

function deriveCommittedFromCapitalCalls(rows) {
  const committed = {};
  if (!Array.isArray(rows)) return committed;
  rows.forEach((row) => {
    const fund = String(row?.fons ?? "").trim();
    if (!fund || row?.cat !== "Compromís") return;
    committed[fund] = (committed[fund] ?? 0) + Math.abs(Number(row?.eur) || 0);
  });
  return committed;
}
