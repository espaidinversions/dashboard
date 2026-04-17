import { PM_MODEL } from "./publicMarketsModel.js";

/** @typedef {import("./publicMarketsTypes.js").PMClosedTransactionSummary} PMClosedTransactionSummary */
/** @typedef {import("./publicMarketsTypes.js").PMClosedPosition} PMClosedPosition */
/** @typedef {import("./publicMarketsTypes.js").PMTransaction} PMTransaction */

const PM_TRANSACTIONS = PM_MODEL.activity.transactions;

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
export function buildClosedTransactionSummaryByIsin() {
  const byIsin = new Map();

  [...PM_TRANSACTIONS]
    .filter(t => t?.isin)
    .sort((a, b) => txDateKey(a).localeCompare(txDateKey(b)))
    .forEach(t => {
      const isin = t.isin;
      const cur = byIsin.get(isin) ?? { txs: [], firstTx: null, firstBuy: null, lastTx: null, lastSell: null };
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
      byIsin.set(isin, cur);
    });

  const summary = new Map();
  byIsin.forEach((cur, isin) => {
    const buyTxs = cur.txs.filter(t => t.action === "buy" && t.date);
    const sellTxs = cur.txs.filter(t => t.action === "sell");
    const firstBuy = cur.firstBuy ?? buyTxs[0] ?? cur.firstTx ?? null;
    const costEur = sumTxValue(cur.txs, "buy");
    const unitats = sumTxUnits(cur.txs, "buy");
    const valorMercat = sumTxValue(cur.txs, "sell");

    summary.set(isin, {
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
  const summary = summaryByIsin.get(p.isin) ?? {};
  return {
    ...p,
    ...summary,
    custodian: p.custodian ?? summary.custodian ?? null,
    endDate: p.endDate ?? summary.endDate ?? null,
  };
}
