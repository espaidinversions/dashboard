import { supabase } from "./supabase.js";

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
  return fetch(input, { ...init, headers });
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
