import { createClient } from "@supabase/supabase-js";

export const ALLOWED_ROLES = new Set(["user", "superuser", "admin"]);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getRequestIp(req) {
  const candidates = [
    req.headers["cf-connecting-ip"],
    req.headers["x-vercel-forwarded-for"],
    req.headers["x-real-ip"],
    req.socket?.remoteAddress,
  ];
  const ip = candidates.find(Boolean);
  return String(ip ?? "unknown").split(",")[0].trim();
}

export async function verifyAdmin(req, serviceClient) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role;
  if (error || role !== "admin") return null;
  return user;
}

export function isAllowedRole(role) {
  return ALLOWED_ROLES.has(String(role ?? ""));
}

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email ?? "").trim());
}
