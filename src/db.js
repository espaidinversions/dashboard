import { supabase } from "./supabase.js";
import { MESOS } from "./config.js";

// ── Helpers ───────────────────────────────────────────────

// Map camelCase app fields ↔ snake_case DB columns for portfolio_companies
function companyToRow(c) {
  return {
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

function rowToCompany(r) {
  return {
    id: r.id, nom: r.nom, tipus: r.tipus, segment: r.segment,
    entrepreneurs: r.entrepreneurs, origen: r.origen, geo: r.geo,
    ticket: r.ticket, tvpi: r.tvpi,
    rvpiEur: r.rvpi_eur, dpiEur: r.dpi_eur,
    rev: r.rev, ebitda: r.ebitda, dfn: r.dfn,
    grossEV: r.gross_ev, multEntry: r.mult_entry,
    dataCompr: r.data_compr, mesosOperant: r.mesos_operant,
    isMock: r.is_mock,
    quarters: r.quarters ?? [],
  };
}

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

function dealToRow(d) {
  return {
    name: d.name, amount: d.amount, currency: d.currency,
    geography: d.geography, strategy: d.strategy, sector: d.sector,
    status: d.status, canal: d.canal, active: d.active ?? true,
    estimated_closing: d.estimatedClosing ?? null,
  };
}

function rowToDeal(r) {
  return {
    id: r.id, name: r.name, amount: r.amount, currency: r.currency,
    geography: r.geography, strategy: r.strategy, sector: r.sector,
    status: r.status, canal: r.canal, active: r.active,
    estimatedClosing: r.estimated_closing ?? null,
  };
}

// ── Audit log ─────────────────────────────────────────────

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

export async function loadAll() {
  if (!supabase) return null;
  const [cc, fm, pl, co, sr] = await Promise.all([
    supabase.from("capital_calls").select("*").order("data"),
    supabase.from("fund_meta").select("*"),
    supabase.from("pipeline").select("*").order("id"),
    supabase.from("portfolio_companies").select("*").order("nom"),
    supabase.from("searchers").select("*").order("nom"),
  ]);
  if (cc.error || fm.error || pl.error || co.error || sr.error) return null;
  return {
    rawCC:      cc.data.map(r => ({ fons:r.fons, tipus:r.tipus, cat:r.cat, data:r.data, mes:r.mes, any:r.year, fy:r.fy, vcpe:r.vcpe, est:r.est, eur:r.eur, divisa:r.divisa })),
    fundMeta:   fm.data.map(r => ({ fons:r.fons, tvpi:r.tvpi })),
    funds0:     pl.data.map(r => ({ id:r.id, name:r.name, amount:r.amount, currency:r.currency, geography:r.geography, strategy:r.strategy, sector:r.sector, status:r.status, canal:r.canal, active:r.active, estimatedClosing: r.estimated_closing ?? null })),
    companies:  co.data.map(rowToCompany),
    searchers:  sr.data.map(rowToSearcher),
  };
}

// ── Save individual tables ────────────────────────────────

export async function saveCapitalCalls(rows) {
  if (!supabase) return;
  const { error: delError } = await supabase.from("capital_calls").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("capital_calls").insert(rows.map(r => ({
    fons:r.fons, tipus:r.tipus, cat:r.cat, data:r.data, mes:r.mes, year:r.any,
    fy:r.fy, vcpe:r.vcpe, est:r.est, eur:r.eur, divisa:r.divisa,
    })));
    if (error) return { error };
  }
  return { error: null };
}

export async function saveFundMeta(rows) {
  if (!supabase) return;
  const { error } = await supabase.from("fund_meta").upsert(rows.map(r => ({ fons:r.fons, tvpi:r.tvpi ?? null })), { onConflict: "fons" });
  return { error };
}

export async function savePipeline(rows) {
  if (!supabase) return;
  const { error: delError } = await supabase.from("pipeline").delete().neq("id", -1);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("pipeline").insert(rows.map(r => ({
    id:r.id, name:r.name, amount:r.amount, currency:r.currency,
    geography:r.geography, strategy:r.strategy, sector:r.sector,
    status:r.status, canal:r.canal, active:r.active,
    })));
    if (error) return { error };
  }
  return { error: null };
}

export async function saveCompanies(rows) {
  if (!supabase) return;
  const { error: delError } = await supabase.from("portfolio_companies").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("portfolio_companies").insert(rows.map(companyToRow));
    if (error) return { error };
  }
  return { error: null };
}

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

export async function saveDashboardBundle({ rawCC, funds0, companies, searchers, fundMeta }) {
  if (!supabase) return { error: null };
  const { error } = await supabase.rpc("replace_dashboard_bundle", {
    p_cc_rows: rawCC == null ? null : rawCC.map(r => ({
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
    p_fund_meta_rows: fundMeta == null ? null : fundMeta.map(r => ({ fons: r.fons, tvpi: r.tvpi ?? null })),
  });
  return { error };
}

// ── Granular single-row upserts ───────────────────────────

export async function upsertFundMeta(fons, tvpi) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("fund_meta").upsert({ fons, tvpi: tvpi ?? null }, { onConflict: "fons" });
  if (!error) logAudit("update", "fund_meta", fons, { fons, tvpi });
  return { error };
}

export async function upsertCompany(company) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies")
    .upsert(companyToRow(company), { onConflict: "nom" });
  if (!error) logAudit("update", "portfolio_companies", company.nom, { nom: company.nom });
  return { error };
}

export async function upsertSearcher(searcher) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers")
    .update(searcherToRow(searcher))
    .eq("id", searcher.id);
  if (!error) logAudit("update", "searchers", searcher.id, { nom: searcher.nom });
  return { error };
}

// ── Insert (single-row, returns row with DB-assigned id) ──

export async function insertCompany(company) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("portfolio_companies")
    .insert(companyToRow(company))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToCompany(data);
}

export async function insertSearcher(searcher) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("searchers")
    .insert(searcherToRow(searcher))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToSearcher(data);
}

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

export async function insertFund(fons, vcpe, est, compromisEur, divisa) {
  if (!supabase) return null;
  const now  = new Date();
  const mes  = MESOS[now.getMonth() + 1]; // MESOS is 1-indexed; index 0 = ""
  const year = now.getFullYear();
  const fy   = "FY " + year;
  const data_iso = now.toISOString().slice(0, 10);

  const { error: ccErr } = await supabase.from("capital_calls").insert({
    fons, vcpe, est, cat: "Compromís", eur: compromisEur, divisa,
    mes, year, fy, tipus: vcpe, data: data_iso,
  });
  if (ccErr) { console.error(ccErr); return null; }

  await supabase.from("fund_meta")
    .upsert({ fons, tvpi: null }, { onConflict: "fons" });

  logAudit("insert", "capital_calls", fons, { fons, vcpe, est });
  // Return in rawCC shape (key `any`, not `year`)
  return { fons, vcpe, est, cat: "Compromís", eur: compromisEur, divisa, mes, any: year, fy, tipus: vcpe, data: data_iso };
}

// ── Delete ────────────────────────────────────────────────

export async function deleteCompany(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies").delete().eq("id", id);
  if (!error) logAudit("delete", "portfolio_companies", id, null);
  return { error };
}

export async function deleteSearcher(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers").delete().eq("id", id);
  if (!error) logAudit("delete", "searchers", id, null);
  return { error };
}

export async function deletePipelineDeal(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline").delete().eq("id", id);
  if (!error) logAudit("delete", "pipeline", id, null);
  return { error };
}

export async function deleteFund(fons) {
  if (!supabase) return null;
  const { error: e1 } = await supabase.from("capital_calls").delete().eq("fons", fons);
  if (e1) return e1;
  const { error: e2 } = await supabase.from("fund_meta").delete().eq("fons", fons);
  if (!e2) logAudit("delete", "capital_calls", fons, { fons });
  return e2 ?? null;
}

// ── Upsert (pipeline) ─────────────────────────────────────

export async function upsertPipelineDeal(deal) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline")
    .upsert({ id: deal.id, ...dealToRow(deal) }, { onConflict: "id" });
  if (!error) logAudit("update", "pipeline", deal.id, { name: deal.name });
  return { error };
}

// ── Public Markets overrides ──────────────────────────────

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

export async function upsertTerOverride(isin, ter) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_ter_overrides")
    .upsert({ isin, ter, updated_at: new Date().toISOString() }, { onConflict: "isin" });
  return { error };
}

export async function upsertPositionMeta(isin, fields) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_position_meta")
    .upsert({ isin, ...fields, updated_at: new Date().toISOString() }, { onConflict: "isin" });
  return { error };
}

// ── Admin: bulk clear ─────────────────────────────────────

const CLEARABLE_TABLES = ["capital_calls", "portfolio_companies", "searchers", "pipeline"];

export async function clearTable(tableName) {
  if (!supabase) return { error: null };
  if (!CLEARABLE_TABLES.includes(tableName)) {
    return { error: new Error(`Table "${tableName}" is not clearable`) };
  }
  const { error } = await supabase.from(tableName).delete().neq("id", -1);
  return { error };
}
