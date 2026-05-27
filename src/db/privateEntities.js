import { apiFetchJson, logAudit, supabase } from "./_shared.js";

export async function loadPrivateEntities() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("private_entities")
    .select("*")
    .order("canonical_name");
  if (error || !Array.isArray(data)) return [];
  return data;
}

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

export async function updateEntityNif(entityId, nif) {
  if (!supabase) return { error: null };
  const trimmed = String(nif ?? "").trim();
  const { error } = await supabase.rpc("update_private_entity_nif", {
    p_id: entityId,
    p_nif: trimmed,
  });
  if (!error) {
    logAudit("update", "private_entities", entityId, { nif: trimmed });
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

