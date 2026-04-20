import { getUserRole, isAllowedRole, isValidEmail, makeServiceClient, verifyAdmin, verifyAdminOnly } from "../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  normalizeBoolean,
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
    const id = req.query?.id !== undefined
      ? sanitizeText(req.query.id, { maxLength: 128 })
      : "";

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
      if (role !== "user") {
        const privilegedAdmin = await verifyAdminOnly(req, supabase);
        if (!privilegedAdmin) return res.status(403).json({ error: "Assigning elevated roles requires admin" });
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

    if (req.method === "PATCH") {
      if (!id) return res.status(400).json({ error: "User id required" });

      const role = req.body?.role !== undefined ? sanitizeText(req.body.role, { maxLength: 20 }) : undefined;
      const emailConfirm = req.body?.email_confirm !== undefined ? normalizeBoolean(req.body.email_confirm, false) : false;
      const updates = {};
      if (role !== undefined) {
        const privilegedAdmin = await verifyAdminOnly(req, supabase);
        if (!privilegedAdmin) return res.status(403).json({ error: "Role changes require admin" });
        if (!isAllowedRole(role)) return res.status(400).json({ error: "Invalid role" });
        updates.app_metadata = { role };
      }
      if (emailConfirm) updates.email_confirm = true;

      const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
      if (error) return serverError(res, error, "updateUserById");
      return res.json({ user: data?.user ?? null });
    }

    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "User id required" });

      const { data: allUsers, error } = await supabase.auth.admin.listUsers();
      if (error) return serverError(res, error, "listUsers(delete)");
      const admins = (allUsers?.users ?? []).filter(user => getUserRole(user) === "admin");
      const target = admins.find(user => user.id === id);
      if (target && admins.length <= 1) {
        return res.status(409).json({ error: "Cannot delete the last admin" });
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
      if (deleteError) return serverError(res, deleteError, "deleteUser");
      return res.json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return serverError(res, e, "handler");
  }
}
