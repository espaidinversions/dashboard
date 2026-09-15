import {
  buildPrivateEntitiesFromDashboardBundle,
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

/**
 * Persist a vehicle's full Classificació from the fund one-pager editor:
 * the categorical class (→ private_entities.vehicle_est) and the four weight
 * maps (→ fund_meta.allocation/geography/sector/strategy jsonb). Each map is a
 * fraction map summing to 1.0, or null to clear that dimension.
 *
 * The fund_meta upsert lists only the columns it owns, so on an existing row
 * ON CONFLICT touches just those columns and leaves tvpi/irr/fi_end/
 * committed_override intact (PostgREST upsert semantics).
 *
 * @param {string | { id?: string, fons?: string, nom?: string }} fund
 * @param {{ vehicleEst?: string | null, allocation?: object | null, geography?: object | null, sector?: object | null, strategy?: object | null }} classification
 */
export async function saveFundClassification(fund, classification) {
  if (!supabase) return { error: null };
  const {
    vehicleEst = null,
    allocation = null,
    geography = null,
    sector = null,
    strategy = null,
  } = classification ?? {};
  const name = typeof fund === "string" ? fund : fund?.fons ?? fund?.nom ?? "";
  const id = typeof fund === "string" ? null : fund?.id ?? null;

  // vehicle_est is the single source of truth for the vehicle class; store it on
  // the private entity (mirrors insertFund).
  const resolved = { ...resolvePrivateEntity("vehicle", name, id), vehicleEst };
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { error: entityError };

  const { error } = await supabase
    .from("fund_meta")
    .upsert(
      { vehicle_id: resolved.id, fons: resolved.canonicalName, allocation, geography, sector, strategy },
      { onConflict: "vehicle_id" },
    );
  if (!error) {
    logAudit("update", "fund_meta", resolved.id, { fons: resolved.canonicalName, vehicleEst });
  }
  return { error };
}

export async function insertFund(fons, est, compromisEur, divisa, options = {}) {
  if (!supabase) return null;
  const normalizedEst = normalizeCapitalCallStrategy(est, null, { fons }) ?? "Fons Primari";
  // The chosen "Tipus de Vehicle" (est) lives on the private entity as vehicle_est,
  // the single source of truth for classification.
  const resolved = { ...resolvePrivateEntity("vehicle", fons), vehicleEst: normalizedEst };
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) { console.error(entityError); return null; }
  const data_iso = new Date().toISOString().slice(0, 10);
  const { mes, year, fy } = parseDateParts(data_iso);

  // A freshly committed vehicle's value equals its cost until real marks arrive,
  // so TVPI defaults to 1.0 (editable later via the TVPI cell in FundsIndex).
  const { error: fmErr } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, tvpi: 1, irr: null }, { onConflict: "vehicle_id" });
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

  logAudit("insert", "capital_calls", resolved.id, { fons: resolved.canonicalName, est: normalizedEst });
  // Return in rawCC shape (key `any`, not `year`)
  return {
    id: resolved.id,
    fons: resolved.canonicalName,
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
