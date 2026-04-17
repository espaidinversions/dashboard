import { isAllowedRole, isValidEmail, makeServiceClient, verifyAdmin } from "../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  parsePagination,
  sanitizeDomain,
  sanitizeEmail,
  sanitizeText,
  ValidationError,
} from "../_security.js";

function serverError(res, error, context) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(`[admin/users] ${context}:`, error);
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
    const admin = await verifyAdmin(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "GET") {
      const { page, pageSize, offset } = parsePagination(req.query, { defaultPageSize: 25, maxPageSize: 100 });
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) return serverError(res, error, "listUsers");
      const users = data?.users ?? [];
      return res.json({
        users: users.slice(offset, offset + pageSize),
        pagination: {
          page,
          pageSize,
          total: users.length,
          totalPages: Math.max(Math.ceil(users.length / pageSize), 1),
        },
      });
    }

    if (req.method === "POST") {
      const email = sanitizeEmail(req.body?.email);
      const role = req.body?.role ? sanitizeText(req.body.role, { maxLength: 20 }) : "user";
      if (!email) return res.status(400).json({ error: "Email required" });
      if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email" });
      if (!isAllowedRole(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "allowed_domains")
        .maybeSingle();
      const domains = Array.isArray(setting?.value)
        ? setting.value.map(domain => sanitizeDomain(domain))
        : [];
      if (domains.length > 0) {
        const domain = email.split("@")[1];
        if (!domains.includes(domain)) {
          return res.status(400).json({ error: "Email domain not allowed" });
        }
      }

      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
      if (error) return serverError(res, error, "inviteUserByEmail");
      if (data?.user?.id) {
        const { error: roleError } = await supabase.auth.admin.updateUserById(data.user.id, {
          app_metadata: { role },
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
