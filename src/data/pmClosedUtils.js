import { PM_MODEL } from "./publicMarketsModel.js";

/** @typedef {import("./publicMarketsTypes.js").PMClosedTransactionSummary} PMClosedTransactionSummary */
/** @typedef {import("./publicMarketsTypes.js").PMClosedPosition} PMClosedPosition */
/** @typedef {import("./publicMarketsTypes.js").PMTransaction} PMTransaction */

const PM_TRANSACTIONS = PM_MODEL.activity.transactions;

function normalizeCustodian(custodian) {
  return String(custodian ?? "").trim();
}

function summaryKey(isin, custodian) {
  const cleanIsin = String(isin ?? "").trim();
  if (!cleanIsin) return null;
  return `${cleanIsin}||${normalizeCustodian(custodian)}`;
}

function txDateKey(t) {
  return t?.date ?? "";
}

function sumTxValue(txs, kind) {
  return txs
    .filter(t => t.action === kind)
    .reduce((sum, t) => sum + (t.valueEur ?? 0), 0);
}

function sumTxUnits(txs, kind) {
  return txs
    .filter(t => t.action === kind)
    .reduce((sum, t) => sum + (t.units ?? 0), 0);
}

/**
 * @returns {Map<string, PMClosedTransactionSummary>}
 */
export function buildClosedTransactionSummaryByIsinCustodian() {
  const byKey = new Map();

  [...PM_TRANSACTIONS]
    .filter(t => t?.isin)
    .sort((a, b) => txDateKey(a).localeCompare(txDateKey(b)))
    .forEach(t => {
      const key = summaryKey(t.isin, t.custodian);
      if (!key) return;
      const cur = byKey.get(key) ?? { txs: [], firstTx: null, firstBuy: null, lastTx: null, lastSell: null };
      cur.txs.push(t);
      if (!cur.firstTx || txDateKey(t).localeCompare(txDateKey(cur.firstTx)) < 0) {
        cur.firstTx = t;
      }
      if (t.action === "buy" && (!cur.firstBuy || txDateKey(t).localeCompare(txDateKey(cur.firstBuy)) < 0)) {
        cur.firstBuy = t;
      }
      if (!cur.lastTx || txDateKey(t).localeCompare(txDateKey(cur.lastTx)) > 0) {
        cur.lastTx = t;
      }
      if (t.action === "sell" && (!cur.lastSell || txDateKey(t).localeCompare(txDateKey(cur.lastSell)) > 0)) {
        cur.lastSell = t;
      }
      byKey.set(key, cur);
    });

  const summary = new Map();
  byKey.forEach((cur, key) => {
    const buyTxs = cur.txs.filter(t => t.action === "buy" && t.date);
    const firstBuy = cur.firstBuy ?? buyTxs[0] ?? cur.firstTx ?? null;
    const costEur = sumTxValue(cur.txs, "buy");
    const unitats = sumTxUnits(cur.txs, "buy");
    const valorMercat = sumTxValue(cur.txs, "sell");

    summary.set(key, {
      gestor: firstBuy?.gestor ?? firstBuy?.custodian ?? cur.firstTx?.gestor ?? null,
      custodian: firstBuy?.custodian ?? cur.firstTx?.custodian ?? null,
      divisa: "EUR",
      dataCompra: firstBuy?.date ?? null,
      costEur: costEur || null,
      unitats: unitats || null,
      costInici: costEur && unitats ? costEur / unitats : null,
      valorMercat: valorMercat || null,
      rendInici: costEur ? ((valorMercat - costEur) / costEur) * 100 : null,
      endDate: cur.lastSell?.date ?? cur.lastTx?.date ?? null,
    });
  });

  return summary;
}

/**
 * @param {PMClosedPosition} p
 * @param {Map<string, PMClosedTransactionSummary>} summaryByIsin
 * @returns {PMClosedPosition}
 */
export function enrichClosedPosition(p, summaryByIsin) {
  const summary = summaryByIsin.get(summaryKey(p?.isin, p?.custodian)) ?? {};
  return {
    ...p,
    ...summary,
    custodian: p.custodian ?? summary.custodian ?? null,
    endDate: p.endDate ?? summary.endDate ?? null,
  };
}
