import { supabase } from "./supabase.js";
import {
  buildPrivateEntitiesFromDashboardBundle,
  getPrivateEntityName,
  resolvePrivateEntity,
} from "./data/privateEntities.js";

/** @typedef {import("./data/dashboardTypes.js").CapitalCallRow} CapitalCallRow */
/** @typedef {import("./data/dashboardTypes.js").DashboardBundle} DashboardBundle */
/** @typedef {import("./data/dashboardTypes.js").FundMetaRow} FundMetaRow */
/** @typedef {import("./data/dashboardTypes.js").PipelineDeal} PipelineDeal */
/** @typedef {import("./data/dashboardTypes.js").PipelineDealRow} PipelineDealRow */
/** @typedef {import("./data/dashboardTypes.js").PrivateEntity} PrivateEntity */
/** @typedef {import("./data/dashboardTypes.js").PortfolioCompany} PortfolioCompany */
/** @typedef {import("./data/dashboardTypes.js").PortfolioCompanyRow} PortfolioCompanyRow */
/** @typedef {import("./data/dashboardTypes.js").Searcher} Searcher */
/** @typedef {import("./data/dashboardTypes.js").SearcherRow} SearcherRow */
/** @typedef {import("./data/publicMarketsTypes.js").PMOverrides} PMOverrides */
/** @typedef {import("./data/publicMarketsTypes.js").PMPositionMeta} PMPositionMeta */
/** @typedef {import("./data/publicMarketsTypes.js").PMTransactionDraft} PMTransactionDraft */

// ── Helpers ───────────────────────────────────────────────

/**
 * @param {PrivateEntity} entity
 */
function privateEntityToRow(entity) {
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
    updated_at: new Date().toISOString(),
  };
}

/**
 * @param {PortfolioCompany} c
 * @returns {PortfolioCompanyRow}
 */
function companyToRow(c) {
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
function rowToCompany(r, entityMap) {
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

/** Derive mes/year/fy from an ISO date string (YYYY-MM-DD). */
function parseDateParts(data) {
  if (!data) return { mes: null, year: null, fy: null };
  const s = String(data).slice(0, 10); // handles Date objects too
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return { mes: null, year: null, fy: null };
  return { mes: m, year: y, fy: `FY ${y}` };
}

/**
 * @param {CapitalCallRow} row
 */
function capitalCallToRow(row) {
  const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? null);
  const { mes, year, fy } = parseDateParts(row.data);
  return {
    vehicle_id: resolved.id,
    fons: row.fons,
    tipus: row.tipus,
    cat: row.cat,
    data: row.data,
    mes,
    year,
    fy,
    vcpe: row.vcpe,
    est: row.est,
    eur: row.eur,
    divisa: row.divisa,
  };
}

/**
 * @param {object} row
 * @param {Map<string, object>} entityMap
 * @returns {CapitalCallRow}
 */
function rowToCapitalCall(row, entityMap) {
  const entityId = row.vehicle_id ?? null;
  const dataStr = row.data ? String(row.data).slice(0, 10) : null;
  const { mes, year, fy } = parseDateParts(dataStr);
  return {
    _rowId: row.id,
    id: entityId ?? undefined,
    fons: getPrivateEntityName(entityMap, entityId, row.fons),
    tipus: row.tipus,
    cat: row.cat,
    data: dataStr,
    mes,
    any: year,
    fy,
    vcpe: row.vcpe,
    est: row.est,
    eur: row.eur,
    divisa: row.divisa,
  };
}

/**
 * @param {FundMetaRow} row
 */
function fundMetaToRow(row) {
  const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? null);
  return {
    vehicle_id: resolved.id,
    fons: row.fons,
    tvpi: row.tvpi ?? null,
  };
}

/**
 * @param {object} row
 * @param {Map<string, object>} entityMap
 * @returns {FundMetaRow}
 */
function rowToFundMeta(row, entityMap) {
  const entityId = row.vehicle_id ?? null;
  return {
    id: entityId ?? undefined,
    fons: getPrivateEntityName(entityMap, entityId, row.fons),
    tvpi: row.tvpi,
  };
}

/**
 * @param {Searcher} s
 * @returns {SearcherRow}
 */
function searcherToRow(s) {
  return {
    nom: s.nom, tipus: s.tipus, modalitat: s.modalitat, geo: s.geo,
    status_screening: s.statusScreening, form_entrada: s.formEntrada,
    intro_per: s.introPer, searcher1: s.searcher1 || null, searcher2: s.searcher2 || null,
    escola1: s.escola1 || null, escola2: s.escola2 || null,
    ticket: s.ticket ?? null, data_inici: s.dataInici || null,
    data_compr: s.dataCompr || null, mesos_cercant: s.mesosCercant ?? null,
    equity_stake: s.equityStake ?? null, is_mock: s.isMock ?? false,
  };
}

/**
 * @param {SearcherRow} r
 * @returns {Searcher}
 */
function rowToSearcher(r) {
  return {
    id: r.id, nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
    statusScreening: r.status_screening, formEntrada: r.form_entrada,
    introPer: r.intro_per, searcher1: r.searcher1 || "", searcher2: r.searcher2 || "",
    escola1: r.escola1 || "", escola2: r.escola2 || "",
    ticket: r.ticket, dataInici: r.data_inici,
    dataCompr: r.data_compr, mesosCercant: r.mesos_cercant,
    equityStake: r.equity_stake, isMock: r.is_mock ?? false,
  };
}

/**
 * @param {PipelineDeal} d
 * @returns {PipelineDealRow}
 */
function dealToRow(d) {
  return {
    name: d.name, amount: d.amount, currency: d.currency,
    geography: d.geography, strategy: d.strategy, sector: d.sector,
    status: d.status, canal: d.canal, active: d.active ?? true,
    estimated_closing: d.estimatedClosing ?? null,
  };
}

/**
 * @param {PipelineDealRow} r
 * @returns {PipelineDeal}
 */
function rowToDeal(r) {
  return {
    id: r.id, name: r.name, amount: r.amount, currency: r.currency,
    geography: r.geography, strategy: r.strategy, sector: r.sector,
    status: r.status, canal: r.canal, active: r.active,
    estimatedClosing: r.estimated_closing ?? null,
  };
}

async function loadPrivateEntityMap() {
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("private_entities").select("*");
  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.map((row) => [row.id, row]));
}

/**
 * @param {PrivateEntity[]} rows
 */
async function upsertPrivateEntities(rows) {
  if (!supabase || !rows.length) return { error: null };
  const { error } = await supabase
    .from("private_entities")
    .upsert(rows.map(privateEntityToRow), { onConflict: "id" });
  return { error };
}

// ── Audit log ─────────────────────────────────────────────

/**
 * @param {string} action
 * @param {string} tableName
 * @param {string | number | null | undefined} recordId
 * @param {Record<string, unknown> | null} changes
 */
async function logAudit(action, tableName, recordId, changes) {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action,
      table_name: tableName,
      record_id: String(recordId ?? ""),
      changes,
    });
  } catch (e) {
    console.error("logAudit failed:", e);
  }
}

// ── Load all ──────────────────────────────────────────────

/** @returns {Promise<DashboardBundle | null>} */
export async function loadAll() {
  if (!supabase) return null;
  const [cc, fm, pl, co, sr, pe] = await Promise.all([
    supabase.from("capital_calls").select("*").order("data"),
    supabase.from("fund_meta").select("*"),
    supabase.from("pipeline").select("*").order("id"),
    supabase.from("portfolio_companies").select("*").order("nom"),
    supabase.from("searchers").select("*").order("nom"),
    supabase.from("private_entities").select("*"),
  ]);
  if (cc.error || fm.error || pl.error || co.error || sr.error) return null;
  const privateEntities = pe.error || !Array.isArray(pe.data) ? [] : pe.data;
  const entityMap = new Map(privateEntities.map((row) => [row.id, row]));
  return {
    rawCC:      cc.data.map((row) => rowToCapitalCall(row, entityMap)),
    fundMeta:   fm.data.map((row) => rowToFundMeta(row, entityMap)),
    funds0:     pl.data.map(r => ({ id:r.id, name:r.name, amount:r.amount, currency:r.currency, geography:r.geography, strategy:r.strategy, sector:r.sector, status:r.status, canal:r.canal, active:r.active, estimatedClosing: r.estimated_closing ?? null })),
    companies:  co.data.map((row) => rowToCompany(row, entityMap)),
    searchers:  sr.data.map(rowToSearcher),
    privateEntities: privateEntities.map((row) => ({
      id: row.id,
      kind: row.kind,
      canonicalName: row.canonical_name,
      sourceName: row.source_name,
      workbookName: row.workbook_name,
      matchType: row.match_type,
    })),
  };
}

/** @returns {Promise<PortfolioCompany[] | null>} */
export async function loadCompanies() {
  if (!supabase) return null;
  const [companies, entityMap] = await Promise.all([
    supabase.from("portfolio_companies").select("*").order("nom"),
    loadPrivateEntityMap(),
  ]);
  if (companies.error) return null;
  return companies.data.map((row) => rowToCompany(row, entityMap));
}

/** @returns {Promise<CapitalCallRow[] | null>} */
export async function loadCapitalCalls() {
  if (!supabase) return null;
  const [cc, entityMap] = await Promise.all([
    supabase.from("capital_calls").select("*").order("data"),
    loadPrivateEntityMap(),
  ]);
  if (cc.error) return null;
  return cc.data.map((row) => rowToCapitalCall(row, entityMap));
}

/** @returns {Promise<Searcher[] | null>} */
export async function loadSearchers() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("searchers").select("*").order("nom");
  if (error) return null;
  return data.map(rowToSearcher);
}

// ── Save individual tables ────────────────────────────────

/** @param {CapitalCallRow[]} rows */
export async function saveCapitalCalls(rows) {
  if (!supabase) return;
  const entities = buildPrivateEntitiesFromDashboardBundle({ rawCC: rows });
  const { error: entitiesError } = await upsertPrivateEntities(entities);
  if (entitiesError) return { error: entitiesError };
  const { error: delError } = await supabase.from("capital_calls").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("capital_calls").insert(rows.map(capitalCallToRow));
    if (error) return { error };
  }
  return { error: null };
}

/** @param {FundMetaRow[]} rows */
export async function saveFundMeta(rows) {
  if (!supabase) return;
  const entities = buildPrivateEntitiesFromDashboardBundle({ fundMeta: rows });
  const { error: entitiesError } = await upsertPrivateEntities(entities);
  if (entitiesError) return { error: entitiesError };
  const { error } = await supabase
    .from("fund_meta")
    .upsert(rows.map(fundMetaToRow), { onConflict: "vehicle_id" });
  return { error };
}

/** @param {PipelineDeal[]} rows */
export async function savePipeline(rows) {
  if (!supabase) return;
  const { error: delError } = await supabase.from("pipeline").delete().neq("id", -1);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("pipeline").insert(rows.map(r => ({
    id:r.id, name:r.name, amount:r.amount, currency:r.currency,
    geography:r.geography, strategy:r.strategy, sector:r.sector,
    status:r.status, canal:r.canal, active:r.active,
    estimated_closing: r.estimatedClosing ?? null,
    })));
    if (error) return { error };
  }
  return { error: null };
}

/** @param {PortfolioCompany[]} rows */
export async function saveCompanies(rows) {
  if (!supabase) return;
  const entities = buildPrivateEntitiesFromDashboardBundle({ companies: rows });
  const { error: entitiesError } = await upsertPrivateEntities(entities);
  if (entitiesError) return { error: entitiesError };
  const { error: delError } = await supabase.from("portfolio_companies").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("portfolio_companies").insert(rows.map(companyToRow));
    if (error) return { error };
  }
  return { error: null };
}

/** @param {Searcher[]} rows */
export async function saveSearchers(rows) {
  if (!supabase) return;
  const { error: delError } = await supabase.from("searchers").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("searchers").insert(rows.map(searcherToRow));
    if (error) return { error };
  }
  return { error: null };
}

/**
 * @param {DashboardBundle} [bundle]
 */
export async function saveDashboardBundle(bundle) {
  const { rawCC, funds0, companies, searchers, fundMeta } = bundle ?? {};
  if (!supabase) return { error: null };
  const privateEntities = bundle?.privateEntities ?? buildPrivateEntitiesFromDashboardBundle({ companies, rawCC, fundMeta });
  const { error } = await supabase.rpc("replace_dashboard_bundle", {
    p_private_entities_rows: privateEntities == null ? null : privateEntities.map(privateEntityToRow),
    p_cc_rows: rawCC == null ? null : rawCC.map(r => ({
      vehicle_id: capitalCallToRow(r).vehicle_id,
      fons: r.fons,
      tipus: r.tipus,
      cat: r.cat,
      data: r.data,
      mes: r.mes,
      year: r.any,
      fy: r.fy,
      vcpe: r.vcpe,
      est: r.est,
      eur: r.eur,
      divisa: r.divisa,
    })),
    p_pl_rows: funds0 == null ? null : funds0.map(r => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      geography: r.geography,
      strategy: r.strategy,
      sector: r.sector,
      status: r.status,
      canal: r.canal,
      active: r.active,
      estimated_closing: r.estimatedClosing ?? null,
    })),
    p_companies_rows: companies == null ? null : companies.map(companyToRow),
    p_searchers_rows: searchers == null ? null : searchers.map(searcherToRow),
    p_fund_meta_rows: fundMeta == null ? null : fundMeta.map(fundMetaToRow),
  });
  return { error };
}

// ── Granular single-row upserts ───────────────────────────

/**
 * @param {string | { id?: string | null, fons?: string | null, nom?: string | null }} fund
 * @param {number | null | undefined} tvpi
 */
export async function upsertFundMeta(fund, tvpi) {
  if (!supabase) return { error: null };
  const name = typeof fund === "string" ? fund : fund?.fons ?? fund?.nom ?? "";
  const resolved = resolvePrivateEntity("vehicle", name, typeof fund === "string" ? null : fund?.id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { error: entityError };
  const { error } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, tvpi: tvpi ?? null }, { onConflict: "vehicle_id" });
  if (!error) logAudit("update", "fund_meta", resolved.id, { fons: resolved.canonicalName, tvpi });
  return { error };
}

/**
 * @param {PortfolioCompany} company
 */
export async function upsertCompany(company) {
  if (!supabase) return { data: company, error: null };
  const resolved = resolvePrivateEntity("company", company.nom, company.id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { data: null, error: entityError };
  const renameResult = await renamePrivateEntity(resolved.id, company.nom);
  if (renameResult.error) return { data: null, error: renameResult.error };
  const row = companyToRow(company);
  const query = supabase.from("portfolio_companies");
  const { data, error } = await query.upsert(row, { onConflict: "entity_id" }).select().single();
  if (!error) logAudit("update", "portfolio_companies", resolved.id, { nom: company.nom });
  const entityMap = await loadPrivateEntityMap();
  return { data: data ? rowToCompany(data, entityMap) : null, error };
}

/**
 * @param {Searcher} searcher
 */
export async function upsertSearcher(searcher) {
  if (!supabase) return { data: searcher, error: null };
  const row = searcherToRow(searcher);
  const query = supabase.from("searchers");
  const { data, error } = searcher.id
    ? await query.update(row).eq("id", searcher.id).select().single()
    : await query.insert(row).select().single();
  if (!error) logAudit("update", "searchers", data?.id ?? searcher.nom, { nom: searcher.nom });
  return { data: data ? rowToSearcher(data) : null, error };
}

// ── Insert (single-row, returns row with DB-assigned id) ──

/**
 * @param {PortfolioCompany} company
 * @returns {Promise<PortfolioCompany | null>}
 */
export async function insertCompany(company) {
  if (!supabase) return null;
  const resolved = resolvePrivateEntity("company", company.nom, company.id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) {
    console.error(entityError);
    return null;
  }
  const { data, error } = await supabase
    .from("portfolio_companies")
    .insert(companyToRow(company))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  logAudit("insert", "portfolio_companies", resolved.id, { nom: data.nom });
  const entityMap = await loadPrivateEntityMap();
  return rowToCompany(data, entityMap);
}

/**
 * @param {Searcher} searcher
 * @returns {Promise<Searcher | null>}
 */
export async function insertSearcher(searcher) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("searchers")
    .insert(searcherToRow(searcher))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  logAudit("insert", "searchers", data.id, { nom: data.nom });
  return rowToSearcher(data);
}

/**
 * @param {PipelineDeal} deal
 * @returns {Promise<PipelineDeal | null>}
 */
export async function insertPipelineDeal(deal) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("pipeline")
    .insert(dealToRow(deal))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToDeal(data);
}

/**
 * @param {string} fons
 * @param {string} vcpe
 * @param {string} est
 * @param {number} compromisEur
 * @param {string} divisa
 * @returns {Promise<CapitalCallRow | null>}
 */
export async function insertFund(fons, vcpe, est, compromisEur, divisa) {
  if (!supabase) return null;
  const resolved = resolvePrivateEntity("vehicle", fons);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) { console.error(entityError); return null; }
  const data_iso = new Date().toISOString().slice(0, 10);
  const { mes, year, fy } = parseDateParts(data_iso);

  const { error: ccErr } = await supabase.from("capital_calls").insert({
    vehicle_id: resolved.id,
    fons: resolved.canonicalName,
    vcpe, est, cat: "Compromís", eur: compromisEur, divisa,
    mes, year, fy, tipus: vcpe, data: data_iso,
  });
  if (ccErr) { console.error(ccErr); return null; }

  await supabase.from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, tvpi: null }, { onConflict: "vehicle_id" });

  logAudit("insert", "capital_calls", resolved.id, { fons: resolved.canonicalName, vcpe, est });
  // Return in rawCC shape (key `any`, not `year`)
  return { id: resolved.id, fons: resolved.canonicalName, vcpe, est, cat: "Compromís", eur: compromisEur, divisa, mes, any: year, fy, tipus: vcpe, data: data_iso };
}

export async function loadPrivateEntities() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("private_entities")
    .select("*")
    .order("canonical_name");
  if (error || !Array.isArray(data)) return [];
  return data;
}

/**
 * @param {string} entityId
 * @param {string} canonicalName
 */
export async function renamePrivateEntity(entityId, canonicalName) {
  if (!supabase) return { error: null };
  const trimmedName = String(canonicalName ?? "").trim();
  if (!trimmedName) return { error: new Error("Name is required") };
  const { error } = await supabase.rpc("rename_private_entity", {
    p_id: entityId,
    p_name: trimmedName,
  });
  if (!error) {
    logAudit("update", "private_entities", entityId, { canonicalName: trimmedName });
  }
  return { error };
}

// ── Delete ────────────────────────────────────────────────

/** @param {string} id */
export async function deleteCompany(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies").delete().eq("entity_id", id);
  if (!error) logAudit("delete", "portfolio_companies", id, null);
  return { error };
}

/** @param {number} id */
export async function deleteSearcher(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers").delete().eq("id", id);
  if (!error) logAudit("delete", "searchers", id, null);
  return { error };
}

/** @param {number} id */
export async function deletePipelineDeal(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline").delete().eq("id", id);
  if (!error) logAudit("delete", "pipeline", id, null);
  return { error };
}

/** @param {string | { id?: string | null, fons?: string | null }} fund */
export async function deleteFund(fund) {
  if (!supabase) return null;
  const name = typeof fund === "string" ? fund : fund?.fons ?? "";
  const resolved = resolvePrivateEntity("vehicle", name, typeof fund === "string" && fund.includes(":") ? fund : fund?.id ?? null);
  const { error: e1 } = await supabase.from("capital_calls").delete().eq("vehicle_id", resolved.id);
  if (e1) return e1;
  const { error: e2 } = await supabase.from("fund_meta").delete().eq("vehicle_id", resolved.id);
  if (!e2) logAudit("delete", "capital_calls", resolved.id, { fons: resolved.canonicalName });
  return e2 ?? null;
}

// ── Upsert (pipeline) ─────────────────────────────────────

/**
 * @param {PipelineDeal} deal
 */
export async function upsertPipelineDeal(deal) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline")
    .upsert({ id: deal.id, ...dealToRow(deal) }, { onConflict: "id" });
  if (!error) logAudit("update", "pipeline", deal.id, { name: deal.name });
  return { error };
}

// ── Public Markets overrides ──────────────────────────────

/** @returns {Promise<PMOverrides | null>} */
export async function loadPMOverrides() {
  if (!supabase) return null;
  const [tx, ter, meta] = await Promise.all([
    supabase.from("pm_transactions").select("*").order("date"),
    supabase.from("pm_ter_overrides").select("*"),
    supabase.from("pm_position_meta").select("*"),
  ]);
  if (tx.error || ter.error || meta.error) return null;
  return {
    transactions: tx.data.map(r => ({
      id:        r.id,
      action:    r.action,
      date:      r.date,
      isin:      r.isin,
      nom:       r.nom,
      tipus:     r.tipus,
      custodian: r.custodian,
      units:     r.units,
      nav:       r.nav,
      valueEur:  r.value_eur,
      source:    r.source ?? "manual",
    })),
    terOverrides:  Object.fromEntries(ter.data.map(r => [r.isin, r.ter])),
    positionMeta:  Object.fromEntries(meta.data.map(r => [r.isin, {
      nom:      r.nom,
      gestor:   r.gestor,
      custodian: r.custodian,
    }])),
  };
}

// ── PM Operations load helpers ────────────────────────────────────────────────

export async function loadPMTransactions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_transactions").select("*").order("date", { ascending: false });
  if (error) return [];
  return data;
}

export async function deletePMTransaction(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_transactions").delete().eq("id", id);
  return { error };
}

export async function loadPMTerOverridesTable() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_ter_overrides").select("*").order("isin");
  if (error) return [];
  return data;
}

export async function loadPMPositionMetaTable() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_position_meta").select("*").order("isin");
  if (error) return [];
  return data;
}

export async function loadPMPositionOverridesTable() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_position_overrides").select("*").order("isin");
  if (error) return [];
  return data;
}

/**
 * @param {PMTransactionDraft & { id?: string | null }} tx
 */
export async function upsertTransaction(tx) {
  if (!supabase) return { error: null };
  const row = {
    action:    tx.action,
    date:      tx.date,
    isin:      tx.isin,
    nom:       tx.nom ?? null,
    tipus:     tx.tipus ?? null,
    custodian: tx.custodian ?? null,
    units:     tx.units ?? null,
    nav:       tx.nav ?? null,
    value_eur: tx.valueEur ?? null,
    source:    "manual",
  };
  if (tx.id) row.id = tx.id;
  const { data, error } = await supabase.from("pm_transactions")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  return { data, error };
}

export async function upsertTerOverride(isin, ter, notes) {
  if (!supabase) return { error: null };
  const row = { isin, ter, updated_at: new Date().toISOString() };
  if (notes !== undefined) row.notes = notes;
  const { error } = await supabase.from("pm_ter_overrides")
    .upsert(row, { onConflict: "isin" });
  return { error };
}

/**
 * @param {string} isin
 * @param {PMPositionMeta} fields
 */
export async function upsertPositionMeta(isin, fields) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_position_meta")
    .upsert({ isin, ...fields, updated_at: new Date().toISOString() }, { onConflict: "isin" });
  return { error };
}

// ── Public Markets — position financial overrides ─────────

/** @returns {Promise<Map<string, object> | null>} */
export async function loadPMPositionOverrides() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("pm_position_overrides").select("*");
  if (error) return null;
  return new Map(data.map(r => [r.isin, {
    valorMercat: r.valor_mercat,
    rendInici:   r.rend_inici,
    rend2026:    r.rend2026,
    rend2025:    r.rend2025,
    rend2024:    r.rend2024,
    rend2023:    r.rend2023,
    costAnual:   r.cost_anual,
  }]));
}

/**
 * @param {string} isin
 * @param {object} fields  camelCase keys matching position fields
 */
export async function upsertPMPositionOverride(isin, fields) {
  if (!supabase) return { error: null };
  const row = { isin, updated_at: new Date().toISOString() };
  if (fields.valorMercat != null) row.valor_mercat = fields.valorMercat;
  if (fields.rendInici   != null) row.rend_inici   = fields.rendInici;
  if (fields.rend2026    != null) row.rend2026      = fields.rend2026;
  if (fields.rend2025    != null) row.rend2025      = fields.rend2025;
  if (fields.rend2024    != null) row.rend2024      = fields.rend2024;
  if (fields.rend2023    != null) row.rend2023      = fields.rend2023;
  if (fields.costAnual   != null) row.cost_anual    = fields.costAnual;
  if (fields.notes       != null) row.notes         = fields.notes;
  const { error } = await supabase.from("pm_position_overrides")
    .upsert(row, { onConflict: "isin" });
  if (!error) logAudit("update", "pm_position_overrides", isin, fields);
  return { error };
}

// ── Admin: bulk clear ─────────────────────────────────────

// ── Capital call row-level CRUD ───────────────────────────────────────────────

export async function insertCapitalCall(cc) {
  if (!supabase) return { data: null, error: null };
  const resolved = resolvePrivateEntity("vehicle", cc.fons, cc.vehicle_id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { data: null, error: entityError };
  const { mes, year, fy } = parseDateParts(cc.data);
  const row = {
    vehicle_id: resolved.id,
    fons: resolved.canonicalName,
    tipus: cc.tipus ?? cc.vcpe ?? null,
    cat: cc.cat,
    data: cc.data,
    mes,
    year,
    fy,
    vcpe: cc.vcpe ?? null,
    est: cc.est ?? null,
    eur: cc.eur,
    divisa: cc.divisa ?? "EUR",
  };
  const { data, error } = await supabase.from("capital_calls").insert(row).select().single();
  if (!error) logAudit("insert", "capital_calls", String(data?.id), row);
  return { data, error };
}

export async function updateCapitalCall(rowId, fields) {
  if (!supabase) return { error: null };
  const updates = { ...fields };
  if (fields.data) {
    const { mes, year, fy } = parseDateParts(fields.data);
    Object.assign(updates, { mes, year, fy });
  }
  const { error } = await supabase.from("capital_calls").update(updates).eq("id", rowId);
  if (!error) logAudit("update", "capital_calls", String(rowId), updates);
  return { error };
}

export async function deleteCapitalCall(rowId) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("capital_calls").delete().eq("id", rowId);
  if (!error) logAudit("delete", "capital_calls", String(rowId), {});
  return { error };
}

const CLEARABLE_TABLES = ["capital_calls", "portfolio_companies", "searchers", "pipeline"];

export async function clearTable(tableName) {
  if (!supabase) return { error: null };
  if (!CLEARABLE_TABLES.includes(tableName)) {
    return { error: new Error(`Table "${tableName}" is not clearable`) };
  }
  const { error } = await supabase.from(tableName).delete().neq("id", -1);
  return { error };
}
