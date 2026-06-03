import { supabase } from "../supabase.js";
import { apiFetchJson } from "../apiClient.js";
import {
  buildPrivateEntitiesFromDashboardBundle,
  resolvePrivateEntity,
} from "../data/privateEntities.js";
import { mergePipelineDeals } from "../data/pipelineCatalog.js";
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
} from "../data/mappers.js";
import { mergeSearchersWithCapitalCalls } from "../data/searcherModel.js";
import { buildFallbackCompaniesFromCapitalCalls } from "../data/privateCompanyModel.js";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "../data/capitalCallTipusModel.js";
import { defaultCapitalCallStrategyForVehicleTipus, normalizeCapitalCallStrategy, setSnapshotInferrer } from "../data/capitalCallStrategyModel.js";
import { buildSearchFundInferrer } from "../data/searchFundSnapshotModel.js";
import { computeFundIrrFromRows } from "../data/fundDetailModel.js";

export {
  supabase,
  apiFetchJson,
  buildPrivateEntitiesFromDashboardBundle,
  resolvePrivateEntity,
  mergePipelineDeals,
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
  mergeSearchersWithCapitalCalls,
  buildFallbackCompaniesFromCapitalCalls,
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
  normalizeCapitalCallTipus,
  defaultCapitalCallStrategyForVehicleTipus,
  normalizeCapitalCallStrategy,
  setSnapshotInferrer,
  buildSearchFundInferrer,
  computeFundIrrFromRows,
};

// ── Helpers ───────────────────────────────────────────────

export async function atomicReplace(rpcName, table, rows) {
  if (!supabase) return { error: null };
  const { error: rpcError } = await supabase.rpc(rpcName, { p_rows: rows });
  if (!rpcError) return { error: null };
  const isMissing = rpcError.code === "PGRST202" || rpcError.message?.includes(rpcName);
  if (!isMissing) return { error: rpcError };
  // RPC not deployed — snapshot-guarded delete+insert
  const { data: snapshot } = await supabase.from(table).select("*");
  const { error: delError } = await supabase.from(table).delete().neq("id", 0);
  if (delError) return { error: delError };
  if (!rows.length) return { error: null };
  const { error: insertError } = await supabase.from(table).insert(rows);
  if (insertError) {
    if (snapshot?.length) {
      const { error: restoreError } = await supabase.from(table).insert(snapshot).catch(e => ({ error: e }));
      if (restoreError) {
        console.error(`[atomicReplace:${table}] restore failed:`, restoreError);
        return { error: new Error(`Insert failed AND restore failed — "${table}" may be empty. Insert: ${insertError.message}. Restore: ${restoreError.message}`) };
      }
    }
    return { error: insertError };
  }
  return { error: null };
}

export async function loadPrivateEntityMap() {
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("private_entities").select("*");
  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.map((row) => [row.id, row]));
}

export async function upsertFundMetaComputed(vehicleId, fallbackName = "", entityMap = null) {
  if (!supabase || !vehicleId) return { error: null };
  const [{ data: ccRows, error: ccError }, { data: metaRow, error: metaError }] = await Promise.all([
    supabase.from("capital_calls").select("*, fund_meta(vehicle_tipus)").eq("vehicle_id", vehicleId).order("data"),
    supabase.from("fund_meta").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
  ]);
  if (ccError) return { error: ccError };
  if (metaError) return { error: metaError };

  const resolvedEntityMap = entityMap ?? await loadPrivateEntityMap();
  const rawRows = (ccRows ?? []).map((row) => rowToCapitalCall(row, resolvedEntityMap));
  const tvpi = metaRow?.tvpi ?? null;
  const irr = computeFundIrrFromRows(rawRows, tvpi);
  const name = metaRow?.fons ?? rawRows[0]?.fons ?? fallbackName;

  const { error } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: vehicleId, fons: name, tvpi, irr }, { onConflict: "vehicle_id" });
  return { error };
}

const CAPITAL_CALLS_PAGE_SIZE = 1000;

export async function fetchAllCapitalCallRows() {
  if (!supabase) return { data: null, error: new Error("Supabase unavailable") };

  // Fetch first page
  const { data: first, error: firstError } = await supabase
    .from("capital_calls")
    .select("*, fund_meta(vehicle_tipus)")
    .order("data")
    .range(0, CAPITAL_CALLS_PAGE_SIZE - 1);
  if (firstError) { console.error("[fetchAllCapitalCallRows] SELECT error:", firstError); return { data: null, error: firstError }; }
  if (!first || first.length < CAPITAL_CALLS_PAGE_SIZE) return { data: first ?? [], error: null };

  // First page was full — get count and fetch remaining pages in parallel
  const { count, error: countError } = await supabase
    .from("capital_calls")
    .select("*", { count: "exact", head: true });

  if (countError || count === null) {
    // Fallback: sequential
    const rows = [...first];
    for (let from = CAPITAL_CALLS_PAGE_SIZE; ; from += CAPITAL_CALLS_PAGE_SIZE) {
      const { data, error } = await supabase.from("capital_calls").select("*, fund_meta(vehicle_tipus)").order("data").range(from, from + CAPITAL_CALLS_PAGE_SIZE - 1);
      if (error) { console.error("[fetchAllCapitalCallRows] SELECT error:", error); return { data: null, error }; }
      rows.push(...(data ?? []));
      if (!data || data.length < CAPITAL_CALLS_PAGE_SIZE) break;
    }
    return { data: rows, error: null };
  }

  const extraPages = Math.ceil((count - CAPITAL_CALLS_PAGE_SIZE) / CAPITAL_CALLS_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: extraPages }, (_, i) => {
      const from = (i + 1) * CAPITAL_CALLS_PAGE_SIZE;
      return supabase.from("capital_calls").select("*, fund_meta(vehicle_tipus)").order("data").range(from, from + CAPITAL_CALLS_PAGE_SIZE - 1);
    })
  );

  const rows = [...first];
  for (const { data, error } of rest) {
    if (error) { console.error("[fetchAllCapitalCallRows] SELECT error:", error); return { data: null, error }; }
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}

export async function upsertPrivateEntities(rows) {
  if (!supabase || !rows.length) return { error: null };
  const { error } = await supabase
    .from("private_entities")
    .upsert(rows.map(privateEntityToRow), { onConflict: "id" });
  return { error };
}

export async function upsertPrivateEntitiesIfNew(rows) {
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

/**
 * @param {string} action
 * @param {string} tableName
 * @param {string | number | null | undefined} recordId
 * @param {{ old?: Record<string, unknown> | null, new?: Record<string, unknown> | null } | Record<string, unknown> | null} changes
 */
export async function logAudit(action, tableName, recordId, changes) {
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

