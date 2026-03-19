import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

const TIPUS_CFG = {
  "SF": { color: "#276749", bg: "#E8F5E9" },
  "PE": { color: "#2B4C7E", bg: "#E8EFF5" },
};

export function CompaniesIndexInner({ inline = false, searchOverride }) {
  const { tc } = useTheme();
  const [searchLocal, setSearchLocal] = useState("");
  const search = searchOverride !== undefined ? searchOverride : searchLocal;
  const [sortKey, setSortKey] = useState("ticket");
  const [sortDir, setSortDir] = useState("desc");

  const rows = useMemo(() =>
    PORTFOLIO_COMPANIES.map(c => ({
      ...c,
      slug: slugify(c.nom),
      dpiMultiple: c.ticket > 0 && c.dpiEur != null ? c.dpiEur / c.ticket : null,
      rvpiMultiple: c.ticket > 0 && c.rvpiEur != null ? c.rvpiEur / c.ticket : null,
    })),
  []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => r.nom.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isMock !== b.isMock) return a.isMock ? -1 : 1;
      let av, bv;
      if (sortKey === "ticket") { av = a.ticket ?? 0; bv = b.ticket ?? 0; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else if (sortKey === "dpi") { av = a.dpiMultiple ?? -1; bv = b.dpiMultiple ?? -1; }
      else if (sortKey === "rvpi") { av = a.rvpiMultiple ?? -1; bv = b.rvpiMultiple ?? -1; }
      else { av = a.nom.toLowerCase(); bv = b.nom.toLowerCase(); }
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

  const multipleColor = v => {
    if (v == null) return tc.textLight;
    if (v < 1) return tc.red;
    if (v < 1.5) return tc.warning;
    return tc.green;
  };

  const fmtX = v => v != null ? `${v.toFixed(2)}×` : "—";

  const COLS = [
    { k: "nom",    label: "Nom",    align: "left" },
    { k: "tipus",  label: "Tipus",  align: "left" },
    { k: "ticket", label: "Ticket", align: "right" },
    { k: "tvpi",   label: "TVPI",   align: "right" },
    { k: "dpi",    label: "DPI",    align: "right" },
    { k: "rvpi",   label: "RVPI",   align: "right" },
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
            <Link to="/investments/funds" style={{ borderBottom: "2px solid transparent", padding: "11px 20px", fontSize: 12, fontWeight: 400, color: tc.textMid, textDecoration: "none", whiteSpace: "nowrap" }}>Fons</Link>
            <span style={{ borderBottom: `2px solid ${tc.green}`, padding: "11px 20px", fontSize: 12, fontWeight: 600, color: tc.navy, whiteSpace: "nowrap" }}>Empreses</span>
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
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.slug} style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}`, opacity: r.isMock ? 0.45 : 1 }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link to={`/company/${r.slug}`} style={{ color: tc.navy, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        {r.nom}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge label={r.tipus} cfg={TIPUS_CFG[r.tipus] || {}} />
                        <span style={{ fontSize: 11, color: tc.textMid }}>{r.segment}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {fmtM(r.ticket)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi) }}>
                      {fmtX(r.tvpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpiMultiple) }}>
                      {fmtX(r.dpiMultiple)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpiMultiple) }}>
                      {fmtX(r.rvpiMultiple)}
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

export default function CompaniesIndex() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <CompaniesIndexInner />
    </ThemeContext.Provider>
  );
}
