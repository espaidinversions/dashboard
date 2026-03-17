// ── Paleta ────────────────────────────────────────────────
import { TC_LIGHT } from "./theme.js";
export const TC = TC_LIGHT;

// ── Configs ───────────────────────────────────────────────
export const CAT_CFG = {
  "Capital Call":    { color:TC.navy,      bg:"#E8EFF5" },
  "Distribució":     { color:TC.green,     bg:"#E8F5E9" },
  "Retorn Capital":  { color:TC.greenDark, bg:"#D6EAE0" },
  "Compromís":       { color:TC.navyLight, bg:"#EAF0F6" },
  "Altres":          { color:TC.textLight, bg:TC.bgAlt  },
};
export const VCPE_CFG = {
  "PE": { color:TC.navy,    bg:"#E8EFF5" },
  "VC": { color:TC.green,   bg:"#E8F4EE" },
  "RE": { color:"#6A4C8A",  bg:"#F3EEF8" },
};
export const EST_CFG = {
  "Fons Primari": { color:TC.navy,      bg:"#E8EFF5" },
  "Fons de Fons": { color:TC.greenDark, bg:"#D6EAE0" },
  "SOCIMI":       { color:"#6A4C8A",    bg:"#F3EEF8" },
};
export const STATUS_CFG = {
  "En estudi": { bg:"#FFF8E1", color:"#B8860B", border:"#F0C040" },
  "Aprovat":   { bg:"#E8F5E9", color:"#2E7D32", border:"#66BB6A" },
  "Descartat": { bg:"#FDECEA", color:"#C62828", border:"#EF9A9A" },
};
export const CANAL_CFG = {
  "Arcano":          { bg:"#E8EFF5", color:TC.navy,      border:TC.border },
  "Placement Agent": { bg:"#E8F4EE", color:TC.greenDark, border:"#A8D5B8" },
  "Propietari":      { bg:"#EAF0F6", color:TC.navyLight, border:"#B0C8DC" },
  "Altres":          { bg:"#F3EEF8", color:"#6A4C8A",    border:"#C4A8DC" },
};
export const FY_LIST = ["FY 2019","FY 2020","FY 2021","FY 2022","FY 2023","FY 2024","FY 2025","FY 2026","FY 2027"];
export const MESOS   = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];

// ── Data imports ─────────────────────────────────────────
export { RAW_CC } from "./data/capital-calls.js";
export { FUNDS0 } from "./data/pipeline.js";
import { RAW_CC } from "./data/capital-calls.js";

export const EUR_USD = 1.08;
export const toEUR = (a,c) => c==="USD" ? a/EUR_USD : a;
export const toUSD = (a,c) => c==="EUR" ? a*EUR_USD : a;
export const SCOL  = {"Fons primari":TC.navy,"Coinversions":TC.green,"Fons secundaris":TC.navyLight,"Fons de fons":TC.greenDark};
export const GCOL  = {EU:TC.green,US:TC.navy,"EU/US":TC.navyLight};
export const SECCOL= {Software:TC.navy,Generalista:TC.green,"B2B Services":TC.greenDark,Healthcare:"#7A5A8A","Software / B2B":TC.greenLight};
export const STCOL = {"En estudi":"#B8860B","Aprovat":"#2E7D32","Descartat":"#C62828"};
export const CCOL  = {"Arcano":TC.navy,"Placement Agent":TC.green,"Propietari":TC.navyLight,"Altres":"#6A4C8A"};
export const SBADGE= {"Fons primari":{bg:"#E8EFF5",color:TC.navy},"Coinversions":{bg:"#E8F4EE",color:TC.greenDark},"Fons secundaris":{bg:"#EAF0F6",color:TC.navyLight},"Fons de fons":{bg:"#E3EDE8",color:TC.greenDark}};
export const GBADGE= {EU:{bg:"#E8F4EE",color:TC.greenDark},US:{bg:"#E8EFF5",color:TC.navyDark},"EU/US":{bg:"#EAF0F6",color:TC.navyLight}};

// ── Precompute ────────────────────────────────────────────
export const COMPROMISOS  = RAW_CC.filter(r=>r.cat==="Compromís");
export const TRANSACTIONS = RAW_CC.filter(r=>r.cat!=="Compromís");
export const ALL_FONS = [...new Set(RAW_CC.map(r=>r.fons))].sort();
