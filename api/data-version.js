import { join } from "path";
import { getLatestDataVersion } from "./_dataVersion.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from "./_security.js";
import { makeServiceClient, verifyUser } from "./_adminAuth.js";

const SRC_DATA = join(process.cwd(), "src", "data");

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!await enforceRateLimit(req, res, "public")) return;

  try {
    const user = await verifyUser(req, makeServiceClient());
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ version: getLatestDataVersion(SRC_DATA) });
  } catch (error) {
    console.error("[data-version] error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
