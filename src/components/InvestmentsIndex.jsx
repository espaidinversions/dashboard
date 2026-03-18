import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RAW_CC as RAW_CC_DEFAULT } from "../config.js";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

function InvestmentsIndexInner() {
  const { tc, dark } = useTheme();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("compromis");
  const [sortDir, setSortDir] = useState("desc");

  // Load rawCC (same pattern as Dashboard.jsx)
  const rawCC = useMemo(() => {
    try {
      const s = localStorage.getItem("tc_rawCC");
      return s ? JSON.parse(s) : RAW_CC_DEFAULT;
    } catch { return RAW_CC_DEFAULT; }
  }, []);

  // Build fund rows: one entry per unique fons
  const fundRows = useMemo(() => {
    const map = new Map();
    for (const r of rawCC) {
      if (!map.has(r.fons)) {
        map.set(r.fons, { fons: r.fons, vcpe: r.vcpe, compromis: 0, calls: 0 });
      }
      const f = map.get(r.fons);
      if (r.cat === "Compromís") f.compromis += r.eur;
      if (r.cat === "Capital Call") f.calls += r.eur;
    }
    return Array.from(map.values()).map(f => ({
      ...f,
      slug: slugify(f.fons),
      tipus: `Fons ${f.vcpe}`,
      utilitat: f.compromis > 0 ? (f.calls / f.compromis) * 100 : null,
    }));
  }, [rawCC]);

  // Build company rows
  const companyRows = useMemo(() =>
    PORTFOLIO_COMPANIES.map(c => ({
      nom: c.nom,
      slug: slugify(c.nom),
      tipus: c.tipus === "SF" ? "Empresa SF" : "Empresa PE",
      compromis: c.ticket,
      calls: null,
      utilitat: null,
      tvpi: c.tvpi,
      _isCompany: true,
    })),
  []);

  const allRows = useMemo(() => [...fundRows, ...companyRows], [fundRows, companyRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(r => (r.fons || r.nom).toLowerCase().includes(q));
  }, [allRows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === "compromis") { av = a.compromis ?? 0; bv = b.compromis ?? 0; }
      else if (sortKey === "utilitat") { av = a.utilitat ?? -1; bv = b.utilitat ?? -1; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else { av = (a.fons || a.nom).toLowerCase(); bv = (b.fons || b.nom).toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const tvpiColor = (v) => {
    if (v == null) return tc.textLight;
    if (v < 1) return "#E53E3E";
    if (v < 1.5) return "#D69E2E";
    return tc.green;
  };

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <span style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em" }}>
          Totes les <span style={{ color: tc.green }}>Inversions</span>
        </span>
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per nom…"
          style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 200 }}
        />
      </div>

      {/* Table */}
      <div style={{ padding: "24px 32px" }}>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {[
                    { k: "nom", label: "Nom" },
                    { k: "tipus", label: "Tipus" },
                    { k: "compromis", label: "Compromís" },
                    { k: "utilitat", label: "Utilizat" },
                    { k: "tvpi", label: "TVPI" },
                  ].map(({ k, label }) => (
                    <th key={k}
                      onClick={() => toggleSort(k)}
                      style={{ padding: "10px 12px", textAlign: k === "nom" || k === "tipus" ? "left" : "right", fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const name = r.fons || r.nom;
                  const href = r._isCompany ? `/company/${r.slug}` : `/fund/${r.slug}`;
                  const bg = i % 2 === 0 ? "transparent" : tc.bgAlt;
                  return (
                    <tr key={r.slug} style={{ background: bg, borderBottom: `1px solid ${tc.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        <Link to={href} style={{ color: tc.navy, textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                          {name}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: tc.textMid }}>{r.tipus}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                        {r.compromis ? fmtM(r.compromis) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>
                        {r.utilitat != null ? `${r.utilitat.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: tvpiColor(r.tvpi) }}>
                        {r.tvpi != null ? `${r.tvpi.toFixed(2)}×` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

export default function InvestmentsIndex() {
  const { dark } = useTheme();
  return (
    <ThemeContext.Provider value={dark ? TC_DARK : TC_LIGHT}>
      <InvestmentsIndexInner />
    </ThemeContext.Provider>
  );
}
