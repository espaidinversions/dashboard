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
  "fons", "searchers", "companies", "inversions", "cash-model", "txlog", // within alternatives
  "re-directe", "re-altres",
  "mp-resum", "mp-rv", "mp-rf", "mp-posicions", "mp-transaccions", "mp-traçabilitat",
  "tx-alt", "tx-re", "tx-mp",
]);
const VALID_ACCESS_LEVELS = new Set(["none", "user", "superuser"]);

function normalizeSectionRoles(sectionRoles, deniedSections) {
  const normalized = {};
  if (sectionRoles && typeof sectionRoles === "object" && !Array.isArray(sectionRoles)) {
    for (const [sectionId, access] of Object.entries(sectionRoles)) {
      if (!VALID_SECTIONS.has(sectionId)) continue;
      if (!VALID_ACCESS_LEVELS.has(access)) continue;
      normalized[sectionId] = access;
    }
  }
  for (const sectionId of Array.isArray(deniedSections) ? deniedSections : []) {
    if (VALID_SECTIONS.has(sectionId)) normalized[sectionId] = "none";
  }
  return normalized;
}

function serverError(res, error, context) {
  console.error(`[admin/user-permissions] ${context}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (!await enforceRateLimit(req, res, "sensitive")) return;

  const supabase = makeServiceClient();
  const user = await verifyUser(req, supabase);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const role = getUserRole(user);
  const isAdmin = role === "admin";
  const isElevated = isAdmin || role === "superuser";

  // Regular users: GET only, returns their own row
  if (!isAdmin) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { data } = await supabase
        .from("user_permissions")
        .select("denied_sections, section_roles")
        .eq("user_id", user.id)
        .maybeSingle();
      return res.status(200).json({
        deniedSections: data?.denied_sections ?? [],
        sectionRoles: normalizeSectionRoles(data?.section_roles, data?.denied_sections),
      });
    } catch (e) {
      return serverError(res, e, "GET own");
    }
  }

  // Admins: full CRUD
  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, denied_sections, section_roles");
      if (error) return serverError(res, error, "GET all");
      return res.status(200).json({
        permissions: (data ?? []).map((row) => ({
          ...row,
          section_roles: normalizeSectionRoles(row.section_roles, row.denied_sections),
        })),
      });
    } catch (e) {
      return serverError(res, e, "GET all");
    }
  }

  if (req.method === "PUT") {
    try {
      const { userId, deniedSections, sectionRoles } = req.body ?? {};
      if (!userId || typeof userId !== "string") {
        return res.status(400).json({ error: "userId required" });
      }
      const sanitizedUserId = sanitizeText(userId, { maxLength: 128 });
      const denied = Array.isArray(deniedSections)
        ? deniedSections.filter(s => VALID_SECTIONS.has(s))
        : [];
      const normalizedRoles = normalizeSectionRoles(sectionRoles, denied);

      if (denied.length === 0 && Object.keys(normalizedRoles).length === 0) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", sanitizedUserId);
        if (error) return serverError(res, error, "PUT delete");
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .upsert({
            user_id: sanitizedUserId,
            denied_sections: denied,
            section_roles: normalizedRoles,
          }, { onConflict: "user_id" });
        if (error) return serverError(res, error, "PUT upsert");
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return serverError(res, e, "PUT");
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
