import {
  buildPrivateEntitiesFromDashboardBundle,
  defaultCapitalCallStrategyForVehicleTipus,
  fundMetaToRow,
  loadPrivateEntityMap,
  logAudit,
  normalizeCapitalCallStrategy,
  parseDateParts,
  resolvePrivateEntity,
  rowToFundMeta,
  supabase,
  upsertPrivateEntities,
} from "./_shared.js";

export async function loadFundMeta() {
  if (!supabase) return null;
  const [fm, entityMap] = await Promise.all([
    supabase.from("fund_meta").select("*"),
    loadPrivateEntityMap(),
  ]);
  if (fm.error) return null;
  return fm.data.map((row) => rowToFundMeta(row, entityMap));
}

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

export async function updateFundMetaVehicleTipus(vehicleId, vehicleTipus) {
  if (!supabase) return { error: null };
  const { error } = await supabase
    .from("fund_meta")
    .update({ vehicle_tipus: vehicleTipus ?? null })
    .eq("vehicle_id", vehicleId);
  if (!error) logAudit("update", "fund_meta", vehicleId, { vehicle_tipus: vehicleTipus });
  return { error };
}

export async function insertFund(fons, vehicleTipus, est, compromisEur, divisa, options = {}) {
  if (!supabase) return null;
  const resolved = resolvePrivateEntity("vehicle", fons);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) { console.error(entityError); return null; }
  const data_iso = new Date().toISOString().slice(0, 10);
  const { mes, year, fy } = parseDateParts(data_iso);
  const normalizedEst = normalizeCapitalCallStrategy(est, vehicleTipus, { fons }) ?? defaultCapitalCallStrategyForVehicleTipus(vehicleTipus);

  const { error: fmErr } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, vehicle_tipus: vehicleTipus, tvpi: null, irr: null }, { onConflict: "vehicle_id" });
  if (fmErr) { console.error(fmErr); return null; }

  const { error: ccErr } = await supabase.from("capital_calls").insert({
    vehicle_id: resolved.id,
    fons: resolved.canonicalName,
    est: normalizedEst, cat: "Compromís", eur: compromisEur, divisa,
    comentaris: options.comentaris ?? null,
    amount_native: options.amountNative ?? (divisa === "EUR" ? compromisEur : null),
    fx_rate: options.fxRate ?? (divisa === "EUR" ? 1 : null),
    fx_source: options.fxSource ?? (divisa === "EUR" ? "identity" : null),
    mes, year, fy, tipus: "Compromís", data: data_iso,
  });
  if (ccErr) { console.error(ccErr); return null; }

  logAudit("insert", "capital_calls", resolved.id, { fons: resolved.canonicalName, vehicleTipus, est: normalizedEst });
  // Return in rawCC shape (key `any`, not `year`)
  return {
    id: resolved.id,
    fons: resolved.canonicalName,
    vehicleTipus,
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

export async function deleteFund(fund) {
  if (!supabase) return null;
  const name = typeof fund === "string" ? fund : fund?.fons ?? "";
  const resolved = resolvePrivateEntity("vehicle", name, typeof fund === "string" && fund.includes(":") ? fund : fund?.id ?? null);
  // Single transactional RPC: capital_calls + fund_meta deletes can't diverge.
  const { error } = await supabase.rpc("delete_fund", { p_vehicle_id: resolved.id });
  if (error) {
    const isMissing = error.code === "PGRST202" || error.message?.includes("delete_fund");
    if (isMissing) {
      console.error("[deleteFund] RPC not deployed; refusing non-atomic delete.");
      return new Error("L'operació segura d'esborrat no està disponible al servidor. Aplica les migracions de Supabase pendents i torna-ho a provar.");
    }
    return error;
  }
  logAudit("delete", "capital_calls", resolved.id, { fons: resolved.canonicalName });
  return null;
}
