import { makeServiceClient, verifyAdminOnly } from "../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from "../_security.js";

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (!await enforceRateLimit(req, res, "admin")) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = makeServiceClient();
    const admin = await verifyAdminOnly(req, supabase);
    if (!admin) return res.status(403).json({ error: "Admin required" });

    const days = parseInt(req.query?.days ?? "90", 10);
    if (isNaN(days) || days < 7 || days > 365) {
      return res.status(400).json({ error: "days must be between 7 and 365" });
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabase
      .from("audit_log")
      .delete({ count: "exact" })
      .lt("created_at", cutoff);

    if (error) throw error;
    return res.json({ deleted: count ?? 0, cutoff });
  } catch (e) {
    console.error("[admin/purge-audit]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
