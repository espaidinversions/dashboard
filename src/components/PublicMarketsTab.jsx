import React, { useMemo, useState } from "react";
import { useTheme } from "../theme.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { FUND_PRICES } from "../generated/prices/fundPrices.js";
import { summarizeLatestPmValues } from "../data/pmValueUtils.js";
import { ALL_PRICE_SERIES, ESTIMATED_PRICE_ISINS } from "../data/allPrices.js";
import { buildGroupedMonthlySeriesFromNestedValues, buildMonthlySeriesFromNestedValues } from "../chartSeries.js";
import { buildPmVehicleCoverageReport } from "../data/pmVehicleCoverage.js";
import { PERIODS, weightedReturn } from "./publicMarkets/PublicMarketsShared.jsx";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { PublicMarketsSummarySection } from "./publicMarkets/PublicMarketsSummarySection.jsx";
import { PublicMarketsTablesSection } from "./publicMarkets/PublicMarketsTablesSection.jsx";
import { PublicMarketsTransactionsSection } from "./publicMarkets/PublicMarketsTransactionsSection.jsx";

const PM_MONTHLY = PM_MODEL.series.monthly;
const PM_VALUES = PM_MODEL.series.values;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_CLOSED = PM_MODEL.holdings.closed;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
const PM_MANAGERS = PM_MODEL.metadata.managers;
const PM_TOTAL_ACTIVE = PM_MODEL.metadata.totals.active;

const CUSTODIAN_GROUPS = ["caixa", "ubs", "creditSuisse", "bankinter", "interactiveBrokers", "jpmorgan", "andbank", "altres"];
const TYPE_GROUPS = ["rv", "rf", "altres"];

function minDate(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

function maxDate(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

function formatDateRange(start, end) {
  if (!start && !end) return "—";
  if (!end || start === end) return start ?? end ?? "—";
  return `${start} → ${end}`;
}

function monthIndex(month) {
  if (!month) return null;
  const [year, monthNum] = String(month).slice(0, 7).split("-").map(Number);
  if (!year || !monthNum) return null;
  return year * 12 + (monthNum - 1);
}

function formatCoverageGap(flowStart, valueStart) {
  const flowMonth = monthIndex(flowStart);
  const valueMonth = monthIndex(valueStart);
  if (flowMonth == null || valueMonth == null) return "—";
  const delta = valueMonth - flowMonth;
  if (delta === 0) return "0m";
  return `${delta > 0 ? "+" : ""}${delta}m`;
}

function groupPmCustodian(position = null) {
  const custodian = String(position?.custodian ?? "").trim();
  if (custodian === "CaixaBank") return "caixa";
  if (custodian === "UBS") return "ubs";
  if (custodian === "Credit Suisse") return "creditSuisse";
  if (custodian === "Bankinter") return "bankinter";
  if (custodian === "Interactive Brokers") return "interactiveBrokers";
  if (custodian === "JPMorgan") return "jpmorgan";
  if (custodian === "Andbank" || custodian === "WAM") return "andbank";
  return "altres";
}

function groupPmAssetType(position = null) {
  const tipus = String(position?.tipus ?? "").trim().toUpperCase();
  if (tipus === "RV") return "rv";
  if (tipus === "RF") return "rf";
  return "altres";
}

export function PublicMarketsTab({ setMercatsPublicsTab }) {
  const { tc, dark } = useTheme();
  const [chartView, setChartView] = useState("total");
  const [expanded, setExpanded] = useState(new Set());
  const [txActionFilter, setTxActionFilter] = useState("all");
  const [txCustodianFilter, setTxCustodianFilter] = useState("all");
  const [openTxMonths, setOpenTxMonths] = useState(() => new Set());
  const [flowGroupBy, setFlowGroupBy] = useState("total");

  const latestPmSummary = useMemo(() => {
    const summary = summarizeLatestPmValues(PM_VALUES, PM_POSITIONS);
    // WAM positions have no PM_VALUES entries — add their static valorMercat directly
    for (const pos of WAM_POSITIONS) {
      const v = pos.valorMercat ?? 0;
      if (!v) continue;
      summary.total += v;
      summary.byManager.andbank = (summary.byManager.andbank ?? 0) + v;
      const t = String(pos.tipus ?? "").trim();
      if (t) summary.byType[t] = (summary.byType[t] ?? 0) + v;
    }
    return summary;
  }, []);
  const vehicleCoverageReport = useMemo(() => buildPmVehicleCoverageReport({
    pmModel: PM_MODEL,
    allPriceSeries: ALL_PRICE_SERIES,
    fundPrices: FUND_PRICES,
    estimatedPriceIsins: ESTIMATED_PRICE_ISINS,
  }), []);

  const currentManagerValues = useMemo(() => ({
    caixa: latestPmSummary.byManager.caixa ?? 0,
    ubs: latestPmSummary.byManager.ubs ?? 0,
    creditSuisse: latestPmSummary.byManager.creditSuisse ?? 0,
    abel: latestPmSummary.byManager.abel ?? 0,
    andbank: latestPmSummary.byManager.andbank ?? 0,
    jpmorgan: latestPmSummary.byManager.jpmorgan ?? 0,
    altres: latestPmSummary.byManager.altres ?? 0,
  }), [latestPmSummary]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTxMonth = (month) => {
    setOpenTxMonths((prev) => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const total = latestPmSummary.total;
  const totalRV = useMemo(() => latestPmSummary.byType.RV ?? 0, [latestPmSummary]);
  const totalRF = useMemo(() => latestPmSummary.byType.RF ?? 0, [latestPmSummary]);

  const managerValueByIdForReturns = useMemo(() => {
    const result = {
      abel: currentManagerValues.abel,
      andbank: currentManagerValues.andbank,
    };
    const allocateGroup = (ids, totalValue) => {
      const managers = ids
        .map((id) => PM_MANAGERS.find((manager) => manager.id === id))
        .filter(Boolean);
      const baseTotal = managers.reduce((sum, manager) => sum + (Number(manager.valorActual) || 0), 0);
      managers.forEach((manager) => {
        const weight = baseTotal > 0 ? (Number(manager.valorActual) || 0) / baseTotal : 0;
        result[manager.id] = totalValue * weight;
      });
    };
    allocateGroup(["caixa-rv", "caixa-rf"], currentManagerValues.caixa);
    allocateGroup(["ubs-rv", "ubs-rf"], currentManagerValues.ubs);
    return result;
  }, [currentManagerValues]);

  const monthlyPortfolioValueSeries = useMemo(() => (
    buildMonthlySeriesFromNestedValues(PM_VALUES, PM_POSITIONS, { startMonth: "2023-12" })
  ), []);

  const monthlyCustodianValueSeries = useMemo(() => (
    buildGroupedMonthlySeriesFromNestedValues(PM_VALUES, PM_POSITIONS, {
      startMonth: "2023-12",
      groupBy: groupPmCustodian,
      groups: CUSTODIAN_GROUPS,
    })
  ), []);

  const monthlyTypeValueSeries = useMemo(() => (
    buildGroupedMonthlySeriesFromNestedValues(PM_VALUES, PM_POSITIONS, {
      startMonth: "2023-12",
      groupBy: groupPmAssetType,
      groups: TYPE_GROUPS,
    })
  ), []);

  const chartMonths = useMemo(() => {
    const months = new Set([
      ...monthlyPortfolioValueSeries.map((row) => row.date),
      ...monthlyCustodianValueSeries.map((row) => row.date),
      ...monthlyTypeValueSeries.map((row) => row.date),
      ...PM_MONTHLY.map((month) => month.date),
    ]);
    return [...months].sort();
  }, [monthlyCustodianValueSeries, monthlyPortfolioValueSeries, monthlyTypeValueSeries]);

  const reportStartMonth = chartMonths[0] ?? "2023-12";

  const vehicleTraceabilityRows = useMemo(() => {
    const coverageByIsin = new Map(vehicleCoverageReport.rows.map((row) => [row.isin, row]));
    const activeByIsin = new Map();
    PM_POSITIONS.forEach((position) => {
      if (!position?.isin) return;
      const current = activeByIsin.get(position.isin) ?? {
        isin: position.isin,
        nom: position.nom ?? position.isin,
        status: "Present",
        custodians: new Set(),
        strategies: new Set(),
        startDate: null,
        endDate: null,
        trancheCount: 0,
      };
      current.nom = current.nom ?? position.nom ?? position.isin;
      current.custodians.add(position.custodian ?? "Sense custodi");
      current.strategies.add(position.tipus ?? "—");
      current.startDate = minDate(current.startDate, position.startDate ?? position.dataCompra ?? null);
      current.endDate = maxDate(current.endDate, position.endDate ?? null);
      current.trancheCount += 1;
      activeByIsin.set(position.isin, current);
    });

    const closedByIsin = new Map();
    PM_CLOSED.forEach((position) => {
      if (!position?.isin) return;
      const current = closedByIsin.get(position.isin) ?? {
        isin: position.isin,
        nom: position.nom ?? position.isin,
        status: "Discontinued",
        custodians: new Set(),
        strategies: new Set(),
        startDate: null,
        endDate: null,
        trancheCount: 0,
      };
      current.nom = current.nom ?? position.nom ?? position.isin;
      current.custodians.add(position.custodian ?? "Sense custodi");
      current.strategies.add(position.tipus ?? "—");
      current.startDate = minDate(current.startDate, position.dataCompra ?? position.startDate ?? null);
      current.endDate = maxDate(current.endDate, position.endDate ?? position.startDate ?? null);
      current.trancheCount += 1;
      closedByIsin.set(position.isin, current);
    });

    const txCoverageByIsin = new Map();
    PM_TRANSACTIONS.forEach((tx) => {
      if (!tx?.isin || !tx?.date) return;
      const current = txCoverageByIsin.get(tx.isin) ?? {
        start: null,
        end: null,
        custodians: new Set(),
        strategies: new Set(),
      };
      current.start = minDate(current.start, tx.date);
      current.end = maxDate(current.end, tx.date);
      current.custodians.add(tx.custodian ?? "Sense custodi");
      current.strategies.add(tx.tipus ?? "—");
      txCoverageByIsin.set(tx.isin, current);
    });

    const allIsins = new Set([
      ...activeByIsin.keys(),
      ...closedByIsin.keys(),
      ...coverageByIsin.keys(),
      ...txCoverageByIsin.keys(),
    ]);

    return [...allIsins].map((isin) => {
      const active = activeByIsin.get(isin) ?? null;
      const closed = closedByIsin.get(isin) ?? null;
      const coverage = coverageByIsin.get(isin) ?? null;
      const valueCoverage = coverage?.valueCoverageStart ? {
        start: coverage.valueCoverageStart,
        end: coverage.valueCoverageEnd,
      } : null;
      const txCoverage = txCoverageByIsin.get(isin) ?? null;
      const base = active ?? closed ?? {};
      const custodians = new Set([
        ...(active?.custodians ?? []),
        ...(closed?.custodians ?? []),
        ...(txCoverage?.custodians ?? []),
      ]);
      const strategies = new Set([
        ...(active?.strategies ?? []),
        ...(closed?.strategies ?? []),
        ...(txCoverage?.strategies ?? []),
      ]);
      const sources = [
        active ? "PM_POSITIONS" : null,
        closed ? "PM_CLOSED" : null,
        txCoverage ? "PM_TRANSACTIONS" : null,
        coverage?.priceSource === "FUND_PRICES" ? "FUND_PRICES" : null,
        coverage?.priceSource === "estimated" ? "ESTIMATED_PRICES" : null,
        coverage?.priceSource === "transactions" ? "TX_NAV" : null,
      ].filter(Boolean);
      const coverageNotes = [...(coverage?.notes ?? [])];
      if (base.startDate && valueCoverage?.start && valueCoverage.start < String(base.startDate).slice(0, 7)) {
        coverageNotes.push("Valors abans de l'inici del vehicle");
      }
      if (base.endDate && valueCoverage?.end && valueCoverage.end > String(base.endDate).slice(0, 7)) {
        coverageNotes.push("Valors després de la venda del vehicle");
      }
      if (!txCoverage && coverage?.unitSource === "missing") coverageNotes.push("Sense fluxos");
      const lifecycleStart = coverage?.startMonth ?? base.startDate ?? null;
      const lifecycleEnd = coverage?.endMonth ?? base.endDate ?? null;
      return {
        isin,
        nom: base.nom ?? isin,
        status: base.status ?? (active ? "Present" : "Discontinued"),
        custodians: [...custodians].sort(),
        strategies: [...strategies].sort(),
        sources,
        valueCoverage: formatDateRange(valueCoverage?.start, valueCoverage?.end),
        txCoverage: formatDateRange(coverage?.txCoverageStart ?? txCoverage?.start, coverage?.txCoverageEnd ?? txCoverage?.end),
        coverageGap: formatCoverageGap(coverage?.txCoverageStart ?? txCoverage?.start, valueCoverage?.start),
        lifecycle: formatDateRange(lifecycleStart, lifecycleEnd),
        notes: [...new Set(coverageNotes)].join(" · "),
        trancheCount: base.trancheCount ?? 0,
      };
    }).sort((a, b) => {
      if (a.status !== b.status) return a.status === "Present" ? -1 : 1;
      return a.nom.localeCompare(b.nom) || a.isin.localeCompare(b.isin);
    });
  }, [vehicleCoverageReport]);

  const ytdWeighted = useMemo(() => weightedReturn("ytd", managerValueByIdForReturns), [managerValueByIdForReturns]);

  const portfolioTWR = useMemo(() => {
    let cumulative = 1;
    for (let i = 1; i < PM_MONTHLY.length; i += 1) {
      const prev = PM_MONTHLY[i - 1];
      const curr = PM_MONTHLY[i];
      const prevValue = prev.caixaRV + prev.caixaRF + prev.ubsRV + prev.ubsRF + (prev.abelBK ?? 0);
      const cashflow = prev.abelBK == null && curr.abelBK != null ? curr.abelBK : 0;
      const currValue = curr.caixaRV + curr.caixaRF + curr.ubsRV + curr.ubsRF + (curr.abelBK ?? 0);
      cumulative *= 1 + (currValue - prevValue - cashflow) / (prevValue + cashflow);
    }
    return (cumulative - 1) * 100;
  }, []);

  const portfolioMWR = useMemo(() => {
    const first = PM_MONTHLY[0];
    const last = PM_MONTHLY[PM_MONTHLY.length - 1];
    const startValue = first.caixaRV + first.caixaRF + first.ubsRV + first.ubsRF;
    const endValue = last.caixaRV + last.caixaRF + last.ubsRV + last.ubsRF + (last.abelBK ?? 0);
    const totalMonths = PM_MONTHLY.length - 1;
    const abelIdx = PM_MONTHLY.findIndex((point) => point.abelBK != null);
    if (abelIdx === -1) return null;
    const cashflow = PM_MONTHLY[abelIdx].abelBK;
    const weight = (totalMonths - abelIdx) / totalMonths;
    const totalReturn = (endValue - startValue - cashflow) / (startValue + cashflow * weight);
    const years = totalMonths / 12;
    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
  }, []);

  const residualValue = total - (
    currentManagerValues.caixa +
    currentManagerValues.ubs +
    currentManagerValues.creditSuisse +
    currentManagerValues.abel +
    currentManagerValues.andbank +
    currentManagerValues.jpmorgan +
    currentManagerValues.altres
  );

  const displayManagers = useMemo(() => {
    const weightedManagerMetric = (ids, field) => {
      const managers = ids
        .map((id) => PM_MANAGERS.find((manager) => manager.id === id))
        .filter((manager) => manager && manager[field] != null);
      if (managers.length === 0) return null;
      const weightedSum = managers.reduce((sum, manager) => sum + manager[field] * manager.valorActual, 0);
      const totalValue = managers.reduce((sum, manager) => sum + manager.valorActual, 0);
      return weightedSum / totalValue;
    };
    const combine = (id, nom, value, ids) => ({
      id,
      nom,
      tipus: "RV+RF",
      valorActual: value,
      ytd: weightedManagerMetric(ids, "ytd"),
      r2025: weightedManagerMetric(ids, "r2025"),
      r2024: weightedManagerMetric(ids, "r2024"),
      rendPct: weightedManagerMetric(ids, "rendPct"),
    });
    return [
      combine("caixa", "CaixaBank", currentManagerValues.caixa, ["caixa-rv", "caixa-rf"]),
      combine("ubs", "UBS", currentManagerValues.ubs, ["ubs-rv", "ubs-rf"]),
      { id: "creditSuisse", nom: "Credit Suisse", gestor: "Credit Suisse", tipus: "RV+RF", valorActual: currentManagerValues.creditSuisse, rendPct: null, ytd: null, r2025: null, r2024: null },
      { ...PM_MANAGERS.find((manager) => manager.id === "abel"), id: "abel", nom: "Bankinter", valorActual: currentManagerValues.abel },
      { ...PM_MANAGERS.find((manager) => manager.id === "andbank"), id: "andbank", nom: "WAM–Andbank", valorActual: currentManagerValues.andbank },
      { id: "jpmorgan", nom: "JPMorgan", gestor: "JPMorgan", tipus: "RV", valorActual: currentManagerValues.jpmorgan, rendPct: null, ytd: null, r2025: null, r2024: null },
      { id: "altres", nom: "Altres / no assignat", gestor: null, tipus: "RV+RF", valorActual: currentManagerValues.altres + residualValue, rendPct: null, ytd: null, r2025: null, r2024: null },
    ];
  }, [currentManagerValues, residualValue]);

  const providerData = useMemo(() => (
    PERIODS.map(({ field, label }) => {
      const point = { year: label };
      displayManagers.forEach((manager) => {
        if (manager[field] != null) point[manager.id] = parseFloat(manager[field].toFixed(2));
      });
      return point;
    })
  ), [displayManagers]);

  const strategyData = useMemo(() => (
    PERIODS.map(({ field, label }) => ({
      year: label,
      rv: weightedReturn(field, managerValueByIdForReturns, "RV"),
      rf: weightedReturn(field, managerValueByIdForReturns, "RF"),
      total: weightedReturn(field, managerValueByIdForReturns),
    }))
  ), [managerValueByIdForReturns]);

  const totalValueSeries = monthlyPortfolioValueSeries;
  const custodianValueByMonth = useMemo(() => new Map(monthlyCustodianValueSeries.map((row) => [row.date, row])), [monthlyCustodianValueSeries]);
  const typeValueByMonth = useMemo(() => new Map(monthlyTypeValueSeries.map((row) => [row.date, row])), [monthlyTypeValueSeries]);

  const chartData = useMemo(() => {
    if (chartView === "total") {
      const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
      return chartMonths.map((month) => ({ month, total: totalByMonth.get(month) ?? null }));
    }
    if (chartView === "actiu") {
      const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
      return chartMonths.map((month) => {
        const tipus = typeValueByMonth.get(month) ?? {};
        const rv = tipus.rv ?? 0;
        const rf = tipus.rf ?? 0;
        const totalValue = totalByMonth.get(month) ?? null;
        const altres = totalValue == null ? null : Math.max(totalValue - rv - rf, 0);
        return { month, rv, rf, altres };
      });
    }

    const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
    return chartMonths.map((month) => {
      const custodian = custodianValueByMonth.get(month) ?? {};
      const caixa = custodian.caixa ?? 0;
      const ubs = custodian.ubs ?? 0;
      const creditSuisse = custodian.creditSuisse ?? 0;
      const bankinter = custodian.bankinter ?? 0;
      const interactiveBrokers = custodian.interactiveBrokers ?? 0;
      const andbank = custodian.andbank ?? 0;
      const jpmorgan = custodian.jpmorgan ?? 0;
      const totalValue = totalByMonth.get(month) ?? null;
      const altres = totalValue == null ? null : Math.max(totalValue - caixa - ubs - creditSuisse - bankinter - interactiveBrokers - andbank - jpmorgan, 0);
      return { month, caixa, ubs, creditSuisse, bankinter, interactiveBrokers, andbank, jpmorgan, altres };
    });
  }, [chartMonths, chartView, custodianValueByMonth, totalValueSeries, typeValueByMonth]);

  const txCustodians = useMemo(() => (
    [...new Set(PM_TRANSACTIONS.map((tx) => tx.custodian).filter(Boolean))].sort()
  ), []);

  const txFiltered = useMemo(() => {
    let rows = PM_TRANSACTIONS;
    if (txActionFilter !== "all") rows = rows.filter((tx) => tx.action === txActionFilter);
    if (txCustodianFilter !== "all") rows = rows.filter((tx) => tx.custodian === txCustodianFilter);
    return rows;
  }, [txActionFilter, txCustodianFilter]);

  const txByMonth = useMemo(() => {
    const grouped = new Map();
    txFiltered.forEach((tx) => {
      const key = tx.date ? tx.date.slice(0, 7) : "????-??";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(tx);
    });
    return [...grouped.entries()].sort(([a], [b]) => {
      if (a === "????-??") return 1;
      if (b === "????-??") return -1;
      return b.localeCompare(a);
    });
  }, [txFiltered]);

  const card = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const secLabel = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PublicMarketsSummarySection
        tc={tc}
        dark={dark}
        card={card}
        secLabel={secLabel}
        total={total}
        totalRV={totalRV}
        totalRF={totalRF}
        ytdWeighted={ytdWeighted}
        portfolioTWR={portfolioTWR}
        portfolioMWR={portfolioMWR}
        providerData={providerData}
        strategyData={strategyData}
        displayManagers={displayManagers}
        chartView={chartView}
        setChartView={setChartView}
        chartData={chartData}
        flowGroupBy={flowGroupBy}
        setFlowGroupBy={setFlowGroupBy}
        totalValueSeries={totalValueSeries}
        reportStartMonth={reportStartMonth}
        transactions={PM_TRANSACTIONS}
      />

      <PublicMarketsTablesSection
        tc={tc}
        dark={dark}
        secLabel={secLabel}
        vehicleTraceabilityRows={vehicleTraceabilityRows}
        displayManagers={displayManagers}
        expanded={expanded}
        toggleExpand={toggleExpand}
      />

      <PublicMarketsTransactionsSection
        tc={tc}
        dark={dark}
        txFiltered={txFiltered}
        transactionCount={PM_TRANSACTIONS.length}
        txCustodians={txCustodians}
        txActionFilter={txActionFilter}
        setTxActionFilter={setTxActionFilter}
        txCustodianFilter={txCustodianFilter}
        setTxCustodianFilter={setTxCustodianFilter}
        openTxMonths={openTxMonths}
        toggleTxMonth={toggleTxMonth}
        txByMonth={txByMonth}
        setMercatsPublicsTab={setMercatsPublicsTab}
      />
    </div>
  );
}
