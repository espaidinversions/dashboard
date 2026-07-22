import { useMemo, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { ALL_PRICE_SERIES } from "../data/allPrices.js";
import { summarizeLatestPmValuesWithWam } from "../data/pmValueUtils.js";
import { buildGroupedMonthlySeriesFromNestedValues, buildMonthlySeriesFromNestedValues } from "../chartSeries.js";
import {
  weightedReturn,
  computeWeightedTer,
  computePositionWeightedYtd,
  computeLastPriceDateForPositions,
  mtmStaleness,
  isEtfPosition,
} from "./publicMarkets/PublicMarketsShared.jsx";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { canonicalPmCustodian, splitIbPositions } from "../data/pmClassification.js";
import { loadPMOverrides, loadLiquidityAccounts } from "../db.js";
import { usePmMonthly, applyManagerOverrides } from "./hooks/usePmMonthly.js";
import { PublicMarketsSummarySection } from "./publicMarkets/PublicMarketsSummarySection.jsx";
import { PublicMarketsTablesSection } from "./publicMarkets/PublicMarketsTablesSection.jsx";

const PM_VALUES = PM_MODEL.series.values;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
const PM_MANAGERS = PM_MODEL.metadata.managers;
const PM_LIQUIDITY_POSITIONS = PM_MODEL.holdings.liquidity ?? [];

// Interactive Brokers is shown separately as "ib" for custody analytics.
const CUSTODIAN_GROUPS = ["caixa", "ubs", "bankinter", "ib", "jpmorgan", "andbank", "altres"];
const TYPE_GROUPS = ["rv", "rf", "altres"];
const WORKBOOK_TOTAL_MONTH = "2026-04";

function pmMonthlyTotal(row = {}) {
  return (row.caixaRV ?? 0)
    + (row.caixaRF ?? 0)
    + (row.ubsRV ?? 0)
    + (row.ubsRF ?? 0)
    + (row.abelBK ?? 0)
    + (row.andbank ?? 0);
}

// Pre-filter positions by custodian for reuse across memos (module-level, stable reference).
const _custodianPositions = {
  caixa:     PM_POSITIONS.filter(p => p.custodian === "CaixaBank"),
  ubs:       PM_POSITIONS.filter(p => canonicalPmCustodian(p.custodian) === "UBS"),
  bankinter: PM_POSITIONS.filter(p => p.custodian === "Bankinter"),
  ib:        PM_POSITIONS.filter(p => p.custodian === "Interactive Brokers"),
  jpmorgan:  PM_POSITIONS.filter(p => p.custodian === "JPMorgan"),
  andbank:   WAM_POSITIONS,
  altres:    [],
};

function groupPmCustodian(position = null) {
  const custodian = String(position?.custodian ?? "").trim();
  if (custodian === "CaixaBank") return "caixa";
  if (canonicalPmCustodian(custodian) === "UBS") return "ubs";
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

function latestSeriesValue(series = []) {
  for (let i = (series?.length ?? 0) - 1; i >= 0; i -= 1) {
    const value = Number(series[i]?.value);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function latestPositionValue(position) {
  const byCustodian = PM_VALUES[position?.isin];
  const series = byCustodian?.[position?.custodian];
  return latestSeriesValue(series) ?? (Number(position?.valorMercat) || 0);
}

export function PublicMarketsTab() {
  const { tc, dark } = useTheme();
  const [chartView, setChartView] = useState("total");
  const [expanded, setExpanded] = useState(new Set());
  const [flowGroupBy, setFlowGroupBy] = useState("total");
  const [manualTxs, setManualTxs] = useState([]);
  const [tableLiquidity, setTableLiquidity] = useState([]);
  const { monthly: pmMonthly, managerOverrides } = usePmMonthly();
  const reportMonthly = useMemo(
    () => (pmMonthly ?? []).filter((month) => month.date <= WORKBOOK_TOTAL_MONTH),
    [pmMonthly]
  );
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

  // Cross-section liquidity: once Mercats Públics bank accounts exist in the
  // Supabase liquidity_accounts table, they become the source of truth for PM's
  // liquidity. Until then, PM falls back to the generated PM_LIQUIDITY_POSITIONS.
  useEffect(() => {
    loadLiquidityAccounts()
      .then((accounts) => setTableLiquidity((accounts ?? []).filter((a) => a.section === "mercats-publics")))
      .catch(console.error);
  }, []);

  const usingTableLiquidity = tableLiquidity.length > 0;
  const liquidityPositions = useMemo(
    () => usingTableLiquidity
      ? tableLiquidity.map((a) => ({ id: a.id, nom: a.nom, custodian: a.banc ?? null, valorMercat: Number(a.saldo) || 0 }))
      : PM_LIQUIDITY_POSITIONS,
    [usingTableLiquidity, tableLiquidity],
  );

  const allTransactions = useMemo(() => {
    const staticIds = new Set(PM_TRANSACTIONS.map(t => t.id));
    const extras = manualTxs.filter(t => !staticIds.has(t.id));
    return [...PM_TRANSACTIONS, ...extras];
  }, [manualTxs]);

  const latestPmSummary = useMemo(
    () => summarizeLatestPmValuesWithWam(PM_VALUES, PM_POSITIONS, WAM_POSITIONS),
    []
  );
  const workbookTotalRow = Number(PM_MODEL.metadata?.totals?.workbookRow) || null;

  const currentManagerValues = useMemo(() => {
    const bankinterVal = _custodianPositions.bankinter
      .reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const ibVal = _custodianPositions.ib
      .reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    return {
      caixa:     latestPmSummary.byManager.caixa ?? 0,
      ubs:       latestPmSummary.byManager.ubs ?? 0,
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

  const total = workbookTotalRow && workbookTotalRow > latestPmSummary.total
    ? workbookTotalRow
    : latestPmSummary.total;

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
      ...reportMonthly.map((month) => month.date),
    ]);
    return [...months].filter((month) => month <= WORKBOOK_TOTAL_MONTH).sort();
  }, [monthlyCustodianValueSeries, monthlyPortfolioValueSeries, monthlyTypeValueSeries, reportMonthly]);

  const reportStartMonth = chartMonths[0] ?? "2023-12";

  const ytdWeighted = useMemo(
    () => weightedReturn("ytd", managerValueByIdForReturns, null, effectiveManagers),
    [managerValueByIdForReturns, effectiveManagers]
  );

  const portfolioTWR = useMemo(() => {
    let cumulative = 1;
    for (let i = 1; i < reportMonthly.length; i += 1) {
      const prev = reportMonthly[i - 1];
      const curr = reportMonthly[i];
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
  }, [reportMonthly]);

  const portfolioMWR = useMemo(() => {
    const first = reportMonthly[0];
    const last = reportMonthly[reportMonthly.length - 1];
    if (!first || !last) return null;
    const startValue = (first.caixaRV ?? 0) + (first.caixaRF ?? 0) + (first.ubsRV ?? 0) + (first.ubsRF ?? 0);
    const endValue = (last.caixaRV ?? 0) + (last.caixaRF ?? 0) + (last.ubsRV ?? 0) + (last.ubsRF ?? 0) + (last.abelBK ?? 0);
    const totalMonths = reportMonthly.length - 1;
    const abelIdx = reportMonthly.findIndex((point) => point.abelBK != null);
    if (abelIdx === -1 || totalMonths <= 0) return null;
    const cashflowEntries = [{ amount: reportMonthly[abelIdx].abelBK, idx: abelIdx }];
    reportMonthly.forEach((m, idx) => {
      if (m.cashflows?.abelBK) cashflowEntries.push({ amount: m.cashflows.abelBK, idx });
    });
    const totalCF = cashflowEntries.reduce((s, cf) => s + cf.amount, 0);
    const weightedCF = cashflowEntries.reduce((s, cf) => s + cf.amount * (totalMonths - cf.idx) / totalMonths, 0);
    const totalReturn = (endValue - startValue - totalCF) / (startValue + weightedCF);
    const years = totalMonths / 12;
    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
  }, [reportMonthly]);

  const liquidityValue = liquidityPositions.reduce((sum, row) => sum + (Number(row.valorMercat) || 0), 0);
  const residualValue = total - (
    liquidityValue +
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
        id: "liquidity",
        nom: "Liquiditat",
        tipus: "Cash",
        valorActual: liquidityValue,
        rendPct: null,
        ytd: null,
        [`r${_cy - 1}`]: null,
        [`r${_cy - 2}`]: null,
      }, liquidityPositions),
      withMeta({
        id: "altres",
        nom: "Excel no assignat",
        tipus: "RV+RF",
        valorActual: currentManagerValues.altres + residualValue,
        rendPct: null,
        ytd: null,
        [`r${_cy - 1}`]: null,
        [`r${_cy - 2}`]: null,
      }, _custodianPositions.altres),
    ];
  }, [currentManagerValues, residualValue, liquidityValue, liquidityPositions, effectiveManagers]);


  const totalValueSeries = useMemo(() => {
    const monthlyRows = (reportMonthly ?? [])
      .map(row => ({ date: row.date, value: pmMonthlyTotal(row) }))
      .filter(row => row.date && Number.isFinite(row.value));
    if (monthlyRows.length === 0) return monthlyPortfolioValueSeries;

    const anchor = monthlyRows.find(row => row.date === WORKBOOK_TOTAL_MONTH);
    const workbookResidual = workbookTotalRow && anchor
      ? Math.max(workbookTotalRow - anchor.value, 0)
      : 0;

    return monthlyRows.map(row => ({
      date: row.date,
      value: row.value + (workbookResidual > 0 && row.date >= WORKBOOK_TOTAL_MONTH ? workbookResidual : 0),
    }));
  }, [monthlyPortfolioValueSeries, reportMonthly, workbookTotalRow]);
  const custodianValueByMonth = useMemo(() => new Map(monthlyCustodianValueSeries.map((row) => [row.date, row])), [monthlyCustodianValueSeries]);
  const typeValueByMonth = useMemo(() => new Map(monthlyTypeValueSeries.map((row) => [row.date, row])), [monthlyTypeValueSeries]);

  const chartData = useMemo(() => {
    const pmByDate = Object.fromEntries(reportMonthly.map(m => [m.date, m]));

    if (chartView === "total") {
      const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
      return chartMonths.map((month) => ({ month, total: totalByMonth.get(month) ?? null }));
    }

    if (chartView === "estrategia") {
      const ratio = (positions, predicate, fallback = 0) => {
        const totalValue = positions.reduce((s, p) => s + (p.valorMercat ?? 0), 0);
        if (totalValue <= 0) return fallback;
        return positions.filter(predicate).reduce((s, p) => s + (p.valorMercat ?? 0), 0) / totalValue;
      };
      const caixaEtfR = ratio(_custodianPositions.caixa, isEtfPosition);
      const bkEtfR    = ratio(_custodianPositions.bankinter, isEtfPosition, 1);
      const ubsEtfR   = ratio(_custodianPositions.ubs, isEtfPosition);
      const jpmEtfR   = ratio(_custodianPositions.jpmorgan, isEtfPosition);
      const { etfs: ibEtfs, stocks: ibStocks } = splitIbPositions(_custodianPositions.ib);
      const ibTotal   = [...ibEtfs, ...ibStocks].reduce((s, p) => s + (p.valorMercat ?? 0), 0);
      const ibEtfR    = ibTotal > 0 ? ibEtfs.reduce((s, p) => s + (p.valorMercat ?? 0), 0) / ibTotal : 0;

      const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
      return chartMonths.map((month) => {
        const custodian = custodianValueByMonth.get(month) ?? {};
        const caixa     = custodian.caixa ?? 0;
        const bk        = custodian.bankinter ?? 0;
        const ubs       = custodian.ubs ?? 0;
        const jpmorgan  = custodian.jpmorgan ?? 0;
        const pm        = pmByDate[month];
        const wam       = pm?.andbank ?? 0;
        const abelBK    = pm?.abelBK ?? null;
        const ib        = abelBK != null ? Math.max(abelBK - bk, 0) : 0;
        const etfCaixa      = caixa * caixaEtfR;
        const etfBankinter  = bk * bkEtfR;
        const etfAltres     = ubs * ubsEtfR + jpmorgan * jpmEtfR + ib * ibEtfR;
        const fgp           = caixa * (1 - caixaEtfR) + bk * (1 - bkEtfR) + ubs * (1 - ubsEtfR) + jpmorgan * (1 - jpmEtfR);
        const accions       = ib * (1 - ibEtfR);
        const liquiditat    = month >= WORKBOOK_TOTAL_MONTH ? liquidityValue : 0;
        const assigned      = etfCaixa + etfBankinter + etfAltres + fgp + wam + accions + liquiditat;
        const altres        = Math.max((totalByMonth.get(month) ?? assigned) - assigned, 0);
        return { month, etfCaixa, etfBankinter, etfAltres, fgp, wam, accions, liquiditat, altres };
      });
    }

    // Custodian view: CS merged into UBS; WAM from PM_MONTHLY; IB derived from abelBK - bankinter.
    const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
    return chartMonths.map((month) => {
      const custodian = custodianValueByMonth.get(month) ?? {};
      const caixa     = custodian.caixa ?? 0;
      const ubs       = custodian.ubs ?? 0;
      const bankinter = custodian.bankinter ?? 0;
      const jpmorgan  = custodian.jpmorgan ?? 0;
      const pm        = pmByDate[month];
      const andbank   = pm?.andbank ?? (custodian.andbank ?? 0);
      const abelBK    = pm?.abelBK ?? null;
      const interactiveBrokers = abelBK != null ? Math.max(abelBK - bankinter, 0) : (custodian.ib ?? 0);
      const liquiditat = month >= WORKBOOK_TOTAL_MONTH ? liquidityValue : 0;
      const totalValue = totalByMonth.get(month) ?? null;
      const altres = totalValue == null ? null : Math.max(totalValue - caixa - ubs - bankinter - interactiveBrokers - andbank - jpmorgan - liquiditat, 0);
      return { month, caixa, ubs, bankinter, interactiveBrokers, andbank, jpmorgan, liquiditat, altres };
    });
  }, [chartMonths, chartView, custodianValueByMonth, totalValueSeries, typeValueByMonth, reportMonthly]);

  // ── Bucket KPI values ──────────────────────────────────────────────────────
  const bucketValues = useMemo(() => {
    const { stocks: ibStocks } = splitIbPositions(_custodianPositions.ib);
    const valueOf = (positions) => positions.reduce((s, p) => s + latestPositionValue(p), 0);
    const isCaixa = p => p.custodian === "CaixaBank";
    const isBankinter = p => p.custodian === "Bankinter";
    const etfCaixa = PM_POSITIONS.filter(p => isEtfPosition(p) && isCaixa(p));
    const etfBankinter = PM_POSITIONS.filter(p => isEtfPosition(p) && isBankinter(p));
    const etfAltres = PM_POSITIONS.filter(p => isEtfPosition(p) && !isCaixa(p) && !isBankinter(p));
    const fgp = PM_POSITIONS.filter(p => p.custodian !== "Interactive Brokers" && !isEtfPosition(p));

    return {
      etfCaixa:      valueOf(etfCaixa),
      etfBankinter:  valueOf(etfBankinter),
      etfAltres:     valueOf(etfAltres),
      fgp:           valueOf(fgp),
      rfWam:         currentManagerValues.andbank,
      accionsIB:     valueOf(ibStocks),
      liquiditat:    liquidityValue,
      residualExcel: Math.max(residualValue, 0),
    };
  }, [currentManagerValues, residualValue, liquidityValue]);

  // ── Bucket weighted annual returns ────────────────────────────────────────
  const bucketReturns = useMemo(() => {
    const YEARS = [2023, 2024, 2025, 2026];
    const wamIds = new Set(WAM_POSITIONS.map(p => p.id ?? p.isin));

    function wavg(positions, field) {
      let sum = 0, w = 0;
      for (const p of positions) {
        const v = p[field];
        if (v == null) continue;
        let pct;
        if (wamIds.has(p.id ?? p.isin) || field === "rendInici") {
          pct = v; // WAM always %, rendInici always % for all PM positions
        } else if (Math.abs(v) > 150) {
          continue; // drop data errors (e.g. 544%)
        } else {
          pct = Math.abs(v) > 0.5 ? v : v * 100;
        }
        sum += pct * (p.valorMercat ?? 0);
        w   += (p.valorMercat ?? 0);
      }
      return w > 0 ? sum / w : null;
    }

    const { stocks: ibStocks } = splitIbPositions(_custodianPositions.ib);

    const buckets = [
      { id: "etf-caixa",      label: "ETFs CaixaBank",       positions: PM_POSITIONS.filter(p => p.custodian === "CaixaBank" && isEtfPosition(p)) },
      { id: "etf-bankinter",  label: "ETFs Bankinter",       positions: PM_POSITIONS.filter(p => p.custodian === "Bankinter" && isEtfPosition(p)) },
      { id: "etf-altres",     label: "ETFs Altres",          positions: PM_POSITIONS.filter(p => p.custodian !== "CaixaBank" && p.custodian !== "Bankinter" && isEtfPosition(p)) },
      { id: "fgp",            label: "Fons Gestió Pròpia",   positions: PM_POSITIONS.filter(p => p.custodian !== "Interactive Brokers" && !isEtfPosition(p)) },
      { id: "rf-wam",         label: "Renda Fixa – WAM",     positions: WAM_POSITIONS },
      { id: "accions-ib",     label: "Accions – IB",         positions: ibStocks },
    ].filter(bucket => bucket.positions.length > 0);

    return buckets.map(b => ({
      ...b,
      years: Object.fromEntries(YEARS.map(y => [y, wavg(b.positions, `rend${y}`)])),
      inici: wavg(b.positions, "rendInici"),
    }));
  }, []);

  // ── Monthly cumulative YTD returns per bucket ─────────────────────────────
  const currentYearMonthlyReturns = useMemo(() => {
    const cy = new Date().getFullYear();
    const baseMonthKey = `${cy - 1}-12`;

    const etfCaixaPos = _custodianPositions.caixa.filter(p => isEtfPosition(p) && p.isin && p.unitats);
    const etfBankinterPos = _custodianPositions.bankinter.filter(p => isEtfPosition(p) && p.isin && p.unitats);
    const etfAltresPos = PM_POSITIONS.filter(p => p.custodian !== "CaixaBank" && p.custodian !== "Bankinter" && p.custodian !== "Interactive Brokers" && isEtfPosition(p) && p.isin && p.unitats);
    const fgpPos = PM_POSITIONS.filter(p => p.custodian !== "Interactive Brokers" && !isEtfPosition(p) && p.isin && p.unitats);
    const bkAllPos = _custodianPositions.bankinter.filter(p => p.isin && p.unitats);

    function valueAt(positions, monthKey) {
      return positions.reduce((sum, pos) => {
        const series = ALL_PRICE_SERIES[pos.isin];
        const entry  = series?.find(([m]) => m === monthKey);
        return sum + (entry != null ? entry[1] * pos.unitats : (pos.valorMercat ?? 0));
      }, 0);
    }

    const pmByDate  = Object.fromEntries(reportMonthly.map(m => [m.date, m]));
    const { etfs: ibEtfs, stocks: ibStocks } = splitIbPositions(_custodianPositions.ib);
    const ibCurrentTotal = [...ibEtfs, ...ibStocks].reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const ibEtfRatio = ibCurrentTotal > 0 ? ibEtfs.reduce((s, p) => s + (p.valorMercat ?? 0), 0) / ibCurrentTotal : 0;

    const etfCaixaBase = valueAt(etfCaixaPos, baseMonthKey);
    const etfBankinterBase = valueAt(etfBankinterPos, baseMonthKey);
    const etfAltresBase = valueAt(etfAltresPos, baseMonthKey);
    const fgpBase = valueAt(fgpPos, baseMonthKey);
    const wamBase   = pmByDate[baseMonthKey]?.andbank ?? 0;
    const abelBase  = pmByDate[baseMonthKey]?.abelBK  ?? 0;
    const bkAllBase = valueAt(bkAllPos,  baseMonthKey);
    const ibBase    = Math.max(abelBase - bkAllBase, 0);
    const ibEtfBase = ibBase * ibEtfRatio;
    const ibStockBase = ibBase * (1 - ibEtfRatio);
    const totalBase = etfCaixaBase + etfBankinterBase + etfAltresBase + ibEtfBase + fgpBase + wamBase + ibStockBase;

    if (totalBase <= 0) return [];

    const now      = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const endMonth = curMonth < WORKBOOK_TOTAL_MONTH ? curMonth : WORKBOOK_TOTAL_MONTH;
    const months   = ["01","02","03","04","05","06","07","08","09","10","11","12"]
      .map(mm => `${cy}-${mm}`)
      .filter(m => m <= endMonth);

    // TWR for IB: derived as abelBK − all-Bankinter-ISIN, adjusted for abelBK cashflows
    let ibCum     = 1;
    let prevIbRaw = ibBase;
    const ibTwrMap = {};
    for (const monthKey of months) {
      const pm = pmByDate[monthKey];
      if (!pm?.abelBK) { ibTwrMap[monthKey] = null; continue; }
      const currBkAll = valueAt(bkAllPos, monthKey);
      const currIbRaw = pm.abelBK - currBkAll;
      const cf        = pm.cashflows?.abelBK ?? 0;
      const denom     = prevIbRaw + cf;
      if (denom > 0) ibCum *= (1 + (currIbRaw - prevIbRaw - cf) / denom);
      ibTwrMap[monthKey] = ibBase > 0 ? (ibCum - 1) * 100 : null;
      prevIbRaw = currIbRaw;
    }

    return months.map(monthKey => {
      const etfCaixaVal = valueAt(etfCaixaPos, monthKey);
      const etfBankinterVal = valueAt(etfBankinterPos, monthKey);
      const etfAltresVal = valueAt(etfAltresPos, monthKey);
      const fgpVal = valueAt(fgpPos, monthKey);
      const pm     = pmByDate[monthKey];
      const wamVal = pm?.andbank ?? null;
      const ibRet  = ibTwrMap[monthKey];
      const ibEstV = ibBase > 0 && ibRet != null ? ibBase * (1 + ibRet / 100) : ibBase;
      const ibEtfV = ibEstV * ibEtfRatio;
      const ibStockV = ibEstV * (1 - ibEtfRatio);
      const etfAltresCombinedBase = etfAltresBase + ibEtfBase;
      const etfAltresCombinedVal = etfAltresVal + ibEtfV;
      const totVal = etfCaixaVal + etfBankinterVal + etfAltresCombinedVal + fgpVal + (wamVal ?? wamBase) + ibStockV;

      return {
        date:  monthKey,
        etfCaixa: etfCaixaBase > 0 ? (etfCaixaVal - etfCaixaBase) / etfCaixaBase * 100 : null,
        etfBankinter: etfBankinterBase > 0 ? (etfBankinterVal - etfBankinterBase) / etfBankinterBase * 100 : null,
        etfAltres: etfAltresCombinedBase > 0 ? (etfAltresCombinedVal - etfAltresCombinedBase) / etfAltresCombinedBase * 100 : null,
        fgp:   fgpBase  > 0 ? (fgpVal - fgpBase) / fgpBase * 100 : null,
        wam:   wamBase  > 0 && wamVal != null ? (wamVal - wamBase) / wamBase * 100 : null,
        accions: ibStockBase > 0 ? (ibStockV - ibStockBase) / ibStockBase * 100 : null,
        total: (totVal  - totalBase) / totalBase * 100,
      };
    });
  }, [reportMonthly]);

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
        liquidityAccounts={liquidityPositions}
        bucketReturns={bucketReturns}
        ytdWeighted={ytdWeighted}
        portfolioTWR={portfolioTWR}
        portfolioMWR={portfolioMWR}
        chartView={chartView}
        setChartView={setChartView}
        chartData={chartData}
        flowGroupBy={flowGroupBy}
        setFlowGroupBy={setFlowGroupBy}
        totalValueSeries={totalValueSeries}
        reportStartMonth={reportStartMonth}
        reportEndMonth={WORKBOOK_TOTAL_MONTH}
        transactions={allTransactions}
        currentYearMonthlyReturns={currentYearMonthlyReturns}
      />

      <PublicMarketsTablesSection
        tc={tc}
        dark={dark}
        secLabel={secLabel}
        displayManagers={displayManagers}
        monthly={reportMonthly}
        expanded={expanded}
        toggleExpand={toggleExpand}
      />
    </div>
  );
}
