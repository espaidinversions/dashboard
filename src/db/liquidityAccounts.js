import { rowToLiquidityRegistry, rowToLiquidityBalance } from "../data/mappers.js";
import { supabase, logAudit } from "./_shared.js";

const MISSING_RPC =
  'L\'operació segura no està disponible al servidor. Aplica les migracions de Supabase pendents i torna-ho a provar.';

function normalizeRpcError(error, rpcName) {
  if (!error) return null;
  if (error.code === "PGRST202" || error.message?.includes(rpcName)) return new Error(MISSING_RPC);
  return error;
}

/**
 * Load the liquidity registry + full balance history. Degrades to empty lists
 * when Supabase is unavailable or the tables are missing (migration not applied).
 * @returns {Promise<{ registry: Array, balances: Array }>}
 */
export async function loadLiquidity() {
  if (!supabase) return { registry: [], balances: [] };
  const [{ data: reg, error: regErr }, { data: bal, error: balErr }] = await Promise.all([
    supabase.from("liquidity_registry").select("id,nom,banc,section,divisa").order("section").order("nom"),
    supabase.from("liquidity_balances").select("id,account_id,data,saldo,saldo_native").order("account_id").order("data"),
  ]);
  if (regErr || !Array.isArray(reg)) {
    if (regErr) console.warn("loadLiquidity registry failed (table may be missing):", regErr.message);
    return { registry: [], balances: [] };
  }
  if (balErr) console.warn("loadLiquidity balances failed:", balErr.message);
  return {
    registry: reg.map(rowToLiquidityRegistry),
    balances: Array.isArray(bal) ? bal.map(rowToLiquidityBalance) : [],
  };
}

/** Insert (id null) or update a registry account. Superuser-only (RPC guard + RLS). */
export async function upsertLiquidityAccount(account) {
  if (!supabase) return { id: null, error: null };
  const { data, error } = await supabase.rpc("upsert_liquidity_account", {
    p_id: account.id ?? null,
    p_nom: String(account.nom ?? "").trim(),
    p_banc: account.banc != null && account.banc !== "" ? String(account.banc).trim() : null,
    p_section: account.section,
    p_divisa: String(account.divisa ?? "EUR").trim() || "EUR",
  });
  const err = normalizeRpcError(error, "upsert_liquidity_account");
  if (!err) await logAudit(account.id ? "update" : "insert", "liquidity_registry", data ?? account.id, { new: account });
  return { id: data ?? null, error: err };
}

/** Delete a registry account (balances cascade). Superuser-only. */
export async function deleteLiquidityAccount(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.rpc("delete_liquidity_account", { p_id: id });
  const err = normalizeRpcError(error, "delete_liquidity_account");
  if (!err) await logAudit("delete", "liquidity_registry", id, null);
  return { error: err };
}

/** Insert (id null) or update a monthly balance. Superuser-only. */
export async function upsertLiquidityBalance(balance) {
  if (!supabase) return { id: null, error: null };
  const saldo = Number(balance.saldo);
  const native = balance.saldoNative != null && balance.saldoNative !== "" ? Number(balance.saldoNative) : null;
  const { data, error } = await supabase.rpc("upsert_liquidity_balance", {
    p_id: balance.id ?? null,
    p_account_id: balance.accountId,
    p_data: balance.data,
    p_saldo: Number.isFinite(saldo) ? saldo : 0,
    p_saldo_native: native != null && Number.isFinite(native) ? native : null,
  });
  const err = normalizeRpcError(error, "upsert_liquidity_balance");
  if (!err) await logAudit(balance.id ? "update" : "insert", "liquidity_balances", data ?? balance.id, { new: balance });
  return { id: data ?? null, error: err };
}

/** Delete a balance. Superuser-only. */
export async function deleteLiquidityBalance(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.rpc("delete_liquidity_balance", { p_id: id });
  const err = normalizeRpcError(error, "delete_liquidity_balance");
  if (!err) await logAudit("delete", "liquidity_balances", id, null);
  return { error: err };
}
