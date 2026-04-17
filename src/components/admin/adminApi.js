import { apiFetchJson } from "../../apiClient.js";

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export async function loadAllowedDomains() {
  const data = await apiFetchJson("/api/admin/settings/allowed-domains");
  return Array.isArray(data?.domains) ? data.domains : [];
}

export async function saveAllowedDomains(domains) {
  const data = await apiFetchJson("/api/admin/settings/allowed-domains", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domains }),
  });
  return Array.isArray(data?.domains) ? data.domains : [];
}

export async function loadAuditLog(params = {}) {
  return apiFetchJson(`/api/admin/audit-log${toQuery(params)}`);
}
