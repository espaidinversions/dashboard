import {
  apiFetchJson,
  dealToRow,
  logAudit,
  mergePipelineDeals,
  rowToDeal,
  supabase,
} from "./_shared.js";

export async function loadPipelineDeals() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("pipeline").select("*").order("id");
  if (error) { console.error(error); return null; }
  return mergePipelineDeals(data.map(rowToDeal)).filter((d) => d?.active !== false);
}

/** @param {object[]} rows */
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

/**
 * @param {object} deal
 * @returns {Promise<object | null>}
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
 * @param {object} deal
 */
export async function upsertPipelineDeal(deal) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline")
    .upsert(dealToRow(deal), { onConflict: "id" });
  if (!error) logAudit("update", "pipeline", deal.id, { name: deal.name });
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

