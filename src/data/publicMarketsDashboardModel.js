import { canonicalPmCustodian, isEtfPosition, splitIbPositions } from "./pmClassification.js";
import { rendToPercent, isPercentFormPosition } from "./pmReturns.js";

export const DEFAULT_PM_WORKBOOK_TOTAL_MONTH = "2026-04";
export const PM_CUSTODIAN_GROUPS = ["caixa", "ubs", "bankinter", "ib", "jpmorgan", "andbank", "altres"];
export const PM_TYPE_GROUPS = ["rv", "rf", "altres"];

export function pmMonthlyTotal(row = {}) {
  return (row.caixaRV ?? 0)
    + (row.caixaRF ?? 0)
    + (row.ubsRV ?? 0)
    + (row.ubsRF ?? 0)
    + (row.abelBK ?? 0)
    + (row.andbank ?? 0);
}

export function groupPmCustodian(position = null) {
  const custodian = String(position?.custodian ?? "").trim();
  if (custodian === "CaixaBank") return "caixa";
  if (canonicalPmCustodian(custodian) === "UBS") return "ubs";
  if (custodian === "Bankinter") return "bankinter";
  if (custodian === "Interactive Brokers") return "ib";
  if (custodian === "JPMorgan") return "jpmorgan";
  if (custodian === "Andbank" || custodian === "WAM") return "andbank";
  return "altres";
}

export function groupPmAssetType(position = null) {
  const tipus = String(position?.tipus ?? "").trim().toUpperCase();
  if (tipus === "RV") return "rv";
  if (tipus === "RF") return "rf";
  return "altres";
}

export function latestSeriesValue(series = []) {
  for (let i = (series?.length ?? 0) - 1; i >= 0; i -= 1) {
    const value = Number(series[i]?.value);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function latestPositionValue(position, pmValues) {
  const byCustodian = pmValues?.[position?.isin];
  const series = byCustodian?.[position?.custodian];
  return latestSeriesValue(series) ?? (Number(position?.valorMercat) || 0);
}

export function buildCustodianPositions(pmPositions = [], wamPositions = []) {
  return {
    caixa: pmPositions.filter(p => p.custodian === "CaixaBank"),
    ubs: pmPositions.filter(p => canonicalPmCustodian(p.custodian) === "UBS"),
    bankinter: pmPositions.filter(p => p.custodian === "Bankinter"),
    ib: pmPositions.filter(p => p.custodian === "Interactive Brokers"),
    jpmorgan: pmPositions.filter(p => p.custodian === "JPMorgan"),
    andbank: wamPositions,
    altres: [],
  };
}

export function buildCurrentManagerValues(latestPmSummary, custodianPositions) {
  const bankinterVal = (custodianPositions.bankinter ?? []).reduce((s, p) => s + (p.valorMercat ?? 0), 0);
  const ibVal = (custodianPositions.ib ?? []).reduce((s, p) => s + (p.valorMercat ?? 0), 0);
  return {
    caixa: latestPmSummary.byManager.caixa ?? 0,
    ubs: latestPmSummary.byManager.ubs ?? 0,
    abel: latestPmSummary.byManager.abel ?? 0,
    bankinter: bankinterVal,
    ib: ibVal,
    andbank: latestPmSummary.byManager.andbank ?? 0,
    jpmorgan: latestPmSummary.byManager.jpmorgan ?? 0,
    altres: latestPmSummary.byManager.altres ?? 0,
  };
}

export function buildManagerValueByIdForReturns(currentManagerValues, effectiveManagers) {
  const result = {
    abel: currentManagerValues.abel,
    andbank: currentManagerValues.andbank,
  };
  const allocateGroup = (ids, totalValue) => {
    const managers = ids.map((id) => effectiveManagers.find((m) => m.id === id)).filter(Boolean);
    const baseTotal = managers.reduce((sum, m) => sum + (Number(m.valorActual) || 0), 0);
    managers.forEach((m) => {
      const weight = baseTotal > 0 ? (Number(m.valorActual) || 0) / baseTotal : 0;
      result[m.id] = totalValue * weight;
    });
  };
  allocateGroup(["caixa-rv", "caixa-rf"], currentManagerValues.caixa);
  allocateGroup(["ubs-rv", "ubs-rf"], currentManagerValues.ubs);
  return result;
}

export function calculatePortfolioTwr(reportMonthly = []) {
  let cumulative = 1;
  for (let i = 1; i < reportMonthly.length; i += 1) {
    const prev = reportMonthly[i - 1];
    const curr = reportMonthly[i];
    const prevValue = pmMonthlyTotal(prev) - (prev.andbank ?? 0);
    const inceptionCF = prev.abelBK == null && curr.abelBK != null ? curr.abelBK : 0;
    const midPeriodCF = curr.cashflows?.abelBK ?? 0;
    const cashflow = inceptionCF + midPeriodCF;
    const denominator = prevValue + inceptionCF + 0.5 * midPeriodCF;
    if (denominator <= 0) continue;
    const currValue = pmMonthlyTotal(curr) - (curr.andbank ?? 0);
    cumulative *= 1 + (currValue - prevValue - cashflow) / denominator;
  }
  return (cumulative - 1) * 100;
}

export function calculatePortfolioMwr(reportMonthly = []) {
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
}

function computeWeightedTer(positions) {
  const withTer = (positions ?? []).filter(p => p.costAnual != null);
  if (withTer.length === 0) return null;
  const totalVal = withTer.reduce((s, p) => s + (p.valorMercat ?? 0), 0);
  if (totalVal === 0) return null;
  return withTer.reduce((s, p) => s + (p.costAnual ?? 0) * (p.valorMercat ?? 0), 0) / totalVal;
}

function computePositionWeightedYtd(positions, currentYear = new Date().getFullYear()) {
  const field = `rend${currentYear}`;
  let sum = 0;
  let totalVal = 0;
  for (const p of (positions ?? [])) {
    // Normalize mixed percent/decimal conventions before value-weighting.
    const pct = rendToPercent(p[field], { alwaysPercent: isPercentFormPosition(p) });
    if (pct == null) continue;
    const val = p.valorMercat ?? 0;
    sum += pct * val;
    totalVal += val;
  }
  return totalVal > 0 ? sum / totalVal : null;
}

function computeLastPriceDateForPositions(positions, pmValues) {
  let last = null;
  for (const pos of (positions ?? [])) {
    if (!pos.isin) continue;
    const byCustodian = pmValues?.[pos.isin];
    if (!byCustodian || typeof byCustodian !== "object") continue;
    for (const series of Object.values(byCustodian)) {
      if (!Array.isArray(series)) continue;
      for (let i = series.length - 1; i >= 0; i--) {
        const entry = series[i];
        const date = entry?.date;
        if (date && Number.isFinite(Number(entry?.value))) {
          if (!last || date > last) last = date;
          break;
        }
      }
    }
  }
  return last;
}

const MONTH_ABBR_CA = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];

function mtmStaleness(lastYYYYMM) {
  if (!lastYYYYMM) return { label: "N/D", color: "#8A9BAC", days: null };
  const [y, m] = lastYYYYMM.split("-").map(Number);
  const endOfMonth = new Date(y, m, 0);
  const today = new Date();
  const days = Math.floor((today - endOfMonth) / 86400000);
  const label = `${MONTH_ABBR_CA[m - 1]}. '${String(y).slice(2)}`;
  const color = days <= 15 ? "#28A029" : days <= 30 ? "#E8A020" : "#B52020";
  return { label, color, days };
}

export function buildDisplayManagers({ effectiveManagers = [], currentManagerValues, custodianPositions, liquidityPositions = [], liquidityValue = 0, residualValue = 0, pmValues, currentYear = new Date().getFullYear() }) {
  const weightedManagerMetric = (ids, field) => {
    const managers = ids.map((id) => effectiveManagers.find((m) => m.id === id)).filter((m) => m && m[field] != null);
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
    [`r${currentYear - 1}`]: weightedManagerMetric(ids, `r${currentYear - 1}`),
    [`r${currentYear - 2}`]: weightedManagerMetric(ids, `r${currentYear - 2}`),
    rendPct: weightedManagerMetric(ids, "rendPct"),
  });
  const withMeta = (obj, positions) => ({
    ...obj,
    ter: computeWeightedTer(positions),
    mtm: mtmStaleness(computeLastPriceDateForPositions(positions, pmValues)),
  });
  const abelMgr = effectiveManagers.find((m) => m.id === "abel") ?? {};
  const andbankMgr = effectiveManagers.find((m) => m.id === "andbank") ?? {};
  return [
    withMeta(combine("caixa", "CaixaBank", currentManagerValues.caixa, ["caixa-rv", "caixa-rf"]), custodianPositions.caixa),
    withMeta(combine("ubs", "UBS", currentManagerValues.ubs, ["ubs-rv", "ubs-rf"]), custodianPositions.ubs),
    withMeta({ ...abelMgr, id: "bankinter", nom: "Bankinter", tipus: abelMgr.tipus ?? "RV+RF", valorActual: currentManagerValues.bankinter }, custodianPositions.bankinter),
    withMeta({ id: "ib", nom: "Interactive Brokers", tipus: "RV", valorActual: currentManagerValues.ib, ytd: computePositionWeightedYtd(custodianPositions.ib, currentYear), [`r${currentYear - 1}`]: null, [`r${currentYear - 2}`]: null, rendPct: null }, custodianPositions.ib),
    withMeta({ ...andbankMgr, id: "andbank", nom: "WAM–Andbank", valorActual: currentManagerValues.andbank }, custodianPositions.andbank),
    withMeta({ id: "jpmorgan", nom: "JPMorgan", tipus: "RV", valorActual: currentManagerValues.jpmorgan, rendPct: null, ytd: null, [`r${currentYear - 1}`]: null, [`r${currentYear - 2}`]: null }, custodianPositions.jpmorgan),
    withMeta({ id: "liquidity", nom: "Liquiditat", tipus: "Cash", valorActual: liquidityValue, rendPct: null, ytd: null, [`r${currentYear - 1}`]: null, [`r${currentYear - 2}`]: null }, liquidityPositions),
    withMeta({ id: "altres", nom: "Excel no assignat", tipus: "RV+RF", valorActual: currentManagerValues.altres + residualValue, rendPct: null, ytd: null, [`r${currentYear - 1}`]: null, [`r${currentYear - 2}`]: null }, custodianPositions.altres),
  ];
}

export function buildTotalValueSeries({ reportMonthly = [], monthlyPortfolioValueSeries = [], workbookTotalRow = null, workbookTotalMonth = DEFAULT_PM_WORKBOOK_TOTAL_MONTH }) {
  const monthlyRows = reportMonthly
    .map(row => ({ date: row.date, value: pmMonthlyTotal(row) }))
    .filter(row => row.date && Number.isFinite(row.value));
  if (monthlyRows.length === 0) return monthlyPortfolioValueSeries;
  const anchor = monthlyRows.find(row => row.date === workbookTotalMonth);
  const workbookResidual = workbookTotalRow && anchor ? Math.max(workbookTotalRow - anchor.value, 0) : 0;
  return monthlyRows.map(row => ({
    date: row.date,
    value: row.value + (workbookResidual > 0 && row.date >= workbookTotalMonth ? workbookResidual : 0),
  }));
}

export function buildPmChartData({ chartView, chartMonths = [], reportMonthly = [], totalValueSeries = [], custodianValueByMonth, custodianPositions, liquidityValue = 0, workbookTotalMonth = DEFAULT_PM_WORKBOOK_TOTAL_MONTH }) {
  const pmByDate = Object.fromEntries(reportMonthly.map(m => [m.date, m]));
  const totalByMonth = new Map(totalValueSeries.map((row) => [row.date, row.value]));
  if (chartView === "total") {
    return chartMonths.map((month) => ({ month, total: totalByMonth.get(month) ?? null }));
  }
  if (chartView === "estrategia") {
    const ratio = (positions, predicate, fallback = 0) => {
      const totalValue = positions.reduce((s, p) => s + (p.valorMercat ?? 0), 0);
      if (totalValue <= 0) return fallback;
      return positions.filter(predicate).reduce((s, p) => s + (p.valorMercat ?? 0), 0) / totalValue;
    };
    const caixaEtfR = ratio(custodianPositions.caixa, isEtfPosition);
    const bkEtfR = ratio(custodianPositions.bankinter, isEtfPosition, 1);
    const ubsEtfR = ratio(custodianPositions.ubs, isEtfPosition);
    const jpmEtfR = ratio(custodianPositions.jpmorgan, isEtfPosition);
    const { etfs: ibEtfs, stocks: ibStocks } = splitIbPositions(custodianPositions.ib);
    const ibTotal = [...ibEtfs, ...ibStocks].reduce((s, p) => s + (p.valorMercat ?? 0), 0);
    const ibEtfR = ibTotal > 0 ? ibEtfs.reduce((s, p) => s + (p.valorMercat ?? 0), 0) / ibTotal : 0;
    return chartMonths.map((month) => {
      const custodian = custodianValueByMonth.get(month) ?? {};
      const caixa = custodian.caixa ?? 0;
      const bk = custodian.bankinter ?? 0;
      const ubs = custodian.ubs ?? 0;
      const jpmorgan = custodian.jpmorgan ?? 0;
      const pm = pmByDate[month];
      const wam = pm?.andbank ?? 0;
      const abelBK = pm?.abelBK ?? null;
      const ib = abelBK != null ? Math.max(abelBK - bk, 0) : 0;
      const etfCaixa = caixa * caixaEtfR;
      const etfBankinter = bk * bkEtfR;
      const etfAltres = ubs * ubsEtfR + jpmorgan * jpmEtfR + ib * ibEtfR;
      const fgp = caixa * (1 - caixaEtfR) + bk * (1 - bkEtfR) + ubs * (1 - ubsEtfR) + jpmorgan * (1 - jpmEtfR);
      const accions = ib * (1 - ibEtfR);
      const liquiditat = month >= workbookTotalMonth ? liquidityValue : 0;
      const assigned = etfCaixa + etfBankinter + etfAltres + fgp + wam + accions + liquiditat;
      const altres = Math.max((totalByMonth.get(month) ?? assigned) - assigned, 0);
      return { month, etfCaixa, etfBankinter, etfAltres, fgp, wam, accions, liquiditat, altres };
    });
  }
  return chartMonths.map((month) => {
    const custodian = custodianValueByMonth.get(month) ?? {};
    const caixa = custodian.caixa ?? 0;
    const ubs = custodian.ubs ?? 0;
    const bankinter = custodian.bankinter ?? 0;
    const jpmorgan = custodian.jpmorgan ?? 0;
    const pm = pmByDate[month];
    const andbank = pm?.andbank ?? (custodian.andbank ?? 0);
    const abelBK = pm?.abelBK ?? null;
    const interactiveBrokers = abelBK != null ? Math.max(abelBK - bankinter, 0) : (custodian.ib ?? 0);
    const liquiditat = month >= workbookTotalMonth ? liquidityValue : 0;
    const totalValue = totalByMonth.get(month) ?? null;
    const altres = totalValue == null ? null : Math.max(totalValue - caixa - ubs - bankinter - interactiveBrokers - andbank - jpmorgan - liquiditat, 0);
    return { month, caixa, ubs, bankinter, interactiveBrokers, andbank, jpmorgan, liquiditat, altres };
  });
}

export function buildPmBucketValues({ pmPositions = [], pmValues, custodianPositions, currentManagerValues, liquidityValue = 0, residualValue = 0 }) {
  const { stocks: ibStocks } = splitIbPositions(custodianPositions.ib);
  const valueOf = (positions) => positions.reduce((s, p) => s + latestPositionValue(p, pmValues), 0);
  const isCaixa = p => p.custodian === "CaixaBank";
  const isBankinter = p => p.custodian === "Bankinter";
  const etfCaixa = pmPositions.filter(p => isEtfPosition(p) && isCaixa(p));
  const etfBankinter = pmPositions.filter(p => isEtfPosition(p) && isBankinter(p));
  const etfAltres = pmPositions.filter(p => isEtfPosition(p) && !isCaixa(p) && !isBankinter(p));
  const fgp = pmPositions.filter(p => p.custodian !== "Interactive Brokers" && !isEtfPosition(p));
  return {
    etfCaixa: valueOf(etfCaixa),
    etfBankinter: valueOf(etfBankinter),
    etfAltres: valueOf(etfAltres),
    fgp: valueOf(fgp),
    rfWam: currentManagerValues.andbank,
    accionsIB: valueOf(ibStocks),
    liquiditat: liquidityValue,
    residualExcel: Math.max(residualValue, 0),
  };
}

// How many trailing years the per-year returns table shows (current year + 3 prior).
export const PM_RETURN_YEAR_WINDOW = 4;

export function buildPmBucketReturns({ pmPositions = [], wamPositions = [], currentYear = new Date().getFullYear(), years } = {}) {
  const resolvedYears = years ?? Array.from(
    { length: PM_RETURN_YEAR_WINDOW },
    (_, i) => currentYear - (PM_RETURN_YEAR_WINDOW - 1) + i,
  );
  const wamIds = new Set(wamPositions.map(p => p.id ?? p.isin));
  function wavg(positions, field) {
    let sum = 0, w = 0;
    for (const p of positions) {
      const alwaysPercent = wamIds.has(p.id ?? p.isin) || field === "rendInici" || isPercentFormPosition(p);
      const pct = rendToPercent(p[field], { alwaysPercent });
      if (pct == null) continue;
      sum += pct * (p.valorMercat ?? 0);
      w += (p.valorMercat ?? 0);
    }
    return w > 0 ? sum / w : null;
  }
  const { stocks: ibStocks } = splitIbPositions(pmPositions.filter(p => p.custodian === "Interactive Brokers"));
  const buckets = [
    { id: "etf-caixa", label: "ETFs CaixaBank", positions: pmPositions.filter(p => p.custodian === "CaixaBank" && isEtfPosition(p)) },
    { id: "etf-bankinter", label: "ETFs Bankinter", positions: pmPositions.filter(p => p.custodian === "Bankinter" && isEtfPosition(p)) },
    { id: "etf-altres", label: "ETFs Altres", positions: pmPositions.filter(p => p.custodian !== "CaixaBank" && p.custodian !== "Bankinter" && isEtfPosition(p)) },
    { id: "fgp", label: "Fons Gestió Pròpia", positions: pmPositions.filter(p => p.custodian !== "Interactive Brokers" && !isEtfPosition(p)) },
    { id: "rf-wam", label: "Renda Fixa – WAM", positions: wamPositions },
    { id: "accions-ib", label: "Accions – IB", positions: ibStocks },
  ].filter(bucket => bucket.positions.length > 0);
  return buckets.map(b => ({
    ...b,
    years: Object.fromEntries(resolvedYears.map(y => [y, wavg(b.positions, `rend${y}`)])),
    inici: wavg(b.positions, "rendInici"),
  }));
}

export function buildCurrentYearMonthlyReturns({ currentYear = new Date().getFullYear(), allPriceSeries = {}, pmPositions = [], custodianPositions, reportMonthly = [], workbookTotalMonth = DEFAULT_PM_WORKBOOK_TOTAL_MONTH }) {
  const baseMonthKey = `${currentYear - 1}-12`;
  const etfCaixaPos = custodianPositions.caixa.filter(p => isEtfPosition(p) && p.isin && p.unitats);
  const etfBankinterPos = custodianPositions.bankinter.filter(p => isEtfPosition(p) && p.isin && p.unitats);
  const etfAltresPos = pmPositions.filter(p => p.custodian !== "CaixaBank" && p.custodian !== "Bankinter" && p.custodian !== "Interactive Brokers" && isEtfPosition(p) && p.isin && p.unitats);
  const fgpPos = pmPositions.filter(p => p.custodian !== "Interactive Brokers" && !isEtfPosition(p) && p.isin && p.unitats);
  const bkAllPos = custodianPositions.bankinter.filter(p => p.isin && p.unitats);
  function valueAt(positions, monthKey) {
    return positions.reduce((sum, pos) => {
      const series = allPriceSeries[pos.isin];
      const entry = series?.find(([m]) => m === monthKey);
      return sum + (entry != null ? entry[1] * pos.unitats : (pos.valorMercat ?? 0));
    }, 0);
  }
  const pmByDate = Object.fromEntries(reportMonthly.map(m => [m.date, m]));
  const { etfs: ibEtfs, stocks: ibStocks } = splitIbPositions(custodianPositions.ib);
  const ibCurrentTotal = [...ibEtfs, ...ibStocks].reduce((s, p) => s + (p.valorMercat ?? 0), 0);
  const ibEtfRatio = ibCurrentTotal > 0 ? ibEtfs.reduce((s, p) => s + (p.valorMercat ?? 0), 0) / ibCurrentTotal : 0;
  const etfCaixaBase = valueAt(etfCaixaPos, baseMonthKey);
  const etfBankinterBase = valueAt(etfBankinterPos, baseMonthKey);
  const etfAltresBase = valueAt(etfAltresPos, baseMonthKey);
  const fgpBase = valueAt(fgpPos, baseMonthKey);
  const wamBase = pmByDate[baseMonthKey]?.andbank ?? 0;
  const abelBase = pmByDate[baseMonthKey]?.abelBK ?? 0;
  const bkAllBase = valueAt(bkAllPos, baseMonthKey);
  const ibBase = Math.max(abelBase - bkAllBase, 0);
  const ibEtfBase = ibBase * ibEtfRatio;
  const ibStockBase = ibBase * (1 - ibEtfRatio);
  const totalBase = etfCaixaBase + etfBankinterBase + etfAltresBase + ibEtfBase + fgpBase + wamBase + ibStockBase;
  if (totalBase <= 0) return [];
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const endMonth = curMonth < workbookTotalMonth ? curMonth : workbookTotalMonth;
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
    .map(mm => `${currentYear}-${mm}`)
    .filter(m => m <= endMonth);
  let ibCum = 1;
  let prevIbRaw = ibBase;
  const ibTwrMap = {};
  for (const monthKey of months) {
    const pm = pmByDate[monthKey];
    if (!pm?.abelBK) { ibTwrMap[monthKey] = null; continue; }
    const currBkAll = valueAt(bkAllPos, monthKey);
    const currIbRaw = pm.abelBK - currBkAll;
    const cf = pm.cashflows?.abelBK ?? 0;
    const denom = prevIbRaw + cf;
    if (denom > 0) ibCum *= (1 + (currIbRaw - prevIbRaw - cf) / denom);
    ibTwrMap[monthKey] = ibBase > 0 ? (ibCum - 1) * 100 : null;
    prevIbRaw = currIbRaw;
  }
  return months.map(monthKey => {
    const etfCaixaVal = valueAt(etfCaixaPos, monthKey);
    const etfBankinterVal = valueAt(etfBankinterPos, monthKey);
    const etfAltresVal = valueAt(etfAltresPos, monthKey);
    const fgpVal = valueAt(fgpPos, monthKey);
    const pm = pmByDate[monthKey];
    const wamVal = pm?.andbank ?? null;
    const ibRet = ibTwrMap[monthKey];
    const ibEstV = ibBase > 0 && ibRet != null ? ibBase * (1 + ibRet / 100) : ibBase;
    const ibEtfV = ibEstV * ibEtfRatio;
    const ibStockV = ibEstV * (1 - ibEtfRatio);
    const etfAltresCombinedBase = etfAltresBase + ibEtfBase;
    const etfAltresCombinedVal = etfAltresVal + ibEtfV;
    const totVal = etfCaixaVal + etfBankinterVal + etfAltresCombinedVal + fgpVal + (wamVal ?? wamBase) + ibStockV;
    return {
      date: monthKey,
      etfCaixa: etfCaixaBase > 0 ? (etfCaixaVal - etfCaixaBase) / etfCaixaBase * 100 : null,
      etfBankinter: etfBankinterBase > 0 ? (etfBankinterVal - etfBankinterBase) / etfBankinterBase * 100 : null,
      etfAltres: etfAltresCombinedBase > 0 ? (etfAltresCombinedVal - etfAltresCombinedBase) / etfAltresCombinedBase * 100 : null,
      fgp: fgpBase > 0 ? (fgpVal - fgpBase) / fgpBase * 100 : null,
      wam: wamBase > 0 && wamVal != null ? (wamVal - wamBase) / wamBase * 100 : null,
      accions: ibStockBase > 0 ? (ibStockV - ibStockBase) / ibStockBase * 100 : null,
      total: (totVal - totalBase) / totalBase * 100,
    };
  });
}