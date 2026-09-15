import { TC_LIGHT } from "../../theme.js";
import { fmtM } from "../../utils.js";
import { SectionHeader } from "../SharedComponents.jsx";

function InfoRow({ label, value, tc = TC_LIGHT }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: tc.textLight, fontSize: 11, paddingRight: 24, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</td>
      <td style={{ padding: "6px 0", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{value ?? "—"}</td>
    </tr>
  );
}

export function PositionCostBreakdown({ p, ter, terOverride, isAbelFont, isClosed, tc, card }) {
  return (
    <div style={{ ...card, flex: 1 }}>
      <SectionHeader title="Detall de cost" tc={tc} />
      <table>
        <tbody>
          <InfoRow label="Unitats"           value={p.unitats != null ? p.unitats.toLocaleString("ca-ES") : null} tc={tc} />
          <InfoRow label="Preu d'entrada"    value={p.costInici != null ? p.costInici.toFixed(4) : null} tc={tc} />
          <InfoRow label="Cost total"        value={p.costEur != null ? fmtM(p.costEur) : null} tc={tc} />
          <InfoRow label="TER anual"
            value={ter > 0 ? (
              <span>{ter.toFixed(2)}%{terOverride != null && <span title="TER manual (override)" style={{ fontSize: 8, fontWeight: 700, background: "#FFF3E0", color: "#E65100", borderRadius: 4, padding: "1px 4px", marginLeft: 5 }}>OV</span>}</span>
            ) : null}
            tc={tc} />
          <InfoRow label="Cost anual"
            value={ter > 0 && p.costEur != null
              ? fmtM(p.costEur * ter / 100) + "/any" : null}
            tc={tc} />
          <InfoRow label="Data compra"       value={p.dataCompra} tc={tc} />
          {isClosed && p.any && <InfoRow label="Any tancament" value={String(p.any)} tc={tc} />}
        </tbody>
      </table>
      {isAbelFont && (
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
          Gestió externa — el TER reflecteix el cost de gestió del vehicle.
        </div>
      )}
    </div>
  );
}
