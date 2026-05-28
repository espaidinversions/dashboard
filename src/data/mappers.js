import { getPrivateEntityName, resolvePrivateEntity } from "./privateEntities.js";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "./capitalCallTipusModel.js";
import { normalizeCapitalCallStrategy, defaultCapitalCallStrategyForVehicleTipus } from "./capitalCallStrategyModel.js";

/** @typedef {import("./dashboardTypes.js").CapitalCallRow} CapitalCallRow */
/** @typedef {import("./dashboardTypes.js").FundMetaRow} FundMetaRow */
/** @typedef {import("./dashboardTypes.js").PipelineDeal} PipelineDeal */
/** @typedef {import("./dashboardTypes.js").PipelineDealRow} PipelineDealRow */
/** @typedef {import("./dashboardTypes.js").PrivateEntity} PrivateEntity */
/** @typedef {import("./dashboardTypes.js").PortfolioCompany} PortfolioCompany */
/** @typedef {import("./dashboardTypes.js").PortfolioCompanyRow} PortfolioCompanyRow */
/** @typedef {import("./dashboardTypes.js").Searcher} Searcher */
/** @typedef {import("./dashboardTypes.js").SearcherRow} SearcherRow */

/** Derive mes/year/fy from an ISO date string (YYYY-MM-DD). */
export function parseDateParts(data) {
  if (!data) return { mes: null, year: null, fy: null };
  const s = String(data).slice(0, 10); // handles Date objects too
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return { mes: null, year: null, fy: null };
  return { mes: m, year: y, fy: `FY ${y}` };
}

/**
 * @param {PrivateEntity} entity
 */
export function privateEntityToRow(entity) {
  return {
    id: entity.id,
    kind: entity.kind,
    canonical_name: entity.canonicalName,
    source_name: entity.sourceName ?? entity.canonicalName,
    workbook_name: entity.workbookName ?? null,
    match_type: entity.matchType ?? null,
    isin: entity.isin ?? null,
    country: entity.country ?? null,
    first_investment_date: entity.firstInvestmentDate ?? null,
    active: entity.active ?? true,
    notes: entity.notes ?? null,
    nif: entity.nif ?? null,
    fiscal_name: entity.fiscalName ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * @param {PortfolioCompany} c
 * @returns {PortfolioCompanyRow}
 */
export function companyToRow(c) {
  const resolved = resolvePrivateEntity("company", c.nom, c.id ?? null);
  return {
    entity_id: resolved.id,
    nom: c.nom, tipus: c.tipus, segment: c.segment || null,
    entrepreneurs: c.entrepreneurs || null, origen: c.origen || null, geo: c.geo || null,
    ticket: c.ticket ?? null, tvpi: c.tvpi ?? null,
    rvpi_eur: c.rvpiEur ?? null, dpi_eur: c.dpiEur ?? null,
    rev: c.rev ?? null, ebitda: c.ebitda ?? null, dfn: c.dfn ?? null,
    gross_ev: c.grossEV ?? null, mult_entry: c.multEntry ?? null,
    data_compr: c.dataCompr || null, mesos_operant: c.mesosOperant ?? null,
    is_mock: c.isMock ?? false,
    quarters: c.quarters ?? [],
  };
}

/**
 * @param {PortfolioCompanyRow & { id?: number }} r
 * @param {Map<string, object>} entityMap
 * @returns {PortfolioCompany}
 */
export function rowToCompany(r, entityMap) {
  const entityId = r.entity_id ?? String(r.id ?? "");
  const name = getPrivateEntityName(entityMap, entityId, r.nom);
  const entity = entityMap.get(entityId);
  return {
    id: entityId, nom: name, tipus: r.tipus, segment: r.segment,
    entrepreneurs: r.entrepreneurs, origen: r.origen, geo: r.geo,
    ticket: r.ticket, tvpi: r.tvpi,
    rvpiEur: r.rvpi_eur, dpiEur: r.dpi_eur,
    rev: r.rev, ebitda: r.ebitda, dfn: r.dfn,
    grossEV: r.gross_ev, multEntry: r.mult_entry,
    dataCompr: r.data_compr, mesosOperant: r.mesos_operant,
    isMock: r.is_mock,
    quarters: r.quarters ?? [],
    sourceName: r.nom,
    workbookName: entity?.workbook_name ?? null,
    matchType: entity?.match_type ?? null,
  };
}

/**
 * @param {CapitalCallRow} row
 */
export function capitalCallToRow(row) {
  const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? null);
  const { mes, year, fy } = parseDateParts(row.data);
  const tipus = normalizeCapitalCallTipus(row.tipus);
  const eur = normalizeCapitalCallSignedAmount(tipus, row.eur);
  return {
    vehicle_id: resolved.id,
    fons: row.fons,
    tipus,
    cat: row.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
    data: row.data,
    mes,
    year,
    fy,
    vehicleTipus: row.fund_meta?.vehicle_tipus ?? null,
    est: normalizeCapitalCallStrategy(row.est, row.fund_meta?.vehicle_tipus ?? null, row),
    eur,
    divisa: row.divisa,
    comentaris: row.comentaris ?? null,
    amount_native: row.amountNative ?? (row.divisa === "EUR" ? eur : null),
    fx_rate: row.fxRate ?? (row.divisa === "EUR" ? 1 : null),
    fx_source: row.fxSource ?? (row.divisa === "EUR" ? "identity" : null),
    recallable:      (row.recallable      !== "" && row.recallable      != null) ? Number(row.recallable)      : null,
    non_recallable:  (row.non_recallable  !== "" && row.non_recallable  != null) ? Number(row.non_recallable)  : null,
    from_recallable: (row.from_recallable !== "" && row.from_recallable != null) ? Number(row.from_recallable) : null,
  };
}

/**
 * @param {object} row
 * @param {Map<string, object>} entityMap
 * @returns {CapitalCallRow}
 */
export function rowToCapitalCall(row, entityMap) {
  const entityId = row.vehicle_id ?? null;
  const entity = entityId ? entityMap.get(entityId) : null;
  const dataStr = row.data ? String(row.data).slice(0, 10) : null;
  const { mes, year, fy } = parseDateParts(dataStr);
  const tipus = normalizeCapitalCallTipus(row.tipus);
  const eur = normalizeCapitalCallSignedAmount(tipus, row.eur);
  const vehicleTipus = row.fund_meta?.vehicle_tipus ?? null;
  const estOverride = entity?.vehicle_est ?? null;
  return {
    _rowId: row.id,
    id: entityId ?? undefined,
    fons: getPrivateEntityName(entityMap, entityId, row.fons),
    tipus,
    cat: row.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
    data: dataStr,
    mes,
    any: year,
    fy,
    vehicleTipus,
    est: estOverride ?? (normalizeCapitalCallStrategy(row.est, vehicleTipus, { fons: row.fons }) ?? defaultCapitalCallStrategyForVehicleTipus(vehicleTipus)),
    eur,
    divisa: row.divisa,
    comentaris: row.comentaris ?? null,
    amountNative: row.amount_native ?? null,
    fxRate: row.fx_rate ?? null,
    fxSource: row.fx_source ?? null,
    recallable:      row.recallable      ?? null,
    non_recallable:  row.non_recallable  ?? null,
    from_recallable: row.from_recallable ?? null,
  };
}

/**
 * @param {FundMetaRow} row
 */
export function fundMetaToRow(row) {
  const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? null);
  return {
    vehicle_id: resolved.id,
    fons: row.fons,
    tvpi: row.tvpi ?? null,
    irr: row.irr ?? null,
    vehicle_tipus: row.vehicleTipus ?? null,
    fi_end: row.fiEnd ?? null,
  };
}

/**
 * @param {object} row
 * @param {Map<string, object>} entityMap
 * @returns {FundMetaRow}
 */
export function rowToFundMeta(row, entityMap) {
  const entityId = row.vehicle_id ?? null;
  return {
    id: entityId ?? undefined,
    fons: getPrivateEntityName(entityMap, entityId, row.fons),
    tvpi: row.tvpi,
    irr: row.irr ?? null,
    vehicleTipus: row.vehicle_tipus ?? null,
    fiEnd: row.fi_end ?? null,
  };
}

/**
 * @param {Searcher} s
 * @returns {SearcherRow}
 */
export function searcherToRow(s) {
  return {
    nom: s.nom, tipus: s.tipus, modalitat: s.modalitat, geo: s.geo,
    status_screening_code: s.statusScreeningCode ?? null,
    status_screening: s.statusScreening, form_entrada: s.formEntrada,
    status_cerca_code: s.statusCercaCode ?? null,
    status_cerca: s.statusCerca ?? null,
    status_adquisicio_code: s.statusAdquisicioCode ?? null,
    status_adquisicio: s.statusAdquisicio ?? null,
    intro_per: s.introPer, searcher1: s.searcher1 || null, searcher2: s.searcher2 || null,
    companyia_adquirida: s.companiaAdquirida ?? null,
    escola1: s.escola1 || null, escola2: s.escola2 || null,
    web: s.web ?? null, comentaris: s.comentaris ?? null,
    ticket: s.ticket ?? null, tvpi: s.tvpi ?? null,
    data_inici: s.dataInici || s.databaseIntroDate || null,
    database_intro_date: s.databaseIntroDate || s.dataInici || null,
    data_compr: s.dataCompr || null, mesos_cercant: s.mesosCercant ?? null,
    equity_stake: s.equityStake ?? null, is_mock: s.isMock ?? false,
    is_legacy: s.isLegacy ?? false,
    nif: s.nif ?? null,
    label: s.label ?? null,
    irr: s.irr ?? null,
    dpi: s.dpi ?? null,
  };
}

/**
 * @param {SearcherRow} r
 * @returns {Searcher}
 */
export function rowToSearcher(r) {
  return {
    id: r.id, nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
    statusScreeningCode: r.status_screening_code ?? null,
    statusScreening: r.status_screening, formEntrada: r.form_entrada,
    statusCercaCode: r.status_cerca_code ?? null,
    statusCerca: r.status_cerca ?? null,
    statusAdquisicioCode: r.status_adquisicio_code ?? null,
    statusAdquisicio: r.status_adquisicio ?? null,
    introPer: r.intro_per, searcher1: r.searcher1 || "", searcher2: r.searcher2 || "",
    escola1: r.escola1 || "", escola2: r.escola2 || "",
    companiaAdquirida: r.companyia_adquirida ?? null,
    web: r.web ?? null,
    comentaris: r.comentaris ?? null,
    ticket: r.ticket, tvpi: r.tvpi ?? null,
    dataInici: r.data_inici ?? r.database_intro_date ?? null,
    databaseIntroDate: r.database_intro_date ?? r.data_inici ?? null,
    dataCompr: r.data_compr, mesosCercant: r.mesos_cercant,
    equityStake: r.equity_stake, isMock: r.is_mock ?? false,
    isLegacy: r.is_legacy ?? false,
    nif: r.nif ?? null,
    label: r.label ?? null,
    irr: r.irr ?? null,
    dpi: r.dpi ?? null,
  };
}

/**
 * @param {PipelineDeal} d
 * @returns {PipelineDealRow}
 */
export function dealToRow(d) {
  return {
    name: d.name, amount: d.amount, currency: d.currency,
    geography: d.geography, strategy: d.strategy, sector: d.sector,
    status: d.status, canal: d.canal, active: d.active ?? true,
    manager: d.manager ?? null,
    estimated_closing: d.estimatedClosing ?? null,
  };
}

/**
 * @param {PipelineDealRow} r
 * @returns {PipelineDeal}
 */
export function rowToDeal(r) {
  return {
    id: r.id, name: r.name, amount: r.amount, currency: r.currency,
    geography: r.geography, strategy: r.strategy, sector: r.sector,
    status: r.status, canal: r.canal, active: r.active,
    manager: r.manager ?? null,
    estimatedClosing: r.estimated_closing ?? null,
  };
}
