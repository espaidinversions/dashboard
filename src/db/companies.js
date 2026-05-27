import {
  buildFallbackCompaniesFromCapitalCalls,
  buildPrivateEntitiesFromDashboardBundle,
  companyToRow,
  fetchAllCapitalCallRows,
  loadPrivateEntityMap,
  logAudit,
  resolvePrivateEntity,
  rowToCompany,
  supabase,
  upsertPrivateEntities,
} from "./_shared.js";
import { renamePrivateEntity } from "./privateEntities.js";

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

export async function deleteCompany(id) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("portfolio_companies").select("*").eq("entity_id", id).single();
  const { error } = await supabase.from("portfolio_companies").delete().eq("entity_id", id);
  if (!error) logAudit("delete", "portfolio_companies", id, { old: old ?? null });
  return { error };
}

