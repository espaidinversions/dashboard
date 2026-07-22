import { broadRowKey, dedupeRows, mergeDefinedRow, mergeRawRows, normalizeIsin, rowDedupeKey } from "./pmIdentity.js";
import { PM_POSITIONS_RAW as PM_POSITIONS_RAW_BASE } from "./publicMarketsRaw.js";
import { PM_POSITIONS_RAW_SUPPLEMENT } from "./publicMarketsRawSupplement.js";
import { PM_WORKBOOK_TOTAL_ACTIVE, PM_WORKBOOK_TOTAL_ROW, PM_POSITIONS_RAW_WORKBOOK } from "../generated/publicMarkets/publicMarketsRawWorkbook.js";

// Kept for generator compatibility.
// Public Markets static data reconstructed from the workbook overlay and supporting bank PDFs.
// Known gaps are filled with explicit interpolation or carry-forward only where the source data is incomplete.

function mergeGroupMetadata(rows) {
  if (!rows?.length) return {};
  return {
    nom: pickPreferredLabel(rows, "nom"),
    gestor: pickPreferredLabel(rows, "gestor"),
    custodian: pickPreferredLabel(rows, "custodian"),
    tipus: pickPreferredLabel(rows, "tipus"),
    divisa: pickPreferredLabel(rows, "divisa"),
    custodyFee: aggregatePct(rows, "custodyFee", "valorMercat"),
    costAnual: aggregatePct(rows, "costAnual", "valorMercat"),
  };
}

function synchronizeWorkbookRows(sourceRows, workbookRows) {
  const mergedSource = mergeRawRows(sourceRows);
  const exactMap = new Map();
  const broadGroups = new Map();

  for (const row of mergedSource) {
    const exactKey = rowDedupeKey(row);
    if (exactKey) {
      const prev = exactMap.get(exactKey) ?? {};
      exactMap.set(exactKey, mergeDefinedRow(prev, row));
    }
    const broadKey = broadRowKey(row);
    if (!broadKey.startsWith("||")) {
      const list = broadGroups.get(broadKey) ?? [];
      list.push(row);
      broadGroups.set(broadKey, list);
    }
  }

  return dedupeRows(workbookRows).map(row => {
    const exact = exactMap.get(rowDedupeKey(row)) ?? {};
    const broad = mergeGroupMetadata(broadGroups.get(broadRowKey(row)) ?? []);
    // supplement (exact) takes precedence over workbook (row); broad is the fallback base
    return mergeDefinedRow(mergeDefinedRow(broad, row), exact);
  });
}

export const PM_POSITIONS_RAW = synchronizeWorkbookRows(
  mergeRawRows(PM_POSITIONS_RAW_BASE, PM_POSITIONS_RAW_SUPPLEMENT),
  PM_POSITIONS_RAW_WORKBOOK,
);

export const PM_LIQUIDITY_POSITIONS = [
  { id: "liquidity-jpm-cc", nom: "JPM cc", gestor: "JPMorgan", custodian: "JPMorgan", tipus: "Liquiditat", divisa: "EUR", valorMercat: 17_000, _source: "Master cash" },
  { id: "liquidity-ubs-cc", nom: "C/c UBS", gestor: "UBS", custodian: "UBS", tipus: "Liquiditat", divisa: "EUR", valorMercat: 0, _source: "Master cash" },
  { id: "liquidity-ubs-cs-cc", nom: "C/c CS", gestor: "UBS", custodian: "UBS", tipus: "Liquiditat", divisa: "EUR", valorMercat: 81_276.96, _source: "Master cash" },
  { id: "liquidity-caixabank-cc", nom: "C/c Caixabank", gestor: "CaixaBank", custodian: "CaixaBank", tipus: "Liquiditat", divisa: "EUR", valorMercat: 1_326_055, _source: "Master cash" },
  { id: "liquidity-caixabank-scr-cc", nom: "C/c Caixabank SCR", gestor: "CaixaBank", custodian: "CaixaBank", tipus: "Liquiditat", divisa: "EUR", valorMercat: 5_284_850, _source: "Master cash" },
  { id: "liquidity-caixabank-solvic-cc", nom: "C/c Caixabank Solvic", gestor: "CaixaBank", custodian: "CaixaBank", tipus: "Liquiditat", divisa: "EUR", valorMercat: 1_045_740, _source: "Master cash" },
  { id: "liquidity-santander-cc", nom: "C/c Santander", gestor: "Santander", custodian: "Santander", tipus: "Liquiditat", divisa: "EUR", valorMercat: 1_000, _source: "Master cash" },
  { id: "liquidity-solvic-ubs-cc", nom: "C/C Solvic UBS", gestor: "UBS", custodian: "UBS", tipus: "Liquiditat", divisa: "EUR", valorMercat: 0, _source: "Master cash" },
  { id: "liquidity-bankinter-cc", nom: "C/C Bankinter", gestor: "Bankinter", custodian: "Bankinter", tipus: "Liquiditat", divisa: "EUR", valorMercat: 0, _source: "Master cash" },
  { id: "liquidity-sabadell-cc", nom: "C/c Sabadell", gestor: "Sabadell", custodian: "Sabadell", tipus: "Liquiditat", divisa: "EUR", valorMercat: 25_070.64, _source: "Master cash" },
];

export const PM_TOTAL_LIQUIDITY = PM_LIQUIDITY_POSITIONS.reduce((sum, row) => sum + (Number(row.valorMercat) || 0), 0);

export const PM_MONTHLY = [
  // ── Dec 2023 ────────────────────────────────────────────
  { date:"2023-12", label:"Des '23", caixaRV:6_260_222, caixaRF:4_013_654, ubsRV:10_236_736, ubsRF:3_690_362, abelBK:null, andbank:5_464_174 },
  // ── 2024 ────────────────────────────────────────────────
  { date:"2024-01", label:"Gen '24", caixaRV:6_381_485, caixaRF:4_043_704, ubsRV:10_411_866, ubsRF:3_713_698, abelBK:null, andbank:5_492_952 },
  { date:"2024-02", label:"Feb '24", caixaRV:5_744_139, caixaRF:4_081_998, ubsRV:8_700_807,  ubsRF:3_752_120, abelBK:null, andbank:5_521_730 },
  { date:"2024-03", label:"Mar '24", caixaRV:5_918_881, caixaRF:4_053_262, ubsRV:7_814_136,  ubsRF:3_703_334, abelBK:null, andbank:5_550_508 },
  { date:"2024-04", label:"Abr '24", caixaRV:5_775_461, caixaRF:3_739_274, ubsRV:7_509_165,  ubsRF:2_708_063, abelBK:null, andbank:5_579_286 },
  { date:"2024-05", label:"Mai '24", caixaRV:6_843_652, caixaRF:3_762_474, ubsRV:7_722_095,  ubsRF:2_724_952, abelBK:null, andbank:5_608_064 },
  { date:"2024-06", label:"Jun '24", caixaRV:6_946_413, caixaRF:3_775_540, ubsRV:7_893_005,  ubsRF:2_716_639, abelBK:null, andbank:5_636_842 },
  { date:"2024-07", label:"Jul '24", caixaRV:7_036_117, caixaRF:3_901_727, ubsRV:7_952_543,  ubsRF:2_689_533, abelBK:null, andbank:5_665_620 },
  { date:"2024-08", label:"Ago '24", caixaRV:7_096_349, caixaRF:3_914_830, ubsRV:8_012_081,  ubsRF:2_662_427, abelBK:null, andbank:5_694_398 },
  { date:"2024-09", label:"Set '24", caixaRV:7_244_782, caixaRF:3_939_397, ubsRV:8_071_619,  ubsRF:2_635_321, abelBK:null, andbank:5_723_176 },
  { date:"2024-10", label:"Oct '24", caixaRV:7_216_196, caixaRF:3_980_125, ubsRV:8_131_157,  ubsRF:2_608_215, abelBK:null, andbank:5_751_954 },
  { date:"2024-11", label:"Nov '24", caixaRV:7_577_969, caixaRF:3_978_907, ubsRV:8_190_695,  ubsRF:2_581_109, abelBK:null, andbank:5_780_732 },
  { date:"2024-12", label:"Des '24", caixaRV:7_480_556, caixaRF:3_992_338, ubsRV:8_250_234,  ubsRF:2_554_003, abelBK:null, andbank:5_809_510 },
  // ── 2025 ────────────────────────────────────────────────
  { date:"2025-01", label:"Gen '25", caixaRV:7_768_451, caixaRF:3_992_338, ubsRV:8_541_892,  ubsRF:2_526_897, abelBK:null, andbank:5_829_746 },
  { date:"2025-02", label:"Feb '25", caixaRV:7_718_892, caixaRF:3_992_338, ubsRV:8_352_934,  ubsRF:2_499_791, abelBK:null, andbank:5_849_982 },
  { date:"2025-03", label:"Mar '25", caixaRV:7_291_453, caixaRF:3_992_338, ubsRV:7_827_909,  ubsRF:2_472_685, abelBK:null, andbank:5_870_218 },
  { date:"2025-04", label:"Abr '25", caixaRV:7_467_258, caixaRF:3_992_338, ubsRV:8_088_432,  ubsRF:2_445_579, abelBK:12_550_766, andbank:5_890_454 },
  { date:"2025-05", label:"Mai '25", caixaRV:7_838_672, caixaRF:3_992_338, ubsRV:8_530_284,  ubsRF:2_418_473, abelBK:13_072_330, andbank:5_910_690 },
  { date:"2025-06", label:"Jun '25", caixaRV:7_934_352, caixaRF:3_992_338, ubsRV:8_765_865,  ubsRF:2_391_367, abelBK:13_213_868, andbank:5_930_926 },
  { date:"2025-07", label:"Jul '25", caixaRV:7_874_688, caixaRF:3_992_338, ubsRV:9_084_570,  ubsRF:2_364_261, abelBK:13_024_261, andbank:5_951_162 },
  { date:"2025-08", label:"Ago '25", caixaRV:8_059_251, caixaRF:3_992_338, ubsRV:9_403_275,  ubsRF:2_337_155, abelBK:13_032_505, andbank:5_971_398 },
  { date:"2025-09", label:"Set '25", caixaRV:8_211_556, caixaRF:3_992_338, ubsRV:9_721_980,  ubsRF:2_310_049, abelBK:13_325_104, andbank:5_991_634 },
  { date:"2025-10", label:"Oct '25", caixaRV:8_160_595, caixaRF:3_992_338, ubsRV:10_040_685, ubsRF:2_282_943, abelBK:13_681_568, andbank:6_011_870 },
  { date:"2025-11", label:"Nov '25", caixaRV:8_073_468, caixaRF:3_992_338, ubsRV:10_359_390, ubsRF:2_255_837, abelBK:13_587_323, andbank:6_032_106 },
  { date:"2025-12", label:"Des '25", caixaRV:8_134_950, caixaRF:3_992_338, ubsRV:10_678_097, ubsRF:2_228_738, abelBK:13_570_385, andbank:6_052_347 },
  // ── 2026 ────────────────────────────────────────────────
  { date:"2026-01", label:"Gen '26", caixaRV:8_244_136, caixaRF:4_049_948, ubsRV:10_995_276, ubsRF:2_244_148, abelBK:13_577_708, andbank:6_064_452 },
  { date:"2026-02", label:"Feb '26", caixaRV:8_192_127, caixaRF:3_990_758, ubsRV:11_031_708, ubsRF:2_220_845, abelBK:13_544_782, andbank:6_076_557 },
  { date:"2026-03", label:"Mar '26", caixaRV:8_037_347, caixaRF:3_990_758, ubsRV:10_704_128, ubsRF:2_220_845, abelBK:20_933_017, andbank:6_088_661, cashflows:{ abelBK:7_388_235 } },
  { date:"2026-04", label:"Abr '26", caixaRV:7_386_176, caixaRF:3_617_793, ubsRV:25_981_483, ubsRF:2_711_658, abelBK:23_123_697, andbank:6_088_661 },
  { date:"2026-05", label:"Mai '26", caixaRV:7_719_423, caixaRF:3_652_971, ubsRV:27_446_614, ubsRF:2_731_147, abelBK:23_701_753, andbank:6_088_661 },
  { date:"2026-06", label:"Jun '26", caixaRV:7_748_490, caixaRF:3_667_746, ubsRV:27_501_307, ubsRF:2_743_760, abelBK:23_649_431, andbank:6_088_661 },
  { date:"2026-07", label:"Jul '26", caixaRV:7_748_490, caixaRF:3_667_746, ubsRV:27_501_307, ubsRF:2_743_760, abelBK:23_649_431, andbank:6_088_661 },
];

const PM_MONTHLY_BY_DATE = Object.fromEntries(PM_MONTHLY.map(m => [m.date, m]));
const ubsRVValue   = d => PM_MONTHLY_BY_DATE[d]?.ubsRV   ?? null;
const ubsRFValue   = d => PM_MONTHLY_BY_DATE[d]?.ubsRF   ?? null;
const caixaRVValue = d => PM_MONTHLY_BY_DATE[d]?.caixaRV ?? null;
const caixaRFValue = d => PM_MONTHLY_BY_DATE[d]?.caixaRF ?? null;
const andbankValue = d => PM_MONTHLY_BY_DATE[d]?.andbank  ?? null;

// Abel TWR since first observation in PM_MONTHLY (mid-period cashflows use 0.5×CF in denominator)
const _abelInceptionIdx = PM_MONTHLY.findIndex(m => m.abelBK != null);
const _abelRendPct = (() => {
  if (_abelInceptionIdx === -1 || _abelInceptionIdx >= PM_MONTHLY.length - 1) return null;
  let cum = 1;
  for (let i = _abelInceptionIdx + 1; i < PM_MONTHLY.length; i++) {
    const prev = PM_MONTHLY[i - 1];
    const curr = PM_MONTHLY[i];
    const midCF = curr.cashflows?.abelBK ?? 0;
    const denom = prev.abelBK + 0.5 * midCF;
    if (denom <= 0) continue;
    cum *= 1 + (curr.abelBK - prev.abelBK - midCF) / denom;
  }
  return (cum - 1) * 100;
})();
const pctChange = (startDate, endDate, getter) => {
  const start = getter(startDate);
  const end   = getter(endDate);
  if (start == null || end == null || start === 0) return null;
  return ((end / start) - 1) * 100;
};

const pmLast = PM_MONTHLY[PM_MONTHLY.length - 1];
const pmLastDate = pmLast?.date ?? "2026-03";

// Current manager snapshots — workbook-backed section totals.
// rendPct: live TWR from Dec 2023 baseline (PM_MONTHLY first snapshot) for all managers except Abel.
// caixaRF r2025/r2024: custodian-reported from PDF statements — the 2025 monthly values are flat (stale
//   workbook data), so pctChange would produce ~0% which is wrong.
// Abel ytd/r2025/r2024: custodian-reported from Bankinter statements — abelBK is null in Dec 2023/2024,
//   so full-year figures are not reconstructable from PM_MONTHLY.
// valorActual: derived from PM_MONTHLY last row for all managers (auto-updates when new months are added).
const PM_MANAGER_TEMPLATE = [
  { id:"caixa-rv", nom:"Caixa RV",     gestor:"CaixaBank", tipus:"RV",    valorActual:pmLast?.caixaRV ?? 8_037_347,  rendPct:pctChange("2023-12", pmLastDate, caixaRVValue), ytd:pctChange("2025-12", pmLastDate, caixaRVValue), r2025:pctChange("2024-12", "2025-12", caixaRVValue), r2024:pctChange("2023-12", "2024-12", caixaRVValue) },
  { id:"caixa-rf", nom:"Caixa RF",     gestor:"CaixaBank", tipus:"RF",    valorActual:pmLast?.caixaRF ?? 3_990_758,  rendPct:pctChange("2023-12", pmLastDate, caixaRFValue), ytd:pctChange("2025-12", pmLastDate, caixaRFValue), r2025:4.96,  r2024:4.96  },
  { id:"ubs-rv",   nom:"UBS RV",       gestor:"UBS",       tipus:"RV",    valorActual:pmLast?.ubsRV   ?? 10_704_128, rendPct:pctChange("2023-12", pmLastDate, ubsRVValue),   ytd:pctChange("2025-12", pmLastDate, ubsRVValue),  r2025:pctChange("2024-12", "2025-12", ubsRVValue),  r2024:pctChange("2023-12", "2024-12", ubsRVValue) },
  { id:"ubs-rf",   nom:"UBS RF",       gestor:"UBS",       tipus:"RF",    valorActual:pmLast?.ubsRF   ?? 2_220_845,  rendPct:pctChange("2023-12", pmLastDate, ubsRFValue),   ytd:pctChange("2025-12", pmLastDate, ubsRFValue),  r2025:pctChange("2024-12", "2025-12", ubsRFValue),  r2024:pctChange("2023-12", "2024-12", ubsRFValue) },
  // ytd/r2025/r2024: custodian-reported from Bankinter statements (abelBK null in Dec 2023/2024, full-year figures not reconstructable).
  { id:"abel",     nom:"Abel (BK+IB)", gestor:"Abel Font", tipus:"RV+RF", valorActual:pmLast?.abelBK  ?? 20_933_017, rendPct:_abelRendPct,                                   ytd:-2.68,  r2025:-8.05, r2024:11.44 },
  { id:"andbank",  nom:"WAM–Andbank (Goyo)", gestor:"WAM", tipus:"RF",    valorActual:pmLast?.andbank ?? 6_088_661,  rendPct:pctChange("2023-12", pmLastDate, andbankValue),  ytd:pctChange("2025-12", pmLastDate, andbankValue), r2025:pctChange("2024-12", "2025-12", andbankValue), r2024:pctChange("2023-12", "2024-12", andbankValue) },
];

function slugifyPart(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "unknown";
}

function pickPreferredLabel(rows, field) {
  const values = rows
    .map(row => row?.[field])
    .filter(v => typeof v === "string" && v.trim());
  if (values.length === 0) return null;
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  return values.sort((a, b) => {
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return b.length - a.length;
  })[0];
}

function aggregatePct(rows, field, weightField = "valorMercat") {
  let weighted = 0;
  let totalWeight = 0;
  rows.forEach(row => {
    const v = row?.[field];
    const w = row?.[weightField];
    if (v == null || w == null || !Number.isFinite(v) || !Number.isFinite(w) || w <= 0) return;
    weighted += v * w;
    totalWeight += w;
  });
  return totalWeight > 0 ? weighted / totalWeight : null;
}

function aggregateGroup(rows) {
  const ordered = [...rows].sort((a, b) => String(a.dataCompra ?? "").localeCompare(String(b.dataCompra ?? "")));
  const first = ordered[0];
  const unitats = rows.reduce((sum, row) => sum + (Number(row.unitats) || 0), 0);
  const costEur = rows.reduce((sum, row) => sum + (Number(row.costEur) || 0), 0);
  const valorMercat = rows.reduce((sum, row) => sum + (Number(row.valorMercat) || 0), 0);
  const pes = rows.reduce((sum, row) => sum + (Number(row.pes) || 0), 0);
  const endDate = rows.some(row => row.endDate == null) ? null : rows.reduce((max, row) => {
    const cur = row.endDate ?? null;
    if (!cur) return max;
    return !max || cur > max ? cur : max;
  }, null);
  const dataCompra = ordered.find(row => row.dataCompra)?.dataCompra ?? null;
  const nom = pickPreferredLabel(rows, "nom") ?? first?.nom ?? null;
  const gestor = pickPreferredLabel(rows, "gestor") ?? first?.gestor ?? null;
  const custodian = pickPreferredLabel(rows, "custodian") ?? first?.custodian ?? null;
  const tipus = first?.tipus ?? null;
  const divisa = first?.divisa ?? "EUR";
  const custodyFee = aggregatePct(rows, "custodyFee", "valorMercat");
  const costAnual = aggregatePct(rows, "costAnual", "valorMercat");
  const rendFields = ["rend2019", "rend2020", "rend2021", "rend2022", "rend2023", "rend2024", "rend2025", "rend2026"];
  const weightedRends = Object.fromEntries(rendFields.map(field => [field, aggregatePct(rows, field, "valorMercat")]));
  const rendInici = costEur > 0 ? ((valorMercat - costEur) / costEur) * 100 : null;

  return {
    id: `${first?.isin?.toLowerCase() ?? "isin"}-${slugifyPart(custodian)}`,
    nom,
    gestor,
    custodian,
    custodyFee,
    isin: first?.isin ?? null,
    tipus,
    divisa,
    dataCompra,
    unitats,
    costInici: unitats > 0 ? costEur / unitats : null,
    costEur,
    valorMercat,
    pes,
    rendInici,
    rend2023: weightedRends.rend2023,
    rend2024: weightedRends.rend2024,
    rend2025: weightedRends.rend2025,
    rend2026: weightedRends.rend2026,
    costAnual,
    startDate: dataCompra,
    endDate,
  };
}

function aggregatePositions(rows) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const isin = normalizeIsin(row?.isin);
    const custodian = row?.custodian ?? null;
    if (!isin) continue;
    const key = `${isin}||${custodian ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push({ ...row, isin });
    groups.set(key, list);
  }
  return [...groups.values()].map(aggregateGroup);
}

function buildPositionIdAliases(rawRows, aggregatedRows) {
  const alias = {};
  const groupIdByKey = new Map(
    aggregatedRows.map(row => [`${row.isin}||${row.custodian ?? ""}`, row.id])
  );
  for (const row of rawRows ?? []) {
    const key = `${normalizeIsin(row?.isin) ?? ""}||${row?.custodian ?? ""}`;
    const target = groupIdByKey.get(key);
    if (row?.id && target && row.id !== target) alias[row.id] = target;
  }
  return alias;
}

export const PM_POSITIONS = aggregatePositions(PM_POSITIONS_RAW);
export const PM_POSITION_ID_ALIASES = buildPositionIdAliases(PM_POSITIONS_RAW, PM_POSITIONS);
export const PM_TOTAL_ACTIVE = PM_WORKBOOK_TOTAL_ACTIVE ?? PM_POSITIONS.reduce((sum, row) => sum + (Number(row?.valorMercat) || 0), 0);
export const PM_TOTAL_WORKBOOK_ROW = PM_WORKBOOK_TOTAL_ROW ?? null;
export const PM_MANAGERS = PM_MANAGER_TEMPLATE;

export const PM_CLOSED = [
  { any: 2021, nom: "Janus Henderson Horizon Global Property Equities Fund A2 HEUR", isin: "LU0828244219", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "ROBECO ALL STRATEGY EURO BONDS EURHDG", isin: "LU0940007262", tipus: "RF", gestor: null, custodian: "UBS", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "CANDRIAM BONDS EURO SHORT TERM", isin: "LU1269890593", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 200000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Robeco Global Consumer Trends Equities F €", isin: "LU0871827464", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 256451.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Invesco Funds - Invesco Global Consumer Trends Fund Z Accumulation EUR", isin: "LU1762220850", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 211014.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Fidelity Funds - Global Technology Fund Y-Acc-EUR", isin: "LU0346389348", tipus: "RV", gestor: null, custodian: "CAIXA", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Pictet Global Environment", isin: "LU0503631631", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 768520.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Pictet Security", isin: "LU0474968293", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 576519.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "AXA US CORPORATE BONDS _Z ACC EURH", isin: "LU0997546055", tipus: "RF", gestor: null, custodian: "Credit Suisse", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "BGF CONTINENTAL EUROPEAN FLEXIBLE \"D2\"", isin: "LU0406496546", tipus: "RV", gestor: "JPMorgan", custodian: "JPMorgan", divisa: "EUR", dataCompra: "2020-12-31", costEur: 480016.0, unitats: 11480.9, costInici: 41.81, valorMercat: 268016.0, rendInici: -44.17, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "THREADNEEDLE (LUX) PA \"ZE\" (EUR)", isin: "LU0957801565", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 116432.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "MSIM GLOBAL FIXED INCOME OPPORTUNITIES  EURHDG", isin: "LU0712123867", tipus: "RF", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2023-09-19", costEur: 221400.0, unitats: 8801.828, costInici: 25.1539, valorMercat: 0, rendInici: -100.0, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "William Blair SICAV - U.S. Small-Mid Cap Growth Fund Class R USD Acc", isin: "LU1664185003", tipus: "RV", gestor: null, custodian: "CAIXA", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "JPM US AGGREGATE BOND _I2 ACC EURH", isin: "LU1727358431", tipus: "RF", gestor: null, custodian: "UBS", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "PIMCO GIS Euro Bond Fund Institutional EUR", isin: "IE0004931386", tipus: "RF", gestor: null, custodian: "CAIXA", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "NORDEA 1 GLOBAL CLIMA \"BC\" (EUR)", isin: "LU0841586075", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 528138.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "VANGUARD U.S. 500 ST IX \"INV\" (EUR)", isin: "IE0032126645", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 187976.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Schroder International Selection Fund EURO Corporate Bond C Accumulation EUR", isin: "LU0113258742", tipus: "RF", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2019-12-31", costEur: 965425.0, unitats: 38908.72, costInici: 24.8126, valorMercat: 414107.0, rendInici: -57.11, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "BSF FIXED INCOME STRATEGIES_ _D2 ACC", isin: "LU0438336421", tipus: "RF", gestor: null, custodian: "UBS", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Pictet-Nutrition P EUR", isin: "LU0366534344", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 278581.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "DWS Smart Industrial Technologies FC", isin: "DE000DWS2MA8", tipus: "RV", gestor: null, custodian: "CAIXA", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "JPM US SHORT DURATION BOND EURHDG", isin: "LU1458465447", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 291000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "NORDEA US TOTAL RETURN BOND _HBC ACC EURH", isin: "LU0826415720", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 182144.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "UBS Global Dynamic", isin: "LU1240774601", tipus: "RF", gestor: null, custodian: "CAIXA", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "BNY MELLON SUS GL DYNAMIC BOND _W ACC EUR", isin: "IE00BF5B2C87", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 299694.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "SKY Harbor Global Funds - U.S. Short Duration Sustainable High Yield Fund Class C EUR Hdg Acc", isin: "LU1134536132", tipus: "RF", gestor: null, custodian: "UBS", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2021, nom: "Federated Hermes Global Emng MTKS L EUR ACC HGD", isin: "IE00BD8G5K55", tipus: "RV", gestor: null, custodian: "CAIXA", divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2021-12-31" },
  { any: 2022, nom: "BlackRock Global Funds - World Mining Fund S2 EUR Hedged Acc", isin: "LU2099033859", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 124000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Amundi Funds European R (eur) A", isin: "LU2183143846", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 828981.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Ishres UK EUR", isin: "IE00B7MSLV86", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 103812.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JPM GLOBAL STRATEGIC BOND EURHDG", isin: "LU0587803247", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 460000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "BGF CONTINENTAL EUROPEAN FLEXIBLE \"D2\"", isin: "LU0406496546", tipus: "RV", gestor: "JPMorgan", custodian: "JPMorgan", divisa: "EUR", dataCompra: "2020-12-31", costEur: 480016.0, unitats: 11480.9, costInici: 41.81, valorMercat: 268016.0, rendInici: -44.17, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "DPAM EQ EUP SUST W EUR AC", isin: "BE6246078545", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 548695.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "THREADNEEDLE (LUX) PA \"ZE\" (EUR)", isin: "LU0957801565", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 116432.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JPM GLOBAL NATURAL RESOURCES \"C\" (EUR)", isin: "LU0208853860", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 75000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "VANGUARD U.S. 500 ST IX \"INV\" (EUR)", isin: "IE0032126645", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 187976.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Pictet Water", isin: "LU0104884605", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 257998.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JPM Emerging Markets Debt (Euro H)", isin: "LU0217390060", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 1730442.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "BNY Mellon MObility Innovation", isin: "IE00BGCSBQ61", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 300000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "GS EMERG MARKETS CORPORATE BD _I ACC EURH", isin: "LU0622306495", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 300000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Tokio Marine Japanese Equity Focus Fund J EUR Hedged", isin: "IE00BYYTL524", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 125000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Pictet-Nutrition P EUR", isin: "LU0366534344", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 278581.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JPM JAPAN EQ EU AC", isin: "LU0861977402", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 180000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "ALLIANZ GLOBAL WATER RT11 EUR ACC", isin: "LU2257995980", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 591433.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "VARIOPARTNER MIV GLBL MEDTECH _N2 ACC EUR", isin: "LU1769944874", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 410002.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "ROBECO EURO SUSTAINABLE CREDIT _FH ACC EUR", isin: "LU0940006884", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 200000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Robeco Global Fintech", isin: "LU1700711077", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 530198.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "UBS CONVERTIBLE GLOBAL EUR", isin: "LU0358423738", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 290000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "NORDEA US TOTAL RETURN BOND _HBC ACC EURH", isin: "LU0826415720", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 182144.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Axa Digital Economy", isin: "LU1694772309", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 202400.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "PIMCO GIS Mortgage Opportunities Fund Institutional EUR", isin: "IE00BYZNBH50", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 480000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "PICTET ROBOTICS _HI ACC", isin: "LU1279334723", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 340001.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "BNY MELLON SUS GL DYNAMIC BOND _W ACC EUR", isin: "IE00BF5B2C87", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 299694.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Robeco New World Financial Equities F", isin: "LU0792910480", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 250000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "NORD 1 LOW DURT COV BN AC", isin: "LU2369359901", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 474786.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Robeco Global Consumer Trends Equities F €", isin: "LU0871827464", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 256451.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Invesco Funds - Invesco Global Consumer Trends Fund Z Accumulation EUR", isin: "LU1762220850", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 211014.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Robecosam Smart Materials F (", isin: "LU2145464264", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 275000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JPM JAPAN EQ EU AC", isin: "LU1668656116", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 499986.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JPM Genetic Therapies", isin: "LU2053353152", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 252400.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "BNP Paribas Smart Food", isin: "LU2066072385", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 252399.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "INFUSIVE CONSUMER ALPHA GLOBAL _AA ACC EUR", isin: "LU2110829848", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 749998.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "UBS ASIAN HIGH YIELD _Q ACC EURH", isin: "LU1240770872", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 300000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "BLACKROCK ASIAN GROWTH LEADERS_S2 ACC EURH", isin: "LU1992155744", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 300000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "CAPITAL GROUP NEW PERSPECTIVE _ZLH ACC EUR", isin: "LU1310447989", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 900003.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Schroder International Selection Fund QEP Global Emerging Markets K1 Accumulation EUR", isin: "LU2004795212", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 260001.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "UBS US TOTAL YIELD EQUITY_QL ACC EURH", isin: "LU2049450716", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 400024.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "JANUS HEN PAN EUROPEAN _H ACC EURH", isin: "LU1276832125", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 599998.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "ALGEBRIS FINANCIAL CREDIT _C ACC EUR", isin: "IE00BD71WK08", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 199999.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "iShares Edge MSCI Europe Momentum Factor UCITS ETF", isin: "IE00BQN1K786", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2021-11-24", costEur: 1060868.0, unitats: 111598.0, costInici: 9.5062, valorMercat: 0, rendInici: -100.0, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "NORDEA LOW DUR EUR COVERED BD _BI ACC EUR", isin: "LU1694214633", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 1280000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Pictet Security", isin: "LU0474968293", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 576519.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Threadneedle (Lux) - American Smaller Companies 9EH (EUR Accumulation)", isin: "LU1878470019", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 599987.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "AXA WF GLOBAL STRATEGIC STRATEGIC BOND F EURHDG", isin: "LU0746605335", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 150000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Eleva Absolute Return R", isin: "LU1331973468", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 251001.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Fidelity Funds - Global Technology Fund Y-Acc-EUR", isin: "LU1482751903", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2019-12-31", costEur: 442451.0, unitats: 14231.88, costInici: 31.0887, valorMercat: 315653.0, rendInici: -28.66, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "GAMCO International SICAV - GAMCO Merger Arbitrage R USD unhgd", isin: "LU1453360825", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 62604.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Pictet Global Environment", isin: "LU0503631631", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 768520.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "UBS China Opportunity USD Eur HDg", isin: "LU2191389209", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 418000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "ROBECO US SELECT OPPORTUNITIES_FH ACC EURH", isin: "LU0971565063", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 400000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Bellevue Funds (Lux) BB Adamant Medtech & Services I EUR", isin: "LU1989506966", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 128000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Schroder International Selection Fund Global Climate Change Equity C Accumulation EUR", isin: "LU0302447452", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 100000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Vanguard U.S. 500 Stock Index Fund EUR Hedged Acc", isin: "IE00B1G3DH73", tipus: "RV", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2021-12-31", costEur: 1494627.0, unitats: 50914.85, costInici: 29.3554, valorMercat: 1382397.0, rendInici: -7.51, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2022, nom: "Amundi Index MSCI Europe", isin: "LU0987205969", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2022-10-10", costEur: 306622.0, unitats: 1939.493, costInici: 158.0939, valorMercat: 280095.0, rendInici: -8.65, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2022-12-31" },
  { any: 2023, nom: "LYXOR US EQ FUND I HG AC", isin: "IE00BD8GKT91", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 227150.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "DWS ESG Equity INC", isin: "LU1747711031", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 539195.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "NORDEA LOW DUR EUR COVERED BD _BI ACC EUR", isin: "LU1694214633", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 1280000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Vontobel Fund - Emerging Markets Corporate Bond HN EUR Hedged", isin: "LU1944396289", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 960000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "BGF WORLD HEALTHSCIENCE _D2 ACC", isin: "LU0827889485", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 734996.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "(TACTIC) DWS Short Dur", isin: "LU1663942362", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 834041.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Candriam Bonds Euro Short Term", isin: "LU1269890593", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 200000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "ROBECO US PREMIUM EQUITIES_F ACC EURH", isin: "LU0832431125", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 600000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Amundi Funds European value R (eur) A", isin: "LU2183143846", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 828981.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Aberdeen Standard SICAV I - China A Share Equity Fund X Acc Hedged EUR", isin: "LU1970471600", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2021-12-31", costEur: 135218.0, unitats: 10744.572, costInici: 12.5848, valorMercat: 64782.0, rendInici: -52.09, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Robeco BP Global Premium Equities FH EUR", isin: "LU1736383024", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2020-12-31", costEur: 296207.0, unitats: 2530.3843, costInici: 117.0601, valorMercat: 1070000.0, rendInici: 261.23, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "AMU INDEX MSCI JAP RE EUR", isin: "LU0996181086", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 298360.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "DWS Top Dividende TFD", isin: "LU1663951603", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 404827.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "PICTET CHINA INDEX \"I\" (EUR)", isin: "LU0625737753", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2019-12-31", costEur: 153241.0, unitats: 1165.4216, costInici: 131.4898, valorMercat: 225000.0, rendInici: 46.83, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Robeco Financial Institutions Bonds FH", isin: "LU1718492769", tipus: "RF", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2020-12-31", costEur: 209678.0, unitats: 2032.3228, costInici: 103.1716, valorMercat: 156318.0, rendInici: -25.45, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "JPM GLOBAL STRAT BD EH AC", isin: "LU0587803247", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 460000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "MSS GLOBAL BRANDS I EUHD", isin: "LU0346800435", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 553003.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Amundi msci europe", isin: "LU0987205969", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2022-10-10", costEur: 306622.0, unitats: 1939.493, costInici: 158.0939, valorMercat: 280095.0, rendInici: -8.65, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "Vontobel Fund - Emerging Markets Corporate Bond H EUR Hedged", isin: "LU2171257319", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 962175.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "JUPITER DYNAMIC BOND _D ACC EUR", isin: "LU0895805017", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 300000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2023, nom: "NORDEA 1 GLOBAL CLIMA \"BC\" (EUR)", isin: "LU0841586075", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 528138.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2023-12-31" },
  { any: 2024, nom: "AMU MSCI JP RHE EUHD AC", isin: "LU2469335967", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 345000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "BlackRock Global Funds - Euro Corporate Bond Fund D2 EUR", isin: "LU0368266499", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 295000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Robeco SAM Smart Energy", isin: "LU2145462300", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 462337.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "MFS Meridian Funds - European Value Fund W1 EUR", isin: "LU0944408821", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 1552000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Robeco Global Premium", isin: "LU1736383024", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2020-12-31", costEur: 296207.0, unitats: 2530.3843, costInici: 117.0601, valorMercat: 1070000.0, rendInici: 261.23, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "NORDEA 1 GLOBAL CLIMA \"BC\" (EUR)", isin: "LU0841586075", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 528138.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "PIC CLN ENGY HI EUR ACC", isin: "LU0474968459", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 225000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Algebris UCITS Funds plc - Algebris Financial Equity Fund I EUR Acc", isin: "IE00BWY56Y06", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 151000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "ANIMA Star High Potential Europe I", isin: "IE0032464921", tipus: "RF", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2021-12-31", costEur: 272558.0, unitats: 27883.717, costInici: 9.7748, valorMercat: 147758.0, rendInici: -45.79, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Amundi Funds European value R (eur) A", isin: "LU2183143846", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 828981.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Schroder International Selection Fund EURO Corporate Bond C Accumulation EUR", isin: "LU0113258742", tipus: "RF", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2019-12-31", costEur: 965425.0, unitats: 38908.72, costInici: 24.8126, valorMercat: 414107.0, rendInici: -57.11, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "JSS Sustainable Equity - Global Dividend P USD acc", isin: "LU0950588763", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 571000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Polar Global Tech", isin: "IE00BZ4D7085", tipus: "RV", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2019-12-31", costEur: 285329.0, unitats: 14858.55, costInici: 19.203, valorMercat: 209868.0, rendInici: -26.45, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Vanguard U.S. 500 Stock Index Fund EUR Hedged Acc", isin: "IE00B1G3DH73", tipus: "RV", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2021-12-31", costEur: 1494627.0, unitats: 50914.85, costInici: 29.3554, valorMercat: 1382397.0, rendInici: -7.51, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "MIROVA GLB SUST EQ FUND EURACC N", isin: "LU1623119218", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 346137.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "JPMorgan Funds - US Value Fund C (acc) - EUR", isin: "LU1098399733", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 482500.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Threadneedle (Lux) - American Smaller Companies 3EH", isin: "LU1878469862", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 234090.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Mirabaud - Sustainable Convertible Global", isin: "LU1708488298", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 86000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "JPM US SH.DURAT.BO C EUHD", isin: "LU1458465447", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 291000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Lazard Rathmore Alternative Fund S Acc EUR Hedged", isin: "IE00BKPLQQ52", tipus: "RF", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2020-12-31", costEur: 101110.0, unitats: 840.552, costInici: 120.29, valorMercat: 101121.0, rendInici: 0.01, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Carmignac Credit 2025 F EUR Acc", isin: "FR0013516028", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 400000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "JPMorgan Funds - Europe Dynamic Technologies Fund C (acc) - EUR", isin: "LU0129494729", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2023-07-14", costEur: 162835.0, unitats: 344.19, costInici: 473.0963, valorMercat: 142165.0, rendInici: -12.69, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2024, nom: "Pictet - Robotics I EUR", isin: "LU1279334053", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 417502.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2024-12-31" },
  { any: 2025, nom: "DPAM B - Equities Europe Sustainable W Cap", isin: "BE6246078545", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 548695.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Pictet - Robotics I EUR", isin: "LU1279334053", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 417502.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Neuberger Berman US Small Cap Fund", isin: "IE00B3PY8J28", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 115000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "ISHARES DEV WL ID D EUR", isin: "IE00BD0NCM55", tipus: "RV", gestor: "CaixaBank", custodian: "CaixaBank", divisa: "EUR", dataCompra: "2023-06-22", costEur: 614690.0, unitats: 33319.15, costInici: 18.4485, valorMercat: 444050.0, rendInici: -27.76, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Polar Global Tech", isin: "IE00BZ4D7085", tipus: "RV", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2019-12-31", costEur: 285329.0, unitats: 14858.55, costInici: 19.203, valorMercat: 209868.0, rendInici: -26.45, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Vanguard U.S. 500 Stock Index Fund EUR Hedged Acc", isin: "IE00B1G3DH73", tipus: "RV", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2021-12-31", costEur: 1494627.0, unitats: 50914.85, costInici: 29.3554, valorMercat: 1382397.0, rendInici: -7.51, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Vanguard US Gov Bd Ind (eurhedg)", isin: "IE0007471471", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 718000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "GOLDMAN SACHS US DOLLAR CREDIT R CAP EUR (HEDGED", isin: "LU1431483780", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 469000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Ishares Global AGG Eurh", isin: "IE00BDBRDM35", tipus: "RF", gestor: "UBS", custodian: "UBS", divisa: "EUR", dataCompra: "2023-11-10", costEur: 1647694.0, unitats: 354938.0, costInici: 4.6422, valorMercat: 465098.0, rendInici: -71.77, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Bellevue Funds (Lux) - BB Adamant Asia Pacific Healthcare I EUR Acc", isin: "LU1587985224", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 151676.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Schroder International Selection Fund Asian Opportunities C Accumulation EUR", isin: "LU0248183658", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 212636.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "UBS Hybrid and Subordinated debt", isin: "ES0125104002", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 468000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Threadneedle (Lux) Glb Smlr Coms ZE", isin: "LU0957820193", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 938740.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "T. Rowe Price Funds SICAV - US Smaller Companies Equity Fund Qn EUR Hedged Acc", isin: "LU1862449409", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 261850.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "JSS Sustainable Equity - Global Dividend P USD acc", isin: "LU0950588763", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 571000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Vanguard 20+ Year Euro Treasury Index Fund EUR Acc", isin: "IE00B246KL88", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 218500.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "TIKEHAU SHT DUR SF EUR AC", isin: "LU2098119287", tipus: "RF", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 200000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Fidelity Funds - Global Industrials Fund Y-Acc-EUR", isin: "LU0346389181", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 300000.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Goldman India", isin: "LU1299707072", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 85200.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Vanguard Global Stock Index Fund EUR Hedged Acc", isin: "IE00B03HD316", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 281700.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "Fundsmith Equity Income", isin: "LU0690374029", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 506477.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
  { any: 2025, nom: "BROWN ADVISORY GLOBAL LEAD B USD", isin: "IE00BVVHP563", tipus: "RV", gestor: null, custodian: null, divisa: "EUR", dataCompra: null, costEur: null, unitats: null, costInici: null, valorMercat: 346360.0, rendInici: null, costAnual: null, rend2019: null, rend2020: null, rend2021: null, rend2022: null, rend2023: null, rend2024: null, rend2025: null, rend2026: null, endDate: "2025-12-31" },
];
