import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = new Set(["user", "superuser", "admin"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    req.headers["x-forwarded-for"],
    req.headers["x-real-ip"],
    req.socket?.remoteAddress,
  ];
  const ip = candidates.find(Boolean);
  return String(ip ?? "unknown").split(",")[0].trim();
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
}

export function getUserRole(user) {
  return user?.app_metadata?.role ?? "user";
}

export async function verifyUser(req, serviceClient) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function verifyAdmin(req, serviceClient) {
  const user = await verifyUser(req, serviceClient);
  if (!user) return null;
  return getUserRole(user) === "admin" ? user : null;
}

export function isAllowedRole(role) {
  return ALLOWED_ROLES.has(String(role ?? ""));
}

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email ?? "").trim());
}
