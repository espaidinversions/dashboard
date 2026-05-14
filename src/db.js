import { supabase } from "./supabase.js";
import { apiFetchJson } from "./apiClient.js";
import {
  buildPrivateEntitiesFromDashboardBundle,
  resolvePrivateEntity,
} from "./data/privateEntities.js";
import { mergePipelineDeals } from "./data/pipelineCatalog.js";
import {
  parseDateParts,
  privateEntityToRow,
  companyToRow,
  rowToCompany,
  capitalCallToRow,
  rowToCapitalCall,
  fundMetaToRow,
  rowToFundMeta,
  searcherToRow,
  rowToSearcher,
  dealToRow,
  rowToDeal,
} from "./data/mappers.js";
import { mergeSearchersWithCapitalCalls } from "./data/searcherModel.js";
import { buildFallbackCompaniesFromCapitalCalls } from "./data/privateCompanyModel.js";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "./data/capitalCallTipusModel.js";
import { defaultCapitalCallStrategyForVcpe, normalizeCapitalCallStrategy, setSnapshotInferrer } from "./data/capitalCallStrategyModel.js";
import { buildSearchFundInferrer } from "./data/searchFundSnapshotModel.js";
import { computeFundIrrFromRows } from "./data/fundDetailModel.js";

/** @typedef {import("./data/dashboardTypes.js").CapitalCallRow} CapitalCallRow */
/** @typedef {import("./data/dashboardTypes.js").DashboardBundle} DashboardBundle */
/** @typedef {import("./data/dashboardTypes.js").FundMetaRow} FundMetaRow */
/** @typedef {import("./data/dashboardTypes.js").PipelineDeal} PipelineDeal */
/** @typedef {import("./data/dashboardTypes.js").PrivateEntity} PrivateEntity */
/** @typedef {import("./data/dashboardTypes.js").PortfolioCompany} PortfolioCompany */
/** @typedef {import("./data/dashboardTypes.js").Searcher} Searcher */
/** @typedef {import("./data/publicMarketsTypes.js").PMOverrides} PMOverrides */
/** @typedef {import("./data/publicMarketsTypes.js").PMPositionMeta} PMPositionMeta */
/** @typedef {import("./data/publicMarketsTypes.js").PMTransactionDraft} PMTransactionDraft */

// ── Helpers ───────────────────────────────────────────────

async function loadPrivateEntityMap() {
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("private_entities").select("*");
  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.map((row) => [row.id, row]));
}

async function upsertFundMetaComputed(vehicleId, fallbackName = "") {
  if (!supabase || !vehicleId) return { error: null };
  const [{ data: ccRows, error: ccError }, { data: metaRow, error: metaError }] = await Promise.all([
    supabase.from("capital_calls").select("*").eq("vehicle_id", vehicleId).order("data"),
    supabase.from("fund_meta").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
  ]);
  if (ccError) return { error: ccError };
  if (metaError) return { error: metaError };

  const entityMap = await loadPrivateEntityMap();
  const rawRows = (ccRows ?? []).map((row) => rowToCapitalCall(row, entityMap));
  const tvpi = metaRow?.tvpi ?? null;
  const irr = computeFundIrrFromRows(rawRows, tvpi);
  const name = metaRow?.fons ?? rawRows[0]?.fons ?? fallbackName;

  const { error } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: vehicleId, fons: name, tvpi, irr }, { onConflict: "vehicle_id" });
  return { error };
}

const CAPITAL_CALLS_PAGE_SIZE = 1000;

async function fetchAllCapitalCallRows() {
  if (!supabase) return { data: null, error: new Error("Supabase unavailable") };
  const rows = [];
  for (let from = 0; ; from += CAPITAL_CALLS_PAGE_SIZE) {
    const to = from + CAPITAL_CALLS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("capital_calls")
      .select("*")
      .order("data")
      .range(from, to);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < CAPITAL_CALLS_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
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

async function upsertPrivateEntitiesIfNew(rows) {
  if (!supabase || !rows.length) return { error: null };
  const ids = rows.map((r) => r.id).filter(Boolean);
  const { data: existing, error: selectError } = await supabase
    .from("private_entities")
    .select("id")
    .in("id", ids);
  if (selectError) return { error: selectError };
  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const toInsert = rows.filter((r) => !existingIds.has(r.id));
  if (!toInsert.length) return { error: null };
  const { error } = await supabase
    .from("private_entities")
    .upsert(toInsert.map(privateEntityToRow), { onConflict: "id" });
  return { error };
}

export async function fetchProspectiveCashForecasts() {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from("prospective_cash_forecasts")
    .select("vehicle_id, fons, flow_type, year, amount")
    .order("fons")
    .order("flow_type")
    .order("year");
  return { data: data ?? [], error };
}

export async function saveProspectiveCashForecasts(rows, vehicleIdValues) {
  if (!supabase) return { error: null };
  const ids = [...new Set(vehicleIdValues)].filter(Boolean);
  if (ids.length) {
    const { error: deleteError } = await supabase
      .from("prospective_cash_forecasts")
      .delete()
      .in("vehicle_id", ids);
    if (deleteError) return { error: deleteError };
  }
  if (!rows.length) return { error: null };
  const { error } = await supabase
    .from("prospective_cash_forecasts")
    .insert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
  return { error };
}

export async function fetchCommittedOverrides() {
  if (!supabase) return { data: {}, error: null };
  const { data, error } = await supabase
    .from("fund_meta")
    .select("fons, committed_override")
    .not("committed_override", "is", null);
  if (error) return { data: {}, error };
  const map = {};
  for (const row of (data ?? [])) {
    if (row.fons && row.committed_override != null) map[row.fons] = Number(row.committed_override);
  }
  return { data: map, error: null };
}

export async function saveCommittedOverrides(overrides, vehicleIds) {
  if (!supabase) return { error: null };
  const rows = Object.entries(overrides)
    .filter(([, v]) => v > 0)
    .map(([fons, committed_override]) => ({ vehicle_id: vehicleIds[fons], fons, committed_override }))
    .filter((r) => r.vehicle_id);
  if (!rows.length) return { error: null };
  const { error } = await supabase.from("fund_meta").upsert(rows, { onConflict: "vehicle_id" });
  return { error };
}

// ── Audit log ─────────────────────────────────────────────

/**
 * @param {string} action
 * @param {string} tableName
 * @param {string | number | null | undefined} recordId
 * @param {{ old?: Record<string, unknown> | null, new?: Record<string, unknown> | null } | Record<string, unknown> | null} changes
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
    fetchAllCapitalCallRows(),
    supabase.from("fund_meta").select("*"),
    supabase.from("pipeline").select("*").order("id"),
    supabase.from("portfolio_companies").select("*").order("nom"),
    supabase.from("searchers").select("*").order("nom"),
    supabase.from("private_entities").select("*"),
  ]);
  if (cc.error) console.error("loadAll capital_calls failed:", cc.error);
  if (fm.error) console.error("loadAll fund_meta failed:", fm.error);
  if (pl.error) console.error("loadAll pipeline failed:", pl.error);
  if (co.error) console.error("loadAll portfolio_companies failed:", co.error);
  if (sr.error) console.error("loadAll searchers failed:", sr.error);
  if (pe.error) console.error("loadAll private_entities failed:", pe.error);

  const privateEntities = pe.error || !Array.isArray(pe.data) ? [] : pe.data;
  const entityMap = new Map(privateEntities.map((row) => [row.id, row]));
  const companies = !co.error && Array.isArray(co.data)
    ? co.data.map((row) => rowToCompany(row, entityMap))
    : [];
  const fallbackCompanies = !cc.error && Array.isArray(cc.data)
    ? buildFallbackCompaniesFromCapitalCalls(cc.data, entityMap, companies)
    : [];
  const livePipelineDeals = (pl.error || !Array.isArray(pl.data) ? [] : pl.data).map(rowToDeal);

  // Wire live data into the strategy inferrer before mapping capital calls
  if (!sr.error && Array.isArray(sr.data) && !co.error && Array.isArray(co.data)) {
    setSnapshotInferrer(buildSearchFundInferrer(
      sr.data.map((r) => ({ nom: r.nom, statusScreening: r.status_screening })),
      co.data.map((r) => ({ nom: r.nom, tipus: r.tipus })),
    ));
  }

  /** @type {DashboardBundle | Partial<DashboardBundle>} */
  const result = {
    privateEntities: privateEntities.map((row) => ({
      id: row.id,
      kind: row.kind,
      canonicalName: row.canonical_name,
      sourceName: row.source_name,
      workbookName: row.workbook_name,
      matchType: row.match_type,
    })),
  };
  if (!cc.error && Array.isArray(cc.data)) result.rawCC = cc.data.map((row) => rowToCapitalCall(row, entityMap));
  if (!fm.error && Array.isArray(fm.data)) result.fundMeta = fm.data.map((row) => rowToFundMeta(row, entityMap));
  if (!pl.error && Array.isArray(pl.data)) result.funds0 = mergePipelineDeals(livePipelineDeals);
  if (!co.error && Array.isArray(co.data)) result.companies = [...companies, ...fallbackCompanies];
  if (!sr.error && Array.isArray(sr.data)) {
    const searchers = sr.data.map(rowToSearcher);
    result.searchers = mergeSearchersWithCapitalCalls(searchers, cc.data);
  }

  if (!result.rawCC && !result.fundMeta && !result.funds0 && !result.companies && !result.searchers) {
    return null;
  }
  return result;
}

/** @returns {Promise<PortfolioCompany[] | null>} */
export async function loadCompanies() {
  if (!supabase) return null;
  const [companies, capitalCalls, entityMap] = await Promise.all([
    supabase.from("portfolio_companies").select("*").order("nom"),
    fetchAllCapitalCallRows(),
    loadPrivateEntityMap(),
  ]);
  if (companies.error) return null;
  const rows = companies.data.map((row) => rowToCompany(row, entityMap));
  const fallbackRows = capitalCalls.error
    ? []
    : buildFallbackCompaniesFromCapitalCalls(capitalCalls.data, entityMap, rows);
  return [...rows, ...fallbackRows];
}

/** @returns {Promise<CapitalCallRow[] | null>} */
export async function loadCapitalCalls() {
  if (!supabase) return null;
  const [cc, entityMap, srResult, coResult] = await Promise.all([
    fetchAllCapitalCallRows(),
    loadPrivateEntityMap(),
    supabase.from("searchers").select("nom,status_screening"),
    supabase.from("portfolio_companies").select("nom,tipus"),
  ]);
  if (cc.error) return null;
  if (!srResult.error && Array.isArray(srResult.data) && !coResult.error && Array.isArray(coResult.data)) {
    setSnapshotInferrer(buildSearchFundInferrer(
      srResult.data.map((r) => ({ nom: r.nom, statusScreening: r.status_screening })),
      coResult.data.map((r) => ({ nom: r.nom, tipus: r.tipus })),
    ));
  }
  return cc.data.map((row) => rowToCapitalCall(row, entityMap));
}

/** @returns {Promise<FundMetaRow[] | null>} */
export async function loadFundMeta() {
  if (!supabase) return null;
  const [fm, entityMap] = await Promise.all([
    supabase.from("fund_meta").select("*"),
    loadPrivateEntityMap(),
  ]);
  if (fm.error) return null;
  return fm.data.map((row) => rowToFundMeta(row, entityMap));
}

/** @returns {Promise<Searcher[] | null>} */
export async function loadSearchers() {
  if (!supabase) return null;
  const [searchers, capitalCalls] = await Promise.all([
    supabase.from("searchers").select("*").order("nom"),
    fetchAllCapitalCallRows(),
  ]);
  if (searchers.error || capitalCalls.error) return null;
  return mergeSearchersWithCapitalCalls(searchers.data.map(rowToSearcher), capitalCalls.data);
}

// ── Save individual tables ────────────────────────────────

/** @param {CapitalCallRow[]} rows */
export async function saveCapitalCalls(rows) {
  if (!supabase) return;
  const entities = buildPrivateEntitiesFromDashboardBundle({ rawCC: rows });
  const { error: entitiesError } = await upsertPrivateEntities(entities);
  if (entitiesError) return { error: entitiesError };
  const { data: existingMeta, error: metaReadError } = await supabase.from("fund_meta").select("*");
  if (metaReadError) return { error: metaReadError };
  const { error: delError } = await supabase.from("capital_calls").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("capital_calls").insert(rows.map(capitalCallToRow));
    if (error) return { error };
  }
  const metaByVehicle = new Map((existingMeta ?? []).map((row) => [row.vehicle_id ?? row.fons, row]));
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.id ?? row.fons;
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  const nextMetaRows = [...grouped.entries()].map(([key, fundRows]) => {
    const existing = metaByVehicle.get(key) ?? metaByVehicle.get(fundRows[0]?.fons) ?? {};
    const tvpi = existing.tvpi ?? null;
    return {
      id: fundRows[0]?.id ?? undefined,
      fons: fundRows[0]?.fons ?? existing.fons ?? "",
      tvpi,
      irr: computeFundIrrFromRows(fundRows, tvpi),
    };
  });
  if (nextMetaRows.length > 0) {
    const { error } = await supabase
      .from("fund_meta")
      .upsert(nextMetaRows.map(fundMetaToRow), { onConflict: "vehicle_id" });
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
  const tablesReplaced = [
    rawCC       != null && "capital_calls",
    funds0      != null && "pipeline",
    companies   != null && "portfolio_companies",
    searchers   != null && "searchers",
    fundMeta    != null && "fund_meta",
    bundle?.privateEntities != null && "private_entities",
  ].filter(Boolean);
  logAudit("replace", "dashboard_bundle", "bulk", { tables: tablesReplaced });
  const { error } = await supabase.rpc("replace_dashboard_bundle", {
    p_private_entities_rows: privateEntities == null ? null : privateEntities.map(privateEntityToRow),
    p_cc_rows: rawCC == null ? null : rawCC.map(r => {
      const row = capitalCallToRow(r);
      return {
        vehicle_id: row.vehicle_id,
        fons: r.fons,
        tipus: row.tipus,
        cat: row.cat,
        data: r.data,
        mes: r.mes,
        year: r.any,
        fy: r.fy,
        vcpe: r.vcpe,
        est: row.est,
        eur: row.eur,
        divisa: r.divisa,
        comentaris: r.comentaris ?? null,
        amount_native: row.amount_native ?? null,
        fx_rate: row.fx_rate ?? null,
        fx_source: row.fx_source ?? null,
        recallable:      (r.recallable      !== "" && r.recallable      != null) ? Number(r.recallable)      : null,
        non_recallable:  (r.non_recallable  !== "" && r.non_recallable  != null) ? Number(r.non_recallable)  : null,
        from_recallable: (r.from_recallable !== "" && r.from_recallable != null) ? Number(r.from_recallable) : null,
      };
    }),
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
export async function upsertFundMeta(fund, tvpi, irr = null) {
  if (!supabase) return { error: null };
  const name = typeof fund === "string" ? fund : fund?.fons ?? fund?.nom ?? "";
  const resolved = resolvePrivateEntity("vehicle", name, typeof fund === "string" ? null : fund?.id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { error: entityError };
  const { error } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, tvpi: tvpi ?? null, irr }, { onConflict: "vehicle_id" });
  if (!error) logAudit("update", "fund_meta", resolved.id, { fons: resolved.canonicalName, tvpi, irr });
  return { error };
}

export async function upsertFundMetaFiEnd(fund, fiEnd) {
  if (!supabase) return { error: null };
  const name = typeof fund === "string" ? fund : fund?.fons ?? fund?.nom ?? "";
  const resolved = resolvePrivateEntity("vehicle", name, typeof fund === "string" ? null : fund?.id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { error: entityError };
  const { error } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, fi_end: fiEnd ?? null }, { onConflict: "vehicle_id" });
  if (!error) logAudit("update", "fund_meta", resolved.id, { fons: resolved.canonicalName, fiEnd });
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
  try {
    await supabase.auth.refreshSession();
  } catch {}
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

export async function loadPipelineDeals() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("pipeline").select("*").order("id");
  if (error) { console.error(error); return null; }
  return mergePipelineDeals(data.map(rowToDeal)).filter((d) => d?.active !== false);
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
 * @param {{ amountNative?: number | null, fxRate?: number | null, fxSource?: string | null, comentaris?: string | null }} [options]
 * @returns {Promise<CapitalCallRow | null>}
 */
export async function insertFund(fons, vcpe, est, compromisEur, divisa, options = {}) {
  if (!supabase) return null;
  const resolved = resolvePrivateEntity("vehicle", fons);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) { console.error(entityError); return null; }
  const data_iso = new Date().toISOString().slice(0, 10);
  const { mes, year, fy } = parseDateParts(data_iso);
  const normalizedEst = normalizeCapitalCallStrategy(est, vcpe, { fons }) ?? defaultCapitalCallStrategyForVcpe(vcpe);

  const { error: ccErr } = await supabase.from("capital_calls").insert({
    vehicle_id: resolved.id,
    fons: resolved.canonicalName,
    vcpe, est: normalizedEst, cat: "Compromís", eur: compromisEur, divisa,
    comentaris: options.comentaris ?? null,
    amount_native: options.amountNative ?? (divisa === "EUR" ? compromisEur : null),
    fx_rate: options.fxRate ?? (divisa === "EUR" ? 1 : null),
    fx_source: options.fxSource ?? (divisa === "EUR" ? "identity" : null),
    mes, year, fy, tipus: "Compromís", data: data_iso,
  });
  if (ccErr) { console.error(ccErr); return null; }

  await supabase.from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, tvpi: null, irr: null }, { onConflict: "vehicle_id" });

  logAudit("insert", "capital_calls", resolved.id, { fons: resolved.canonicalName, vcpe, est: normalizedEst });
  // Return in rawCC shape (key `any`, not `year`)
  return {
    id: resolved.id,
    fons: resolved.canonicalName,
    vcpe,
    est: normalizedEst,
    cat: "Compromís",
    eur: compromisEur,
    divisa,
    comentaris: options.comentaris ?? null,
    amountNative: options.amountNative ?? (divisa === "EUR" ? compromisEur : null),
    fxRate: options.fxRate ?? (divisa === "EUR" ? 1 : null),
    fxSource: options.fxSource ?? (divisa === "EUR" ? "identity" : null),
    mes,
    any: year,
    fy,
    tipus: "Compromís",
    data: data_iso,
  };
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

export async function updateEntityId(oldId, newId) {
  if (!supabase) return { error: null };
  const trimmed = String(newId ?? "").trim();
  const { error } = await supabase.rpc("update_private_entity_id", {
    p_old_id: oldId,
    p_new_id: trimmed,
  });
  if (!error) {
    logAudit("update", "private_entities", oldId, { id: trimmed });
  }
  return { error };
}

/**
 * @param {string} entityId
 * @param {string} nif
 */
export async function updateEntityNif(entityId, nif) {
  if (!supabase) return { error: null };
  const { error } = await supabase.rpc("update_private_entity_nif", {
    p_id: entityId,
    p_nif: String(nif ?? "").trim(),
  });
  if (!error) {
    logAudit("update", "private_entities", entityId, { nif: String(nif ?? "").trim() });
  }
  return { error };
}

export async function updateEntityFiscalName(entityId, fiscalName) {
  if (!supabase) return { error: null };
  const trimmed = String(fiscalName ?? "").trim();
  const { error } = await supabase
    .from("private_entities")
    .update({ fiscal_name: trimmed || null })
    .eq("id", entityId);
  if (!error) {
    logAudit("update", "private_entities", entityId, { fiscal_name: trimmed || null });
  }
  return { error };
}

/**
 * Routes through the API server (service key) to bypass RLS.
 * Deletes fund_meta first, then the private_entities row.
 * capital_calls.vehicle_id will be SET NULL by the FK cascade.
 * @param {string} id - vehicle entity id
 */
export async function deleteVehicle(id) {
  try {
    const params = new URLSearchParams({ route: "vehicles", id });
    await apiFetchJson(`/api/app?${params}`, { method: "DELETE" });
    logAudit("delete", "private_entities", id, { kind: "vehicle" });
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

export async function deleteCompanyEntity(id) {
  try {
    const params = new URLSearchParams({ route: "companies", id });
    await apiFetchJson(`/api/app?${params}`, { method: "DELETE" });
    logAudit("delete", "private_entities", id, { kind: "company" });
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Merge a duplicate entity into the canonical one.
 * Reassigns capital_calls, portfolio_companies, and fund_meta, then deletes from_id.
 * @param {string} fromId - entity to delete (duplicate)
 * @param {string} toId   - entity to keep (canonical)
 */
export async function mergePrivateEntities(fromId, toId) {
  try {
    await apiFetchJson(`/api/app?route=merge-entity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_id: fromId, to_id: toId }),
    });
    logAudit("merge", "private_entities", fromId, { into: toId });
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

// ── Delete ────────────────────────────────────────────────

/** @param {string} id */
export async function deleteCompany(id) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("portfolio_companies").select("*").eq("entity_id", id).single();
  const { error } = await supabase.from("portfolio_companies").delete().eq("entity_id", id);
  if (!error) logAudit("delete", "portfolio_companies", id, { old: old ?? null });
  return { error };
}

/**
 * @param {number} id
 * @param {string} [name] - Deal name; required for seed-only deals so the server can upsert a DB record.
 */
export async function deletePipelineDeal(id, name) {
  // Route through API server (service key) — anon client cannot UPDATE due to RLS.
  // Soft-deletes (active=false) so the DB record suppresses seed resurrection in mergePipelineDeals.
  // Name is passed so seed-only deals (no DB row yet) get upserted with active=false instead of a no-op UPDATE.
  try {
    const params = new URLSearchParams({ route: "pipeline", id: String(id) });
    if (name) params.set("name", name);
    await apiFetchJson(`/api/app?${params}`, { method: "DELETE" });
    return { error: null };
  } catch (err) {
    return { error: err };
  }
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
    .upsert(dealToRow(deal), { onConflict: "id" });
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
    rendiment:   r.rendiment ?? {},
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
  if (fields.rendiment   != null) row.rendiment    = fields.rendiment;
  if (fields.costAnual   != null) row.cost_anual   = fields.costAnual;
  if (fields.notes       != null) row.notes        = fields.notes;
  const { error } = await supabase.from("pm_position_overrides")
    .upsert(row, { onConflict: "isin" });
  if (!error) logAudit("update", "pm_position_overrides", isin, fields);
  return { error };
}

// ── Admin: bulk clear ─────────────────────────────────────

// ── Capital call row-level CRUD ───────────────────────────────────────────────

export async function insertCapitalCall(cc) {
  if (!supabase) return { data: null, error: null };
  let resolved = resolvePrivateEntity("vehicle", cc.fons, cc.vehicle_id ?? null);
  if (!resolved) return { data: null, error: new Error("No s'ha pogut identificar el vehicle") };
  resolved.nif = String(cc.nif ?? "").trim() || null;
  resolved.fiscalName = String(cc.fiscal_name ?? "").trim() || null;

  // MOCKNIF IDs are fallbacks generated locally when no workbook entry matches.
  // The real entity may already exist in the DB under a different (NIF-based) ID.
  // Resolve by canonical name first to avoid FK violations and RLS errors.
  if (resolved.id.startsWith("MOCKNIF:")) {
    const { data: dbEntity, error: lookupError } = await supabase
      .from("private_entities")
      .select("id")
      .eq("canonical_name", resolved.canonicalName)
      .maybeSingle();
    if (lookupError) return { data: null, error: lookupError };
    if (dbEntity?.id) {
      resolved = { ...resolved, id: dbEntity.id };
    } else {
      // Genuinely new vehicle — only admins can create private entities.
      const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
      if (entityError) return { data: null, error: entityError };
    }
  } else {
    const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
    if (entityError) return { data: null, error: entityError };
  }
  const { mes, year, fy } = parseDateParts(cc.data);
  const tipus = normalizeCapitalCallTipus(cc.tipus) ?? null;
  const eur = normalizeCapitalCallSignedAmount(tipus, cc.eur);
  const row = {
    vehicle_id: resolved.id,
    fons: resolved.canonicalName,
    tipus,
    cat: cc.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
    data: cc.data,
    mes,
    year,
    fy,
    vcpe: cc.vcpe ?? null,
    est: normalizeCapitalCallStrategy(cc.est, cc.vcpe, cc) ?? null,
    eur,
    divisa: cc.divisa ?? "EUR",
    comentaris: cc.comentaris ?? null,
    amount_native: cc.amountNative ?? (cc.divisa === "EUR" ? eur : null),
    fx_rate: cc.fxRate ?? (cc.divisa === "EUR" ? 1 : null),
    fx_source: cc.fxSource ?? (cc.divisa === "EUR" ? "identity" : null),
    recallable:      (cc.recallable      !== "" && cc.recallable      != null) ? Number(cc.recallable)      : null,
    non_recallable:  (cc.non_recallable  !== "" && cc.non_recallable  != null) ? Number(cc.non_recallable)  : null,
    from_recallable: (cc.from_recallable !== "" && cc.from_recallable != null) ? Number(cc.from_recallable) : null,
  };
  const { data, error } = await supabase.from("capital_calls").insert(row).select().single();
  if (!error) logAudit("insert", "capital_calls", String(data?.id), row);
  if (!error) {
    const metaResult = await upsertFundMetaComputed(resolved.id, resolved.canonicalName);
    if (metaResult.error) console.warn("upsertFundMetaComputed (insert) failed (non-fatal):", metaResult.error);
  }
  return { data, error };
}

export async function updateCapitalCall(rowId, fields) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("capital_calls").select("*").eq("id", rowId).single();
  const updates = { ...fields };
  if (Object.prototype.hasOwnProperty.call(updates, "amountNative")) {
    updates.amount_native = updates.amountNative;
    delete updates.amountNative;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "fxRate")) {
    updates.fx_rate = updates.fxRate;
    delete updates.fxRate;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "fxSource")) {
    updates.fx_source = updates.fxSource;
    delete updates.fxSource;
  }
  for (const col of ["recallable", "non_recallable", "from_recallable", "amount_native", "fx_rate"]) {
    if (Object.prototype.hasOwnProperty.call(updates, col)) {
      updates[col] = (updates[col] !== "" && updates[col] != null) ? Number(updates[col]) : null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, "comentaris")) {
    updates.comentaris = String(updates.comentaris ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "tipus")) {
    updates.tipus = normalizeCapitalCallTipus(fields.tipus) ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "eur")) {
    const nextTipus = Object.prototype.hasOwnProperty.call(updates, "tipus") ? updates.tipus : old?.tipus;
    updates.eur = normalizeCapitalCallSignedAmount(nextTipus, fields.eur);
  }
  if (Object.prototype.hasOwnProperty.call(fields, "est") || Object.prototype.hasOwnProperty.call(fields, "vcpe")) {
    const nextVcpe = Object.prototype.hasOwnProperty.call(updates, "vcpe") ? updates.vcpe : old?.vcpe ?? null;
    const nextEst = Object.prototype.hasOwnProperty.call(updates, "est") ? updates.est : old?.est;
    const nextFons = Object.prototype.hasOwnProperty.call(updates, "fons") ? updates.fons : old?.fons;
    updates.est = normalizeCapitalCallStrategy(nextEst, nextVcpe, { fons: nextFons });
  }
  if (
    !Object.prototype.hasOwnProperty.call(fields, "cat")
    && (Object.prototype.hasOwnProperty.call(fields, "tipus") || Object.prototype.hasOwnProperty.call(fields, "eur"))
  ) {
    const nextTipus = Object.prototype.hasOwnProperty.call(updates, "tipus") ? updates.tipus : old?.tipus;
    const nextEur = Object.prototype.hasOwnProperty.call(updates, "eur") ? updates.eur : old?.eur;
    updates.cat = inferCapitalCallCategoryFromTipus(nextTipus, nextEur);
  }
  if (fields.fons) {
    const resolved = resolvePrivateEntity("vehicle", fields.fons, old?.vehicle_id ?? null);
    const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
    if (entityError) return { error: entityError };
    updates.vehicle_id = resolved.id;
    updates.fons = resolved.canonicalName;
  }
  if (fields.data) {
    const { mes, year, fy } = parseDateParts(fields.data);
    Object.assign(updates, { mes, year, fy });
  }
  const { error } = await supabase.from("capital_calls").update(updates).eq("id", rowId);
  if (!error) logAudit("update", "capital_calls", String(rowId), { old: old ?? null, new: updates });
  if (!error) {
    const vehicleId = updates.vehicle_id ?? old?.vehicle_id ?? null;
    const fundName = updates.fons ?? old?.fons ?? "";
    const metaResult = await upsertFundMetaComputed(vehicleId, fundName);
    if (metaResult.error) console.warn("upsertFundMetaComputed (update) failed (non-fatal):", metaResult.error);
  }
  return { error };
}

export async function deleteCapitalCall(rowId) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("capital_calls").select("*").eq("id", rowId).single();
  const { error } = await supabase.from("capital_calls").delete().eq("id", rowId);
  if (!error && old?.vehicle_id) {
    const metaResult = await upsertFundMetaComputed(old.vehicle_id, old.fons ?? "");
    if (metaResult.error) console.warn("upsertFundMetaComputed (delete) failed (non-fatal):", metaResult.error);
  }
  if (!error) logAudit("delete", "capital_calls", String(rowId), { old: old ?? null });
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
