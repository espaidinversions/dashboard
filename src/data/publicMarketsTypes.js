/**
 * Shared PM/public-markets shape definitions.
 *
 * These are JSDoc-only types so the JS side can share a canonical vocabulary
 * without adding a TypeScript build step.
 */

/**
 * @typedef {Object} PMPositionIdentity
 * @property {string} isin
 * @property {string|null} [id]
 * @property {string|null} [nom]
 * @property {string|null} [gestor]
 * @property {string|null} [custodian]
 * @property {string|null} [tipus]
 */

/**
 * @typedef {PMPositionIdentity & Object} PMPositionSnapshot
 * @property {string|null} [divisa]
 * @property {string|null} [dataCompra]
 * @property {number|null} [unitats]
 * @property {number|null} [costEur]
 * @property {number|null} [costInici]
 * @property {number|null} [valorMercat]
 * @property {number|null} [rendInici]
 * @property {number|null} [costAnual]
 * @property {string|null} [startDate]
 * @property {string|null} [endDate]
 * @property {string|null} [notes]
 */

/**
 * @typedef {PMPositionSnapshot & Object} PMRawWorkbookPosition
 * @property {string|null} [bancRaw]
 * @property {string|null} [source]
 * @property {string|null} [rowType]
 * @property {number|null} [n_titols]
 * @property {number|null} [valorActual]
 * @property {string|null} [data]
 * @property {number|null} [any]
 */

/**
 * @typedef {PMPositionSnapshot & { any?: number | null }} PMClosedPosition
 */

/**
 * @typedef {Object} PMTransaction
 * @property {string} id
 * @property {"buy" | "sell"} action
 * @property {string} date
 * @property {string} isin
 * @property {string|null} [nom]
 * @property {string|null} [gestor]
 * @property {string|null} [tipus]
 * @property {string|null} [custodian]
 * @property {number|null} [units]
 * @property {number|null} [nav]
 * @property {number|null} [valueEur]
 * @property {string|null} [source]
 */

/**
 * @typedef {Object} PMTransactionDraft
 * @property {"buy" | "sell"} action
 * @property {string} date
 * @property {string} isin
 * @property {string|null} [id]
 * @property {string|null} [nom]
 * @property {string|null} [gestor]
 * @property {string|null} [tipus]
 * @property {string|null} [custodian]
 * @property {number|null} [units]
 * @property {number|null} [nav]
 * @property {number|null} [valueEur]
 * @property {string|null} [source]
 */

/**
 * @typedef {Object} PMValuePoint
 * @property {string} date
 * @property {number} value
 */

/**
 * @typedef {Record<string, PMValuePoint[]>} PMValuesByCustodian
 */

/**
 * @typedef {Record<string, PMValuesByCustodian>} PMValuesByIsin
 */

/**
 * @typedef {Object} PMManagerSnapshot
 * @property {string} id
 * @property {string} nom
 * @property {string} gestor
 * @property {string} tipus
 * @property {number|null} valorActual
 * @property {number|null} rendPct
 * @property {number|null} ytd
 * @property {number|null} r2025
 * @property {number|null} r2024
 */

/**
 * @typedef {Object} PMPositionMeta
 * @property {string|null} [nom]
 * @property {string|null} [gestor]
 * @property {string|null} [custodian]
 */

/**
 * @typedef {Object} PMOverrides
 * @property {PMTransaction[]} transactions
 * @property {Record<string, number>} terOverrides
 * @property {Record<string, PMPositionMeta>} positionMeta
 */

/**
 * @typedef {Object} PMClosedTransactionSummary
 * @property {PMTransaction[]} txs
 * @property {PMTransaction|null} firstTx
 * @property {PMTransaction|null} firstBuy
 * @property {PMTransaction|null} lastTx
 * @property {PMTransaction|null} lastSell
 */

/**
 * @typedef {Object} PMMonthlySeriesRow
 * @property {string} date
 * @property {string} label
 */

/**
 * @typedef {Object} PMModelGenerated
 * @property {Object} holdings
 * @property {PMPositionSnapshot[]} holdings.active
 * @property {PMRawWorkbookPosition[]} holdings.activeRaw
 * @property {PMClosedPosition[]} holdings.closed
 * @property {Object} activity
 * @property {PMTransaction[]} activity.transactions
 * @property {Object} series
 * @property {PMValuesByIsin} series.values
 * @property {PMMonthlySeriesRow[]} series.monthly
 * @property {PMValuesByIsin} series.closedValues
 * @property {Object} metadata
 * @property {PMManagerSnapshot[]} metadata.managers
 * @property {Record<string, string>} metadata.positionIdAliases
 * @property {Object} metadata.totals
 * @property {number} metadata.totals.active
 * @property {number} metadata.totals.workbookRow
 */

/**
 * @typedef {Object} PMModelIndexes
 * @property {Map<string, PMPositionSnapshot>} activeById
 * @property {Map<string, PMPositionSnapshot[]>} activeByIsin
 * @property {Map<string, PMPositionSnapshot[]>} activeByCustodian
 * @property {Map<string, PMPositionSnapshot[]>} activeByIsinCustodian
 * @property {Map<string, PMClosedPosition[]>} closedByIsin
 * @property {Map<string, PMTransaction>} transactionsById
 * @property {Map<string, PMTransaction[]>} transactionsByIsin
 * @property {Map<string, PMTransaction[]>} transactionsByCustodian
 */

/**
 * @typedef {PMModelGenerated & { indexes: PMModelIndexes }} PMModel
 */

export {};
