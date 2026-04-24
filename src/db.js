import { supabase } from "./supabase.js";
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
import { normalizeCapitalCallTipus } from "./data/capitalCallTipusModel.js";

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
  const [cc, entityMap] = await Promise.all([
    fetchAllCapitalCallRows(),
    loadPrivateEntityMap(),
  ]);
  if (cc.error) return null;
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
  const { error } = await supabase.rpc("replace_dashboard_bundle", {
    p_private_entities_rows: privateEntities == null ? null : privateEntities.map(privateEntityToRow),
    p_cc_rows: rawCC == null ? null : rawCC.map(r => {
      const row = capitalCallToRow(r);
      return {
        vehicle_id: row.vehicle_id,
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
  return mergePipelineDeals(data.map(rowToDeal));
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
    mes, year, fy, tipus: "Compromís", data: data_iso,
  });
  if (ccErr) { console.error(ccErr); return null; }

  await supabase.from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, tvpi: null }, { onConflict: "vehicle_id" });

  logAudit("insert", "capital_calls", resolved.id, { fons: resolved.canonicalName, vcpe, est });
  // Return in rawCC shape (key `any`, not `year`)
  return { id: resolved.id, fons: resolved.canonicalName, vcpe, est, cat: "Compromís", eur: compromisEur, divisa, mes, any: year, fy, tipus: "Compromís", data: data_iso };
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
  const { data: old } = await supabase.from("portfolio_companies").select("*").eq("entity_id", id).single();
  const { error } = await supabase.from("portfolio_companies").delete().eq("entity_id", id);
  if (!error) logAudit("delete", "portfolio_companies", id, { old: old ?? null });
  return { error };
}

/** @param {number} id */
export async function deleteSearcher(id) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("searchers").select("*").eq("id", id).single();
  const { error } = await supabase.from("searchers").delete().eq("id", id);
  if (!error) logAudit("delete", "searchers", id, { old: old ?? null });
  return { error };
}

/** @param {number} id */
export async function deletePipelineDeal(id) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("pipeline").select("*").eq("id", id).single();
  const { error } = await supabase.from("pipeline").delete().eq("id", id);
  if (!error) logAudit("delete", "pipeline", id, { old: old ?? null });
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
    tipus: normalizeCapitalCallTipus(cc.tipus) ?? null,
    cat: cc.cat,
    data: cc.data,
    mes,
    year,
    fy,
    vcpe: cc.vcpe ?? null,
    est: cc.est ?? null,
    eur: cc.eur,
    divisa: cc.divisa ?? "EUR",
    recallable:      (cc.recallable      !== "" && cc.recallable      != null) ? Number(cc.recallable)      : null,
    non_recallable:  (cc.non_recallable  !== "" && cc.non_recallable  != null) ? Number(cc.non_recallable)  : null,
    from_recallable: (cc.from_recallable !== "" && cc.from_recallable != null) ? Number(cc.from_recallable) : null,
  };
  const { data, error } = await supabase.from("capital_calls").insert(row).select().single();
  if (!error) logAudit("insert", "capital_calls", String(data?.id), row);
  return { data, error };
}

export async function updateCapitalCall(rowId, fields) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("capital_calls").select("*").eq("id", rowId).single();
  const updates = { ...fields };
  for (const col of ["recallable", "non_recallable", "from_recallable"]) {
    if (Object.prototype.hasOwnProperty.call(updates, col)) {
      updates[col] = (updates[col] !== "" && updates[col] != null) ? Number(updates[col]) : null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(fields, "tipus")) {
    updates.tipus = normalizeCapitalCallTipus(fields.tipus) ?? null;
  }
  if (fields.fons) {
    const resolved = resolvePrivateEntity("vehicle", fields.fons, old?.vehicle_id ?? null);
    const { error: entityError } = await upsertPrivateEntities([resolved]);
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
  return { error };
}

export async function deleteCapitalCall(rowId) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("capital_calls").select("*").eq("id", rowId).single();
  const { error } = await supabase.from("capital_calls").delete().eq("id", rowId);
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
