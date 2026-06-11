import { logAudit, supabase } from "./_shared.js";

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

export async function loadPMTransactions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_transactions").select("*").order("date", { ascending: false });
  if (error) return [];
  return data;
}

export async function deletePMTransaction(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_transactions").delete().eq("id", id);
  return { error };
}

export async function loadPMTerOverridesTable() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_ter_overrides").select("*").order("isin");
  if (error) return [];
  return data;
}

export async function loadPMPositionMetaTable() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_position_meta").select("*").order("isin");
  if (error) return [];
  return data;
}

export async function loadPMPositionOverridesTable() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_position_overrides").select("*").order("isin");
  if (error) return [];
  return data;
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

export async function upsertTerOverride(isin, ter, notes) {
  if (!supabase) return { error: null };
  const row = { isin, ter, updated_at: new Date().toISOString() };
  if (notes !== undefined) row.notes = notes;
  const { error } = await supabase.from("pm_ter_overrides")
    .upsert(row, { onConflict: "isin" });
  return { error };
}

export async function upsertPositionMeta(isin, fields) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_position_meta")
    .upsert({ isin, ...fields, updated_at: new Date().toISOString() }, { onConflict: "isin" });
  return { error };
}

export async function loadPMPositionOverrides() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("pm_position_overrides").select("*");
  if (error) return null;
  return new Map(data.map(r => [r.isin, {
    valorMercat: r.valor_mercat,
    rendInici:   r.rend_inici,
    rendiment:   r.rendiment ?? {},
    costAnual:   r.cost_anual,
  }]));
}

export async function loadPMMonthlySeries() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_monthly_series").select("*").order("month");
  if (error) return [];
  return data;
}

export async function upsertPMMonthlyRow(row) {
  if (!supabase) return { error: null };
  const payload = {
    month:      row.month,
    caixa_rv:   row.caixaRV ?? null,
    caixa_rf:   row.caixaRF ?? null,
    ubs_rv:     row.ubsRV ?? null,
    ubs_rf:     row.ubsRF ?? null,
    abel_bk:    row.abelBK ?? null,
    andbank:    row.andbank ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("pm_monthly_series")
    .upsert(payload, { onConflict: "month" });
  if (!error) logAudit("update", "pm_monthly_series", row.month, payload);
  return { error };
}

export async function deletePMMonthlyRow(month) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pm_monthly_series").delete().eq("month", month);
  if (!error) logAudit("delete", "pm_monthly_series", month, {});
  return { error };
}

export async function loadPMManagerOverrides() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pm_manager_overrides").select("*").order("manager_id");
  if (error) return [];
  return data;
}

export async function upsertPMManagerOverride(managerId, fields) {
  if (!supabase) return { error: null };
  const row = { manager_id: managerId, updated_at: new Date().toISOString() };
  if (fields.valorActual !== undefined) row.valor_actual = fields.valorActual;
  if (fields.rendPct     !== undefined) row.rend_pct     = fields.rendPct;
  if (fields.ytd         !== undefined) row.ytd          = fields.ytd;
  if (fields.r2025       !== undefined) row.r2025        = fields.r2025;
  if (fields.r2024       !== undefined) row.r2024        = fields.r2024;
  if (fields.notes       !== undefined) row.notes        = fields.notes;
  const { error } = await supabase.from("pm_manager_overrides")
    .upsert(row, { onConflict: "manager_id" });
  if (!error) logAudit("update", "pm_manager_overrides", managerId, fields);
  return { error };
}

export async function upsertPMPositionOverride(isin, fields) {
  if (!supabase) return { error: null };
  const row = { isin, updated_at: new Date().toISOString() };
  if (fields.valorMercat != null) row.valor_mercat = fields.valorMercat;
  if (fields.rendInici   != null) row.rend_inici   = fields.rendInici;
  if (fields.rendiment   != null) row.rendiment    = fields.rendiment;
  if (fields.costAnual   != null) row.cost_anual   = fields.costAnual;
  if (fields.notes       != null) row.notes        = fields.notes;
  const { error } = await supabase.from("pm_position_overrides")
    .upsert(row, { onConflict: "isin" });
  if (!error) logAudit("update", "pm_position_overrides", isin, fields);
  return { error };
}

