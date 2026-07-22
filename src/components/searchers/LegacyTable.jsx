import { fmtM, formatMultiple, tvpiColor } from "../../utils.js";
import { FlagImg } from "../SharedComponents.jsx";
import { tableCardStyle } from "../SharedComponents.jsx";
import { SectionHeading } from "../SearchersBadges.jsx";
import { searcherKey, formatEquityStake } from "../../data/searcherFormatting.js";

export function LegacyTable({ TC, dark, canEdit, legacyRows, saveSearcherField }) {
  const th = { padding: "9px 10px", fontSize: 10, fontWeight: 700, color: TC.navyLight ?? TC.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${TC.border}`, whiteSpace: "nowrap", userSelect: "none" };
  const sec = { fontSize: 10, letterSpacing: "0.11em", color: TC.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 };

  return (
    <div style={{ ...tableCardStyle(TC), marginBottom: 14 }}>
      <div style={{ ...sec, color: TC.textLight }}>
        <SectionHeading icon="📦" color={dark ? "#1a1a2e" : "#F0EDF8"}>Searchers Legacy (Desinvertits)</SectionHeading>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { label: "Search Fund", k: "nom" },
                { label: "Searchers", k: "searchers" },
                { label: "Entrada", k: "formEntrada" },
                { label: "Modalitat", k: "modalitat" },
                { label: "Pais", k: "geo" },
                { label: "Ticket", k: "ticket", right: true },
                { label: "TVPI", k: "tvpi", right: true },
                { label: "IRR", k: "irr", right: true },
                { label: "DPI", k: "dpi", right: true },
                { label: "Any Inv.", k: "investmentYear", center: true },
                { label: "Equity Stake", k: "equityStake", right: true },
              ].map(h => (
                <th key={h.k} style={{ ...th, textAlign: h.right ? "right" : h.center ? "center" : "left" }}>{h.label}</th>
              ))}
              {canEdit && <th style={{ ...th, textAlign: "center" }}>Actiu</th>}
            </tr>
          </thead>
          <tbody>
            {legacyRows.length === 0 && (
              <tr><td colSpan={12} style={{ padding: "20px 10px", textAlign: "center", color: TC.textLight, fontSize: 12 }}>Cap searcher marcat com a Legacy.</td></tr>
            )}
            {legacyRows.map((r, i) => (
              <tr key={searcherKey(r) ?? r.nom} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                <td style={{ padding: "9px 10px", fontWeight: 600, color: TC.navy }}>{r.nom}</td>
                <td style={{ padding: "9px 10px", color: TC.textMid }}>{r.searchers || "—"}</td>
                <td style={{ padding: "9px 10px" }}>{r.formEntrada || "—"}</td>
                <td style={{ padding: "9px 10px" }}>{r.modalitat || "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}><FlagImg geo={r.geo} /></td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: TC.navyLight }}>{fmtM(r.ticket)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tvpiColor(r.tvpi, TC) }}>{r.tvpi != null ? formatMultiple(r.tvpi) : "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{r.irr != null ? `${(r.irr * 100).toFixed(1)}%` : "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{r.dpi != null ? formatMultiple(r.dpi) : "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", color: TC.textMid }}>{r.investmentYear || "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: TC.navyLight }}>{formatEquityStake(r.equityStake)}</td>
                {canEdit && (
                  <td style={{ padding: "9px 10px", textAlign: "center" }}>
                    <button
                      title="Torna a Actius"
                      onClick={() => saveSearcherField(r, "isLegacy", false)}
                      style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}
                    >Actiu</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {legacyRows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${TC.border}` }}>
                <td colSpan={5} style={{ padding: "9px 10px", fontWeight: 700, fontSize: 11, color: TC.navyLight }}>TOTAL ({legacyRows.length} searchers)</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: TC.navy }}>{fmtM(legacyRows.reduce((s, r) => s + (r.ticket ?? 0), 0))}</td>
                <td colSpan={canEdit ? 6 : 5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
