import { getUserRole, makeServiceClient, verifyAdminOnly } from "../_adminAuth.js";
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
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = makeServiceClient();
    const admin = await verifyAdminOnly(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    // User counts by role
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const users = allUsers?.users ?? [];
    const usersByRole = { user: 0, admin: 0, superuser: 0 };
    let pending = 0;
    for (const u of users) {
      const r = getUserRole(u);
      if (usersByRole[r] !== undefined) usersByRole[r]++;
      if (!u.email_confirmed_at) pending++;
    }

    // Row counts per table
    const TABLES = [
      "capital_calls", "portfolio_companies", "searchers", "pipeline",
      "pm_transactions", "pm_ter_overrides", "pm_position_meta",
      "pm_position_overrides", "private_entities", "audit_log",
    ];
    const counts = {};
    await Promise.all(TABLES.map(async (t) => {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      counts[t] = error ? null : (count ?? 0);
    }));

    // Last audit log entry
    const { data: lastLog } = await supabase
      .from("audit_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return res.json({
      users: { total: users.length, pending, byRole: usersByRole },
      tables: counts,
      lastActivity: lastLog?.created_at ?? null,
    });
  } catch (e) {
    console.error("[admin/system-status]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
