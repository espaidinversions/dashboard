import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { fmtM, fmtSignedM, fmtSignedNative, usePersistedState } from "../utils.js";
import { makeVehicleDetailPath } from "../data/privateRoutes.js";
import { CAPITAL_CALL_STRATEGY_OPTIONS } from "../data/capitalCallStrategyModel.js";
import { normalizeCapitalCallTipus } from "../data/capitalCallTipusModel.js";
import { Badge, DeleteRowButton, EditableCell } from "./SharedComponents.jsx";
import { useCapitalCallModal } from "./contexts/CapitalCallModalContext.jsx";

const PM_TX_MONTHS_SHORT = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];

// Legacy non-cash rows that should not distort "committed vs called" KPIs.
const EXCLUDED_KPI_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);

export function TxSection({
  tx,
  compr = [],
  search = "",
  catCfg,
  estCfg,
  tc,
  dark,
  canEdit,
  addDefaults,
  onDelete,
  onQuickUpdate,
  title,
  scopeToggle = false,
  scopeStorageKey = null,
  defaultScope = "vehicles", // "vehicles" | "companies" | "all"
}) {
  const { openAddModal, openEditModal } = useCapitalCallModal();
  const [sort, setSort] = useState({ k: "data", d: "desc" });
  const storageKey = scopeStorageKey || "ui_tx_scope";
  const [scope, setScope] = usePersistedState(storageKey, defaultScope);
  const [filters, setFilters] = useState({ year: "Tots", month: "Tots", fons: "", tipus: "Tots", eur: "", est: "Tots", comentaris: "" });
  const [page, setPage] = useState(0);
  const TX_PP = 25;

  const isCompanyRow = (row) => {
    const v = String(row?.vehicleTipus ?? "").trim();
    return v === "PC" || v === "SF";
  };

  const scopedTx = useMemo(() => {
    if (!scopeToggle || scope === "all") return tx;
    if (scope === "companies") return tx.filter(isCompanyRow);
    return tx.filter((r) => !isCompanyRow(r));
  }, [scope, scopeToggle, tx]);

  const scopedCompr = useMemo(() => {
    if (!scopeToggle || scope === "all") return compr;
    if (scope === "companies") return compr.filter(isCompanyRow);
    return compr.filter((r) => !isCompanyRow(r));
  }, [compr, scope, scopeToggle]);

  const allRows = useMemo(() => [...scopedTx, ...scopedCompr], [scopedTx, scopedCompr]);
  const yearOptions = useMemo(() => {
    const years = new Set(allRows.map((r) => String(r.data ?? "").slice(0, 4)).filter((y) => /^\d{4}$/.test(y)));
    return ["Tots", ...[...years].sort()];
  }, [allRows]);
  const monthOptions = [
    { value: "Tots", label: "Tots" },
    { value: "01", label: "Gen" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
    { value: "04", label: "Abr" }, { value: "05", label: "Mai" }, { value: "06", label: "Jun" },
    { value: "07", label: "Jul" }, { value: "08", label: "Ago" }, { value: "09", label: "Set" },
    { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Des" },
  ];

  const query = search.trim().toLowerCase();
  const visibleTx = useMemo(() => {
    return allRows.filter((row) => {
      if (query && !(
        (row.fons || "").toLowerCase().includes(query) ||
        (row.tipus || "").toLowerCase().includes(query) ||
        (row.comentaris || "").toLowerCase().includes(query)
      )) return false;
      if (filters.year !== "Tots" && !String(row.data ?? "").startsWith(filters.year)) return false;
      if (filters.month !== "Tots" && String(row.data ?? "").slice(5, 7) !== filters.month) return false;
      if (filters.fons && !String(row.fons ?? "").toLowerCase().includes(filters.fons.toLowerCase())) return false;
      if (filters.tipus !== "Tots" && row.tipus !== filters.tipus) return false;
      if (filters.eur && !String(row.eur ?? "").includes(filters.eur)) return false;
      if (filters.est !== "Tots" && row.est !== filters.est) return false;
      if (filters.comentaris && !String(row.comentaris ?? "").toLowerCase().includes(filters.comentaris.toLowerCase())) return false;
      return true;
    });
  }, [filters, query, allRows]);
  const visibleCompr = useMemo(() => visibleTx.filter((row) => row.cat === "Compromís"), [visibleTx]);

  const tipusOptions = useMemo(
    () => ["Tots", ...Array.from(new Set(allRows.map((row) => row.tipus).filter(Boolean))).sort()],
    [allRows],
  );

  const sorted = useMemo(() => [...visibleTx].sort((a, b) => {
    const av = a?.[sort.k] ?? "";
    const bv = b?.[sort.k] ?? "";
    if (typeof av === "string" || typeof bv === "string") {
      return sort.d === "asc"
        ? String(av).localeCompare(String(bv), "ca", { sensitivity: "base" })
        : String(bv).localeCompare(String(av), "ca", { sensitivity: "base" });
    }
    return sort.d === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  }), [sort, visibleTx]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / TX_PP));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = sorted.slice(currentPage * TX_PP, (currentPage + 1) * TX_PP);

  const isExcludedKpiRow = (row) => EXCLUDED_KPI_TIPUS.has(normalizeCapitalCallTipus(row?.tipus));
  const isAportacio = (row) => normalizeCapitalCallTipus(row?.tipus) === "Aportació";
  const totalCompr = visibleCompr
    .filter((row) => !isExcludedKpiRow(row))
    .reduce((sum, row) => sum + (row.eur || 0), 0);

  // "Capital cridat" should reflect only capital contributions (Aportació), not fees/equalisation/etc.
  const totalCalls = visibleTx
    .filter((row) => row.cat === "Capital Call" && isAportacio(row) && !isExcludedKpiRow(row))
    .reduce((sum, row) => sum + (row.eur || 0), 0);
  const totalOtherOutflows = visibleTx
    .filter((row) => row.cat === "Capital Call" && !isAportacio(row) && !isExcludedKpiRow(row))
    .reduce((sum, row) => sum + (row.eur || 0), 0);
  const totalPaidBack = visibleTx
    .filter((row) => row.cat === "Distribució" || row.cat === "Retorn Capital")
    .reduce((sum, row) => sum + Math.abs(row.eur || 0), 0);
  const netFlow = totalPaidBack - totalCalls;
  const totalUncalled = Math.max(0, totalCompr - totalCalls);
  const calledPct = totalCompr > 0 ? (totalCalls / totalCompr) * 100 : null;
  const chartData = useMemo(() => {
    const map = new Map();
    visibleTx.forEach((row) => {
      const month = String(row?.data ?? "").slice(0, 7);
      const match = month.match(/^(\d{4})-(\d{2})$/);
      if (!match) return;
      if (!map.has(month)) {
        map.set(month, {
          label: `${PM_TX_MONTHS_SHORT[Number(match[2])]} '${match[1].slice(2)}`,
          CapitalCalls: 0,
          Retorns: 0,
        });
      }
      const entry = map.get(month);
      // Strict category accounting: Compromis is not a cash flow and must not be counted as a call.
      if (row.cat === "Capital Call" && isAportacio(row) && !isExcludedKpiRow(row)) entry.CapitalCalls += Math.abs(row.eur ?? 0);
      if (row.cat === "Distribució" || row.cat === "Retorn Capital") entry.Retorns += Math.abs(row.eur ?? 0);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  }, [visibleTx]);
  const cards = [
    ...(totalCompr > 0 ? [{
      label: "Compromís",
      value: fmtM(totalCompr),
      accent: tc.navyLight,
    }] : []),
    { label: "Capital Cridat (Aportació)", value: fmtM(totalCalls), accent: tc.navy },
    ...(totalCompr > 0 ? [{
      label: "Pendent de Cridar",
      value: fmtM(totalUncalled),
      accent: tc.warning ?? "#B8860B",
      sub: calledPct == null ? null : `${calledPct.toFixed(1)}% utilitzat`,
    }] : []),
    ...(totalOtherOutflows > 0 ? [{
      label: "Altres Sortides",
      value: fmtM(totalOtherOutflows),
      accent: tc.textLight,
      sub: "fees / prima / interessos / etc.",
    }] : []),
    { label: "Total Rebut", value: fmtM(totalPaidBack), accent: tc.green },
    {
      label: "Flux Net",
      value: `${netFlow > 0 ? "+" : ""}${fmtM(netFlow)}`,
      accent: netFlow >= 0 ? tc.greenDark : tc.navyLight,
      sub: netFlow >= 0 ? "saldo positiu" : "pendent",
    },
  ];

  const toggleSort = (k) => {
    setSort((prev) => prev.k === k ? { k, d: prev.d === "desc" ? "asc" : "desc" } : { k, d: "desc" });
  };
  useEffect(() => {
    setPage(0);
  }, [query, sort]);
  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);
  const Arr = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sort.k === k ? 1 : 0.25, fontSize: 9 }}>
      {sort.k === k && sort.d === "asc" ? "▲" : "▼"}
    </span>
  );
  const thStyle = {
    padding: "8px 10px",
    fontSize: 10,
    letterSpacing: "0.09em",
    color: tc.textLight,
    textTransform: "uppercase",
    fontWeight: 600,
    whiteSpace: "nowrap",
    userSelect: "none",
    cursor: "pointer",
    borderBottom: `2px solid ${tc.border}`,
  };

  const scopeBtnStyle = (id) => {
    const active = scope === id;
    return {
      border: `1px solid ${tc.border}`,
      background: active ? tc.navy : "transparent",
      color: active ? "#fff" : tc.textMid,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: active ? 700 : 600,
      cursor: "pointer",
      fontFamily: "inherit",
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>
            Flux Mensual · Mercats Privats
          </div>
          {scopeToggle ? (
            <div style={{ display: "inline-flex", border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", background: tc.bg }}>
              <button onClick={() => setScope("all")} style={{ ...scopeBtnStyle("all"), borderRight: `1px solid ${tc.border}` }}>All</button>
              <button onClick={() => setScope("vehicles")} style={{ ...scopeBtnStyle("vehicles"), borderRight: `1px solid ${tc.border}` }}>Vehicles</button>
              <button onClick={() => setScope("companies")} style={scopeBtnStyle("companies")}>Companies</button>
            </div>
          ) : null}
        </div>
        {chartData.length === 0 ? (
          <div style={{ padding: "24px 0 8px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>Cap transacció</div>
        ) : (() => {
          const t = ecTheme(tc);
          const option = {
            grid: { top: 8, right: 8, bottom: 56, left: 0, containLabel: true },
            tooltip: {
              ...t.tooltip,
              trigger: "axis",
              axisPointer: { type: "shadow" },
              formatter: (params) => {
                const label = params[0]?.axisValue ?? "";
                let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                params.forEach((point) => {
                  if (!point.value) return;
                  html += `<div>${point.marker}${point.seriesName}: ${fmtM(point.value)}</div>`;
                });
                return html;
              },
            },
            legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
            xAxis: {
              type: "category",
              data: chartData.map((row) => row.label),
              axisLabel: { fontSize: 9, color: tc.textLight, rotate: -40 },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            yAxis: {
              type: "value",
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: (value) => fmtM(value) },
              splitLine: { lineStyle: { color: tc.border } },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series: [
              {
                name: "Capital Calls",
                type: "bar",
                data: chartData.map((row) => row.CapitalCalls ?? null),
                itemStyle: { color: tc.navy, borderRadius: [4, 4, 0, 0] },
                barMaxWidth: 28,
                barGap: "10%",
              },
              {
                name: "Retorns",
                type: "bar",
                data: chartData.map((row) => row.Retorns ?? null),
                itemStyle: { color: tc.green, borderRadius: [4, 4, 0, 0] },
                barMaxWidth: 28,
              },
            ],
          };
          return <ReactECharts option={option} style={{ width: "100%", height: 220 }} opts={{ renderer: "canvas" }} />;
        })()}
      </div>

      <div className="grid-4" style={{ gap: 12 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "14px 18px", borderTop: `3px solid ${card.accent}`, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", color: tc.textLight, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.accent, fontFamily: "'DM Mono',monospace" }}>{card.value}</div>
            {card.sub ? <div style={{ fontSize: 11, color: tc.textLight, marginTop: 2 }}>{card.sub}</div> : null}
          </div>
        ))}
      </div>

      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: tc.textLight }}>{title}</div>
          {canEdit ? (
            <button
              onClick={() => openAddModal(addDefaults ?? {})}
              style={{ padding: "5px 14px", borderRadius: 6, border: `1.5px solid ${tc.green}`, background: dark ? "#0A2010" : "#E8F8E8", color: tc.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}
            >
              ＋ Afegeix moviment
            </button>
          ) : null}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {[
                  { k: "data", label: "Data" },
                  { k: "fons", label: "Vehicle" },
                  { k: "tipus", label: "Tipus" },
                  { k: "amountNative", label: "Import (Original)", right: true },
                  { k: "eur", label: "Import (Euros)", right: true },
                  { k: "est", label: "Tipus de Vehicle" },
                  { k: "comentaris", label: "Comentaris" },
                ].map((head) => (
                  <th key={head.k} onClick={() => toggleSort(head.k)} style={{ ...thStyle, textAlign: head.right ? "right" : "left" }}>
                    {head.label}<Arr k={head.k} />
                  </th>
                ))}
                {canEdit ? <th style={{ ...thStyle, textAlign: "center", cursor: "default" }}>Accions</th> : null}
              </tr>
              <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
                <th style={{ padding: "6px 10px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <select value={filters.year} onChange={(e) => setFilters((current) => ({ ...current, year: e.target.value }))} style={{ flex: 1, padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y === "Tots" ? "Any" : y}</option>)}
                    </select>
                    <select value={filters.month} onChange={(e) => setFilters((current) => ({ ...current, month: e.target.value }))} style={{ flex: 1, padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>
                      {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </th>
                <th style={{ padding: "6px 10px" }}><input value={filters.fons} onChange={(e) => setFilters((current) => ({ ...current, fons: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 10px" }}>
                  <select value={filters.tipus} onChange={(e) => setFilters((current) => ({ ...current, tipus: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>
                    {tipusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 10px" }} />
                <th style={{ padding: "6px 10px" }}><input value={filters.eur} onChange={(e) => setFilters((current) => ({ ...current, eur: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 10px" }}>
                  <select value={filters.est} onChange={(e) => setFilters((current) => ({ ...current, est: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>
                    {["Tots", ...Array.from(new Set(allRows.map((row) => row.est).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 10px" }}><input value={filters.comentaris} onChange={(e) => setFilters((current) => ({ ...current, comentaris: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                {canEdit ? <th style={{ padding: "6px 10px", textAlign:"center" }}>{Object.values(filters).some((value) => value !== "" && value !== "Tots") ? <button onClick={() => setFilters({ year: "Tots", month: "Tots", fons: "", tipus: "Tots", eur: "", est: "Tots", comentaris: "" })} style={{ background:"transparent", border:`1px solid ${tc.border}`, borderRadius:4, padding:"2px 8px", cursor:"pointer", fontSize:10, color:tc.textMid, fontFamily:"inherit" }}>netejar</button> : null}</th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} style={{ padding: "24px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>Cap transacció</td>
                </tr>
              ) : null}
              {pagedRows.map((row, index) => {
                const isIn = row.eur > 0;
                return (
                  <tr key={row._rowId ?? `${row.fons}-${row.data}-${currentPage}-${index}`} style={{ borderBottom: `1px solid ${tc.bgAlt}`, background: index % 2 === 0 ? tc.card : tc.bgAlt }}>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: tc.textMid, whiteSpace: "nowrap" }}>{row.data}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: tc.text, fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.fons}>
                      <Link to={makeVehicleDetailPath(row)} style={{ color: tc.navy, textDecoration: "none" }} onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"} onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>{row.fons}</Link>
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: tc.textMid, whiteSpace: "nowrap" }}>{row.tipus}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isIn ? tc.navy : tc.green }}>
                      {fmtSignedNative(row.amountNative ?? row.eur, row.divisa ?? "EUR")}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isIn ? tc.navy : tc.green }}>
                      {row.fxSource?.startsWith("ecb:estimated:") ? (
                        <span
                          title="Tipus de canvi estimat — s'actualitzarà quan arribi la data de la transacció"
                          style={{ cursor: "help", borderBottom: "1px dashed currentColor" }}
                        >
                          ~{fmtSignedM(row.eur)}
                        </span>
                      ) : (
                        fmtSignedM(row.eur)
                      )}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {row.est ? <Badge label={row.est} cfg={estCfg[row.est] || {}} /> : <span style={{ color: tc.textLight }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: tc.textMid, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.comentaris ?? ""}>
                      {row.comentaris || "—"}
                    </td>
                    {canEdit ? (
                      <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {row._rowId ? (
                          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <button
                              onClick={() => openEditModal(row)}
                              style={{ minWidth: 58, padding: "4px 0", borderRadius: 4, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, textAlign: "center" }}
                            >
                              Edita
                            </button>
                            <DeleteRowButton onDelete={() => onDelete(row)} />
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${tc.border}` }}>
            <span style={{ fontSize: 12, color: tc.textLight }}>
              {sorted.length} moviments · pàgina <b style={{ color: tc.navy }}>{currentPage + 1}</b> de {pageCount}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={currentPage === 0}
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 4, padding: "5px 14px", cursor: currentPage === 0 ? "not-allowed" : "pointer", color: currentPage === 0 ? tc.textLight : tc.navy, fontFamily: "inherit", fontSize: 12 }}
              >
                ← Anterior
              </button>
              <button
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage((prev) => Math.min(prev + 1, pageCount - 1))}
                style={{ background: currentPage >= pageCount - 1 ? tc.bgAlt : tc.navy, border: "none", borderRadius: 4, padding: "5px 14px", cursor: currentPage >= pageCount - 1 ? "not-allowed" : "pointer", color: currentPage >= pageCount - 1 ? tc.textLight : "#fff", fontFamily: "inherit", fontSize: 12 }}
              >
                Següent →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
