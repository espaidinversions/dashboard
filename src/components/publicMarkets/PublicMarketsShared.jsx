import React from "react";
import { PM_MODEL } from "../../data/publicMarketsModel.js";
import { WAM_POSITIONS } from "../../data/wamPositions.js";

const PM_MANAGERS = PM_MODEL.metadata.managers;
const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_CLOSED = PM_MODEL.holdings.closed;

const ABEL_RV_SPLIT = 0.7516;
const ABEL_RF_SPLIT = 1 - ABEL_RV_SPLIT;

export const TIPUS_CFG = {
  RV: { color: "#2B5070", bg: "#E6EDF3" },
  RF: { color: "#7A6000", bg: "#FFF8E1" },
  "RV+RF": { color: "#28A029", bg: "#E8F8E8" },
};

export const AREA_COLORS = {
  total: "#2B5070",
  rv: "#2B5070",
  rf: "#E8A020",
  caixa: "#2B5070",
  ubs: "#4E79A7",
  creditSuisse: "#C46B5A",
  abel: "#3DC83E",
  bankinter: "#3DC83E",
  interactiveBrokers: "#7BC96F",
  andbank: "#6B2E7E",
  jpmorgan: "#8A6D3B",
  altres: "#9AA4B2",
};

export const MGR_COLORS = {
  caixa: "#2B5070",
  ubs: "#4E79A7",
  creditSuisse: "#C46B5A",
  andbank: "#6B2E7E",
  abel: "#3DC83E",
  jpmorgan: "#8A6D3B",
  altres: "#9AA4B2",
};

export const PERIODS = [
  { field: "r2024", label: "2024" },
  { field: "r2025", label: "2025" },
  { field: "ytd", label: "YTD '26" },
];

const DEFAULT_EXPAND_TIPUS = {
  caixa: "all",
  ubs: "all",
  abel: "all",
  andbank: null,
};

export function weightedReturn(field, managerValueById, tipus = null) {
  const entries = PM_MANAGERS.flatMap((manager) => {
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
  let custodians, extraActive = [];
  if (mgrId === "abel")         custodians = ["Bankinter", "Interactive Brokers"];
  else if (mgrId === "caixa")   custodians = ["CaixaBank"];
  else if (mgrId === "ubs")     custodians = ["UBS"];
  else if (mgrId === "creditSuisse") custodians = ["Credit Suisse"];
  else if (mgrId === "andbank") { custodians = ["Andbank"]; extraActive = WAM_POSITIONS; }
  else if (mgrId === "jpmorgan") custodians = ["JPMorgan"];
  else return null;

  const match = custodianMatch(custodians);
  const active = [...PM_POSITIONS.filter(match), ...extraActive]
    .sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0));
  const discontinued = PM_CLOSED.filter(match)
    .sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0))
    .map((p) => ({ ...p, _discontinued: true }));

  return [...active, ...discontinued];
}

export function KpiCard({ label, value, sub, tc, valueColor }) {
  return (
    <div
      className="kpi-card card-hover"
      style={{
        background: tc.card,
        border: `1px solid ${tc.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        minWidth: 160,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy, fontFamily: "'DM Mono',monospace" }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export function PctChip({ v, tc }) {
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

export function fmtTxMonth(yyyymm) {
  if (!yyyymm || yyyymm === "????-??") return "Sense data";
  const [year, month] = yyyymm.split("-");
  return `${TX_MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}
