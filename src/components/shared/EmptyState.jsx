import React from "react";
import { useTheme } from "../../theme.js";

export function EmptyState({ message = "Cap resultat amb els filtres actuals." }) {
  const { tc } = useTheme();
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"48px 24px", color:tc.textLight, gap:10 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.4 }}>
        <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
      <span style={{ fontSize:14, fontWeight:600, color:tc.textMid }}>{message}</span>
      <span style={{ fontSize:12 }}>Prova a canviar o treure algun filtre.</span>
    </div>
  );
}

