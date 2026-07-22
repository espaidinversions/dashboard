import { useTheme } from "../theme.js";
import { SEARCHER_STATUS_CFG } from "../config.js";
import { SANKEY_NODE_COLORS as _SANKEY_NODE_COLORS } from "../chartColors.js";

export const SANKEY_NODE_COLORS = _SANKEY_NODE_COLORS;

export const ENTRY_BADGE_CFG = {
  "Search Capital": { bg:"#E6EDF3", color:"#2563A8", border:"#E6EDF3" },
  "Equity Gap": { bg:"#F5F0FA", color:"#6B2E7E", border:"#F5F0FA" },
};

const STAGE_BADGE_CFG = {
  "Cerca activa": { bg:"#E8F8E8", color:"#1C6B1D" },
  "Equity Gap actiu": { bg:"#F5F0FA", color:"#6B2E7E" },
  "En adquisició": { bg:"#D6EAD6", color:"#1C5220" },
  "En revisió": { bg:"#FFF6DB", color:"#8A6400" },
  "Sense plaça": { bg:"#FDECEC", color:"#B01F17" },
  "Procés aturat": { bg:"#EEF2F7", color:"#425466" },
  "Descartat": { bg:"#FDECEC", color:"#B01F17" },
  "Sense classificar": { bg:"#EEF2F7", color:"#425466" },
};

export function StatusBadge({ s }) {
  const { tc: TC } = useTheme();
  const cfg = SEARCHER_STATUS_CFG[s] || { bg:TC.border, color:TC.textMid };
  return (
    <span style={{
      background:cfg.bg, color:cfg.color,
      borderRadius:20, padding:"2px 9px",
      fontSize:10, fontWeight:600, whiteSpace:"nowrap",
    }}>{s || "—"}</span>
  );
}

export function StageBadge({ label }) {
  const cfg = STAGE_BADGE_CFG[label] || STAGE_BADGE_CFG["Sense classificar"];
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      borderRadius: 20,
      padding: "2px 9px",
      fontSize: 10,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>{label || "—"}</span>
  );
}

export function SectionHeading({ icon, children, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <span style={{
        width:24,
        height:24,
        display:"inline-flex",
        alignItems:"center",
        justifyContent:"center",
        borderRadius:999,
        background:color,
        fontSize:13,
        lineHeight:1,
      }}>{icon}</span>
      <span style={{ fontSize:10, letterSpacing:"0.11em", color:"inherit", textTransform:"uppercase", fontWeight:600 }}>{children}</span>
    </div>
  );
}
