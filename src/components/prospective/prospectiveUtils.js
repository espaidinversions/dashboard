// Pure utility functions and data helpers for ProspectiveCashTab.
// No React imports — safe to use outside components.

export function periodOf(year) {
  if (year <= 2025) return "closed";
  if (year === 2026) return "current";
  return "fwd";
}

export function modeValue(row, mode) {
  if (mode === "calls") return { model: row.mc, real: row.rc };
  if (mode === "dist") return { model: row.md, real: row.rd };
  return { model: row.md - row.mc, real: row.rd - row.rc };
}

export function fmtK(value, digits = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  const a = Math.abs(n);
  const dM = digits == null ? 0 : digits;
  const dK = digits == null ? 0 : digits;
  if (a >= 1e6) return `${(n / 1e6).toFixed(dM)}M€`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(dK)}K€`;
  return `${n.toFixed(0)}€`;
}

export function fmtC(value) {
  const n = Number(value) || 0;
  if (!n) return "";
  return fmtK(n, 0);
}

export function pct(real, model) {
  return model ? `${(((real - model) / Math.abs(model)) * 100).toFixed(1)}%` : "--";
}

export function signed(value) {
  return value >= 0 ? `+${fmtK(value)}` : fmtK(value);
}

export function signedPct(value) {
  return value >= 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

export function numberAtYear(values, year) {
  return Number(values?.[year] ?? values?.[String(year)] ?? 0) || 0;
}

export function yearMapValue(values, year, next) {
  const copy = { ...(values ?? {}) };
  const numeric = Number(next) || 0;
  if (numeric > 0) copy[year] = numeric;
  else delete copy[year];
  return copy;
}

export function colorFor(tc, color) {
  if (color === "green") return tc.green;
  if (color === "yellow") return tc.warning;
  return tc.textLight;
}

export function periodColor(tc, year) {
  const period = periodOf(year);
  if (period === "closed") return tc.green;
  if (period === "current") return tc.warning;
  return tc.textLight;
}

export function periodBg(tc, year, total = false) {
  const period = periodOf(year);
  const alpha = total ? "22" : "12";
  if (period === "closed") return `${tc.green}${alpha}`;
  if (period === "current") return `${tc.warning}${alpha}`;
  return `${tc.textLight}${total ? "18" : "0D"}`;
}

export function tdStyle(tc, align = "right") {
  return { padding: "7px 10px", textAlign: align, borderBottom: `1px solid ${tc.border}`, color: tc.text, verticalAlign: "middle", whiteSpace: "nowrap" };
}

export function vintageStyle(tc, year) {
  const color = year <= 2020 ? tc.textLight : year <= 2022 ? tc.navy : year <= 2024 ? tc.green : tc.warning;
  return { fontSize: 9, fontWeight: 750, color, background: "transparent", border: `1px solid ${color}88`, padding: "1px 5px", borderRadius: 4, cursor: "pointer" };
}

export function selectStyle(tc) {
  return { background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 7, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", minWidth: 220 };
}

export function inputStyle(tc) {
  return { background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 7, padding: "7px 9px", fontSize: 12, fontFamily: "inherit" };
}

export function editorNumberStyle(tc) {
  return { ...inputStyle(tc), width: 96, textAlign: "right", padding: "5px 7px" };
}

export function buttonStyle(tc, primary = false) {
  return { border: primary ? "none" : `1px solid ${tc.border}`, background: primary ? tc.navy : "transparent", color: primary ? "#fff" : tc.textMid, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };
}

export function aggregateByYear(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.year)) map.set(row.year, { year: row.year, mc: 0, rc: 0, md: 0, rd: 0 });
    const target = map.get(row.year);
    if (row.type === "calls") {
      target.mc += row.model;
      target.rc += row.real;
    } else {
      target.md += row.model;
      target.rd += row.real;
    }
  });
  return [...map.values()].sort((a, b) => a.year - b.year);
}

export function aggregateByFund(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.fund)) map.set(row.fund, { fund: row.fund, mc: 0, rc: 0, md: 0, rd: 0 });
    const target = map.get(row.fund);
    if (row.type === "calls") {
      target.mc += row.model;
      target.rc += row.real;
    } else {
      target.md += row.model;
      target.rd += row.real;
    }
  });
  return [...map.values()];
}

export function buildTable({ rows, committed, firstCall, metricsByFund = {}, fund, tableType, visibleYears, yearFilters, vintageFilter, sort }) {
  // Paid-in (real calls) and distributed (real distributions) both come straight
  // from the cap-calls-derived rows, keyed by the same mapped fund name used
  // everywhere else — so DPI resolves for every fund with calls (fixes funds that
  // had distributions but a blank DPI due to raw-vs-mapped name mismatch).
  const paidIn = {};
  const distributed = {};
  rows.forEach((row) => {
    if (fund !== "all" && row.fund !== fund) return;
    if (row.type === "calls") paidIn[row.fund] = (paidIn[row.fund] ?? 0) + row.real;
    else if (row.type === "dist") distributed[row.fund] = (distributed[row.fund] ?? 0) + row.real;
  });

  const byFund = new Map();
  rows.forEach((row) => {
    if (tableType !== "net" && row.type !== tableType) return;
    if (fund !== "all" && row.fund !== fund) return;
    if (!byFund.has(row.fund)) byFund.set(row.fund, {});
    const yearData = byFund.get(row.fund);
    if (!yearData[row.year]) yearData[row.year] = { model: 0, real: 0 };
    const sign = tableType === "net" ? (row.type === "dist" ? 1 : -1) : 1;
    yearData[row.year].model += row.model * sign;
    yearData[row.year].real += row.real * sign;
  });

  const selectedYears = [...yearFilters].sort((a, b) => a - b);
  let tableRows = [...byFund.entries()].map(([fundName, yearData]) => {
    let totalModel = 0;
    let totalReal = 0;
    Object.values(yearData).forEach((value) => {
      totalModel += value.model;
      totalReal += value.real;
    });
    const deltaModel = selectedYears.reduce((sum, year) => sum + (yearData[year]?.model ?? 0), 0);
    const deltaReal = selectedYears.reduce((sum, year) => sum + (yearData[year]?.real ?? 0), 0);
    return {
      fund: fundName,
      yearData,
      totalModel,
      totalReal,
      dev: totalReal - totalModel,
      devAbs: Math.abs(totalReal - totalModel),
      committed: committed[fundName] ?? 0,
      paidIn: paidIn[fundName] ?? 0,
      paidInPct: committed[fundName] ? ((paidIn[fundName] ?? 0) / committed[fundName]) * 100 : 0,
      vintage: firstCall[fundName] ?? null,
      deltaReal,
      deltaDev: deltaReal - deltaModel,
      dpi: paidIn[fundName] ? (distributed[fundName] ?? 0) / paidIn[fundName] : null,
      tvpi: metricsByFund[fundName]?.tvpi ?? null,
    };
  });

  if (vintageFilter != null) tableRows = tableRows.filter((row) => row.vintage === vintageFilter);
  if (selectedYears.length) tableRows = tableRows.filter((row) => selectedYears.some((year) => row.yearData[year]?.model || row.yearData[year]?.real));

  tableRows.sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "fund") return dir * a.fund.localeCompare(b.fund);
    if (/^r\d{4}$/.test(sort.key)) {
      const year = Number(sort.key.slice(1));
      return dir * ((a.yearData[year]?.real ?? 0) - (b.yearData[year]?.real ?? 0));
    }
    return dir * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0));
  });

  const totals = {
    totalModel: 0,
    totalReal: 0,
    committed: 0,
    paidIn: 0,
    deltaReal: 0,
    deltaDev: 0,
    byYear: Object.fromEntries(visibleYears.map((year) => [year, { model: 0, real: 0 }])),
  };
  tableRows.forEach((row) => {
    totals.totalModel += row.totalModel;
    totals.totalReal += row.totalReal;
    totals.committed += row.committed;
    totals.paidIn += row.paidIn;
    totals.deltaReal += row.deltaReal;
    totals.deltaDev += row.deltaDev;
    visibleYears.forEach((year) => {
      totals.byYear[year].model += row.yearData[year]?.model ?? 0;
      totals.byYear[year].real += row.yearData[year]?.real ?? 0;
    });
  });
  totals.dev = totals.totalReal - totals.totalModel;
  totals.paidInPct = totals.committed ? (totals.paidIn / totals.committed) * 100 : null;

  return { rows: tableRows, totals, selectedYears };
}
