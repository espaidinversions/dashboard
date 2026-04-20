import { makeServiceClient, verifyAdmin } from "../_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from "../_security.js";

// Tables where revert is allowed and their primary key columns
const REVERTABLE = {
  capital_calls:        { pk: "id" },
  portfolio_companies:  { pk: "entity_id" },
  searchers:            { pk: "id" },
  pipeline:             { pk: "id" },
};

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (!await enforceRateLimit(req, res, "admin")) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = makeServiceClient();
    const admin = await verifyAdmin(req, supabase);
    if (!admin) return res.status(403).json({ error: "Admin required" });

    const { auditId } = req.body ?? {};
    if (!auditId) return res.status(400).json({ error: "auditId required" });

    // Fetch the audit log entry
    const { data: entry, error: fetchErr } = await supabase
      .from("audit_log")
      .select("*")
      .eq("id", auditId)
      .single();

    if (fetchErr || !entry) return res.status(404).json({ error: "Audit entry not found" });

    const { action, table_name, record_id, changes } = entry;
    const tableCfg = REVERTABLE[table_name];
    if (!tableCfg) {
      return res.status(400).json({ error: `Revert not supported for table: ${table_name}` });
    }

    const { pk } = tableCfg;
    let revertError = null;

    if (action === "insert") {
      // Revert insert → delete the record
      const { error } = await supabase.from(table_name).delete().eq(pk, record_id);
      revertError = error;
    } else if (action === "delete") {
      // Revert delete → re-insert with the stored old record
      const oldRecord = changes?.old;
      if (!oldRecord) return res.status(400).json({ error: "No old record stored in audit log — cannot revert" });
      const { error } = await supabase.from(table_name).insert(oldRecord);
      revertError = error;
    } else if (action === "update") {
      // Revert update → restore old values
      const oldRecord = changes?.old;
      if (!oldRecord) return res.status(400).json({ error: "No old record stored in audit log — cannot revert" });
      // Only restore fields that were captured in old
      const { error } = await supabase.from(table_name).update(oldRecord).eq(pk, record_id);
      revertError = error;
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    if (revertError) throw revertError;

    // Log the revert itself in the audit log
    await supabase.from("audit_log").insert({
      user_id: admin.id,
      user_email: admin.email,
      action: "revert",
      table_name,
      record_id: String(record_id ?? ""),
      changes: { reverted_audit_id: auditId, original_action: action },
    });

    return res.json({ ok: true, reverted: auditId });
  } catch (e) {
    console.error("[admin/revert-change]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
