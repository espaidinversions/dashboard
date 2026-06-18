import { PM_MODEL_GENERATED } from "../generated/publicMarkets/publicMarketsModel.generated.js";
import { PM_POSITIONS_RAW_SUPPLEMENT } from "./publicMarketsRawSupplement.js";

/**
 * @template T
 * @param {readonly T[]} rows
 * @param {(row: T) => string | null | undefined} keyFn
 * @returns {Map<string, T[]>}
 */
function indexMany(rows, keyFn) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = keyFn(row);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

/**
 * @template T
 * @param {readonly T[]} rows
 * @param {(row: T) => string | null | undefined} keyFn
 * @returns {Map<string, T>}
 */
function indexOne(rows, keyFn) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = keyFn(row);
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

const _suppByExact = new Map(
  PM_POSITIONS_RAW_SUPPLEMENT.map(s => [`${s.isin}||${String(s.custodian ?? "").trim()}`, s])
);
const _suppByIsin = new Map(
  PM_POSITIONS_RAW_SUPPLEMENT.map(s => [s.isin, s])
);
function _applySupp(pos) {
  const supp = _suppByExact.get(`${pos.isin}||${String(pos.custodian ?? "").trim()}`) ?? _suppByIsin.get(pos.isin);
  if (!supp) return pos;
  const out = { ...pos };
  if (supp.tipus     !== undefined) out.tipus     = supp.tipus;
  if (supp.nom       !== undefined) out.nom       = supp.nom;
  if (supp.gestor    !== undefined) out.gestor    = supp.gestor;
  return out;
}
const PM_POSITIONS_RAW = PM_MODEL_GENERATED.holdings.active.map(_applySupp);
const PM_CLOSED = PM_MODEL_GENERATED.holdings.closed;
const PM_TRANSACTIONS = PM_MODEL_GENERATED.activity.transactions;

// Derive dataCompra from the earliest buy transaction for positions missing a purchase date.
const _earliestBuyByIsin = (() => {
  const map = new Map();
  for (const tx of PM_TRANSACTIONS ?? []) {
    if (tx?.action !== "buy" || !tx?.isin || !tx?.date) continue;
    const current = map.get(tx.isin);
    if (!current || tx.date < current) map.set(tx.isin, tx.date);
  }
  return map;
})();

const PM_POSITIONS = PM_POSITIONS_RAW.map(p =>
  p.dataCompra ? p : { ...p, dataCompra: _earliestBuyByIsin.get(p.isin) ?? null }
);

const activeById = indexOne(PM_POSITIONS, row => row?.id);
const activeByIsin = indexMany(PM_POSITIONS, row => row?.isin);
const activeByCustodian = indexMany(PM_POSITIONS, row => row?.custodian);
const activeByIsinCustodian = indexMany(
  PM_POSITIONS,
  row => (row?.isin ? `${row.isin}||${String(row?.custodian ?? "").trim()}` : null)
);
const closedByIsin = indexMany(PM_CLOSED, row => row?.isin);
const transactionsById = indexOne(PM_TRANSACTIONS, row => row?.id);
const transactionsByIsin = indexMany(PM_TRANSACTIONS, row => row?.isin);
const transactionsByCustodian = indexMany(PM_TRANSACTIONS, row => row?.custodian);

export const PM_MODEL = {
  ...PM_MODEL_GENERATED,
  holdings: {
    ...PM_MODEL_GENERATED.holdings,
    active: PM_POSITIONS,
  },
  indexes: {
    activeById,
    activeByIsin,
    activeByCustodian,
    activeByIsinCustodian,
    closedByIsin,
    transactionsById,
    transactionsByIsin,
    transactionsByCustodian,
  },
};
