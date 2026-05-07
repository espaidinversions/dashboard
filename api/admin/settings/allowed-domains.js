import { makeServiceClient, verifyAdminOnly } from "../../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  sanitizeDomain,
  ValidationError,
} from "../../_security.js";

function serverError(res, error, context) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(`[admin/settings/allowed-domains] ${context}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (!await enforceRateLimit(req, res, "admin")) return;

  try {
    const supabase = makeServiceClient();
    const admin = await verifyAdminOnly(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "allowed_domains")
        .maybeSingle();
      if (error) return serverError(res, error, "load");
      const domains = Array.isArray(data?.value)
        ? data.value.map(domain => sanitizeDomain(domain))
        : [];
      return res.json({ domains });
    }

    if (req.method === "PATCH") {
      if (!Array.isArray(req.body?.domains)) {
        return res.status(400).json({ error: "domains must be an array" });
      }
      if (req.body.domains.length > 100) {
        return res.status(400).json({ error: "Too many domains" });
      }
      const domains = [...new Set(req.body.domains.map(domain => sanitizeDomain(domain)))];
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "allowed_domains", value: domains, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) return serverError(res, error, "save");
      return res.json({ domains });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return serverError(res, error, "handler");
  }
}
