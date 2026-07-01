import React, { useMemo, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { summarizeLatestPmValues } from "../data/pmValueUtils.js";
import { buildGroupedMonthlySeriesFromNestedValues, buildMonthlySeriesFromNestedValues } from "../chartSeries.js";
import {
  PERIODS,
  weightedReturn,
  computeWeightedTer,
  computePositionWeightedYtd,
  computeLastPriceDateForPositions,
  mtmStaleness,
  isEtfPosition,
} from "./publicMarkets/PublicMarketsShared.jsx";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { loadPMOverrides } from "../db.js";
import { usePmMonthly, applyManagerOverrides } from "./hooks/usePmMonthly.js";
import { PublicMarketsSummarySection } from "./publicMarkets/PublicMarketsSummarySection.jsx";
import { PublicMarketsTablesSection } from "./publicMarkets/PublicMarketsTablesSection.jsx";

const PM_VALUES = PM_MODEL.series.values;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
const PM_MANAGERS = PM_MODEL.metadata.managers;

// Credit Suisse is merged into UBS; Interactive Brokers renamed to "ib".
const CUSTODIAN_GROUPS = ["caixa", "ubs", "bankinter", "ib", "jpmorgan", "andbank", "altres"];
const TYPE_GROUPS = ["rv", "rf", "altres"];

// Pre-filter positions by custodian for reuse across memos (module-level, stable reference).
const _custodianPositions = {
  caixa:     PM_POSITIONS.filter(p => p.custodian === "CaixaBank"),
  ubs:       PM_POSITIONS.filter(p => p.custodian === "UBS" || p.custodian === "Credit Suisse"),
  bankinter: PM_POSITIONS.filter(p => p.custodian === "Bankinter"),
  ib:        PM_POSITIONS.filter(p => p.custodian === "Interactive Brokers"),
  jpmorgan:  PM_POSITIONS.filter(p => p.custodian === "JPMorgan"),
  andbank:   WAM_POSITIONS,
  altres:    [],
};

function groupPmCustodian(position = null) {
  const custodian = String(position?.custodian ?? "").trim();
  if (custodian === "CaixaBank") return "caixa";
  if (custodian === "UBS" || custodian === "Credit Suisse") return "ubs";
  if (custodian === "Bankinter") return "bankinter";
  if (custodian === "Interactive Brokers") return "ib";
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
    loadPMOverrides()
      .then(data => {
        if (data?.transactions?.length) setManualTxs(data.transactions);
      })
      .catch(console.error);
  }, []);

  const allTransactions = useMemo(() => {
    const staticIds = new Set(PM_TRANSACTIONS.map(t => t.id));
    const extras = manualTxs.filter(t => !staticIds.has(t.id));
    return [...PM_TRANSACTIONS, ...extras];
  }, [manualTxs]);

  const latestPmSummary = useMemo(() => {
    const summary = summarizeLatestPmValues(PM_VALUES, PM_POSITIONS);
    // WAM positions have no PM_VALUES entries — add their static valorMercat directly.
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

  const currentManagerValues = useMemo(() => {
    const bankinterVal = _custodianPositions.bankinter
      .reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const ibVal = _custodianPositions.ib
      .reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    return {
      caixa:     latestPmSummary.byManager.caixa ?? 0,
      ubs:       (latestPmSummary.byManager.ubs ?? 0) + (latestPmSummary.byManager.creditSuisse ?? 0),
      abel:      latestPmSummary.byManager.abel ?? 0, // kept for TWR/returns analytics (Bankinter+IB combined series)
      bankinter: bankinterVal,
      ib:        ibVal,
      andbank:   latestPmSummary.byManager.andbank ?? 0,
      jpmorgan:  latestPmSummary.byManager.jpmorgan ?? 0,
      altres:    latestPmSummary.byManager.altres ?? 0,
    };
  }, [latestPmSummary]);

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
      abel:    currentManagerValues.abel,
      andbank: currentManagerValues.andbank,
    };
    const allocateGroup = (ids, totalValue) => {
      const managers = ids
        .map((id) => effectiveManagers.find((m) => m.id === id))
        .filter(Boolean);
      const baseTotal = managers.reduce((sum, m) => sum + (Number(m.valorActual) || 0), 0);
      managers.forEach((m) => {
        const weight = baseTotal > 0 ? (Number(m.valorActual) || 0) / baseTotal : 0;
        result[m.id] = totalValue * weight;
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
      const inceptionCF = prev.abelBK == null && curr.abelBK != null ? curr.abelBK : 0;
      const midPeriodCF = curr.cashflows?.abelBK ?? 0;
      const cashflow = inceptionCF + midPeriodCF;
      const denominator = prevValue + inceptionCF + 0.5 * midPeriodCF;
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
    const cashflowEntries = [{ amount: pmMonthly[abelIdx].abelBK, idx: abelIdx }];
    pmMonthly.forEach((m, idx) => {
      if (m.cashflows?.abelBK) cashflowEntries.push({ amount: m.cashflows.abelBK, idx });
    });
    const totalCF = cashflowEntries.reduce((s, cf) => s + cf.amount, 0);
    const weightedCF = cashflowEntries.reduce((s, cf) => s + cf.amount * (totalMonths - cf.idx) / totalMonths, 0);
    const totalReturn = (endValue - startValue - totalCF) / (startValue + weightedCF);
    const years = totalMonths / 12;
    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
  }, [pmMonthly]);

  const residualValue = total - (
    currentManagerValues.caixa +
    currentManagerValues.ubs +
    currentManagerValues.bankinter +
    currentManagerValues.ib +
    currentManagerValues.andbank +
    currentManagerValues.jpmorgan +
    currentManagerValues.altres
  );

  const displayManagers = useMemo(() => {
    const _cy = new Date().getFullYear();
    const weightedManagerMetric = (ids, field) => {
      const managers = ids
        .map((id) => effectiveManagers.find((m) => m.id === id))
        .filter((m) => m && m[field] != null);
      if (managers.length === 0) return null;
      const weightedSum = managers.reduce((sum, m) => sum + m[field] * m.valorActual, 0);
      const totalValue = managers.reduce((sum, m) => sum + m.valorActual, 0);
      return weightedSum / totalValue;
    };
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
    // Attach TER + MTM staleness to every custodian row for the table.
    const withMeta = (obj, positions) => ({
      ...obj,
      ter: computeWeightedTer(positions),
      mtm: mtmStaleness(computeLastPriceDateForPositions(positions, PM_VALUES)),
    });
    const abelMgr = effectiveManagers.find((m) => m.id === "abel") ?? {};
    const andbankMgr = effectiveManagers.find((m) => m.id === "andbank") ?? {};
    return [
      withMeta(combine("caixa", "CaixaBank", currentManagerValues.caixa, ["caixa-rv", "caixa-rf"]), _custodianPositions.caixa),
      withMeta(combine("ubs", "UBS", currentManagerValues.ubs, ["ubs-rv", "ubs-rf"]), _custodianPositions.ubs),
      withMeta({
        ...abelMgr,
        id: "bankinter",
        nom: "Bankinter",
        tipus: abelMgr.tipus ?? "RV+RF",
        valorActual: currentManagerValues.bankinter,
      }, _custodianPositions.bankinter),
      withMeta({
        id: "ib",
        nom: "Interactive Brokers",
        tipus: "RV",
        valorActual: currentManagerValues.ib,
        ytd: computePositionWeightedYtd(_custodianPositions.ib),
        [`r${_cy - 1}`]: null,
        [`r${_cy - 2}`]: null,
        rendPct: null,
      }, _custodianPositions.ib),
      withMeta({
        ...andbankMgr,
        id: "andbank",
        nom: "WAM–Andbank",
        valorActual: currentManagerValues.andbank,
      }, _custodianPositions.andbank),
      withMeta({
        id: "jpmorgan",
        nom: "JPMorgan",
        tipus: "RV",
        valorActual: currentManagerValues.jpmorgan,
        rendPct: null,
        ytd: null,
        [`r${_cy - 1}`]: null,
        [`r${_cy - 2}`]: null,
      }, _custodianPositions.jpmorgan),
      withMeta({
        id: "altres",
        nom: "Altres / no assignat",
        tipus: "RV+RF",
        valorActual: currentManagerValues.altres + residualValue,
        rendPct: null,
        ytd: null,
        [`r${_cy - 1}`]: null,
        [`r${_cy - 2}`]: null,
      }, _custodianPositions.altres),
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

    // Custodian view: CS merged into UBS via groupPmCustodian; IB keyed as "ib".
    const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
    return chartMonths.map((month) => {
      const custodian = custodianValueByMonth.get(month) ?? {};
      const caixa     = custodian.caixa ?? 0;
      const ubs       = custodian.ubs ?? 0;
      const bankinter = custodian.bankinter ?? 0;
      const ib        = custodian.ib ?? 0;
      const andbank   = custodian.andbank ?? 0;
      const jpmorgan  = custodian.jpmorgan ?? 0;
      const totalValue = totalByMonth.get(month) ?? null;
      const altres = totalValue == null ? null : Math.max(totalValue - caixa - ubs - bankinter - ib - andbank - jpmorgan, 0);
      return { month, caixa, ubs, bankinter, ib, andbank, jpmorgan, altres };
    });
  }, [chartMonths, chartView, custodianValueByMonth, totalValueSeries, typeValueByMonth]);

  // ── Bucket KPI values ──────────────────────────────────────────────────────
  const bucketValues = useMemo(() => {
    const caixaPos = _custodianPositions.caixa;
    const bkPos    = _custodianPositions.bankinter;

    const caixaEtfMV  = caixaPos.filter(isEtfPosition).reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const caixaFgpMV  = caixaPos.filter(p => !isEtfPosition(p)).reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const caixaTotMV  = caixaEtfMV + caixaFgpMV;
    const caixaEtfR   = caixaTotMV > 0 ? caixaEtfMV / caixaTotMV : 0;

    const bkEtfMV     = bkPos.filter(isEtfPosition).reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const bkFgpMV     = bkPos.filter(p => !isEtfPosition(p)).reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const bkTotMV     = bkEtfMV + bkFgpMV;
    const bkEtfR      = bkTotMV > 0 ? bkEtfMV / bkTotMV : 1;

    return {
      etfs:        currentManagerValues.caixa * caixaEtfR + currentManagerValues.bankinter * bkEtfR,
      fgpCaixa:    currentManagerValues.caixa * (1 - caixaEtfR),
      fgpBankinter: currentManagerValues.bankinter * (1 - bkEtfR),
      rfWam:       currentManagerValues.andbank,
      accionsIB:   currentManagerValues.ib,
    };
  }, [currentManagerValues]);

  // ── Bucket weighted annual returns ────────────────────────────────────────
  const bucketReturns = useMemo(() => {
    const YEARS = [2023, 2024, 2025, 2026];
    const wamIds = new Set(WAM_POSITIONS.map(p => p.id ?? p.isin));

    function wavg(positions, field) {
      let sum = 0, w = 0;
      for (const p of positions) {
        const v = p[field];
        if (v == null) continue;
        const pct = wamIds.has(p.id ?? p.isin) ? v : v * 100;
        sum += pct * (p.valorMercat ?? 0);
        w   += (p.valorMercat ?? 0);
      }
      return w > 0 ? sum / w : null;
    }

    const caixaPos = _custodianPositions.caixa;
    const bkPos    = _custodianPositions.bankinter;

    const buckets = [
      { id: "etfs",          label: "ETFs",                   positions: [...caixaPos.filter(isEtfPosition), ...bkPos.filter(isEtfPosition)] },
      { id: "fgp-caixa",     label: "Fons Gestió Pròpia CB",  positions: caixaPos.filter(p => !isEtfPosition(p)) },
      { id: "fgp-bankinter", label: "Fons Gestió Pròpia BK",  positions: bkPos.filter(p => !isEtfPosition(p)) },
      { id: "rf-wam",        label: "Renda Fixa – WAM",       positions: WAM_POSITIONS },
      { id: "accions-ib",    label: "Accions – IB",           positions: _custodianPositions.ib },
    ];

    return buckets.map(b => ({
      ...b,
      years: Object.fromEntries(YEARS.map(y => [y, wavg(b.positions, `rend${y}`)])),
      inici: wavg(b.positions, "rendInici"),
    }));
  }, []);

  // ── Monthly cumulative YTD returns for current year ────────────────────────
  const currentYearMonthlyReturns = useMemo(() => {
    const cy = new Date().getFullYear();
    const baseRow = pmMonthly.find(m => m.date === `${cy - 1}-12`);
    const baseVal = baseRow
      ? (baseRow.caixaRV ?? 0) + (baseRow.caixaRF ?? 0) + (baseRow.ubsRV ?? 0) + (baseRow.ubsRF ?? 0) + (baseRow.abelBK ?? 0)
      : 0;
    return pmMonthly
      .filter(m => m.date?.startsWith(String(cy)))
      .map(m => {
        const val = (m.caixaRV ?? 0) + (m.caixaRF ?? 0) + (m.ubsRV ?? 0) + (m.ubsRF ?? 0) + (m.abelBK ?? 0);
        return { date: m.date, ret: baseVal > 0 ? (val - baseVal) / baseVal * 100 : null };
      });
  }, [pmMonthly]);

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
        bucketValues={bucketValues}
        bucketReturns={bucketReturns}
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
        currentYearMonthlyReturns={currentYearMonthlyReturns}
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
