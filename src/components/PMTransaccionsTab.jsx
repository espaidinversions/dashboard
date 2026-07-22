import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { loadPMOverrides, upsertTransaction } from "../db.js";
import { resolvePmTransactionRouteId } from "../data/pmPositionRouting.js";
import { canonicalPmCustodian } from "../data/pmClassification.js";

const PM_POSITIONS    = PM_MODEL.holdings.active;
const PM_CLOSED       = PM_MODEL.holdings.closed;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;

const MESOS_SHORT  = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];
const fmtYYYYMMShort = yyyymm => {
  const [y, m] = yyyymm.split("-");
  return `${MESOS_SHORT[parseInt(m, 10)]} '${y.slice(2)}`;
};

const CUSTODIANS = ["CaixaBank", "Bankinter", "Interactive Brokers", "JPMorgan", "UBS", "Andbank", "Altre"];

const EMPTY_FILTERS = { date: "", nom: "", tipus: "Tots", action: "Tots", units: "", nav: "", value: "", custodian: "" };

const TX_PP = 25;

export function PMTransaccionsTab({ search = "" }) {
  const { tc, dark } = useTheme();
  const [filters,   setFilters]   = useState(EMPTY_FILTERS);
  const [showModal, setShowModal] = useState(false);
  const [manualTxs, setManualTxs] = useState([]);
  const [sort,      setSort]      = useState({ k: "date", d: "desc" });
  const [page,      setPage]      = useState(0);

  useEffect(() => {
    loadPMOverrides().then(data => {
      if (data?.transactions?.length) setManualTxs(data.transactions);
    });
  }, []);

  const allTxs = useMemo(() => {
    const staticIds = new Set(PM_TRANSACTIONS.map(t => t.id));
    const extras = manualTxs.filter(t => !staticIds.has(t.id));
    return [...PM_TRANSACTIONS, ...extras]
      .map(t => ({ ...t, custodian: canonicalPmCustodian(t.custodian) }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [manualTxs]);

  const custodians = useMemo(() =>
    [...new Set(allTxs.map(t => t.custodian).filter(Boolean))].sort(),
  [allTxs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTxs.filter(t => {
      if (q && !String(t.nom ?? t.isin ?? "").toLowerCase().includes(q)) return false;
      if (filters.date     && !String(t.date ?? "").includes(filters.date)) return false;
      if (filters.nom      && !String(t.nom ?? t.isin ?? "").toLowerCase().includes(filters.nom.toLowerCase())) return false;
      if (filters.tipus    !== "Tots" && t.tipus !== filters.tipus) return false;
      if (filters.action   !== "Tots" && t.action !== filters.action) return false;
      if (filters.units    && !String(t.units ?? "").includes(filters.units)) return false;
      if (filters.nav      && !String(t.nav ?? "").includes(filters.nav)) return false;
      if (filters.value    && !String(t.valueEur ?? "").includes(filters.value)) return false;
      if (filters.custodian && !String(t.custodian ?? "").toLowerCase().includes(filters.custodian.toLowerCase())) return false;
      return true;
    });
  }, [allTxs, filters, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const av = a?.[sort.k] ?? "";
    const bv = b?.[sort.k] ?? "";
    if (typeof av === "number" || typeof bv === "number") {
      return sort.d === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    }
    return sort.d === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  }), [filtered, sort]);

  const pageCount   = Math.max(1, Math.ceil(sorted.length / TX_PP));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows   = sorted.slice(currentPage * TX_PP, (currentPage + 1) * TX_PP);

  useEffect(() => { setPage(0); }, [search, sort, filters]);
  useEffect(() => { if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1)); }, [page, pageCount]);

  const hasActiveFilters = Object.entries(filters).some(([, v]) => v !== "" && v !== "Tots");

  const totalBuys  = filtered.filter(t => t.action === "buy").reduce((s, t)  => s + (t.valueEur ?? 0), 0);
  const totalSells = filtered.filter(t => t.action === "sell").reduce((s, t) => s + (t.valueEur ?? 0), 0);
  const netFlow    = totalBuys - totalSells;

  const cards = [
    { label: "Compres",    value: fmtM(totalBuys),  accent: tc.navy  },
    { label: "Vendes",     value: fmtM(totalSells), accent: tc.green },
    { label: "Balanç Net", value: `${netFlow >= 0 ? "+" : ""}${fmtM(netFlow)}`, accent: netFlow >= 0 ? tc.navyLight : tc.green },
  ];

  const chartData = useMemo(() => {
    const map = new Map();
    allTxs.forEach(t => {
      if (!t.date) return;
      const key = t.date.slice(0, 7);
      if (!map.has(key)) map.set(key, { label: fmtYYYYMMShort(key), Compres: 0, Vendes: 0 });
      const entry = map.get(key);
      if (t.action === "buy")  entry.Compres += t.valueEur ?? 0;
      if (t.action === "sell") entry.Vendes  += t.valueEur ?? 0;
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [allTxs]);

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggleSort = (k) => setSort(prev => prev.k === k ? { k, d: prev.d === "desc" ? "asc" : "desc" } : { k, d: "desc" });
  const Arr = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sort.k === k ? 1 : 0.25, fontSize: 9 }}>
      {sort.k === k && sort.d === "asc" ? "▲" : "▼"}
    </span>
  );

  const inputStyle = {
    width: "100%", padding: "4px 6px", borderRadius: 4,
    border: `1px solid ${tc.border}`, background: tc.bg,
    color: tc.text, fontSize: 11, fontFamily: "inherit",
  };
  const thStyle = {
    padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight,
    textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap",
    userSelect: "none", cursor: "pointer", borderBottom: `2px solid ${tc.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Bar chart */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10,
        padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight,
          textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
          Flux Mensual · Mercats Públics
        </div>
        {(() => {
          const t = ecTheme(tc);
          const option = {
            grid: { top: 8, right: 8, bottom: 56, left: 0, containLabel: true },
            tooltip: {
              ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" },
              formatter: params => {
                const label = params[0]?.axisValue ?? "";
                let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                params.forEach(p => { if (p.value) html += `<div>${p.marker}${p.seriesName}: ${fmtM(p.value)}</div>`; });
                return html;
              },
            },
            legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
            xAxis: { type: "category", data: chartData.map(d => d.label),
              axisLabel: { fontSize: 9, color: tc.textLight, rotate: -40 },
              axisLine: { show: false }, axisTick: { show: false } },
            yAxis: { type: "value",
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => fmtM(v) },
              splitLine: { lineStyle: { color: tc.border } },
              axisLine: { show: false }, axisTick: { show: false } },
            series: [
              { name: "Compres", type: "bar", data: chartData.map(d => d.Compres ?? null),
                itemStyle: { color: tc.navy, borderRadius: [4,4,0,0] }, barMaxWidth: 28, barGap: "10%" },
              { name: "Vendes",  type: "bar", data: chartData.map(d => d.Vendes  ?? null),
                itemStyle: { color: tc.green, borderRadius: [4,4,0,0] }, barMaxWidth: 28 },
            ],
          };
          return <ReactECharts option={option} style={{ width: "100%", height: 220 }} opts={{ renderer: "canvas" }} />;
        })()}
      </div>

      {/* KPI cards */}
      <div className="grid-4" style={{ gap: 12 }}>
        {cards.map(card => (
          <div key={card.label} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10,
            padding: "14px 18px", borderTop: `3px solid ${card.accent}`, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", color: tc.textLight,
              textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.accent,
              fontFamily: "'DM Mono',monospace" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10,
        padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>

        {showModal && (
          <NovaTxModal tc={tc} dark={dark}
            onClose={() => setShowModal(false)}
            onSave={tx => setManualTxs(prev => [...prev, tx])} />
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 14, gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em",
            textTransform: "uppercase", color: tc.textLight }}>
            Transaccions Mercats Públics
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasActiveFilters && (
              <button onClick={() => setFilters(EMPTY_FILTERS)}
                style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 4,
                  padding: "2px 8px", cursor: "pointer", fontSize: 10, color: tc.textMid, fontFamily: "inherit" }}>
                netejar
              </button>
            )}
            <button onClick={() => setShowModal(true)} style={{
              padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${tc.green}`, background: dark ? "#0A2010" : "#E8F8E8",
              color: tc.green, fontWeight: 700,
            }}>＋ Nova transacció</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 720 }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {[
                  { label: "Data",      k: "date",     align: "left"  },
                  { label: "Nom",       k: "nom",      align: "left"  },
                  { label: "Tipus",     k: "tipus",    align: "left"  },
                  { label: "Acció",     k: "action",   align: "left"  },
                  { label: "Units",     k: "units",    align: "right" },
                  { label: "NAV",       k: "nav",      align: "right" },
                  { label: "Valor EUR", k: "valueEur", align: "right" },
                  { label: "Custodi",   k: "custodian",align: "left"  },
                ].map(col => (
                  <th key={col.k} onClick={() => toggleSort(col.k)}
                    style={{ ...thStyle, textAlign: col.align }}>
                    {col.label}<Arr k={col.k} />
                  </th>
                ))}
              </tr>
              <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
                <th style={{ padding: "6px 10px" }}>
                  <input value={filters.date} onChange={e => setF("date", e.target.value)} style={inputStyle} />
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <input value={filters.nom} onChange={e => setF("nom", e.target.value)} style={inputStyle} />
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <select value={filters.tipus} onChange={e => setF("tipus", e.target.value)} style={inputStyle}>
                    {["Tots","RV","RF"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <select value={filters.action} onChange={e => setF("action", e.target.value)} style={inputStyle}>
                    {["Tots","buy","sell"].map(o => <option key={o} value={o}>{o === "buy" ? "Compra" : o === "sell" ? "Venda" : o}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <input value={filters.units} onChange={e => setF("units", e.target.value)} style={inputStyle} />
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <input value={filters.nav} onChange={e => setF("nav", e.target.value)} style={inputStyle} />
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <input value={filters.value} onChange={e => setF("value", e.target.value)} style={inputStyle} />
                </th>
                <th style={{ padding: "6px 10px" }}>
                  <select value={filters.custodian} onChange={e => setF("custodian", e.target.value)} style={inputStyle}>
                    <option value="">Tots</option>
                    {custodians.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((t, i) => {
                const isBuy = t.action === "buy";
                const rowBg = i % 2 === 0 ? (dark ? tc.card : "#fff") : (dark ? tc.bgAlt : "#FAFBFC");
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${tc.border}`, background: rowBg }}>
                    <td style={{ padding: "8px 10px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight, whiteSpace: "nowrap" }}>
                      {t.date}
                    </td>
                    <td style={{ padding: "8px 10px", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Link
                        to={`/mercats-publics/${encodeURIComponent(resolvePmTransactionRouteId(t, PM_POSITIONS, PM_CLOSED) ?? t.isin)}`}
                        style={{ color: tc.navy, fontWeight: 600, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        {t.nom || t.isin}
                      </Link>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: t.tipus === "RV" ? "#E6EDF3" : "#FFF8E1",
                        color:      t.tipus === "RV" ? "#2B5070" : "#7A6000" }}>
                        {t.tipus}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: isBuy ? "#E8F8E8" : "#FDECEA",
                        color:      isBuy ? "#1C6B1D" : "#C62828", fontWeight: 600 }}>
                        {isBuy ? "Compra" : "Venda"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                      {t.units != null ? t.units.toLocaleString("ca-ES", { maximumFractionDigits: 0 }) : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                      {t.nav != null ? t.nav.toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.navy }}>
                      {t.valueEur != null ? fmtM(t.valueEur) : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: tc.textLight }}>
                      {t.custodian}
                    </td>
                  </tr>
                );
              })}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: tc.textLight, fontSize: 12 }}>
                    Cap transacció trobada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tc.border}` }}>
          <div style={{ fontSize: 10, color: tc.textLight, fontStyle: "italic" }}>
            {filtered.length} de {allTxs.length} transaccions{manualTxs.length > 0 ? ` · ${manualTxs.length} manuals` : ""}. Dates de venda aproximades a 31/12.
          </div>
          {pageCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${tc.border}`,
                  background: "transparent", color: tc.textMid, cursor: currentPage === 0 ? "default" : "pointer",
                  fontSize: 11, fontFamily: "inherit", opacity: currentPage === 0 ? 0.4 : 1 }}>‹</button>
              <span style={{ fontSize: 11, color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>
                {currentPage + 1} / {pageCount}
              </span>
              <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={currentPage === pageCount - 1}
                style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${tc.border}`,
                  background: "transparent", color: tc.textMid, cursor: currentPage === pageCount - 1 ? "default" : "pointer",
                  fontSize: 11, fontFamily: "inherit", opacity: currentPage === pageCount - 1 ? 0.4 : 1 }}>›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Nova transacció modal ─────────────────────────────────────
function NovaTxModal({ tc, onClose, onSave }) {
  const [form, setForm] = useState({
    action: "buy", date: new Date().toISOString().slice(0, 10),
    isin: "", nom: "", tipus: "RV", custodian: "CaixaBank",
    units: "", nav: "", valueEur: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const knownPos = useMemo(() =>
    PM_POSITIONS.find(p => p.isin === form.isin.trim().toUpperCase()),
  [form.isin]);
  useEffect(() => {
    if (knownPos) set("nom", knownPos.nom);
  }, [knownPos]);

  const computedValue = form.units && form.nav
    ? (parseFloat(form.units) * parseFloat(form.nav)).toFixed(0)
    : "";

  const inp = {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: `1.5px solid ${tc.border}`, borderRadius: 6,
    background: tc.bg, color: tc.text, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.isin.trim()) return setError("ISIN és obligatori");
    if (!form.date) return setError("Data és obligatòria");
    setSaving(true);
    const tx = {
      action:    form.action,
      date:      form.date,
      isin:      form.isin.trim().toUpperCase(),
      nom:       form.nom || null,
      tipus:     form.tipus,
      custodian: form.custodian,
      units:     form.units ? parseFloat(form.units) : null,
      nav:       form.nav ? parseFloat(form.nav) : null,
      valueEur:  form.valueEur ? parseFloat(form.valueEur) : (computedValue ? parseFloat(computedValue) : null),
    };
    const { data, error: err } = await upsertTransaction(tx);
    setSaving(false);
    if (err) return setError(err.message);
    onSave(data ?? { ...tx, id: `manual-${Date.now()}` });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: tc.card, borderRadius: 14, padding: "28px 28px 24px",
        width: 440, maxWidth: "92vw", boxShadow: "0 8px 40px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy, marginBottom: 20 }}>Nova transacció</div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Acció</label>
              <select value={form.action} onChange={e => set("action", e.target.value)} style={inp}>
                <option value="buy">Compra</option>
                <option value="sell">Venda</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tipus</label>
              <select value={form.tipus} onChange={e => set("tipus", e.target.value)} style={inp}>
                <option value="RV">RV</option>
                <option value="RF">RF</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>ISIN</label>
              <input list="pm-isins-modal" value={form.isin} onChange={e => set("isin", e.target.value.toUpperCase())}
                placeholder="IE00BFMXXD54" style={inp} />
              <datalist id="pm-isins-modal">
                {PM_POSITIONS.map(p => <option key={p.isin} value={p.isin}>{p.nom}</option>)}
              </datalist>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inp} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nom</label>
            <input value={form.nom} onChange={e => set("nom", e.target.value)} placeholder="Nom del fons / ETF" style={inp} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Custodi</label>
            <select value={form.custodian} onChange={e => set("custodian", e.target.value)} style={inp}>
              {CUSTODIANS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Units</label>
              <input type="number" step="any" value={form.units} onChange={e => set("units", e.target.value)} placeholder="1500" style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>NAV</label>
              <input type="number" step="any" value={form.nav} onChange={e => set("nav", e.target.value)} placeholder="100.00" style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Valor EUR</label>
              <input type="number" step="any" value={form.valueEur || computedValue}
                onChange={e => set("valueEur", e.target.value)} placeholder={computedValue || "150000"} style={inp} />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA", borderRadius: 6, padding: "8px 12px" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 6, border: `1.5px solid ${tc.border}`,
                background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              Cancel·lar
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "8px 16px", borderRadius: 6, border: "none",
                background: tc.navy, color: "#fff", cursor: saving ? "wait" : "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              {saving ? "Desant…" : "Afegir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
