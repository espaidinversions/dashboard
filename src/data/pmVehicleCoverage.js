import { START_MONTH_2019, buildMonthRange, toMonthKey } from "../chartSeries.js";

const ISIN_RE = /([A-Z]{2}[A-Z0-9]{10})/;

function monthIndex(month) {
  if (!month) return null;
  const [year, monthNum] = String(month).slice(0, 7).split("-").map(Number);
  if (!year || !monthNum) return null;
  return year * 12 + (monthNum - 1);
}

function compressMonths(months) {
  const sorted = [...new Set(months)].sort();
  if (sorted.length === 0) return [];
  const spans = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (monthIndex(current) === monthIndex(prev) + 1) {
      prev = current;
      continue;
    }
    spans.push([start, prev]);
    start = current;
    prev = current;
  }
  spans.push([start, prev]);
  return spans;
}

function spanLabel(start, end) {
  if (!start || !end) return "—";
  if (start === end) return start;
  return `${start} → ${end}`;
}

function missingSpanLabel(months) {
  return compressMonths(months)
    .map(([start, end]) => `${spanLabel(start, end)} (${buildMonthRange(start, end).length}m)`)
    .join("; ");
}

function fmtInt(value) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value ?? 0);
}

function firstMonth(months) {
  return months.length ? [...months].sort()[0] : null;
}

function lastMonth(months) {
  return months.length ? [...months].sort().at(-1) ?? null : null;
}

function inferUnitsDelta(tx) {
  let units = tx?.units;
  if (units == null && tx?.valueEur != null && tx?.nav != null && tx.nav !== 0) {
    units = tx.valueEur / tx.nav;
  }
  if (units == null || !Number.isFinite(units)) return 0;
  const sign = tx?.action === "sell" ? -1 : 1;
  return sign * Math.abs(Number(units));
}

function transactionPricePoints(transactions) {
  const points = [];
  (transactions ?? []).forEach((tx) => {
    const month = toMonthKey(tx?.date);
    const nav = Number(tx?.nav);
    if (!month || !Number.isFinite(nav) || nav <= 0) return;
    points.push([month, nav]);
  });
  return points;
}

function firstMonthFromRows(rows, keys) {
  let first = null;
  (rows ?? []).forEach((row) => {
    keys.forEach((key) => {
      const month = toMonthKey(row?.[key]);
      if (month && (!first || month < first)) first = month;
    });
  });
  return first;
}

function latestMonthFromRows(rows, keys) {
  let latest = null;
  (rows ?? []).forEach((row) => {
    keys.forEach((key) => {
      const month = toMonthKey(row?.[key]);
      if (month && (!latest || month > latest)) latest = month;
    });
  });
  return latest;
}

function firstMonthFromPriceSeries(priceSeries) {
  if (!Array.isArray(priceSeries) || priceSeries.length === 0) return null;
  let first = null;
  priceSeries.forEach(([month]) => {
    const key = toMonthKey(month);
    if (key && (!first || key < first)) first = key;
  });
  return first;
}

function latestMonthFromPrices(allPriceSeries) {
  let latest = null;
  Object.values(allPriceSeries ?? {}).forEach((series) => {
    (series ?? []).forEach(([month]) => {
      const key = toMonthKey(month);
      if (key && (!latest || key > latest)) latest = key;
    });
  });
  return latest;
}

function latestMonthFromTransactions(transactions) {
  let latest = null;
  (transactions ?? []).forEach((tx) => {
    const key = toMonthKey(tx?.date);
    if (key && (!latest || key > latest)) latest = key;
  });
  return latest;
}

function buildTransactionUnitSeries(transactions, startMonth, endMonth) {
  const deltas = new Map();
  [...(transactions ?? [])]
    .filter((tx) => tx?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((tx) => {
      const month = toMonthKey(tx.date);
      if (!month) return;
      const delta = inferUnitsDelta(tx);
      if (!delta) return;
      deltas.set(month, (deltas.get(month) ?? 0) + delta);
    });

  let units = 0;
  const rows = [];
  for (const month of buildMonthRange(startMonth, endMonth)) {
    units += deltas.get(month) ?? 0;
    rows.push({ month, units });
  }
  return rows;
}

function buildSnapshotUnitSeries(rows, startMonth, endMonth) {
  const totalUnits = rows.reduce((sum, row) => sum + Number(row?.unitats ?? row?.units ?? 0), 0);
  const series = [];
  for (const month of buildMonthRange(startMonth, endMonth)) {
    series.push({ month, units: totalUnits });
  }
  return series;
}

function buildTrancheUnitSeries(rows, startMonth, endMonth) {
  const deltas = new Map();
  (rows ?? []).forEach((row) => {
    const month = toMonthKey(row?.dataCompra);
    const units = Number(row?.unitats ?? 0);
    if (!month || !units) return;
    deltas.set(month, (deltas.get(month) ?? 0) + units);
  });

  let units = 0;
  const series = [];
  for (const month of buildMonthRange(startMonth, endMonth)) {
    units += deltas.get(month) ?? 0;
    series.push({ month, units });
  }
  return series;
}

function rowName(vehicle) {
  return (
    vehicle.activeRows.find((row) => row?.nom)?.nom ??
    vehicle.closedRows.find((row) => row?.nom)?.nom ??
    vehicle.txs.find((row) => row?.nom)?.nom ??
    vehicle.isin
  );
}

function rowStatus(vehicle) {
  if (vehicle.activeRows.length && vehicle.closedRows.length) return "Mixed";
  if (vehicle.activeRows.length) return "Present";
  if (vehicle.closedRows.length) return "Closed";
  return "Unknown";
}

function rowStartMonth(vehicle, priceSeries) {
  const candidates = [
    firstMonthFromRows(vehicle.activeRows, ["dataCompra"]),
    firstMonthFromRows(vehicle.closedRows, ["dataCompra"]),
    firstMonthFromRows(vehicle.txs, ["date"]),
  ].filter(Boolean);
  if (candidates.length > 0) return candidates.sort()[0];

  const firstPriceMonth = firstMonthFromPriceSeries(priceSeries);
  if (vehicle.activeRows.length && firstPriceMonth) return firstPriceMonth;
  return START_MONTH_2019;
}

function rowEndMonth(vehicle, reportEndMonth) {
  if (vehicle.activeRows.length) return reportEndMonth;
  const candidates = [
    latestMonthFromRows(vehicle.closedRows, ["endDate"]),
    latestMonthFromRows(
      vehicle.txs.filter((tx) => tx?.action === "sell"),
      ["date"]
    ),
    latestMonthFromRows(vehicle.txs, ["date"]),
  ].filter(Boolean);
  return candidates.sort().at(-1) ?? reportEndMonth;
}

function buildVehicleIndex(pmModel) {
  const byIsin = new Map();

  const ensure = (isin) => {
    const current = byIsin.get(isin) ?? {
      isin,
      activeRows: [],
      closedRows: [],
      txs: [],
    };
    byIsin.set(isin, current);
    return current;
  };

  pmModel.holdings.active.forEach((row) => {
    const isin = cleanPmIsin(row?.isin);
    if (!isin) return;
    ensure(isin).activeRows.push(row);
  });

  pmModel.holdings.closed.forEach((row) => {
    const isin = cleanPmIsin(row?.isin);
    if (!isin) return;
    ensure(isin).closedRows.push(row);
  });

  pmModel.activity.transactions.forEach((tx) => {
    const isin = cleanPmIsin(tx?.isin);
    if (!isin) return;
    ensure(isin).txs.push(tx);
  });

  return byIsin;
}

function buildCoverageRow(vehicle, reportEndMonth, allPriceSeries, fundPrices, estimatedPriceIsins) {
  const isin = vehicle.isin;
  const name = rowName(vehicle);
  const status = rowStatus(vehicle);
  const priceSeries = allPriceSeries[isin] ?? [];
  const priceByMonth = new Map(
    priceSeries
      .map(([month, value]) => [toMonthKey(month), value])
      .filter(([month, value]) => month && value != null)
  );
  transactionPricePoints(vehicle.txs).forEach(([month, nav]) => {
    if (!priceByMonth.has(month)) priceByMonth.set(month, nav);
  });

  const priceMonths = [...priceByMonth.keys()].sort();
  const hasFundPrices = (fundPrices[isin] ?? []).length > 0;
  const hasEstimatedPrices = estimatedPriceIsins.has(isin);
  const hasTransactionPrices = transactionPricePoints(vehicle.txs).length > 0;
  const priceSource = hasFundPrices ? "FUND_PRICES" : hasEstimatedPrices ? "estimated" : hasTransactionPrices ? "transactions" : "missing";
  const startMonth = rowStartMonth(vehicle, priceSeries);
  const endMonth = rowEndMonth(vehicle, reportEndMonth);
  const lifecycleMonths = buildMonthRange(startMonth, endMonth);

  const activeTranches = vehicle.activeRows.filter((row) => row?.dataCompra && Number(row?.unitats ?? 0) > 0);
  const activeSnapshots = vehicle.activeRows.filter((row) => Number(row?.unitats ?? 0) > 0);
  const hasTransactionSeries = vehicle.txs.some((tx) => tx?.date);
  const unitSource = hasTransactionSeries
    ? "transactions"
    : activeTranches.length
      ? "active tranches"
      : activeSnapshots.length
        ? "active snapshot"
        : vehicle.closedRows.length
          ? "closed placeholder"
          : "missing";

  const unitSeries = hasTransactionSeries
    ? buildTransactionUnitSeries(vehicle.txs, startMonth, endMonth)
    : activeTranches.length
      ? buildTrancheUnitSeries(activeTranches, startMonth, endMonth)
      : activeSnapshots.length
        ? buildSnapshotUnitSeries(activeSnapshots, startMonth, endMonth)
        : [];

  const heldMonths = unitSeries.filter((row) => row.units > 0).map((row) => row.month);
  const valueMonths = heldMonths.filter((month) => priceByMonth.has(month));
  const missingPriceMonths = heldMonths.filter((month) => !priceByMonth.has(month));
  const missingValueMonths = unitSource === "missing" ? lifecycleMonths : missingPriceMonths;
  const txCoverageMonths = vehicle.txs.map((tx) => toMonthKey(tx?.date)).filter(Boolean);

  const unitCurrent = unitSeries.at(-1)?.units ?? null;
  const expectedCurrent = activeTranches.length
    ? activeTranches.reduce((sum, row) => sum + Number(row?.unitats ?? 0), 0)
    : null;
  const unitMismatch = expectedCurrent != null && unitCurrent != null && Math.abs(unitCurrent - expectedCurrent) > 0.01;

  const notes = [];
  if (unitSource === "missing") notes.push("No hi ha sèrie d'unitats reconstruïble");
  if (unitSource === "active snapshot") notes.push("Unitats reconstruïdes des de la posició actual");
  if (unitSource === "closed placeholder") notes.push("Posició tancada sense traça d'unitats al ledger local");
  if (!priceMonths.length) notes.push("Sense sèrie de preus");
  if (hasEstimatedPrices) notes.push("Sèrie de preus estimada des de cost i MTM actual");
  if (priceSource === "transactions") notes.push("Preu seed extret del NAV de la transacció");
  if (missingPriceMonths.length) notes.push(`Falten preus: ${missingSpanLabel(missingPriceMonths)}`);
  if (unitMismatch) notes.push(`Unitats finals no quadren amb la posició actual (${fmtInt(unitCurrent)} vs ${fmtInt(expectedCurrent)})`);
  if (!firstMonthFromRows(vehicle.activeRows, ["dataCompra"]) && vehicle.activeRows.length && firstMonthFromPriceSeries(priceSeries)) {
    notes.push(`Inici inferit des del primer preu disponible (${firstMonthFromPriceSeries(priceSeries)})`);
  }
  if (vehicle.closedRows.length && vehicle.activeRows.length) notes.push("ISIN present a taula activa i tancada");

  return {
    isin,
    name,
    status,
    startMonth,
    endMonth,
    lifecycleMonths: lifecycleMonths.length,
    unitSource,
    priceSource,
    priceMonths: priceMonths.length,
    heldMonths: heldMonths.length,
    valueMonths: valueMonths.length,
    valueCoverageStart: firstMonth(valueMonths),
    valueCoverageEnd: lastMonth(valueMonths),
    txCoverageStart: firstMonth(txCoverageMonths),
    txCoverageEnd: lastMonth(txCoverageMonths),
    missingPriceMonths: compressMonths(missingPriceMonths),
    missingValueMonths: compressMonths(missingValueMonths),
    unitCurrent,
    expectedCurrent,
    notes,
  };
}

function formatSummary(rows) {
  const total = rows.length;
  const withPrice = rows.filter((row) => row.priceSource !== "missing").length;
  const closedPlaceholders = rows.filter((row) => row.unitSource === "closed placeholder");
  const withUnits = rows.filter((row) => !["missing", "closed placeholder"].includes(row.unitSource)).length;
  const fullCoverage = rows.filter(
    (row) => !["missing", "closed placeholder"].includes(row.unitSource) && row.priceSource !== "missing" && row.missingPriceMonths.length === 0
  ).length;
  const gapRows = rows.filter(
    (row) => row.unitSource === "missing" || row.priceSource === "missing" || row.missingPriceMonths.length > 0
  );
  const totalLifecycle = rows.reduce((sum, row) => sum + row.lifecycleMonths, 0);
  const totalValueMonths = rows.reduce((sum, row) => sum + row.valueMonths, 0);
  return { total, withPrice, withUnits, fullCoverage, gapRows, closedPlaceholders, totalLifecycle, totalValueMonths };
}

function cleanPmIsin(raw) {
  return (ISIN_RE.exec(String(raw ?? "").toUpperCase())?.[1]) ?? null;
}

export function buildPmVehicleCoverageReport({
  pmModel,
  allPriceSeries,
  fundPrices,
  estimatedPriceIsins,
}) {
  const vehicles = buildVehicleIndex(pmModel);
  const reportEndMonth = [
    latestMonthFromPrices(allPriceSeries),
    latestMonthFromTransactions(pmModel.activity.transactions),
    latestMonthFromRows(pmModel.holdings.active, ["dataCompra", "endDate"]),
    latestMonthFromRows(pmModel.holdings.closed, ["dataCompra", "endDate"]),
    START_MONTH_2019,
  ].filter(Boolean).sort().at(-1);

  const rows = [...vehicles.values()]
    .map((vehicle) => buildCoverageRow(vehicle, reportEndMonth, allPriceSeries, fundPrices, estimatedPriceIsins))
    .sort((a, b) => {
      const score = (row) => row.missingPriceMonths.length + (row.unitSource === "missing" ? 1 : 0);
      const gapDelta = score(b) - score(a);
      if (gapDelta !== 0) return gapDelta;
      return a.name.localeCompare(b.name, "ca", { sensitivity: "base" });
    });

  const summary = formatSummary(rows);
  const actionableGaps = summary.gapRows.filter((row) => row.unitSource !== "closed placeholder");
  const closedPlaceholders = summary.closedPlaceholders;

  return {
    reportEndMonth,
    summary,
    rows,
    actionableGaps,
    closedPlaceholders,
  };
}
