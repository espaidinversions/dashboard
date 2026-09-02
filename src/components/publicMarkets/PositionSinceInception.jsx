import { SectionHeader } from "../SharedComponents.jsx";

export function PositionSinceInception({
  p, ter, yh, netInici, isAbelFont,
  rendIniciColor, netIniciColor, cagrBrut, cagrNet, cagrBrutColor, cagrNetColor,
  tc, card,
}) {
  return (
    <div style={card}>
      <SectionHeader title="Des d'inici" tc={tc} />

      {/* TWR row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            TWR {isAbelFont ? "brut" : "total"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: rendIniciColor, fontFamily: "'DM Mono',monospace", letterSpacing: "-0.02em" }}>
            {p.rendInici != null ? (p.rendInici >= 0 ? "+" : "") + p.rendInici.toFixed(2) + "%" : "—"}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            MWR / CAGR
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: cagrBrutColor, fontFamily: "'DM Mono',monospace", letterSpacing: "-0.02em" }}>
            {cagrBrut != null ? (cagrBrut >= 0 ? "+" : "") + cagrBrut.toFixed(2) + "%" : "—"}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: tc.textLight, marginBottom: isAbelFont && netInici != null ? 12 : 0 }}>
        {yh.toFixed(1)} anys · TWR acumulat vs CAGR anualitzat
      </div>

      {/* Net row (Abel Font only) */}
      {isAbelFont && netInici != null && (
        <div style={{ borderTop: `1px solid ${tc.border}`, paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Net TER estimat</div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 2 }}>TWR net</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: netIniciColor, fontFamily: "'DM Mono',monospace" }}>
                {(netInici >= 0 ? "+" : "") + netInici.toFixed(2) + "%"}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 2 }}>CAGR net</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: cagrNetColor, fontFamily: "'DM Mono',monospace" }}>
                {cagrNet != null ? (cagrNet >= 0 ? "+" : "") + cagrNet.toFixed(2) + "%" : "—"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 4 }}>
            Brut − {ter.toFixed(2)}% TER × {yh.toFixed(1)} anys
          </div>
        </div>
      )}
    </div>
  );
}
