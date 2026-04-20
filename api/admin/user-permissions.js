import { makeServiceClient, verifyAdmin, verifyUser, getUserRole } from "../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  sanitizeText,
} from "../_security.js";

const VALID_SECTIONS = new Set([
  "alternatives", "mercats-publics", "real-estate",   // top-level sections
  "fons", "searchers", "companies", "inversions", "txlog", // supra within alternatives
]);

function serverError(res, error, context) {
  console.error(`[admin/user-permissions] ${context}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (!await enforceRateLimit(req, res, "default")) return;

  const supabase = makeServiceClient();
  const user = await verifyUser(req, supabase);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const role = getUserRole(user);
  const isElevated = role === "admin" || role === "superuser";

  // Regular users: GET only, returns their own row
  if (!isElevated) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { data } = await supabase
        .from("user_permissions")
        .select("denied_sections")
        .eq("user_id", user.id)
        .maybeSingle();
      return res.status(200).json({ deniedSections: data?.denied_sections ?? [] });
    } catch (e) {
      return serverError(res, e, "GET own");
    }
  }

  // Admins / superusers: full CRUD
  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, denied_sections");
      if (error) return serverError(res, error, "GET all");
      const response = { permissions: data ?? [] };
      // Superusers are segment-scoped: include their own denied sections
      // so the frontend can restrict their nav just like regular users
      if (role === "superuser") {
        const myRow = (data ?? []).find(p => p.user_id === user.id);
        response.deniedSections = myRow?.denied_sections ?? [];
      }
      return res.status(200).json(response);
    } catch (e) {
      return serverError(res, e, "GET all");
    }
  }

  if (req.method === "PUT") {
    try {
      const { userId, deniedSections } = req.body ?? {};
      if (!userId || typeof userId !== "string") {
        return res.status(400).json({ error: "userId required" });
      }
      const sanitizedUserId = sanitizeText(userId, { maxLength: 128 });
      const denied = Array.isArray(deniedSections)
        ? deniedSections.filter(s => VALID_SECTIONS.has(s))
        : [];

      if (denied.length === 0) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", sanitizedUserId);
        if (error) return serverError(res, error, "PUT delete");
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .upsert({ user_id: sanitizedUserId, denied_sections: denied }, { onConflict: "user_id" });
        if (error) return serverError(res, error, "PUT upsert");
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return serverError(res, e, "PUT");
    }
  }

  // POST — apply the DB migration (creates user_permissions table if it doesn't exist)
  if (req.method === "POST") {
    try {
      const { action } = req.body ?? {};
      if (action !== "apply-migration") return res.status(400).json({ error: "Unknown action" });

      const sql = `
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id  TEXT PRIMARY KEY,
          denied_sections TEXT[] NOT NULL DEFAULT '{}'
        );
        ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'user_permissions' AND policyname = 'user_permissions_admin_all'
          ) THEN
            CREATE POLICY user_permissions_admin_all ON user_permissions
              FOR ALL TO authenticated
              USING ((auth.jwt() ->> 'role') IN ('admin', 'superuser'))
              WITH CHECK ((auth.jwt() ->> 'role') IN ('admin', 'superuser'));
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'user_permissions' AND policyname = 'user_permissions_own_read'
          ) THEN
            CREATE POLICY user_permissions_own_read ON user_permissions
              FOR SELECT TO authenticated
              USING (auth.uid()::text = user_id);
          END IF;
        END $$;
      `;
      const { error } = await supabase.rpc("exec_sql", { sql }).catch(() => ({ error: { message: "exec_sql not available" } }));
      if (error) {
        // Fallback: try direct query approach via postgrest
        return res.status(200).json({ ok: false, hint: "Run the SQL manually in the Supabase SQL Editor. The exec_sql RPC is not installed.", sql });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return serverError(res, e, "POST apply-migration");
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
