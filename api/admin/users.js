import { isRateLimited } from "../_rateLimit.js";
import { setCors } from "../_cors.js";
import { getRequestIp, isAllowedRole, isValidEmail, makeServiceClient, verifyAdmin } from "../_adminAuth.js";

function serverError(res, error, context) {
  console.error(`[admin/users] ${context}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = getRequestIp(req);
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  try {
    const supabase = makeServiceClient();
    const admin = await verifyAdmin(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "GET") {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) return serverError(res, error, "listUsers");
      return res.json({ users: data.users });
    }

    if (req.method === "POST") {
      const { email, role } = req.body ?? {};
      if (!email) return res.status(400).json({ error: "Email required" });
      if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email" });
      if (role !== undefined && !isAllowedRole(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Check domain allowlist
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "allowed_domains")
        .maybeSingle();
      const domains = setting?.value ?? [];
      if (domains.length > 0) {
        const domain = email.split("@")[1];
        if (!domains.includes(domain)) {
          return res.status(400).json({ error: "Email domain not allowed" });
        }
      }

      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { role: role || "user" },
      });
      if (error) return serverError(res, error, "inviteUserByEmail");
      if (data?.user?.id && role) {
        const { error: roleError } = await supabase.auth.admin.updateUserById(data.user.id, {
          app_metadata: { role },
          user_metadata: { role },
        });
        if (roleError) return serverError(res, roleError, "updateUserById(role)");
      }
      return res.json({ user: data?.user ?? null });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return serverError(res, e, "handler");
  }
}
