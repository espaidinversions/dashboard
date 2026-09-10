import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf-8"));
const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
const redirects = Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : [];

// The app is reverse-proxied at espaidinversions.com/dashboard, so every route
// (assets, API, SPA fallback) is served under the /dashboard/ prefix. Vite base
// ("/dashboard/") and these rewrites must stay in lockstep, or assets/API break.
const BASE = "/dashboard";

test("vercel preserves api routes before the SPA fallback", () => {
  const apiRewriteIndex = rewrites.findIndex(
    (entry) => entry?.source === `${BASE}/api/(.*)` && entry?.destination === "/api/$1",
  );
  assert.notEqual(apiRewriteIndex, -1, `Missing ${BASE}/api passthrough rewrite`);

  const spaFallbackIndex = rewrites.findIndex(
    (entry) => entry?.source === `${BASE}/(.*)` && entry?.destination === "/index.html",
  );
  assert.notEqual(spaFallbackIndex, -1, "Missing SPA fallback rewrite");

  assert.ok(
    apiRewriteIndex < spaFallbackIndex,
    "API passthrough must be declared before the SPA fallback",
  );
});

test("vercel serves the SPA under the /dashboard base path", () => {
  // Asset passthrough must exist and precede the SPA fallback, otherwise
  // /dashboard/assets/*.js would resolve to index.html and the app won't boot.
  const assetIndex = rewrites.findIndex(
    (entry) => entry?.source === `${BASE}/assets/(.*)` && entry?.destination === "/assets/$1",
  );
  assert.notEqual(assetIndex, -1, `Missing ${BASE}/assets passthrough rewrite`);

  const spaFallbackIndex = rewrites.findIndex(
    (entry) => entry?.source === `${BASE}/(.*)` && entry?.destination === "/index.html",
  );
  assert.ok(
    assetIndex < spaFallbackIndex,
    "Asset passthrough must be declared before the SPA fallback",
  );
});

test("vercel redirects the bare root to the /dashboard base path", () => {
  const rootRedirect = redirects.find((entry) => entry?.source === "/");
  assert.ok(rootRedirect, "Missing root redirect");
  assert.equal(
    rootRedirect.destination,
    `${BASE}/`,
    "Root must redirect to the /dashboard base so the bare deployment URL still works",
  );
});
