import { supabase } from "./supabase.js";

// The app is served under import.meta.env.BASE_URL ("/dashboard/" in production,
// "/" in dev). API calls are written as absolute "/api/..." paths; prefix them
// with the base so they resolve under the same path the reverse proxy forwards
// (espaidinversions.com/dashboard/api/* -> Vercel), not the bare WordPress root.
const API_PREFIX = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Resolve an absolute-from-root "/api/..." path to the app's base path.
 * Non-/api inputs (or non-string inputs like Request) pass through unchanged.
 * @param {string | Request} input
 * @returns {string | Request}
 */
export function apiUrl(input) {
  return typeof input === "string" && input.startsWith("/api/")
    ? `${API_PREFIX}${input}`
    : input;
}

async function getAccessToken() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

async function apiFetch(input, init = {}, { auth = "required" } = {}) {
  const headers = new Headers(init.headers ?? {});
  if (auth !== "none") {
    const token = await getAccessToken();
    if (!token) throw new Error("Authentication required");
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(apiUrl(input), { ...init, headers });
}

export async function apiFetchJson(input, init = {}, options = {}) {
  const response = await apiFetch(input, init, options);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}
