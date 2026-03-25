import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "../_rateLimit.js";
import { setCors } from "../_cors.js";

function serverError(res, error, context) {
  console.error(`[admin/users] ${context}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

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
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] ?? req.socket?.remoteAddress ?? "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const supabase = makeServiceClient();
  const admin = await verifyAdmin(req, supabase);
  if (!admin) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return serverError(res, error, "listUsers");
    return res.json({ users: data.users });
  }

  if (req.method === "POST") {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    // Check domain allowlist
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "allowed_domains")
      .single();
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
    return res.json({ user: data.user });
  }

  res.status(405).json({ error: "Method not allowed" });
}
