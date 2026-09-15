import { useMemo, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { ALL_PRICE_SERIES } from "../data/allPrices.js";
import { summarizeLatestPmValuesWithWam } from "../data/pmValueUtils.js";
import { buildGroupedMonthlySeriesFromNestedValues, buildMonthlySeriesFromNestedValues } from "../chartSeries.js";
import { weightedReturn } from "./publicMarkets/PublicMarketsShared.jsx";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { loadPMOverrides, loadLiquidity } from "../db.js";
import { buildLatestAccounts } from "../data/liquidityModel.js";
import { usePmMonthly, applyManagerOverrides } from "./hooks/usePmMonthly.js";
import { PublicMarketsSummarySection } from "./publicMarkets/PublicMarketsSummarySection.jsx";
import { PublicMarketsTablesSection } from "./publicMarkets/PublicMarketsTablesSection.jsx";
import {
  DEFAULT_PM_WORKBOOK_TOTAL_MONTH,
  PM_CUSTODIAN_GROUPS,
  PM_TYPE_GROUPS,
  buildCurrentManagerValues,
  buildCurrentYearMonthlyReturns,
  buildCustodianPositions,
  buildDisplayManagers,
  buildManagerValueByIdForReturns,
  buildPmBucketReturns,
  buildPmBucketValues,
  buildPmChartData,
  buildTotalValueSeries,
  calculatePortfolioMwr,
  calculatePortfolioTwr,
  groupPmAssetType,
  groupPmCustodian,
} from "../data/publicMarketsDashboardModel.js";

const PM_VALUES = PM_MODEL.series.values;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
const PM_MANAGERS = PM_MODEL.metadata.managers;
const PM_LIQUIDITY_POSITIONS = PM_MODEL.holdings.liquidity ?? [];
const WORKBOOK_TOTAL_MONTH = DEFAULT_PM_WORKBOOK_TOTAL_MONTH;

// Pre-filter positions by custodian for reuse across memos (module-level, stable reference).
const _custodianPositions = buildCustodianPositions(PM_POSITIONS, WAM_POSITIONS);
export function PublicMarketsTab() {
  const { tc, dark } = useTheme();
  const currentYear = new Date().getFullYear();
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
    loadLiquidity()
      .then(({ registry, balances }) =>
        setTableLiquidity(buildLatestAccounts(registry, balances).filter((a) => a.section === "mercats-publics")))
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

  const currentManagerValues = useMemo(
    () => buildCurrentManagerValues(latestPmSummary, _custodianPositions),
    [latestPmSummary]
  );

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

  const managerValueByIdForReturns = useMemo(
    () => buildManagerValueByIdForReturns(currentManagerValues, effectiveManagers),
    [currentManagerValues, effectiveManagers]
  );

  const monthlyPortfolioValueSeries = useMemo(() => (
    buildMonthlySeriesFromNestedValues(PM_VALUES, PM_POSITIONS, { startMonth: "2023-12" })
  ), []);

  const monthlyCustodianValueSeries = useMemo(() => (
    buildGroupedMonthlySeriesFromNestedValues(PM_VALUES, PM_POSITIONS, {
      startMonth: "2023-12",
      groupBy: groupPmCustodian,
      groups: PM_CUSTODIAN_GROUPS,
    })
  ), []);

  const monthlyTypeValueSeries = useMemo(() => (
    buildGroupedMonthlySeriesFromNestedValues(PM_VALUES, PM_POSITIONS, {
      startMonth: "2023-12",
      groupBy: groupPmAssetType,
      groups: PM_TYPE_GROUPS,
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

  const portfolioTWR = useMemo(() => calculatePortfolioTwr(reportMonthly), [reportMonthly]);

  const portfolioMWR = useMemo(() => calculatePortfolioMwr(reportMonthly), [reportMonthly]);

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

  const displayManagers = useMemo(
    () => buildDisplayManagers({
      effectiveManagers,
      currentManagerValues,
      custodianPositions: _custodianPositions,
      liquidityPositions,
      liquidityValue,
      residualValue,
      pmValues: PM_VALUES,
      currentYear,
    }),
    [currentManagerValues, residualValue, liquidityValue, liquidityPositions, effectiveManagers, currentYear]
  );


  const totalValueSeries = useMemo(
    () => buildTotalValueSeries({ reportMonthly, monthlyPortfolioValueSeries, workbookTotalRow, workbookTotalMonth: WORKBOOK_TOTAL_MONTH }),
    [monthlyPortfolioValueSeries, reportMonthly, workbookTotalRow]
  );
  const custodianValueByMonth = useMemo(() => new Map(monthlyCustodianValueSeries.map((row) => [row.date, row])), [monthlyCustodianValueSeries]);

  const chartData = useMemo(
    () => buildPmChartData({
      chartView,
      chartMonths,
      reportMonthly,
      totalValueSeries,
      custodianValueByMonth,
      custodianPositions: _custodianPositions,
      liquidityValue,
      workbookTotalMonth: WORKBOOK_TOTAL_MONTH,
    }),
    [chartMonths, chartView, custodianValueByMonth, totalValueSeries, reportMonthly, liquidityValue]
  );

  const bucketValues = useMemo(
    () => buildPmBucketValues({
      pmPositions: PM_POSITIONS,
      pmValues: PM_VALUES,
      custodianPositions: _custodianPositions,
      currentManagerValues,
      liquidityValue,
      residualValue,
    }),
    [currentManagerValues, residualValue, liquidityValue]
  );

  const bucketReturns = useMemo(
    () => buildPmBucketReturns({ pmPositions: PM_POSITIONS, wamPositions: WAM_POSITIONS, currentYear }),
    [currentYear]
  );

  const currentYearMonthlyReturns = useMemo(
    () => buildCurrentYearMonthlyReturns({
      allPriceSeries: ALL_PRICE_SERIES,
      pmPositions: PM_POSITIONS,
      custodianPositions: _custodianPositions,
      reportMonthly,
      workbookTotalMonth: WORKBOOK_TOTAL_MONTH,
      currentYear,
    }),
    [reportMonthly, currentYear]
  );

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
