import { createClient } from "@supabase/supabase-js";

function makeServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function verifyAdmin(req, serviceClient) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  if (error || user?.user_metadata?.role !== "admin") return null;
  return user;
}

export default async function handler(req, res) {
  const supabase = makeServiceClient();
  const admin = await verifyAdmin(req, supabase);
  if (!admin) return res.status(403).json({ error: "Forbidden" });

  const { id } = req.query;

  if (req.method === "PATCH") {
    const { role, email_confirm } = req.body;
    const updates = {};
    if (role !== undefined) updates.user_metadata = { role };
    if (email_confirm) updates.email_confirm = true;
    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ user: data.user });
  }

  if (req.method === "DELETE") {
    // Guard: don't delete the last admin
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const admins = (allUsers?.users ?? []).filter(
      u => u.user_metadata?.role === "admin",
    );
    const target = admins.find(u => u.id === id);
    if (target && admins.length <= 1) {
      return res.status(409).json({ error: "Cannot delete the last admin" });
    }

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
