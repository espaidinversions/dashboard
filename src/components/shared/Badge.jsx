import React from "react";
import { useTheme } from "../../theme.js";

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  const border = s.border ?? hexToRgba(s.color, 0.15);
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:4,padding:"2px 7px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block",border:`1px solid ${border}`}}>{label}</span>;
}

