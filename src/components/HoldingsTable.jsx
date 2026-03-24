import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, cagr, yearsHeld } from "../utils.js";

function SectionHeader({ tipus, count, total, tc }) {
  const isRV  = tipus === "RV";
  const color = isRV ? tc.navy : "#7A6000";
  const label = isRV ? "Renda Variable" : "Renda Fixa";
  return (
    <tr>
      <td colSpan={11} style={{
        padding: "8px 10px", fontWeight: 700, fontSize: 10,
        letterSpacing: "0.09em", textTransform: "uppercase",
        color, borderBottom: `2px solid ${tc.border}`,
        borderTop: `1px solid ${tc.border}`,
      }}>
        {label} · <span style={{ fontFamily: "'DM Mono',monospace" }}>{count} posicions · {fmtM(total)}</span>
      </td>
    </tr>
  );
}

function PnlCell({ v, tc }) {
  if (v == null) {
    return <td style={{ padding: "6px 10px", textAlign: "right", color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</td>;
  }
  const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
  const bg    = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
  const label = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  return (
    <td style={{ padding: "6px 10px", textAlign: "right" }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg, borderRadius: 4, padding: "1px 5px" }}>{label}</span>
    </td>
  );
}

export function HoldingsTable() {
  const { tc, dark } = useTheme();

  const [gestorFilter, setGestorFilter] = useState("all");
  const [tipusFilter,  setTipusFilter]  = useState("all");
  const [sortCol, setSortCol] = useState("valorMercat");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const rows = useMemo(() => {
    let all = [...PM_POSITIONS];
    if (gestorFilter !== "all") all = all.filter(p => p.gestor === gestorFilter);
    if (tipusFilter  !== "all") all = all.filter(p => p.tipus  === tipusFilter);
    all.sort((a, b) => {
      const va = a[sortCol] ?? (sortDir === "desc" ? -Infinity : Infinity);
      const vb = b[sortCol] ?? (sortDir === "desc" ? -Infinity : Infinity);
      if (typeof va === "string") return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return all;
  }, [gestorFilter, tipusFilter, sortCol, sortDir]);

  const th = {
    padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em",
    color: tc.textLight, textTransform: "uppercase", fontWeight: 600,
    borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap",
    userSelect: "none", cursor: "pointer",
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span style={{ color: tc.navy }}>{sortDir === "desc" ? " ↓" : " ↑"}</span>;
  };

  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 5, fontSize: 11,
      border: `1.5px solid ${active ? tc.navy : tc.border}`,
      background: active ? (dark ? "#0A1A30" : "#E8F0FA") : "transparent",
      color: active ? tc.navy : tc.textLight,
      cursor: "pointer", fontFamily: "inherit",
      fontWeight: active ? 700 : 400,
    }}>{label}</button>
  );

  return (
    <div style={{
      background: tc.card, borderRadius: 10,
      border: `1px solid ${tc.border}`,
      padding: "20px 24px",
      boxShadow: "0 2px 8px rgba(0,0,0,.06)",
    }}>

      {/* ── Filter pills ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {pillBtn(tipusFilter === "all", () => setTipusFilter("all"), "Tots")}
          {pillBtn(tipusFilter === "RV",  () => setTipusFilter("RV"),  "RV")}
          {pillBtn(tipusFilter === "RF",  () => setTipusFilter("RF"),  "RF")}
        </div>
        <div style={{ width: 1, height: 20, background: tc.border }} />
        <div style={{ display: "flex", gap: 4 }}>
          {pillBtn(gestorFilter === "all",             () => setGestorFilter("all"),             "Tots els gestors")}
          {pillBtn(gestorFilter === "CaixaBank / UBS", () => setGestorFilter("CaixaBank / UBS"), "Caixa / UBS")}
          {pillBtn(gestorFilter === "Abel Font",       () => setGestorFilter("Abel Font"),       "Abel Font")}
        </div>
        <div style={{ fontSize: 11, color: tc.textLight, marginLeft: "auto" }}>
          {rows.length} posicions · {fmtM(rows.reduce((s, p) => s + (p.valorMercat || 0), 0))}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left"  }} onClick={() => handleSort("nom")}>
                Nom{sortIcon("nom")}
              </th>
              <th style={{ ...th, textAlign: "left"  }} onClick={() => handleSort("gestor")}>
                Gestor{sortIcon("gestor")}
              </th>
              <th style={{ ...th, textAlign: "left"  }}>Tipus</th>
              <th style={{ ...th, textAlign: "left"  }}>ISIN</th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("dataCompra")}>
                Data compra{sortIcon("dataCompra")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("valorMercat")}>
                Valor mercat{sortIcon("valorMercat")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("rendInici")}>
                P&amp;L{sortIcon("rendInici")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("pes")}>
                Pes %{sortIcon("pes")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("rend2026")}>
                YTD{sortIcon("rend2026")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("rend2025")}>
                2025{sortIcon("rend2025")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("costAnual")}>
                TER{sortIcon("costAnual")}
              </th>
              <th style={{ ...th, textAlign: "center" }}>MS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const zebra  = i % 2 === 1;
              const bg     = zebra ? (dark ? tc.bgAlt : "#f8f9fb") : tc.card;
              const msUrl  = `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}`;
              const isRV   = p.tipus === "RV";
              const typColor = isRV ? "#2B5070" : "#7A6000";
              const typBg    = isRV ? "#E6EDF3" : "#FFF8E1";
              return (
                <tr key={p.id} className="hoverable" style={{ background: bg, borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                    <Link to={`/mercats-publics/${p.id}`}
                      style={{ color: tc.navy, textDecoration: "none" }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "6px 10px", fontSize: 11, color: tc.textLight }}>{p.gestor}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: typColor, background: typBg, borderRadius: 4, padding: "1px 6px" }}>
                      {p.tipus}
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", fontFamily: "'DM Mono',monospace", fontSize: 10, color: tc.textLight }}>{p.isin}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>{p.dataCompra}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
                    {p.valorMercat != null ? fmtM(p.valorMercat) : "—"}
                  </td>
                  <PnlCell v={p.rendInici} tc={tc} />
                  <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
                    {p.pes != null ? p.pes.toFixed(1) + "%" : "—"}
                  </td>
                  <PnlCell v={p.rend2026} tc={tc} />
                  <PnlCell v={p.rend2025} tc={tc} />
                  <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
                    {p.costAnual != null ? p.costAnual.toFixed(2) + "%" : "—"}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "center" }}>
                    {p.isin ? (
                      <a href={msUrl} target="_blank" rel="noreferrer"
                         style={{ color: "#E8A020", fontSize: 11, textDecoration: "none" }} title="Morningstar">★</a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
        WAM (€6.1M) i Andbank (€6.1M) gestionats directament — posicions individuals no disponibles.
      </div>
    </div>
  );
}
