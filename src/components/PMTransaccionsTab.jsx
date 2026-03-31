import React, { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { PM_TRANSACTIONS } from "../data/pmTransactions.js";
import { loadPMOverrides, upsertTransaction } from "../db.js";

const MONTH_NAMES = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
const MESOS_SHORT = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];
const fmtYYYYMM = yyyymm => {
  const [y, m] = yyyymm.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
};
const fmtYYYYMMShort = yyyymm => {
  const [y, m] = yyyymm.split("-");
  return `${MESOS_SHORT[parseInt(m, 10)]} '${y.slice(2)}`;
};

const CUSTODIANS = ["CaixaBank", "Bankinter", "UBS", "Credit Suisse", "Altre"];

export function PMTransaccionsTab() {
  const { tc, dark } = useTheme();
  const [actionFilter,   setActionFilter]   = useState("tots");
  const [custodianFilter, setCustodianFilter] = useState("tots");
  const [showModal,  setShowModal]  = useState(false);
  const [openMonths, setOpenMonths] = useState(null);
  const [manualTxs,  setManualTxs]  = useState([]);

  useEffect(() => {
    loadPMOverrides().then(data => {
      if (data?.transactions?.length) setManualTxs(data.transactions);
    });
  }, []);

  const allTxs = useMemo(() => {
    const staticIds = new Set(PM_TRANSACTIONS.map(t => t.id));
    const extras = manualTxs.filter(t => !staticIds.has(t.id));
    return [...PM_TRANSACTIONS, ...extras];
  }, [manualTxs]);

  const custodians = useMemo(() =>
    [...new Set(allTxs.map(t => t.custodian).filter(Boolean))].sort(),
  [allTxs]);

  const filtered = useMemo(() => {
    let rows = allTxs;
    if (actionFilter !== "tots") rows = rows.filter(t => t.action === actionFilter);
    if (custodianFilter !== "tots") rows = rows.filter(t => t.custodian === custodianFilter);
    return [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [allTxs, actionFilter, custodianFilter]);

  const byMonth = useMemo(() => {
    const map = new Map();
    filtered.forEach(t => {
      const m = (t.date ?? "????-??").slice(0, 7);
      if (!map.has(m)) map.set(m, []);
      map.get(m).push(t);
    });
    return [...map.entries()];
  }, [filtered]);

  const resolvedOpen = useMemo(() => {
    if (openMonths !== null) return openMonths;
    return new Set(byMonth.slice(0, 3).map(([m]) => m));
  }, [openMonths, byMonth]);

  const toggleMonth = m => setOpenMonths(prev => {
    const s = new Set(prev ?? resolvedOpen);
    s.has(m) ? s.delete(m) : s.add(m);
    return s;
  });

  // Bar chart: buys & sells by month (all txs, ascending)
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

  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
      border: `1.5px solid ${active ? tc.green : tc.border}`,
      background: active ? (dark ? "#0A2010" : "#E8F8E8") : "transparent",
      color: active ? tc.green : tc.textLight, fontWeight: active ? 700 : 400,
    }}>{label}</button>
  );

  const th = {
    padding: "9px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight,
    textTransform: "uppercase", fontWeight: 600, textAlign: "left",
    borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap", userSelect: "none",
  };

  const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 7,
        padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,.18)", minWidth: 160 }}>
        <p style={{ color: tc.navy, margin: "0 0 6px", fontWeight: 700, fontSize: 12 }}>{label}</p>
        {payload.filter(p => p.value > 0).map((p, i) => (
          <p key={i} style={{ color: p.fill, margin: "2px 0", fontSize: 12,
            display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span>{p.name}</span><span style={{ fontWeight: 700 }}>{fmtM(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  const rowMain = dark ? tc.card  : "#fff";
  const rowAlt  = dark ? tc.bgAlt : "#FAFBFC";

  return (
    <>
      {/* ── Bar chart ── */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10,
        padding: "18px 20px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight,
          textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
          Flux Mensual · Mercats Públics
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 30 }} barGap={3} barCategoryGap="28%">
            <XAxis dataKey="label" tick={{ fill: tc.textMid, fontSize: 9 }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" />
            <YAxis tickFormatter={v => fmtM(v)} tick={{ fill: tc.textLight, fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTip />} />
            <Legend formatter={v => <span style={{ color: tc.textMid, fontSize: 11 }}>{v}</span>} />
            <Bar dataKey="Compres" fill={tc.navy}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Vendes"  fill={tc.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Accordion table ── */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>

        {showModal && (
          <NovaTxModal tc={tc} dark={dark}
            onClose={() => setShowModal(false)}
            onSave={tx => setManualTxs(prev => [...prev, tx])} />
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          padding: "18px 20px 14px", borderBottom: `1px solid ${tc.border}` }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight,
            textTransform: "uppercase", fontWeight: 600, flex: 1 }}>
            Detall per Mes › Transaccions · {filtered.length}
          </div>
          <button onClick={() => setShowModal(true)} style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${tc.green}`, background: dark ? "#0A2010" : "#E8F8E8",
            color: tc.green, fontWeight: 700,
          }}>+ Nova</button>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chip("Totes",   actionFilter === "tots", () => setActionFilter("tots"))}
            {chip("Compres", actionFilter === "buy",  () => setActionFilter("buy"))}
            {chip("Vendes",  actionFilter === "sell", () => setActionFilter("sell"))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chip("Tot custodi", custodianFilter === "tots", () => setCustodianFilter("tots"))}
            {custodians.map(c => chip(c, custodianFilter === c, () => setCustodianFilter(c)))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setOpenMonths(new Set(byMonth.map(([m]) => m)))}
              style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 5,
                padding: "4px 12px", cursor: "pointer", fontSize: 11, color: tc.textMid, fontFamily: "inherit" }}>
              Expandir tots
            </button>
            <button onClick={() => setOpenMonths(new Set())}
              style={{ background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 5,
                padding: "4px 12px", cursor: "pointer", fontSize: 11, color: tc.textMid, fontFamily: "inherit" }}>
              Plegar tots
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 700 }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {[
                  { l: "",        align: "left",   w: 32  },
                  { l: "Mes",     align: "left",   w: 130 },
                  { l: "Nom",     align: "left"         },
                  { l: "Tipus",   align: "center"       },
                  { l: "Acció",   align: "center"       },
                  { l: "Units",   align: "right"        },
                  { l: "NAV",     align: "right"        },
                  { l: "Valor",   align: "right"        },
                  { l: "Custodi", align: "left"         },
                ].map(({ l, align, w }) => (
                  <th key={l || "_"} style={{ ...th, textAlign: align, ...(w ? { width: w } : {}) }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byMonth.map(([month, rows], mi) => {
                const isOpen = resolvedOpen.has(month);
                const monthTotal = rows.reduce((s, t) => s + (t.valueEur ?? 0), 0);
                const buys  = rows.filter(t => t.action === "buy").length;
                const sells = rows.filter(t => t.action === "sell").length;

                return (
                  <React.Fragment key={month}>
                    {/* Month header row */}
                    <tr
                      onClick={() => toggleMonth(month)}
                      style={{
                        background: isOpen ? (dark ? "#0E1F0E" : "#F0F8F0") : mi % 2 === 0 ? rowMain : rowAlt,
                        cursor: "pointer",
                        borderTop: `1px solid ${tc.border}`,
                        borderBottom: isOpen ? "none" : `1px solid ${tc.border}`,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => !isOpen && (e.currentTarget.style.background = tc.bgAlt)}
                      onMouseLeave={e => !isOpen && (e.currentTarget.style.background = mi % 2 === 0 ? rowMain : rowAlt)}
                    >
                      <td style={{ padding: "10px 10px 10px 14px", fontSize: 13, color: tc.green, fontWeight: 700, userSelect: "none" }}>
                        {isOpen ? "▼" : "▶"}
                      </td>
                      <td colSpan={2} style={{ padding: "10px", fontWeight: 700, color: tc.text, fontSize: 13 }}>{fmtYYYYMM(month)}</td>
                      <td colSpan={5} style={{ padding: "10px", fontSize: 10, color: tc.textLight }}>
                        {rows.length} op.{buys > 0 ? ` · ${buys} compra${buys > 1 ? "es" : ""}` : ""}{sells > 0 ? ` · ${sells} venda${sells > 1 ? "es" : ""}` : ""}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: tc.navy }}>
                        {monthTotal > 0 ? fmtM(monthTotal) : "—"}
                      </td>
                      <td />
                    </tr>

                    {/* Transaction rows */}
                    {isOpen && rows.map((t, i) => {
                      const isBuy = t.action === "buy";
                      return (
                        <tr key={t.id} style={{
                          borderBottom: `1px solid ${tc.border}`,
                          background: i % 2 === 0
                            ? (dark ? "#091C0B" : "#F4FBF4")
                            : (dark ? "#071A08" : "#E8F8E8"),
                        }}>
                          <td />
                          <td style={{ padding: "8px 10px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight, whiteSpace: "nowrap" }}>{t.date}</td>
                          <td style={{ padding: "8px 10px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ color: tc.navy, fontWeight: 600 }}>{t.nom}</span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: t.tipus === "RV" ? "#E6EDF3" : "#FFF8E1",
                              color:      t.tipus === "RV" ? "#2B5070" : "#7A6000" }}>{t.tipus}</span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
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
                          <td style={{ padding: "8px 10px", fontSize: 11, color: tc.textLight }}>{t.custodian}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 10, color: tc.textLight, padding: "10px 20px", fontStyle: "italic", borderTop: `1px solid ${tc.border}` }}>
          {filtered.length} de {allTxs.length} transaccions{manualTxs.length > 0 ? ` · ${manualTxs.length} manuals` : ""}. Dates de venda aproximades a 31/12 de l'any de tancament.
        </div>
      </div>
    </>
  );
}

// ── Nova transacció modal ─────────────────────────────────────
function NovaTxModal({ tc, dark, onClose, onSave }) {
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
    border: `1.5px solid ${tc.border}`, borderRadius: 7,
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
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA", borderRadius: 7, padding: "8px 12px" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 7, border: `1.5px solid ${tc.border}`,
                background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              Cancel·lar
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "8px 16px", borderRadius: 7, border: "none",
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
