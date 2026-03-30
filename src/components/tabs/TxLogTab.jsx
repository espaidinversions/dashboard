import React, { useState } from "react";
import { Link } from "react-router-dom";
import { fmtM, slugify } from "../../utils.js";
import { CAT_CFG } from "../../config.js";

export function TxLogTab({ tc, filtered, catCfg }) {
  const [sortK, setSortK] = useState("data");
  const [sortDir, setSortDir] = useState("desc");

  const sortTx = k => {
    if (sortK === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortK(k); setSortDir("desc"); }
  };
  const TArr = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortK === k ? 1 : 0.2, fontSize: 9 }}>
      {sortK === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortK], vb = b[sortK];
    if (typeof va === "string") {
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const th = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 };

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: tc.bgAlt }}>
              {[
                { k: "data", l: "Data" },
                { k: "fons", l: "Fons" },
                { k: "tipus", l: "Tipus" },
                { k: "cat", l: "Categoria" },
                { k: "eur", l: "Import EUR", right: true },
                { k: "fy", l: "FY" },
                { k: "vcpe", l: "VC/PE" },
                { k: "est", l: "Estratègia" },
              ].map(h => (
                <th key={h.k} onClick={() => sortTx(h.k)}
                  style={{ ...th, textAlign: h.right ? "right" : "left", cursor: "pointer" }}>
                  {h.l}<TArr k={h.k} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const cfg = catCfg[r.cat] || {};
              return (
                <tr key={`${r.data}-${r.cat}-${r.eur}-${i}`} className="hoverable"
                  style={{ borderBottom: `1px solid ${tc.border}`, background: i % 2 === 0 ? "transparent" : tc.bgAlt }}>
                  <td style={{ padding: "10px 10px", fontSize: 12, color: tc.textMid }}>{r.data}</td>
                  <td style={{ padding: "10px 10px", fontSize: 12 }}>
                    <Link to={`/fund/${slugify(r.fons)}`} style={{ color: tc.navy, fontWeight: 600, textDecoration: "none" }}>
                      {r.fons}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 12, color: tc.textMid }}>{r.tipus}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <span style={{ fontSize: 10, background: cfg.bg || tc.bgAlt, color: cfg.color || tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                      {r.cat}
                    </span>
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: r.eur > 0 ? tc.navy : tc.green }}>
                    {r.eur < 0 && "+ "}{fmtM(Math.abs(r.eur))}
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 12, color: tc.textLight }}>{r.fy}</td>
                  <td style={{ padding: "10px 10px", fontSize: 12, color: tc.textMid }}>{r.vcpe}</td>
                  <td style={{ padding: "10px 10px", fontSize: 12, color: tc.textMid }}>{r.est}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${tc.border}`, background: tc.bgAlt }}>
              <td colSpan={4} style={{ padding: "9px 10px", fontSize: 12, fontWeight: 700 }}>TOTAL ({sorted.length} transaccions)</td>
              <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.navy, fontSize: 12 }}>
                {fmtM(filtered.filter(r => r.eur > 0).reduce((s, r) => s + r.eur, 0))} cridat
                {filtered.filter(r => r.eur < 0).length > 0 && (
                  <span style={{ color: tc.green, marginLeft: 8 }}>
                    {fmtM(filtered.filter(r => r.eur < 0).reduce((s, r) => s + Math.abs(r.eur), 0))} rebut
                  </span>
                )}
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
