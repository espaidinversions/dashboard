export const START_MONTH_2019 = "2019-01";

export const toMonthKey = d => (d ?? "").slice(0, 7);

function nextMonth(month) {
  const [y, mo] = String(month ?? "").split("-").map(Number);
  if (!y || !mo) return null;
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

export function buildMonthRange(startMonth, endMonth) {
  if (!startMonth || !endMonth || startMonth > endMonth) return [];
  const months = [];
  let cur = startMonth;
  while (cur <= endMonth) {
    months.push(cur);
    cur = nextMonth(cur);
    if (!cur) break;
  }
  return months;
}

export function buildMonthGrid({ startMonth = START_MONTH_2019, months = [] } = {}) {
  const keys = new Set(months.filter(Boolean));
  const lastMonth = [...keys].sort().at(-1) ?? startMonth;
  return buildMonthRange(startMonth, lastMonth);
}

export function forwardFillMonthValues(rows, valueByMonth, field = "value") {
  let lastValue = null;
  return rows.map(row => {
    const v = valueByMonth[row.month] ?? lastValue;
    if (v != null) lastValue = v;
    return v != null ? { ...row, [field]: v } : row;
  });
}

function minMonth(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

function maxMonth(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

function buildFilledMonthValueGetter(months, valueByMonth) {
  const forward = new Map();
  let lastValue = null;
  for (const month of months) {
    const current = valueByMonth.get(month);
    if (current != null) lastValue = current;
    forward.set(month, lastValue);
  }

  const backward = new Map();
  let nextValue = null;
  for (let i = months.length - 1; i >= 0; i--) {
    const month = months[i];
    const current = valueByMonth.get(month);
    if (current != null) nextValue = current;
    backward.set(month, nextValue);
  }

  return month => forward.get(month) ?? backward.get(month) ?? null;
}

function normalizeMonth(date) {
  return toMonthKey(date ?? null) || null;
}

export function getPriceScale(position = null) {
  if (String(position?.gestor ?? "").trim() === "WAM") return 100;
  return 1;
}

function getLastPriceMonth(priceSeries) {
  let lastMonth = null;
  (priceSeries ?? []).forEach(([month]) => {
    const cur = toMonthKey(month);
    if (cur && (!lastMonth || cur > lastMonth)) lastMonth = cur;
  });
  return lastMonth;
}

function computeLastMonth(nestedValues, startMonth, positions = [], priceSeriesByIsin = null) {
  let lastMonth = startMonth;
  Object.values(nestedValues ?? {}).forEach(byCustodian => {
    Object.values(byCustodian ?? {}).forEach(series => {
      (series ?? []).forEach(point => {
        const month = toMonthKey(point?.date);
        if (month && month > lastMonth) lastMonth = month;
      });
    });
  });
  (positions ?? []).forEach(pos => {
    const start = normalizeMonth(pos?.startDate ?? pos?.dataCompra);
    const end = pos?.endDate ? normalizeMonth(pos.endDate) : null;
    const priceEnd = getLastPriceMonth(priceSeriesByIsin?.[pos?.isin]);
    if (start && start > lastMonth) lastMonth = start;
    const candidateEnd = end ?? priceEnd;
    if (candidateEnd && candidateEnd > lastMonth) lastMonth = candidateEnd;
  });
  return lastMonth;
}

function buildPositionIndex(positions = []) {
  const byKey = new Map();
  const byIsin = new Map();
  (positions ?? []).forEach(pos => {
    if (!pos?.isin) return;
    const isin = String(pos.isin).trim();
    const custodian = String(pos.custodian ?? "").trim();
    const key = `${isin}||${custodian}`;
    const cur = byKey.get(key) ?? {
      ...pos,
      isin,
      custodian,
      startDate: null,
      endDate: null,
    };
    cur.startDate = minMonth(cur.startDate, normalizeMonth(pos.startDate ?? pos.dataCompra));
    cur.endDate = maxMonth(cur.endDate, normalizeMonth(pos.endDate));
    byKey.set(key, cur);

    const isinCur = byIsin.get(isin) ?? {
      ...pos,
      isin,
      startDate: null,
      endDate: null,
    };
    isinCur.startDate = minMonth(isinCur.startDate, normalizeMonth(pos.startDate ?? pos.dataCompra));
    isinCur.endDate = maxMonth(isinCur.endDate, normalizeMonth(pos.endDate));
    byIsin.set(isin, isinCur);
  });
  return { byKey, byIsin };
}

export function buildMonthlySeriesFromNestedValues(
  nestedValues,
  positions = [],
  {
    startMonth = START_MONTH_2019,
    endMonth = null,
    include = () => true,
    priceSeriesByIsin = null,
  } = {}
) {
  const lastMonth = computeLastMonth(nestedValues, startMonth, positions, priceSeriesByIsin);
  const positionByIsin = new Map();
  const positionsByIsin = new Map();
  (positions ?? [])
    .filter(p => p?.isin)
    .forEach(p => {
      const cur = positionByIsin.get(p.isin) ?? {
        isin: p.isin,
        valorMercat: 0,
        unitats: 0,
        startDate: null,
        endDate: null,
        hasOpenTranche: false,
      };
      cur.valorMercat += p.valorMercat ?? 0;
      cur.unitats += p.unitats ?? p.n_titols ?? 0;
      cur.startDate = minMonth(cur.startDate, normalizeMonth(p.startDate ?? p.dataCompra));
      if (p.endDate) {
        cur.endDate = maxMonth(cur.endDate, normalizeMonth(p.endDate));
      } else {
        cur.hasOpenTranche = true;
      }
      positionByIsin.set(p.isin, cur);

      const list = positionsByIsin.get(p.isin) ?? [];
      list.push({
        ...p,
        startMonth: normalizeMonth(p.startDate ?? p.dataCompra),
        endMonth: normalizeMonth(p.endDate),
        units: p.unitats ?? p.n_titols ?? 0,
      });
      positionsByIsin.set(p.isin, list);
    });

  positionByIsin.forEach(cur => {
    if (cur.hasOpenTranche) cur.endDate = null;
  });

  const monthTotals = new Map();

  const allIsins = new Set([
    ...Object.keys(nestedValues ?? {}),
    ...positionByIsin.keys(),
  ]);

  allIsins.forEach(isin => {
    const byCustodian = nestedValues?.[isin];
    const position = positionByIsin.get(isin);
    if (!include(position, isin)) return;

    const priceSeries = priceSeriesByIsin?.[isin];
    if (Array.isArray(priceSeries) && priceSeries.length > 0) {
      const priceByMonth = new Map(
        priceSeries
          .map(([month, value]) => [toMonthKey(month), value])
          .filter(([month, value]) => month && value != null)
      );
      const tranches = positionsByIsin.get(isin) ?? [];
      const seriesStartMonth = maxMonth(startMonth, position?.startDate ?? null);
      const seriesEndMonth = position?.endDate ? toMonthKey(position.endDate) : lastMonth;
      if (seriesStartMonth > seriesEndMonth) return;
      const months = buildMonthRange(seriesStartMonth, seriesEndMonth);
      const priceForMonth = buildFilledMonthValueGetter(months, priceByMonth);

      for (const month of months) {
        const price = priceForMonth(month);
        if (price == null) continue;
        const value = tranches.reduce((sum, tranche) => {
          const trancheStart = tranche.startMonth ?? null;
          const trancheEnd = tranche.endMonth ?? null;
          if (trancheStart && month < trancheStart) return sum;
          if (trancheEnd && month > trancheEnd) return sum;
          const scale = getPriceScale(tranche);
          return sum + ((tranche.units ?? 0) * price) / scale;
        }, 0);
        if (value > 0) {
          monthTotals.set(month, (monthTotals.get(month) ?? 0) + value);
        }
      }
      return;
    }

    if (!byCustodian) return;

    Object.values(byCustodian ?? {}).forEach(series => {
      if (!Array.isArray(series) || series.length === 0) return;
      const maxValue = series.reduce((m, point) => {
        const value = point?.value;
        return value != null && value > m ? value : m;
      }, 0);
      const positionValue = position?.valorMercat ?? null;
      if (
        (positionValue != null && maxValue > positionValue * 25) ||
        maxValue > 5_000_000
      ) {
        return;
      }

      // Forward-fill each series independently before summing across positions.
      const monthlyLatest = new Map();
      series.forEach(point => {
        const month = toMonthKey(point?.date);
        const value = point?.value;
        if (!month || value == null) return;
        monthlyLatest.set(month, value);
      });

      let runningValue = null;
      const seriesStartMonth = maxMonth(startMonth, position?.startDate ?? null);
      const seriesEndMonth = position?.endDate ? toMonthKey(position.endDate) : lastMonth;
      if (seriesStartMonth > seriesEndMonth) return;
      for (const month of buildMonthRange(seriesStartMonth, seriesEndMonth)) {
        if (monthlyLatest.has(month)) runningValue = monthlyLatest.get(month);
        if (runningValue != null) {
          monthTotals.set(month, (monthTotals.get(month) ?? 0) + runningValue);
        }
      }
    });
  });

  const months = buildMonthRange(startMonth, endMonth ?? lastMonth);
  return months
    .map(month => (monthTotals.has(month) ? { date: month, value: monthTotals.get(month) } : null))
    .filter(Boolean);
}

export function buildGroupedMonthlySeriesFromNestedValues(
  nestedValues,
  positions = [],
  {
    startMonth = START_MONTH_2019,
    include = () => true,
    groupBy = () => "total",
    groups = [],
    priceSeriesByIsin = null,
  } = {}
) {
  const lastMonth = computeLastMonth(nestedValues, startMonth, positions, priceSeriesByIsin);
  const { byKey: positionByKey, byIsin: positionByIsin } = buildPositionIndex(positions);
  const tranchesByKey = new Map();
  (positions ?? []).forEach(position => {
    if (!position?.isin) return;
    const isin = String(position.isin).trim();
    const custodian = String(position.custodian ?? "").trim();
    const key = `${isin}||${custodian}`;
    const list = tranchesByKey.get(key) ?? [];
    list.push({
      ...position,
      startMonth: normalizeMonth(position.startDate ?? position.dataCompra),
      endMonth: normalizeMonth(position.endDate),
      units: position.unitats ?? position.n_titols ?? 0,
    });
    tranchesByKey.set(key, list);
  });

  const monthTotals = new Map();
  const seenGroups = new Set(groups);

  const allIsins = new Set([
    ...Object.keys(nestedValues ?? {}),
    ...positionByIsin.keys(),
  ]);

  allIsins.forEach(isin => {
    const byCustodian = nestedValues?.[isin];
    const priceSeries = priceSeriesByIsin?.[isin];
    if (Array.isArray(priceSeries) && priceSeries.length > 0) {
      const priceByMonth = new Map(
        priceSeries
          .map(([month, value]) => [toMonthKey(month), value])
          .filter(([month, value]) => month && value != null)
      );
      const keysForIsin = new Set([
        ...Array.from(tranchesByKey.keys()).filter(key => key.startsWith(`${isin}||`)),
        ...Object.keys(byCustodian ?? {}).map(custodian => `${isin}||${String(custodian ?? "").trim()}`),
      ]);

      keysForIsin.forEach(key => {
        const [, custodian = ""] = String(key).split("||");
        const position = positionByKey.get(key) ?? positionByIsin.get(isin) ?? { isin, custodian };
        if (!include(position, isin)) return;
        const group = groupBy(position, isin);
        if (!group) return;
        seenGroups.add(group);

        const tranches = tranchesByKey.get(key) ?? [];
        const seriesStartMonth = maxMonth(startMonth, position?.startDate ?? null);
        const seriesEndMonth = position?.endDate ? toMonthKey(position.endDate) : lastMonth;
        if (seriesStartMonth > seriesEndMonth) return;
        const months = buildMonthRange(seriesStartMonth, seriesEndMonth);
        const priceForMonth = buildFilledMonthValueGetter(months, priceByMonth);

        for (const month of months) {
          const price = priceForMonth(month);
          if (price == null) continue;
          const value = tranches.reduce((sum, tranche) => {
            if (tranche.startMonth && month < tranche.startMonth) return sum;
            if (tranche.endMonth && month > tranche.endMonth) return sum;
            const scale = getPriceScale(tranche);
            return sum + ((tranche.units ?? 0) * price) / scale;
          }, 0);
          if (value <= 0) continue;
          if (!monthTotals.has(month)) monthTotals.set(month, new Map());
          const monthMap = monthTotals.get(month);
          monthMap.set(group, (monthMap.get(group) ?? 0) + value);
        }
      });
      return;
    }

    if (!byCustodian) return;

    Object.entries(byCustodian ?? {}).forEach(([custodian, series]) => {
      const position =
        positionByKey.get(`${isin}||${String(custodian ?? "").trim()}`) ??
        positionByIsin.get(isin) ??
        { isin, custodian };
      if (!include(position, isin)) return;
      const group = groupBy(position, isin);
      if (!group) return;
      seenGroups.add(group);

      if (!Array.isArray(series) || series.length === 0) return;
      const maxValue = series.reduce((m, point) => {
        const value = point?.value;
        return value != null && value > m ? value : m;
      }, 0);
      const positionValue = position?.valorMercat ?? null;
      if (
        (positionValue != null && maxValue > positionValue * 25) ||
        maxValue > 5_000_000
      ) {
        return;
      }

      const monthlyLatest = new Map();
      series.forEach(point => {
        const month = toMonthKey(point?.date);
        const value = point?.value;
        if (!month || value == null) return;
        monthlyLatest.set(month, value);
      });

      let runningValue = null;
      const seriesStartMonth = maxMonth(startMonth, position?.startDate ?? null);
      const seriesEndMonth = position?.endDate ? toMonthKey(position.endDate) : lastMonth;
      if (seriesStartMonth > seriesEndMonth) return;
      for (const month of buildMonthRange(seriesStartMonth, seriesEndMonth)) {
        if (monthlyLatest.has(month)) runningValue = monthlyLatest.get(month);
        if (runningValue == null) continue;
        if (!monthTotals.has(month)) monthTotals.set(month, new Map());
        const monthMap = monthTotals.get(month);
        monthMap.set(group, (monthMap.get(group) ?? 0) + runningValue);
      }
    });
  });

  const months = buildMonthRange(startMonth, lastMonth);
  const lastValues = {};
  return months.map(month => {
    const row = { date: month };
    const monthMap = monthTotals.get(month) ?? new Map();
    [...seenGroups].forEach(group => {
      if (monthMap.has(group)) lastValues[group] = monthMap.get(group);
      if (lastValues[group] != null) row[group] = lastValues[group];
    });
    return Object.keys(row).length > 1 ? row : null;
  }).filter(Boolean);
}
