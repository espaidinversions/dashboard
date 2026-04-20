import { getUserRole, isAllowedRole, makeServiceClient, verifyAdmin, verifyAdminOnly } from "../../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  normalizeBoolean,
  sanitizeText,
  ValidationError,
} from "../../_security.js";

function serverError(res, error, context) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(`[admin/users/[id]] ${context}:`, error);
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

    const id = sanitizeText(req.query.id, { maxLength: 128 });

    if (req.method === "PATCH") {
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
      const { data: allUsers } = await supabase.auth.admin.listUsers();
      const admins = (allUsers?.users ?? []).filter(user => getUserRole(user) === "admin");
      const target = admins.find(user => user.id === id);
      if (target && admins.length <= 1) {
        return res.status(409).json({ error: "Cannot delete the last admin" });
      }

      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) return serverError(res, error, "deleteUser");
      return res.json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return serverError(res, e, "handler");
  }
}
