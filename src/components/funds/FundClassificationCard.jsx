import { EST_CFG } from "../../config.js";
import { Badge, SectionHeader } from "../SharedComponents.jsx";

// Color maps mirror the dashboard palette (Dashboard.jsx geoCfg/sectorCfg and
// AssetAllocationTab STRATEGY_CFG) so a vehicle's one-pager reads consistently
// with the Resum donuts and Asset Allocation view.
function geoColor(tc) {
  return {
    "Nord America": tc.navy,
    "Nord d'Europa": tc.green,
    "Sud d'Europa": "#C9822E",
    "Asia": "#7A5AA6",
    "LatAm": "#2E9C8E",
  };
}
function sectorColor(tc) {
  return {
    "Tecnologia": tc.navy,
    "Consum": "#C9822E",
    "Salut": "#3AA76D",
    "Industrials / Materials": "#6B7280",
    "Energy": "#E0A93B",
    "Telecoms": "#7A5AA6",
    "Finance": "#2E6FB0",
    "Food & Agriculture": "#8FA31E",
    "Serveis": "#2E9C8E",
    "Real Estate & Infraestructure": tc.purple || "#9B7CC8",
  };
}
const STRATEGY_COLOR = {
  "Small Buyout": "#1E3A5F",
  "Mid Buyout": "#2E6FB0",
  "Large Buyout": "#5B9BD5",
  "Growth": "#3AA76D",
  "VC": "#C9822E",
  "Turnaround": "#9B7CC8",
  "Real Estate & Infraestructure": "#6B7280",
};

// Fund-type est composition (underlying deal-type mix). Distinct hues so this
// bar doesn't read as the same dimension as the strategy "Tipus fons" bar.
const FUND_TYPE_COLOR = {
  "Fons de Fons": "#1E3A5F",
  "Fons Primari": "#2E6FB0",
  "Fons Secundari": "#C9822E",
  "Fons de Coinversió": "#3AA76D",
};

// Deterministic fallback for keys not in the palette above.
const FALLBACK = ["#1E3A5F", "#2E6FB0", "#3AA76D", "#C9822E", "#7A5AA6", "#2E9C8E", "#8FA31E", "#6B7280"];

// Turn a jsonb weight map into a sorted, %-normalized, colored list.
// "Sense classificar" is always pushed last so it reads as a residual bucket.
function toSegments(map, colorMap, tc) {
  if (!map || typeof map !== "object") return [];
  const entries = Object.entries(map)
    .map(([key, value]) => [key, Number(value)])
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return [];
  entries.sort((a, b) => {
    if (a[0] === "Sense classificar") return 1;
    if (b[0] === "Sense classificar") return -1;
    return b[1] - a[1];
  });
  return entries.map(([key, value], i) => ({
    key,
    pct: Math.round((value / total) * 100),
    color: key === "Sense classificar" ? tc.textLight : colorMap[key] || FALLBACK[i % FALLBACK.length],
  }));
}

function DistributionRow({ label, segments, tc }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 96, flexShrink: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: tc.textLight, paddingTop: 1 }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {segments.length === 0 ? (
          <span style={{ fontSize: 12, color: tc.textLight }}>Sense dades</span>
        ) : (
          <>
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: tc.bgAlt }}>
              {segments.map((s) => (
                <div key={s.key} title={`${s.key} · ${s.pct}%`} style={{ width: `${s.pct}%`, background: s.color }} />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", marginTop: 8 }}>
              {segments.map((s) => (
                <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: tc.textMid }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  {s.key}
                  <span style={{ fontFamily: "'DM Mono',monospace", color: tc.textLight }}>{s.pct}%</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Classificació card for the vehicle one-pager: the categorical vehicle class
 * (est) as a badge, plus geography / vertical / fund-type weight maps rendered
 * as 100%-stacked mini bars with a legend.
 */
export function FundClassificationCard({ tc, est, geography, sector, strategy, fundTypeMix }) {
  const rows = [
    { label: "Al·locació", segments: toSegments(fundTypeMix, FUND_TYPE_COLOR, tc) },
    { label: "Geografia", segments: toSegments(geography, geoColor(tc), tc) },
    { label: "Vertical", segments: toSegments(sector, sectorColor(tc), tc) },
    { label: "Tipus fons", segments: toSegments(strategy, STRATEGY_COLOR, tc) },
  ];

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
      <SectionHeader title="Classificació" tc={tc} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 96, flexShrink: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: tc.textLight }}>
            Classe
          </div>
          {est ? <Badge label={est} cfg={EST_CFG[est] || {}} /> : <span style={{ fontSize: 12, color: tc.textLight }}>—</span>}
        </div>
        {rows.map((r) => (
          <DistributionRow key={r.label} label={r.label} segments={r.segments} tc={tc} />
        ))}
      </div>
    </div>
  );
}
