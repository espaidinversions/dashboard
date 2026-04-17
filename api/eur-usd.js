import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  toFiniteNumber,
} from "./_security.js";
import { makeServiceClient, verifyUser } from "./_adminAuth.js";

let cache = { rate: null, fetchedAt: 0 };
const TTL = 60 * 60 * 1000;

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
    if (Date.now() - cache.fetchedAt < TTL && cache.rate) {
      return res.json({ rate: cache.rate, source: "cache" });
    }
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const data = await r.json();
    cache = {
      rate: toFiniteNumber(data?.rates?.USD, { allowNull: false, min: 0.1, max: 10 }),
      fetchedAt: Date.now(),
    };
    res.json({ rate: cache.rate, source: "live" });
  } catch {
    res.json({ rate: 1.08, source: "fallback" });
  }
}
