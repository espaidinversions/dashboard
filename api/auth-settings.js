import { createClient } from "@supabase/supabase-js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  sanitizeDomain,
} from "./_security.js";

// Use the anon key — this endpoint is public (called before login).
// The app_settings_allowed_domains_public RLS policy allows anon reads for
// the 'allowed_domains' key specifically. No service role key needed here.
function makeAnonClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  );
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!await enforceRateLimit(req, res, "auth")) return;

  try {
    const supabase = makeAnonClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "allowed_domains")
      .maybeSingle();
    if (error) throw error;
    const allowed_domains = Array.isArray(data?.value)
      ? data.value.map(domain => sanitizeDomain(domain))
      : [];
    return res.json({ allowed_domains });
  } catch (e) {
    console.error("[auth-settings] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
