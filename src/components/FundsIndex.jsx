import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT } from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge, EditableCell, DeleteRowButton } from "./SharedComponents.jsx";
import { upsertFundMeta, insertFund, deleteFund, loadAll } from "../db.js";
import { useAuth } from "../auth.jsx";

const VCPE_CFG = {
  "PE": { color: "#2B5070", bg: "#E6EDF3" },
  "VC": { color: "#28A029", bg: "#E8F8E8" },
  "RE": { color: "#6B2E7E", bg: "#F3EEF8" },
};
const EST_CFG = {
  "Fons Primari": { color: "#2B5070", bg: "#E6EDF3" },
  "Fons de Fons": { color: "#28A029", bg: "#E8F8E8" },
  "SOCIMI":       { color: "#6B2E7E", bg: "#F3EEF8" },
};

export function FundsIndexInner({ inline = false, searchOverride }) {
  const { isSuperuser } = useAuth();
  const { tc } = useTheme();
  const [searchLocal, setSearchLocal] = useState("");
  const search = searchOverride !== undefined ? searchOverride : searchLocal;
  const [sortKey, setSortKey] = useState("compromis");
  const [sortDir, setSortDir] = useState("desc");

  const [rawCC, setRawCC] = useState(() => {
    try { const s = localStorage.getItem("tc_rawCC"); return s ? JSON.parse(s) : RAW_CC_DEFAULT; }
    catch { return RAW_CC_DEFAULT; }
  });

  const persistRawCC = (updated) => {
    setRawCC(updated);
    try { localStorage.setItem("tc_rawCC", JSON.stringify(updated)); } catch {}
  };

  const [fundMeta, setFundMeta] = useState(() => {
    try { const s = localStorage.getItem("tc_fundMeta"); return s ? JSON.parse(s) : FUND_META_DEFAULT; }
    catch { return FUND_META_DEFAULT; }
  });

  const saveTvpi = (fons, tvpi) => {
    const updated = fundMeta.some(m => m.fons === fons)
      ? fundMeta.map(m => m.fons === fons ? { ...m, tvpi } : m)
      : [...fundMeta, { fons, tvpi }];
    setFundMeta(updated);
    try { localStorage.setItem("tc_fundMeta", JSON.stringify(updated)); } catch {}
    upsertFundMeta(fons, tvpi);
  };

  const handleDeleteFund = async (fons) => {
    const err = await deleteFund(fons);
    if (err) {
      alert("Error en eliminar el fons: " + err.message);
      const data = await loadAll();
      if (data) {
        persistRawCC(data.rawCC);
        setFundMeta(data.fundMeta);
        try { localStorage.setItem("tc_fundMeta", JSON.stringify(data.fundMeta)); } catch {}
      }
      return;
    }
    const updatedCC = rawCC.filter(r => r.fons !== fons);
    persistRawCC(updatedCC);
    const updatedMeta = fundMeta.filter(m => m.fons !== fons);
    setFundMeta(updatedMeta);
    try { localStorage.setItem("tc_fundMeta", JSON.stringify(updatedMeta)); } catch {}
  };

  const [addingFund, setAddingFund] = useState(false);
  const [newFund, setNewFund] = useState({ fons: "", vcpe: "PE", est: "Fons Primari", compromis: "", divisa: "EUR" });

  const handleAddFund = async (e) => {
    e.preventDefault();
    if (!newFund.fons.trim()) return;
    const row = await insertFund(
      newFund.fons.trim(),
      newFund.vcpe,
      newFund.est,
      parseFloat(newFund.compromis) || 0,
      newFund.divisa,
    );
    if (!row) { alert("Error en crear el fons"); return; }
    persistRawCC([...rawCC, row]);
    setAddingFund(false);
    setNewFund({ fons: "", vcpe: "PE", est: "Fons Primari", compromis: "", divisa: "EUR" });
  };

  const rows = useMemo(() => {
    const map = new Map();
    for (const r of rawCC) {
      if (!map.has(r.fons)) map.set(r.fons, { fons: r.fons, vcpe: r.vcpe, est: r.est, compromis: 0, calls: 0, dist: 0, isMock: !!r.isMock });
      const f = map.get(r.fons);
      if (r.cat === "Compromís") f.compromis += r.eur;
      if (r.cat === "Capital Call") f.calls += r.eur;
      if (r.cat === "Distribució" || r.cat === "Retorn Capital") f.dist += Math.abs(r.eur);
    }
    return Array.from(map.values()).map(f => {
      const meta = fundMeta.find(m => m.fons === f.fons);
      const tvpi = meta?.tvpi ?? null;
      const dpi = f.calls > 0 ? f.dist / f.calls : 0;
      const rvpi = tvpi != null ? tvpi - dpi : null;
      return {
        ...f,
        slug: slugify(f.fons),
        utilizat: f.compromis > 0 ? (f.calls / f.compromis) * 100 : null,
        tvpi,
        dpi,
        rvpi,
      };
    });
  }, [rawCC, fundMeta]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => r.fons.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isMock !== b.isMock) return a.isMock ? -1 : 1;
      let av, bv;
      if (sortKey === "compromis") { av = a.compromis ?? 0; bv = b.compromis ?? 0; }
      else if (sortKey === "cridat") { av = a.calls ?? 0; bv = b.calls ?? 0; }
      else if (sortKey === "utilizat") { av = a.utilizat ?? -1; bv = b.utilizat ?? -1; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else if (sortKey === "dpi") { av = a.dpi ?? -1; bv = b.dpi ?? -1; }
      else if (sortKey === "rvpi") { av = a.rvpi ?? -1; bv = b.rvpi ?? -1; }
      else { av = a.fons.toLowerCase(); bv = b.fons.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const utilizatColor = v => {
    if (v == null) return tc.textLight;
    if (v < 50) return tc.red;
    if (v < 80) return tc.warning;
    return tc.green;
  };

  const multipleColor = v => {
    if (v == null) return tc.textLight;
    if (v < 1) return tc.red;
    if (v < 1.5) return tc.warning;
    return tc.green;
  };

  const fmtX = v => v != null ? `${v.toFixed(2)}×` : "—";

  const COLS = [
    { k: "nom",       label: "Nom",      align: "left" },
    { k: "tipus",     label: "Tipus",    align: "left" },
    { k: "compromis", label: "Compromís",align: "right" },
    { k: "cridat",    label: "Cridat",   align: "right" },
    { k: "utilizat",  label: "Utilizat", align: "right" },
    { k: "tvpi",      label: "TVPI",     align: "right" },
    { k: "dpi",       label: "DPI",      align: "right" },
    { k: "rvpi",      label: "RVPI",     align: "right" },
  ];

  return (
    <div style={{ minHeight: inline ? undefined : "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {!inline && (
        <>
          <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
            <div style={{ flex: 1 }} />
            <input value={searchLocal} onChange={e => setSearchLocal(e.target.value)} placeholder="Cerca per nom…"
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 200 }} />
          </div>
          <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "0 32px", display: "flex" }}>
            <span style={{ borderBottom: `2px solid ${tc.green}`, padding: "11px 20px", fontSize: 12, fontWeight: 600, color: tc.navy, whiteSpace: "nowrap" }}>Fons</span>
            <Link to="/investments/companies" style={{ borderBottom: "2px solid transparent", padding: "11px 20px", fontSize: 12, fontWeight: 400, color: tc.textMid, textDecoration: "none", whiteSpace: "nowrap" }}>Participades</Link>
          </div>
        </>
      )}

      <div style={{ padding: "24px 32px" }}>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {COLS.map(({ k, label, align }) => (
                    <th key={k} onClick={() => toggleSort(k)}
                      style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
                  {isSuperuser && <th style={{ width: 40 }} />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.slug} className="hoverable" style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}`, opacity: r.isMock ? 0.45 : 1 }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link to={`/fund/${r.slug}`} style={{ color: tc.navy, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        {r.fons}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Badge label={r.vcpe} cfg={VCPE_CFG[r.vcpe] || {}} />
                        {r.est && <Badge label={r.est} cfg={EST_CFG[r.est] || {}} />}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {r.compromis ? fmtM(r.compromis) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {r.calls ? fmtM(r.calls) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: utilizatColor(r.utilizat) }}>
                      {r.utilizat != null ? `${r.utilizat.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi) }}>
                      <EditableCell value={r.tvpi} type="number" align="right"
                        fmt={fmtX} onSave={v => saveTvpi(r.fons, v)}
                        disabled={!isSuperuser} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpi) }}>
                      {fmtX(r.dpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpi) }}>
                      {fmtX(r.rvpi)}
                    </td>
                    {isSuperuser && (
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <DeleteRowButton onDelete={() => handleDeleteFund(r.fons)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      {isSuperuser && (
        <div style={{ marginTop: 16 }}>
          {!addingFund ? (
            <button onClick={() => setAddingFund(true)}
              style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 12, color: tc.textMid,
                fontFamily: "inherit", fontWeight: 600 }}>
              + Nou fons
            </button>
          ) : (
            <form onSubmit={handleAddFund}
              style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end",
                background: tc.bgAlt, padding: 12, borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nom</div>
                <input value={newFund.fons} onChange={e => setNewFund(p => ({ ...p, fons: e.target.value }))}
                  placeholder="Nom del fons" style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              </div>
              {[
                { label: "Tipus", key: "vcpe", options: ["PE", "VC", "RE"] },
                { label: "Estructura", key: "est", options: ["Fons Primari", "Fons de Fons", "SOCIMI"] },
                { label: "Divisa", key: "divisa", options: ["EUR", "USD"] },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                  <select value={newFund[f.key]} onChange={e => setNewFund(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Compromís (€)</div>
                <input type="number" value={newFund.compromis} onChange={e => setNewFund(p => ({ ...p, compromis: e.target.value }))}
                  placeholder="0" style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: 100 }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit"
                  style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                  Afegir
                </button>
                <button type="button" onClick={() => setAddingFund(false)}
                  style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                  Cancel·lar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default function FundsIndex() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <FundsIndexInner />
    </ThemeContext.Provider>
  );
}
