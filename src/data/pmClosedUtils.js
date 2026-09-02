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

/**
 * @returns {Map<string, PMClosedTransactionSummary>}
 */
export function buildClosedTransactionSummaryByIsinCustodian(transactions = PM_TRANSACTIONS) {
  const byKey = new Map();

  [...transactions]
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

    // Realized P&L matched by units using the average-cost method, walking the
    // transactions in date order. This gives the correct realized return even
    // for positions with layered buys/sells — a plain Σsells − Σbuys is only
    // valid for a single-buy / single-full-sell line.
    let openUnits = 0;        // units still held as we walk the ledger
    let openCost = 0;         // cost basis of the units still held
    let buyUnitsTotal = 0;    // gross units ever bought (for display)
    let buyCostTotal = 0;     // gross cost ever invested (for avg buy price)
    let sellProceeds = 0;     // Σ proceeds from sells
    let sellCostMatched = 0;  // cost basis of the sold units (realized denominator)
    for (const t of cur.txs) {
      const u = t.units ?? 0;
      const v = t.valueEur ?? 0;
      if (t.action === "buy") {
        openUnits += u;
        openCost += v;
        buyUnitsTotal += u;
        buyCostTotal += v;
      } else if (t.action === "sell") {
        const avgCost = openUnits > 0 ? openCost / openUnits : 0;
        const matchedCost = avgCost * u;
        sellProceeds += v;
        sellCostMatched += matchedCost;
        openUnits -= u;
        openCost -= matchedCost;
        if (openUnits < 1e-9) { openUnits = 0; openCost = 0; } // clamp rounding drift
      }
    }

    summary.set(key, {
      gestor: firstBuy?.gestor ?? firstBuy?.custodian ?? cur.firstTx?.gestor ?? null,
      custodian: firstBuy?.custodian ?? cur.firstTx?.custodian ?? null,
      divisa: "EUR",
      dataCompra: firstBuy?.date ?? null,
      costEur: sellCostMatched || buyCostTotal || null,
      unitats: buyUnitsTotal || null,
      costInici: buyCostTotal && buyUnitsTotal ? buyCostTotal / buyUnitsTotal : null,
      valorMercat: sellProceeds || null,
      rendInici: sellCostMatched > 0 ? ((sellProceeds - sellCostMatched) / sellCostMatched) * 100 : null,
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
  // Hand-entered workbook (PM_CLOSED) values are AUTHORITATIVE. The transaction
  // summary only fills fields the workbook left blank — it must never overwrite
  // an authoritative figure (previously `...summary` after `...p` did exactly that).
  const fill = (key) => p?.[key] ?? summary[key] ?? null;
  return {
    ...summary,
    ...p,
    gestor: fill("gestor"),
    custodian: fill("custodian"),
    dataCompra: fill("dataCompra"),
    costEur: fill("costEur"),
    unitats: fill("unitats"),
    costInici: fill("costInici"),
    valorMercat: fill("valorMercat"),
    rendInici: fill("rendInici"),
    endDate: fill("endDate"),
  };
}
