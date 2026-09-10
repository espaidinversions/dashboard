import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf-8"));
const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];

test("vercel preserves api routes before the SPA fallback", () => {
  const apiRewriteIndex = rewrites.findIndex(
    (entry) => entry?.source === "/api/(.*)" && entry?.destination === "/api/$1",
  );
  assert.notEqual(apiRewriteIndex, -1, "Missing /api passthrough rewrite");

  const spaFallbackIndex = rewrites.findIndex(
    (entry) => entry?.source === "/(.*)" && entry?.destination === "/index.html",
  );
  assert.notEqual(spaFallbackIndex, -1, "Missing SPA fallback rewrite");

  assert.ok(
    apiRewriteIndex < spaFallbackIndex,
    "API passthrough must be declared before the SPA fallback",
  );
});
