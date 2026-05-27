import { supabase } from "./_shared.js";

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

