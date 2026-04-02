import { supabase } from "../../supabase.js";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase client not configured");
  return supabase;
}

async function readSettingValue(key) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? [];
}

export async function loadAllowedDomains() {
  const value = await readSettingValue("allowed_domains");
  return Array.isArray(value) ? value : [];
}

export async function saveAllowedDomains(domains) {
  const client = assertSupabase();
  const { error } = await client
    .from("app_settings")
    .upsert(
      { key: "allowed_domains", value: domains, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}

export async function loadAuditLog({ limit = 500 } = {}) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
