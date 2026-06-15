import React, { useMemo, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { summarizeLatestPmValues } from "../data/pmValueUtils.js";
import { buildGroupedMonthlySeriesFromNestedValues, buildMonthlySeriesFromNestedValues } from "../chartSeries.js";
import { PERIODS, weightedReturn } from "./publicMarkets/PublicMarketsShared.jsx";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { loadPMOverrides } from "../db.js";
import { usePmMonthly, applyManagerOverrides } from "./hooks/usePmMonthly.js";
import { PublicMarketsSummarySection } from "./publicMarkets/PublicMarketsSummarySection.jsx";
import { PublicMarketsTablesSection } from "./publicMarkets/PublicMarketsTablesSection.jsx";

const PM_VALUES = PM_MODEL.series.values;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
const PM_MANAGERS = PM_MODEL.metadata.managers;
const PM_TOTAL_ACTIVE = PM_MODEL.metadata.totals.active;

const CUSTODIAN_GROUPS = ["caixa", "ubs", "creditSuisse", "bankinter", "interactiveBrokers", "jpmorgan", "andbank", "altres"];
const TYPE_GROUPS = ["rv", "rf", "altres"];

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

export function PublicMarketsTab() {
  const { tc, dark } = useTheme();
  const [chartView, setChartView] = useState("total");
  const [expanded, setExpanded] = useState(new Set());
  const [flowGroupBy, setFlowGroupBy] = useState("total");
  const [manualTxs, setManualTxs] = useState([]);
  const { monthly: pmMonthly, managerOverrides } = usePmMonthly();
  const effectiveManagers = useMemo(
    () => applyManagerOverrides(PM_MANAGERS, managerOverrides),
    [managerOverrides]
  );

  useEffect(() => {
    loadPMOverrides().then(data => {
      if (data?.transactions?.length) setManualTxs(data.transactions);
    });
  }, []);

  const allTransactions = useMemo(() => {
    const staticIds = new Set(PM_TRANSACTIONS.map(t => t.id));
    const extras = manualTxs.filter(t => !staticIds.has(t.id));
    return [...PM_TRANSACTIONS, ...extras];
  }, [manualTxs]);

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
        .map((id) => effectiveManagers.find((manager) => manager.id === id))
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
  }, [currentManagerValues, effectiveManagers]);

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
      ...pmMonthly.map((month) => month.date),
    ]);
    return [...months].sort();
  }, [monthlyCustodianValueSeries, monthlyPortfolioValueSeries, monthlyTypeValueSeries, pmMonthly]);

  const reportStartMonth = chartMonths[0] ?? "2023-12";

  const ytdWeighted = useMemo(
    () => weightedReturn("ytd", managerValueByIdForReturns, null, effectiveManagers),
    [managerValueByIdForReturns, effectiveManagers]
  );

  const portfolioTWR = useMemo(() => {
    let cumulative = 1;
    for (let i = 1; i < pmMonthly.length; i += 1) {
      const prev = pmMonthly[i - 1];
      const curr = pmMonthly[i];
      const prevValue = (prev.caixaRV ?? 0) + (prev.caixaRF ?? 0) + (prev.ubsRV ?? 0) + (prev.ubsRF ?? 0) + (prev.abelBK ?? 0);
      const cashflow = (prev.abelBK == null && curr.abelBK != null ? curr.abelBK : 0) + (curr.cashflows?.abelBK ?? 0);
      const denominator = prevValue + cashflow;
      if (denominator <= 0) continue;
      const currValue = (curr.caixaRV ?? 0) + (curr.caixaRF ?? 0) + (curr.ubsRV ?? 0) + (curr.ubsRF ?? 0) + (curr.abelBK ?? 0);
      cumulative *= 1 + (currValue - prevValue - cashflow) / denominator;
    }
    return (cumulative - 1) * 100;
  }, [pmMonthly]);

  const portfolioMWR = useMemo(() => {
    const first = pmMonthly[0];
    const last = pmMonthly[pmMonthly.length - 1];
    if (!first || !last) return null;
    const startValue = (first.caixaRV ?? 0) + (first.caixaRF ?? 0) + (first.ubsRV ?? 0) + (first.ubsRF ?? 0);
    const endValue = (last.caixaRV ?? 0) + (last.caixaRF ?? 0) + (last.ubsRV ?? 0) + (last.ubsRF ?? 0) + (last.abelBK ?? 0);
    const totalMonths = pmMonthly.length - 1;
    const abelIdx = pmMonthly.findIndex((point) => point.abelBK != null);
    if (abelIdx === -1 || totalMonths <= 0) return null;
    const cashflow = pmMonthly[abelIdx].abelBK;
    const weight = (totalMonths - abelIdx) / totalMonths;
    const totalReturn = (endValue - startValue - cashflow) / (startValue + cashflow * weight);
    const years = totalMonths / 12;
    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
  }, [pmMonthly]);

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
        .map((id) => effectiveManagers.find((manager) => manager.id === id))
        .filter((manager) => manager && manager[field] != null);
      if (managers.length === 0) return null;
      const weightedSum = managers.reduce((sum, manager) => sum + manager[field] * manager.valorActual, 0);
      const totalValue = managers.reduce((sum, manager) => sum + manager.valorActual, 0);
      return weightedSum / totalValue;
    };
    const _cy = new Date().getFullYear();
    const combine = (id, nom, value, ids) => ({
      id,
      nom,
      tipus: "RV+RF",
      valorActual: value,
      ytd: weightedManagerMetric(ids, "ytd"),
      [`r${_cy - 1}`]: weightedManagerMetric(ids, `r${_cy - 1}`),
      [`r${_cy - 2}`]: weightedManagerMetric(ids, `r${_cy - 2}`),
      rendPct: weightedManagerMetric(ids, "rendPct"),
    });
    return [
      combine("caixa", "CaixaBank", currentManagerValues.caixa, ["caixa-rv", "caixa-rf"]),
      combine("ubs", "UBS", currentManagerValues.ubs, ["ubs-rv", "ubs-rf"]),
      { id: "creditSuisse", nom: "Credit Suisse", gestor: "Credit Suisse", tipus: "RV+RF", valorActual: currentManagerValues.creditSuisse, rendPct: null, ytd: null, r2025: null, r2024: null },
      { ...effectiveManagers.find((manager) => manager.id === "abel"), id: "abel", nom: "Bankinter", valorActual: currentManagerValues.abel },
      { ...effectiveManagers.find((manager) => manager.id === "andbank"), id: "andbank", nom: "WAM–Andbank", valorActual: currentManagerValues.andbank },
      { id: "jpmorgan", nom: "JPMorgan", gestor: "JPMorgan", tipus: "RV", valorActual: currentManagerValues.jpmorgan, rendPct: null, ytd: null, r2025: null, r2024: null },
      { id: "altres", nom: "Altres / no assignat", gestor: null, tipus: "RV+RF", valorActual: currentManagerValues.altres + residualValue, rendPct: null, ytd: null, r2025: null, r2024: null },
    ];
  }, [currentManagerValues, residualValue, effectiveManagers]);

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
      rv: weightedReturn(field, managerValueByIdForReturns, "RV", effectiveManagers),
      rf: weightedReturn(field, managerValueByIdForReturns, "RF", effectiveManagers),
      total: weightedReturn(field, managerValueByIdForReturns, null, effectiveManagers),
    }))
  ), [managerValueByIdForReturns, effectiveManagers]);

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
        transactions={allTransactions}
      />

      <PublicMarketsTablesSection
        tc={tc}
        dark={dark}
        secLabel={secLabel}
        displayManagers={displayManagers}
        monthly={pmMonthly}
        expanded={expanded}
        toggleExpand={toggleExpand}
      />
    </div>
  );
}
