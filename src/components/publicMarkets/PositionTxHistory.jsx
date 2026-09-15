import { useMemo, useState } from "react";
import { TC_LIGHT } from "../../theme.js";
import { fmtM } from "../../utils.js";
import { SectionHeader } from "../SharedComponents.jsx";

export function PositionTxHistory({ txs: scopedTxs = [], tc = TC_LIGHT, card }) {
  const [sortDesc, setSortDesc] = useState(true);
  const txs = useMemo(() => {
    return [...scopedTxs].sort((a, b) => {
      const cmp = (a.date ?? "").localeCompare(b.date ?? "");
      return sortDesc ? -cmp : cmp;
    });
  }, [scopedTxs, sortDesc]);

  return (
    <div style={card}>
      <SectionHeader
        title="Moviments"
        tc={tc}
        action={txs.length > 0 ? (
          <button onClick={() => setSortDesc(d => !d)} style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textLight,
          }}>{sortDesc ? "↓ Més recent" : "↑ Més antic"}</button>
        ) : undefined}
      />
      {txs.length === 0 && (
        <div style={{ fontSize: 12, color: tc.textLight, fontStyle: "italic" }}>Sense moviments registrats.</div>
      )}
      {txs.length > 0 && <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <thead>
          <tr>
            {["Data", "Acció", "Units", "NAV", "Valor", "Custodi"].map(h => (
              <th key={h} style={{
                padding: "5px 10px", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                color: tc.textLight, fontWeight: 600, borderBottom: `2px solid ${tc.border}`,
                textAlign: h === "Custodi" ? "left" : "right", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txs.map(t => {
            const isBuy = t.action === "buy";
            return (
              <tr key={t.id} style={{ borderBottom: `1px solid ${tc.border}` }}>
                <td style={{ padding: "5px 10px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight, textAlign: "right", whiteSpace: "nowrap" }}>{t.date}</td>
                <td style={{ padding: "5px 10px", textAlign: "right" }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: isBuy ? "#E8F8E8" : "#FDECEA",
                    color:      isBuy ? "#1C6B1D" : "#C62828", fontWeight: 600 }}>
                    {isBuy ? "Compra" : "Venda"}
                  </span>
                </td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{t.units != null ? t.units.toLocaleString("ca-ES", { maximumFractionDigits: 0 }) : "—"}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{t.nav != null ? t.nav.toFixed(2) : "—"}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>{t.valueEur != null ? fmtM(t.valueEur) : "—"}</td>
                <td style={{ padding: "5px 10px", fontSize: 11, color: tc.textLight }}>{t.custodian}</td>
              </tr>
            );
          })}
        </tbody>
      </table>}
    </div>
  );
}
