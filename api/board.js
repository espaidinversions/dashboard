import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { makeServiceClient, verifyUser } from "./_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from "./_security.js";

const CANVAS_FILE = join(process.cwd(), "Dashboard.canvas");

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  if (!await enforceRateLimit(req, res, "public")) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await verifyUser(req, makeServiceClient());
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!existsSync(CANVAS_FILE)) {
      return res.status(404).json({ error: "Canvas not found" });
    }
    const raw = readFileSync(CANVAS_FILE, "utf-8");
    const canvas = JSON.parse(raw);
    return res.json({ nodes: canvas.nodes || [], edges: canvas.edges || [] });
  } catch (error) {
    console.error("[board] error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
