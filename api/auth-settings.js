import { createClient } from "@supabase/supabase-js";
import { setCors } from "./_cors.js";

function makeServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = makeServiceClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "allowed_domains")
      .maybeSingle();
    if (error) throw error;
    const allowed_domains = Array.isArray(data?.value) ? data.value : [];
    return res.json({ allowed_domains });
  } catch (e) {
    console.error("[auth-settings] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
