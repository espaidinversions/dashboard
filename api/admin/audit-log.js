import { makeServiceClient, verifyAdminOnly } from "../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  parsePagination,
  sanitizeText,
  ValidationError,
} from "../_security.js";

function serverError(res, error, context) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(`[admin/audit-log] ${context}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

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

    const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 50, maxPageSize: 200 });
    const user = req.query?.user ? sanitizeText(req.query.user, { maxLength: 320 }) : "";
    const table = req.query?.table ? sanitizeText(req.query.table, { maxLength: 80 }) : "";
    const action = req.query?.action ? sanitizeText(req.query.action, { maxLength: 20 }) : "";

    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (user) query = query.ilike("user_email", `%${user}%`);
    if (table) query = query.eq("table_name", table);
    if (action) query = query.eq("action", action);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) return serverError(res, error, "load");

    return res.json({
      logs: data ?? [],
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(Math.ceil((count ?? 0) / pageSize), 1),
      },
    });
  } catch (error) {
    return serverError(res, error, "handler");
  }
}
