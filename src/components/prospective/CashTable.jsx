import React from "react";
import { Link } from "react-router-dom";
import { PROSPECTIVE_CASH_USD_FUNDS } from "../../data/prospectiveCashUsdFunds.js";
import { fmtC, signed, periodColor, periodBg, tdStyle, vintageStyle, buttonStyle } from "./prospectiveUtils.js";
import { formatMultiple, multipleColor } from "../../utils/formatters.js";
import { Segmented, MiniTag, Th, YearCell } from "./ProspectivePrimitives.jsx";

export function CashTable({
  tc,
  table,
  tableType,
  setTableType,
  allYears,
  visibleYears,
  yearFilters,
  setYearFilters,
  vintageFilter,
  setVintageFilter,
  sort,
  setSort,
  fundRouteIds = {},
  entityScope = "funds",
  entityText = { plural: "fons" },
  entityMetaByName = {},
}) {
  const hasYearFilter = yearFilters.size > 0;

  const setSortKey = (key) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));
  };

  const toggleYear = (year, multi) => {
    setYearFilters((current) => {
      const next = new Set(multi ? current : []);
      if (current.size === 1 && current.has(year) && !multi) return new Set();
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const entityColLabel = entityScope === "companies" ? "Companyia" : "Fons";

  const rowLink = (name) => {
    const meta = entityMetaByName?.[name] ?? null;
    if (entityScope === "companies" && meta?.id) {
      if (meta.vehicleTipus === "PC") return `/investments/companies/${encodeURIComponent(meta.id)}`;
      if (meta.vehicleTipus === "SF") return `/investments/searchers/${encodeURIComponent(meta.id)}`;
    }
    if (fundRouteIds?.[name]) return `/investments/funds/${encodeURIComponent(fundRouteIds[name])}`;
    return null;
  };

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: tc.textLight, fontWeight: 750 }}>Detall per {entityText.plural}</div>
        <Segmented tc={tc} value={tableType} onChange={setTableType} options={[{ id: "calls", label: "Calls" }, { id: "dist", label: "Distribucions" }, { id: "net", label: "Net CF" }]} />
        {vintageFilter != null && (
          <button onClick={() => setVintageFilter(null)} style={buttonStyle(tc)}>
            Treure vintage {vintageFilter}
          </button>
        )}
      </div>
      <div style={{ padding: "9px 14px", borderBottom: `1px solid ${tc.border}`, background: tc.bgAlt, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: tc.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Anys</span>
        {allYears.map((year) => {
          const active = visibleYears.includes(year);
          const selected = yearFilters.has(year);
          const color = periodColor(tc, year);
          return (
            <button
              key={year}
              onClick={(event) => toggleYear(year, event.ctrlKey || event.metaKey)}
              style={{ border: `1px solid ${selected ? tc.navy : `${color}66`}`, color: selected ? tc.navy : color, background: selected ? `${tc.navy}18` : "transparent", opacity: active ? 1 : 0.35, borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
              title="Clic selecciona; Ctrl/Cmd afegeix a la seleccio"
            >
              {year}
            </button>
          );
        })}
        {hasYearFilter ? <button onClick={() => setYearFilters(new Set())} style={buttonStyle(tc)}>Tots</button> : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <Th tc={tc} onClick={() => setSortKey("fund")} active={sort.key === "fund"} dir={sort.dir} align="left">{entityColLabel}</Th>
              <Th tc={tc} onClick={() => setSortKey("committed")} active={sort.key === "committed"} dir={sort.dir}>Comp.</Th>
              {visibleYears.map((year) => <Th key={year} tc={tc} onClick={() => setSortKey(`r${year}`)}>{year}</Th>)}
              {hasYearFilter ? (
                <>
                  <Th tc={tc} onClick={() => setSortKey("deltaReal")} active={sort.key === "deltaReal"} dir={sort.dir}>Real</Th>
                  <Th tc={tc} onClick={() => setSortKey("deltaDev")} active={sort.key === "deltaDev"} dir={sort.dir}>Delta Dev</Th>
                </>
              ) : null}
              <Th tc={tc} onClick={() => setSortKey("totalReal")} active={sort.key === "totalReal"} dir={sort.dir}>Σ Real</Th>
              <Th tc={tc} onClick={() => setSortKey("paidInPct")} active={sort.key === "paidInPct"} dir={sort.dir}>%Comp</Th>
              <Th tc={tc} onClick={() => setSortKey("totalModel")} active={sort.key === "totalModel"} dir={sort.dir}>Σ Model</Th>
              <Th tc={tc} onClick={() => setSortKey("dev")} active={sort.key === "dev"} dir={sort.dir}>Desv.</Th>
              <Th tc={tc} onClick={() => setSortKey("dpi")} active={sort.key === "dpi"} dir={sort.dir}>DPI</Th>
              <Th tc={tc} onClick={() => setSortKey("tvpi")} active={sort.key === "tvpi"} dir={sort.dir}>TVPI</Th>
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 80).map((row) => (
              <tr key={row.fund} className="hoverable">
                <td style={tdStyle(tc, "left")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 700 }}>
                    {rowLink(row.fund)
                      ? <Link to={rowLink(row.fund)} title={row.fund} style={{ color: tc.navy, textDecoration: "none" }}>{row.fund.length > 32 ? `${row.fund.slice(0, 32)}...` : row.fund}</Link>
                      : <span title={row.fund}>{row.fund.length > 32 ? `${row.fund.slice(0, 32)}...` : row.fund}</span>}
                    {PROSPECTIVE_CASH_USD_FUNDS.has(row.fund) ? <MiniTag tc={tc}>USD</MiniTag> : null}
                    {row.totalReal && !row.totalModel ? <MiniTag tc={tc}>Unmodeled</MiniTag> : null}
                    {row.vintage ? <button onClick={() => setVintageFilter(row.vintage)} style={vintageStyle(tc, row.vintage)}>{row.vintage}</button> : null}
                  </div>
                </td>
                <td style={tdStyle(tc)}>{fmtC(row.committed)}</td>
                {visibleYears.map((year) => {
                  const cell = row.yearData[year] ?? { model: 0, real: 0 };
                  const base = tableType === "calls" ? row.committed : row.paidIn;
                  const pctValue = base && cell.real ? (cell.real / base) * 100 : null;
                  return <YearCell key={year} tc={tc} year={year} model={cell.model} real={cell.real} pctValue={pctValue} />;
                })}
                {hasYearFilter ? (
                  <>
                    <td style={tdStyle(tc)}><strong style={{ color: tc.navy }}>{fmtC(row.deltaReal)}</strong></td>
                    <td style={tdStyle(tc)}><span style={{ color: row.deltaDev >= 0 ? tc.green : tc.red, fontWeight: 700 }}>{signed(row.deltaDev)}</span></td>
                  </>
                ) : null}
                <td style={tdStyle(tc)}><strong style={{ color: tc.green }}>{fmtC(row.totalReal)}</strong></td>
                <td style={tdStyle(tc)}>{row.paidInPct ? `${row.paidInPct.toFixed(1)}%` : ""}</td>
                <td style={tdStyle(tc)}>{fmtC(row.totalModel)}</td>
                <td style={tdStyle(tc)}><span style={{ color: row.dev >= 0 ? tc.green : tc.red, fontWeight: 750 }}>{signed(row.dev)}</span></td>
                <td style={tdStyle(tc)}><span style={{ color: multipleColor(row.dpi, tc), fontWeight: 700 }}>{formatMultiple(row.dpi)}</span></td>
                <td style={tdStyle(tc)}><span style={{ color: multipleColor(row.tvpi, tc), fontWeight: 700 }}>{formatMultiple(row.tvpi)}</span></td>
              </tr>
            ))}
            <tr style={{ background: tc.bgAlt, fontWeight: 750 }}>
              <td style={tdStyle(tc, "left")}>Σ TOTAL ({table.rows.length} {entityText.plural})</td>
              <td style={tdStyle(tc)}>{fmtC(table.totals.committed)}</td>
              {visibleYears.map((year) => {
                const cell = table.totals.byYear[year] ?? { model: 0, real: 0 };
                const base = tableType === "calls" ? table.totals.committed : table.totals.paidIn;
                return <YearCell key={year} tc={tc} year={year} model={cell.model} real={cell.real} pctValue={base && cell.real ? (cell.real / base) * 100 : null} total />;
              })}
              {hasYearFilter ? (
                <>
                  <td style={tdStyle(tc)}><strong style={{ color: tc.navy }}>{fmtC(table.totals.deltaReal)}</strong></td>
                  <td style={tdStyle(tc)}><span style={{ color: table.totals.deltaDev >= 0 ? tc.green : tc.red }}>{signed(table.totals.deltaDev)}</span></td>
                </>
              ) : null}
              <td style={tdStyle(tc)}><strong style={{ color: tc.green }}>{fmtC(table.totals.totalReal)}</strong></td>
              <td style={tdStyle(tc)}>{table.totals.paidInPct ? `${table.totals.paidInPct.toFixed(1)}%` : ""}</td>
              <td style={tdStyle(tc)}>{fmtC(table.totals.totalModel)}</td>
              <td style={tdStyle(tc)}><span style={{ color: table.totals.dev >= 0 ? tc.green : tc.red }}>{signed(table.totals.dev)}</span></td>
              <td style={tdStyle(tc)}>—</td>
              <td style={tdStyle(tc)}>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
