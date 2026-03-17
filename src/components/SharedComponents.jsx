import React from "react";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";

// ── Flag emoji as images via Twemoji (works on Windows) ───
// EN maps to GB (United Kingdom ISO code)
const GEO_TO_ISO = { EN:"gb" };

// Computes Twemoji SVG URL from 2-letter ISO country code
// Flag emoji codepoints = regional indicator letters (U+1F1E6 = A, …)
const twemojiUrl = (isoCode) => {
  const upper = (GEO_TO_ISO[isoCode] || isoCode).toUpperCase();
  const base = 0x1F1E6 - 65; // 65 = 'A'.charCodeAt(0)
  const cp1 = (upper.charCodeAt(0) + base).toString(16);
  const cp2 = (upper.charCodeAt(1) + base).toString(16);
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cp1}-${cp2}.svg`;
};

export const FlagImg = ({ geo, size=22 }) => (
  <img
    src={twemojiUrl(geo)}
    alt={geo}
    style={{ width:size, height:size, verticalAlign:"middle" }}
  />
);

// SVG <image> version for use inside Recharts pie chart labels
export const FlagSvgLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, geo }) => {
  if (percent < 0.07) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + r * Math.cos(-midAngle * R);
  const y = cy + r * Math.sin(-midAngle * R);
  return (
    <image
      href={twemojiUrl(geo)}
      x={x - 11} y={y - 11}
      width={22} height={22}
    />
  );
};

// ── Subcomponents compartits ──────────────────────────────
export function Logo() {
  return <img src="/logo.jpg" alt="Turtle Capital" style={{height:60,objectFit:"contain"}}/>;
}

export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:5,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{label}</span>;
}

export const BarTip = ({active,payload,label}) => {
  const { tc: TC } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:TC.card,border:`1px solid ${TC.border}`,borderRadius:7,padding:"10px 14px",boxShadow:"0 4px 12px rgba(0,0,0,.18)",minWidth:160}}>
      <p style={{color:TC.navy,margin:"0 0 6px",fontWeight:700,fontSize:12}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.fill||TC.navy,margin:"2px 0",fontSize:12,display:"flex",justifyContent:"space-between",gap:16}}>
          <span>{p.name}</span><span style={{fontWeight:700}}>{fmtM(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export const PieTip = ({active,payload}) => {
  const { tc: TC } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:TC.card,border:`1px solid ${TC.border}`,borderRadius:7,padding:"10px 14px",boxShadow:"0 4px 12px rgba(0,0,0,.18)"}}>
      <p style={{color:TC.navy,margin:0,fontWeight:700,fontSize:12}}>{payload[0].name}</p>
      <p style={{color:TC.green,margin:"4px 0 0",fontSize:13,fontWeight:700}}>{fmtM(payload[0].value)}</p>
      <p style={{color:TC.textLight,margin:"2px 0 0",fontSize:11}}>{payload[0].payload.pct}%</p>
    </div>
  );
};

export const PL = ({cx,cy,midAngle,innerRadius,outerRadius,percent}) => {
  if(percent<0.06)return null;
  const R=Math.PI/180, r=innerRadius+(outerRadius-innerRadius)*0.58;
  return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="700">{`${(percent*100).toFixed(0)}%`}</text>;
};

// ══════════════════════════════════════════════════════════
// SELECTOR MULTI-FONS (panel lateral/dropdown)
