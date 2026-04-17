import { PM_MODEL_GENERATED } from "../generated/publicMarkets/publicMarketsModel.generated.js";

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

const PM_POSITIONS = PM_MODEL_GENERATED.holdings.active;
const PM_CLOSED = PM_MODEL_GENERATED.holdings.closed;
const PM_TRANSACTIONS = PM_MODEL_GENERATED.activity.transactions;

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
