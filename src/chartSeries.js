export const START_MONTH_2019 = "2019-01";

export const toMonthKey = d => (d ?? "").slice(0, 7);

export function nextMonth(month) {
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
