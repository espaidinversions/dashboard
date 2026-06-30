import React from "react";
import { MGR_COLORS as _MGR_COLORS } from "../../chartColors.js";
import { TC_LIGHT } from "../../theme.js";
import { KpiCard as _KpiCard } from "../SharedComponents.jsx";
import { PM_MODEL } from "../../data/publicMarketsModel.js";
const PM_MANAGERS = PM_MODEL.metadata.managers;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_CLOSED = PM_MODEL.holdings.closed;

const _abelCustodians = new Set(["Bankinter", "Interactive Brokers"]);
const _abelPos = PM_POSITIONS.filter(p => _abelCustodians.has(p.custodian));
const _abelRV = _abelPos.filter(p => p.tipus === "RV").reduce((s, p) => s + (p.valorMercat ?? 0), 0);
const _abelRF = _abelPos.filter(p => p.tipus === "RF").reduce((s, p) => s + (p.valorMercat ?? 0), 0);
const _abelPosTotal = _abelRV + _abelRF;
// Fallback 0.7516 = RV share as of Mar 2026 snapshot (used only when positions list is empty).
export const ABEL_RV_SPLIT = _abelPosTotal > 0 ? _abelRV / _abelPosTotal : 0.7516;
export const ABEL_RF_SPLIT = 1 - ABEL_RV_SPLIT;

export const TIPUS_CFG = {
  RV: { color: "#2B5070", bg: "#E6EDF3" },
  RF: { color: "#7A6000", bg: "#FFF8E1" },
  "RV+RF": { color: "#28A029", bg: "#E8F8E8" },
};

export const MGR_COLORS = _MGR_COLORS;

export const AREA_COLORS = {
  total: "#2B5070",
  rv:    "#2B5070",
  rf:    "#E8A020",
  ...MGR_COLORS,
};

const _cy = new Date().getFullYear();
export const PERIODS = [
  { field: `r${_cy - 2}`, label: String(_cy - 2) },
  { field: `r${_cy - 1}`, label: String(_cy - 1) },
  { field: "ytd", label: `YTD '${String(_cy).slice(2)}` },
];

const DEFAULT_EXPAND_TIPUS = {
  caixa: "all",
  ubs: "all",
  abel: "all",
  andbank: null,
};

export function weightedReturn(field, managerValueById, tipus = null, managers = PM_MANAGERS) {
  const entries = managers.flatMap((manager) => {
    if (manager[field] == null) return [];
    const managerValue = managerValueById?.[manager.id] ?? manager.valorActual;
    if (tipus === null) return [{ val: managerValue, r: manager[field] }];
    if (manager.tipus === tipus) return [{ val: managerValue, r: manager[field] }];
    if (manager.tipus === "RV+RF") {
      const split = tipus === "RV" ? ABEL_RV_SPLIT : ABEL_RF_SPLIT;
      return [{ val: managerValue * split, r: manager[field] }];
    }
    return [];
  });

  const totalVal = entries.reduce((sum, entry) => sum + entry.val, 0);
  return totalVal > 0
    ? entries.reduce((sum, entry) => sum + entry.r * entry.val, 0) / totalVal
    : null;
}

function custodianMatch(custodians) {
  return (p) => custodians.includes(p.custodian);
}

export function getMgrPositions(mgrId) {
  let custodians;
  if (mgrId === "caixa")       custodians = ["CaixaBank"];
  else if (mgrId === "ubs")    custodians = ["UBS", "Credit Suisse"];
  else if (mgrId === "bankinter") custodians = ["Bankinter"];
  else if (mgrId === "jpmorgan")  custodians = ["JPMorgan"];
  else return null; // ib and andbank: aggregated only, no drill-down

  const match = custodianMatch(custodians);
  const active = PM_POSITIONS.filter(match)
    .sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0));
  const discontinued = PM_CLOSED.filter(match)
    .sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0))
    .map((p) => ({ ...p, _discontinued: true }));

  return [...active, ...discontinued];
}

export function isEtfPosition(pos) {
  return pos?.nom?.toUpperCase().includes("ETF") ?? false;
}

export function computeWeightedTer(positions) {
  const withTer = (positions ?? []).filter(p => p.costAnual != null);
  if (withTer.length === 0) return null;
  const totalVal = withTer.reduce((s, p) => s + (p.valorMercat ?? 0), 0);
  if (totalVal === 0) return null;
  return withTer.reduce((s, p) => s + (p.costAnual ?? 0) * (p.valorMercat ?? 0), 0) / totalVal;
}

export function computePositionWeightedYtd(positions) {
  const _cy = new Date().getFullYear();
  const field = `rend${_cy}`;
  const withYtd = (positions ?? []).filter(p => p[field] != null);
  if (withYtd.length === 0) return null;
  const totalVal = withYtd.reduce((s, p) => s + (p.valorMercat ?? 0), 0);
  if (totalVal === 0) return null;
  return withYtd.reduce((s, p) => s + (p[field] ?? 0) * (p.valorMercat ?? 0), 0) / totalVal;
}

export function computeLastPriceDateForPositions(positions, pmValues) {
  let last = null;
  for (const pos of (positions ?? [])) {
    if (!pos.isin) continue;
    const byCustodian = pmValues?.[pos.isin];
    if (!byCustodian || typeof byCustodian !== "object") continue;
    for (const series of Object.values(byCustodian)) {
      if (!Array.isArray(series)) continue;
      for (let i = series.length - 1; i >= 0; i--) {
        const entry = series[i];
        const date = entry?.date;
        if (date && Number.isFinite(Number(entry?.value))) {
          if (!last || date > last) last = date;
          break;
        }
      }
    }
  }
  return last;
}

const _MONTH_ABBR_CA = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];

export function mtmStaleness(lastYYYYMM) {
  if (!lastYYYYMM) return { label: "N/D", color: "#8A9BAC", days: null };
  const [y, m] = lastYYYYMM.split("-").map(Number);
  const endOfMonth = new Date(y, m, 0);
  const today = new Date();
  const days = Math.floor((today - endOfMonth) / 86400000);
  const label = `${_MONTH_ABBR_CA[m - 1]}. '${String(y).slice(2)}`;
  const color = days <= 15 ? "#28A029" : days <= 30 ? "#E8A020" : "#B52020";
  return { label, color, days };
}

export function KpiCard({ label, value, sub, tc = TC_LIGHT, valueColor, hero = false }) {
  return <_KpiCard label={label} value={value} sub={sub} tc={tc} valueColor={valueColor} hero={hero} />;
}

export function PctChip({ v, tc = TC_LIGHT }) {
  if (v == null) return <span style={{ fontSize: 11, color: tc.textLight }}>—</span>;
  const pos = v > 0.005;
  const neg = v < -0.005;
  const color = pos ? tc.green : neg ? tc.red : tc.textLight;
  const bg = pos ? "#E8F8E8" : neg ? "#FDECEA" : tc.bgAlt;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "1px 6px", fontFamily: "'DM Mono',monospace" }}>
      {pos ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

export function pctFmt(v) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

const TX_MONTH_NAMES = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

function fmtTxMonth(yyyymm) {
  if (!yyyymm || yyyymm === "????-??") return "Sense data";
  const [year, month] = yyyymm.split("-");
  return `${TX_MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}
