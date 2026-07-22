import {
  atomicReplace,
  liquidityAccountToRow,
  rowToLiquidityAccount,
  supabase,
} from "./_shared.js";

/**
 * Load all liquidity accounts (the cross-section cash source of truth).
 * Returns [] when Supabase is unavailable or the table is missing/empty, so a
 * not-yet-applied migration degrades to "no liquidity" instead of crashing.
 */
export async function loadLiquidityAccounts() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("liquidity_accounts")
    .select("id,nom,banc,section,saldo,saldo_native,divisa,data")
    .order("section")
    .order("nom");
  if (error || !Array.isArray(data)) {
    if (error) console.warn("loadLiquidityAccounts failed (table may be missing):", error.message);
    return [];
  }
  return data.map(rowToLiquidityAccount);
}

/** Atomically replace the full set of liquidity accounts. Superuser-only (RLS + RPC guard). */
export async function saveLiquidityAccounts(accounts) {
  if (!supabase) return { error: null };
  const rows = (Array.isArray(accounts) ? accounts : []).map(liquidityAccountToRow);
  return atomicReplace("replace_liquidity_accounts", "liquidity_accounts", rows);
}
