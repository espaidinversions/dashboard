import {
  buildPrivateEntitiesFromDashboardBundle,
  buildSearchFundInferrer,
  capitalCallToRow,
  computeFundIrrFromRows,
  fetchAllCapitalCallRows,
  fundMetaToRow,
  inferCapitalCallCategoryFromTipus,
  loadPrivateEntityMap,
  logAudit,
  normalizeCapitalCallSignedAmount,
  normalizeCapitalCallStrategy,
  normalizeCapitalCallTipus,
  parseDateParts,
  resolvePrivateEntity,
  rowToCapitalCall,
  setSnapshotInferrer,
  supabase,
  upsertFundMetaComputed,
  upsertPrivateEntities,
  upsertPrivateEntitiesIfNew,
} from "./_shared.js";

/**
 * @param {{ skipCompanions?: boolean }} [options]
 *   skipCompanions – when true, skip the searchers/portfolio_companies re-fetch
 *   (safe after a CC-only mutation where neither table has changed).
 */
export async function loadCapitalCalls({ skipCompanions = false } = {}) {
  if (!supabase) return null;
  if (skipCompanions) {
    const [cc, entityMap] = await Promise.all([
      fetchAllCapitalCallRows(),
      loadPrivateEntityMap(),
    ]);
    if (cc.error) return null;
    return cc.data.map((row) => rowToCapitalCall(row, entityMap));
  }
  const [cc, entityMap, srResult, coResult] = await Promise.all([
    fetchAllCapitalCallRows(),
    loadPrivateEntityMap(),
    supabase.from("searchers").select("nom,status_screening"),
    supabase.from("portfolio_companies").select("nom,tipus"),
  ]);
  if (cc.error) return null;
  if (!srResult.error && Array.isArray(srResult.data) && !coResult.error && Array.isArray(coResult.data)) {
    setSnapshotInferrer(buildSearchFundInferrer(
      srResult.data.map((r) => ({ nom: r.nom, statusScreening: r.status_screening })),
      coResult.data.map((r) => ({ nom: r.nom, tipus: r.tipus })),
    ));
  }
  return cc.data.map((row) => rowToCapitalCall(row, entityMap));
}

export async function saveCapitalCalls(rows) {
  if (!supabase) return;
  const entities = buildPrivateEntitiesFromDashboardBundle({ rawCC: rows });
  const { error: entitiesError } = await upsertPrivateEntities(entities);
  if (entitiesError) return { error: entitiesError };
  const { data: existingMeta, error: metaReadError } = await supabase.from("fund_meta").select("*");
  if (metaReadError) return { error: metaReadError };
  const { error: delError } = await supabase.from("capital_calls").delete().neq("id", 0);
  if (delError) return { error: delError };
  if (rows.length) {
    const { error } = await supabase.from("capital_calls").insert(rows.map(capitalCallToRow));
    if (error) return { error };
  }
  const metaByVehicle = new Map((existingMeta ?? []).map((row) => [row.vehicle_id ?? row.fons, row]));
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.id ?? row.fons;
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  const nextMetaRows = [...grouped.entries()].map(([key, fundRows]) => {
    const existing = metaByVehicle.get(key) ?? metaByVehicle.get(fundRows[0]?.fons) ?? {};
    const tvpi = existing.tvpi ?? null;
    return {
      id: fundRows[0]?.id ?? undefined,
      fons: fundRows[0]?.fons ?? existing.fons ?? "",
      tvpi,
      irr: computeFundIrrFromRows(fundRows, tvpi),
    };
  });
  if (nextMetaRows.length > 0) {
    const { error } = await supabase
      .from("fund_meta")
      .upsert(nextMetaRows.map(fundMetaToRow), { onConflict: "vehicle_id" });
    if (error) return { error };
  }
  return { error: null };
}

export async function insertCapitalCall(cc) {
  if (!supabase) return { data: null, error: null };
  let resolved = resolvePrivateEntity("vehicle", cc.fons, cc.vehicle_id ?? null);
  if (!resolved) return { data: null, error: new Error("No s'ha pogut identificar el vehicle") };
  resolved.nif = String(cc.nif ?? "").trim() || null;
  resolved.fiscalName = String(cc.fiscal_name ?? "").trim() || null;

  // For existing vehicles: pull vehicle_id from an existing capital_call row.
  // This avoids touching private_entities (which non-admins cannot write to)
  // and sidesteps any mismatch between the locally-resolved ID and the DB ID.
  const { data: existingCC } = await supabase
    .from("capital_calls")
    .select("vehicle_id")
    .eq("fons", resolved.canonicalName)
    .not("vehicle_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (existingCC?.vehicle_id) {
    resolved = { ...resolved, id: existingCC.vehicle_id };
  } else {
    // No existing transaction for this vehicle — try private_entities by canonical_name.
    const { data: dbEntity, error: lookupError } = await supabase
      .from("private_entities")
      .select("id")
      .eq("canonical_name", resolved.canonicalName)
      .maybeSingle();
    if (lookupError) return { data: null, error: lookupError };
    if (dbEntity?.id) {
      resolved = { ...resolved, id: dbEntity.id };
    } else {
      // Genuinely new vehicle — only admins can create private entities.
      const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
      if (entityError) return { data: null, error: entityError };
    }
  }
  const { mes, year, fy } = parseDateParts(cc.data);
  const tipus = normalizeCapitalCallTipus(cc.tipus) ?? null;
  const eur = normalizeCapitalCallSignedAmount(tipus, cc.eur);
  const row = {
    vehicle_id: resolved.id,
    fons: resolved.canonicalName,
    tipus,
    cat: cc.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
    data: cc.data,
    mes,
    year,
    fy,
    est: normalizeCapitalCallStrategy(cc.est, cc.vehicleTipus ?? null, cc) ?? null,
    eur,
    divisa: cc.divisa ?? "EUR",
    comentaris: cc.comentaris ?? null,
    amount_native: cc.amountNative ?? (cc.divisa === "EUR" ? eur : null),
    fx_rate: cc.fxRate ?? (cc.divisa === "EUR" ? 1 : null),
    fx_source: cc.fxSource ?? (cc.divisa === "EUR" ? "identity" : null),
    recallable:      (cc.recallable      !== "" && cc.recallable      != null) ? Number(cc.recallable)      : null,
    non_recallable:  (cc.non_recallable  !== "" && cc.non_recallable  != null) ? Number(cc.non_recallable)  : null,
    from_recallable: (cc.from_recallable !== "" && cc.from_recallable != null) ? Number(cc.from_recallable) : null,
  };
  // Ensure fund_meta has a row for this vehicle before the FK-constrained insert.
  // capital_calls_fund_meta_fk requires fund_meta.vehicle_id to exist first;
  // upsertFundMetaComputed runs after the insert to fill in computed IRR.
  const { error: fmPreError } = await supabase
    .from("fund_meta")
    .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName }, { onConflict: "vehicle_id" });
  if (fmPreError) return { data: null, error: fmPreError };

  const { data, error } = await supabase.from("capital_calls").insert(row).select("*, fund_meta(vehicle_tipus)").single();
  if (!error) logAudit("insert", "capital_calls", String(data?.id), row);
  if (!error) {
    const metaResult = await upsertFundMetaComputed(resolved.id, resolved.canonicalName);
    if (metaResult.error) console.warn("upsertFundMetaComputed (insert) failed (non-fatal):", metaResult.error);
  }
  return { data, error };
}

export async function updateCapitalCall(rowId, fields) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("capital_calls").select("*, fund_meta(vehicle_tipus)").eq("id", rowId).single();
  const updates = { ...fields };
  delete updates.vehicleTipus; // derived from fund_meta, not a capital_calls column
  if (Object.prototype.hasOwnProperty.call(updates, "amountNative")) {
    updates.amount_native = updates.amountNative;
    delete updates.amountNative;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "fxRate")) {
    updates.fx_rate = updates.fxRate;
    delete updates.fxRate;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "fxSource")) {
    updates.fx_source = updates.fxSource;
    delete updates.fxSource;
  }
  for (const col of ["recallable", "non_recallable", "from_recallable", "amount_native", "fx_rate"]) {
    if (Object.prototype.hasOwnProperty.call(updates, col)) {
      updates[col] = (updates[col] !== "" && updates[col] != null) ? Number(updates[col]) : null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, "comentaris")) {
    updates.comentaris = String(updates.comentaris ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "tipus")) {
    updates.tipus = normalizeCapitalCallTipus(fields.tipus) ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "eur")) {
    const nextTipus = Object.prototype.hasOwnProperty.call(updates, "tipus") ? updates.tipus : old?.tipus;
    updates.eur = normalizeCapitalCallSignedAmount(nextTipus, fields.eur);
  }
  if (Object.prototype.hasOwnProperty.call(fields, "est")) {
    const nextEst = Object.prototype.hasOwnProperty.call(updates, "est") ? updates.est : old?.est;
    const nextFons = Object.prototype.hasOwnProperty.call(updates, "fons") ? updates.fons : old?.fons;
    const vehicleTipus = old?.fund_meta?.vehicle_tipus ?? null;
    updates.est = normalizeCapitalCallStrategy(nextEst, vehicleTipus, { fons: nextFons });
  }
  if (
    !Object.prototype.hasOwnProperty.call(fields, "cat")
    && (Object.prototype.hasOwnProperty.call(fields, "tipus") || Object.prototype.hasOwnProperty.call(fields, "eur"))
  ) {
    const nextTipus = Object.prototype.hasOwnProperty.call(updates, "tipus") ? updates.tipus : old?.tipus;
    const nextEur = Object.prototype.hasOwnProperty.call(updates, "eur") ? updates.eur : old?.eur;
    updates.cat = inferCapitalCallCategoryFromTipus(nextTipus, nextEur);
  }
  if (fields.fons) {
    const resolved = resolvePrivateEntity("vehicle", fields.fons, old?.vehicle_id ?? null);
    const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
    if (entityError) return { error: entityError };
    updates.vehicle_id = resolved.id;
    updates.fons = resolved.canonicalName;
    // Ensure fund_meta has this vehicle_id before the FK-constrained update.
    // Applies whenever vehicle_id changes (including null → non-null transitions).
    if (resolved.id != null) {
      const { error: fmPreError } = await supabase
        .from("fund_meta")
        .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName }, { onConflict: "vehicle_id" });
      if (fmPreError) return { error: fmPreError };
    }
  }
  if (fields.data) {
    const { mes, year, fy } = parseDateParts(fields.data);
    Object.assign(updates, { mes, year, fy });
  }
  const { error } = await supabase.from("capital_calls").update(updates).eq("id", rowId);
  if (!error) logAudit("update", "capital_calls", String(rowId), { old: old ?? null, new: updates });
  if (!error) {
    const vehicleId = updates.vehicle_id ?? old?.vehicle_id ?? null;
    const fundName = updates.fons ?? old?.fons ?? "";
    const metaResult = await upsertFundMetaComputed(vehicleId, fundName);
    if (metaResult.error) console.warn("upsertFundMetaComputed (update) failed (non-fatal):", metaResult.error);
  }
  return { error };
}

export async function deleteCapitalCall(rowId) {
  if (!supabase) return { error: null };
  const { data: old } = await supabase.from("capital_calls").select("*, fund_meta(vehicle_tipus)").eq("id", rowId).single();
  const { error } = await supabase.from("capital_calls").delete().eq("id", rowId);
  if (!error && old?.vehicle_id) {
    const metaResult = await upsertFundMetaComputed(old.vehicle_id, old.fons ?? "");
    if (metaResult.error) console.warn("upsertFundMetaComputed (delete) failed (non-fatal):", metaResult.error);
  }
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
