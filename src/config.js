// ── Paleta ────────────────────────────────────────────────
import { TC_LIGHT } from "./theme.js";
import { CAPITAL_CALL_TIPUS_OPTIONS as CAPITAL_CALL_TIPUS_MODEL_OPTIONS } from "./data/capitalCallTipusModel.js";
import { CAPITAL_CALL_STRATEGY_OPTIONS } from "./data/capitalCallStrategyModel.js";
const TC = TC_LIGHT;

// ── Configs ───────────────────────────────────────────────
const CAT_CFG = {
  "Capital Call":    { color:TC.navy,      bg:"#E8EFF5" },
  "Distribució":     { color:TC.green,     bg:"#E8F5E9" },
  "Retorn Capital":  { color:TC.greenDark, bg:"#D6EAE0" },
  "Compromís":       { color:TC.navyLight, bg:"#EAF0F6" },
  "Altres":          { color:TC.textLight, bg:TC.bgAlt  },
};
export const VEHICLE_TIPUS_CFG = {
  "Primari":     { color: TC.navy,      bg: "#E6EDF3" },
  "FoF":         { color: TC.greenDark, bg: "#E8F8E8" },
  "Secundari":   { color: TC.navyLight, bg: "#EAF0F6" },
  "Co-inversió": { color: "#0F766E",    bg: "#DFF7F3" },
};
export const VCPE_CFG = {
  "PE": { color:TC.navy,      bg:"#E6EDF3" },
  "VC": { color:TC.green,     bg:"#E8F8E8" },
  "RE": { color:"#6A4C8A",    bg:"#F3EEF8" },
  "SF": { color:"#2563A8",    bg:"#DDEAF8" },
  "PC": { color:"#7A5A00",    bg:"#FFF5D6" },
};
export const EST_CFG = {
  "Fons Primari":                          { color:TC.navy,      bg:"#E6EDF3" },
  "Fons Secundari":                        { color:TC.navyLight, bg:"#EAF0F6" },
  "Fons de Fons":                          { color:TC.greenDark, bg:"#E8F8E8" },
  "Fons de Coinversió":                    { color:"#0F766E",    bg:"#DFF7F3" },
  "Search Fund - Cerca":                   { color:"#2563A8",    bg:"#DDEAF8" },
  "Search Fund - Adquisició/Participada (SF)": { color:"#1D4ED8", bg:"#E0E7FF" },
  "Participada (Altres)":                  { color:"#7A5A00",    bg:"#FFF5D6" },
  "Fons Real Estate":                      { color:"#6A4C8A",    bg:"#F3EEF8" },
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
export const GEO_NAME = {
  ES:"ESP", EN:"UK", IT:"ITA", DE:"DEU", FR:"FRA",
  PT:"POR", NL:"NED", US:"USA", CH:"CHE", SE:"SWE",
  MX:"MEX", PL:"POL", TR:"TUR",
};
export const SEARCHER_STATUS_CFG = {
  "Invertit en fase de cerca":     { bg:"#E8F8E8", color:"#1C6B1D" },
  "Invertit en fase d'adquisició": { bg:"#D6EAD6", color:"#1C5220" },
  "Descartat":                      { bg:"#FDECEA", color:"#B01F17" },
  "En anàlisi":                     { bg:"#FFF8E1", color:"#8A6400" },
  "Sobresuscrit":                   { bg:"#F0EEFA", color:"#5A3E9A" },
  "Pendent de formalitzar":         { bg:"#E6EDF3", color:"#2B5070" },
  "No tancat":                      { bg:"#F5F5F5", color:"#777"    },
};
export const FY_LIST = ["FY 2019","FY 2020","FY 2021","FY 2022","FY 2023","FY 2024","FY 2025","FY 2026","FY 2027"];
export const MESOS   = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];

// ── Enum option arrays (single source of truth for selects + DB constraints) ─
export const PIPELINE_STATUS_OPTIONS    = Object.keys(STATUS_CFG);
export const PIPELINE_CANAL_OPTIONS     = Object.keys(CANAL_CFG);
export const SEARCHER_STATUS_OPTIONS    = Object.keys(SEARCHER_STATUS_CFG);
export const SEARCHER_MODALITAT_OPTIONS = ["Solo", "Duo", "Trio", "Partnership"];
export const SEARCHER_FORM_ENTRADA_OPTIONS = ["Search Capital", "Equity Gap"];
export const COMPANY_TIPUS_OPTIONS      = ["SF", "PE"];
export const COMPANY_ORIGEN_OPTIONS     = ["Search Capital", "Equity Gap", "Direct PE"];
const CAPITAL_CALL_CAT_OPTIONS   = Object.keys(CAT_CFG).filter(k => k !== "Compromís");
const CAPITAL_CALL_VCPE_OPTIONS  = Object.keys(VCPE_CFG);
const CAPITAL_CALL_EST_OPTIONS   = CAPITAL_CALL_STRATEGY_OPTIONS;
export const CAPITAL_CALL_TIPUS_OPTIONS = CAPITAL_CALL_TIPUS_MODEL_OPTIONS;

// ── Data imports ─────────────────────────────────────────
import { RAW_CC as RAW_CC_DATA } from "./data/capital-calls.js";
import { FUNDS0 as FUNDS0_DATA } from "./data/pipeline.js";

export const EUR_USD = 1.08;
const toEUR = (a,c) => c==="USD" ? a/EUR_USD : a;
const toUSD = (a,c) => c==="EUR" ? a*EUR_USD : a;
export const SCOL  = {"Fons primari":TC.navy,"Coinversions":TC.green,"Fons secundaris":TC.navyLight,"Fons de fons":TC.greenDark};
export const GCOL  = {EU:TC.green,US:TC.navy,"EU/US":TC.navyLight};
export const SECCOL= {Software:TC.navy,Generalista:TC.green,"B2B Services":TC.greenDark,Healthcare:TC.purple,"Software / B2B":TC.greenLight};
export const STCOL = {"En estudi":TC.yellow,"Aprovat":TC.greenDark,"Descartat":TC.red};
export const CCOL  = {"Arcano":TC.navy,"Placement Agent":TC.green,"Propietari":TC.navyLight,"Altres":TC.purple};
export const SBADGE= {"Fons primari":{bg:"#E8EFF5",color:TC.navy},"Coinversions":{bg:"#E8F4EE",color:TC.greenDark},"Fons secundaris":{bg:"#EAF0F6",color:TC.navyLight},"Fons de fons":{bg:"#E3EDE8",color:TC.greenDark}};
export const GBADGE= {EU:{bg:"#E8F4EE",color:TC.greenDark},US:{bg:"#E8EFF5",color:TC.navyDark},"EU/US":{bg:"#EAF0F6",color:TC.navyLight}};

// ── Precompute ────────────────────────────────────────────
const COMPROMISOS  = RAW_CC_DATA.filter(r=>r.cat==="Compromís");
const TRANSACTIONS = RAW_CC_DATA.filter(r=>r.cat!=="Compromís");
const ALL_FONS = [...new Set(RAW_CC_DATA.map(r=>r.fons))].sort();

