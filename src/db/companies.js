import {
  atomicReplace,
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
  const { error: replaceError } = await atomicReplace("replace_portfolio_companies", "portfolio_companies", rows.map(companyToRow));
  if (replaceError) return { error: replaceError };
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
