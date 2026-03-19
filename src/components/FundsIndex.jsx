import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT } from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

const VCPE_CFG = {
  "PE": { color: "#2B4C7E", bg: "#E8EFF5" },
  "VC": { color: "#276749", bg: "#E8F5E9" },
  "RE": { color: "#6B2E7E", bg: "#F3EEF8" },
};
const EST_CFG = {
  "Fons Primari": { color: "#2B4C7E", bg: "#E8EFF5" },
  "Fons de Fons": { color: "#276749", bg: "#D6EAE0" },
  "SOCIMI":       { color: "#6B2E7E", bg: "#F3EEF8" },
};

function FundsIndexInner() {
  const { tc } = useTheme();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("compromis");
  const [sortDir, setSortDir] = useState("desc");

  const rawCC = useMemo(() => {
    try { const s = localStorage.getItem("tc_rawCC"); return s ? JSON.parse(s) : RAW_CC_DEFAULT; }
    catch { return RAW_CC_DEFAULT; }
  }, []);

  const fundMeta = useMemo(() => {
    try { const s = localStorage.getItem("tc_fundMeta"); return s ? JSON.parse(s) : FUND_META_DEFAULT; }
    catch { return FUND_META_DEFAULT; }
  }, []);

  const rows = useMemo(() => {
    const map = new Map();
    for (const r of rawCC) {
      if (!map.has(r.fons)) map.set(r.fons, { fons: r.fons, vcpe: r.vcpe, est: r.est, compromis: 0, calls: 0, dist: 0 });
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
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nom…"
          style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 200 }} />
      </div>
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "0 32px", display: "flex" }}>
        <span style={{ borderBottom: `2px solid ${tc.green}`, padding: "11px 20px", fontSize: 12, fontWeight: 600, color: tc.navy, whiteSpace: "nowrap" }}>Fons</span>
        <Link to="/investments/companies" style={{ borderBottom: "2px solid transparent", padding: "11px 20px", fontSize: 12, fontWeight: 400, color: tc.textMid, textDecoration: "none", whiteSpace: "nowrap" }}>Empreses</Link>
      </div>

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
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.slug} style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}>
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
                      {fmtX(r.tvpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpi) }}>
                      {fmtX(r.dpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpi) }}>
                      {fmtX(r.rvpi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
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
