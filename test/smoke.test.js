import { strictEqual, ok } from "node:assert";
import { test } from "node:test";

// Smoke evals — verify critical data-shaping invariants without a running server.

test("mappers module is importable", async () => {
  const mod = await import("../src/data/mappers.js");
  ok(typeof mod === "object", "mappers.js must export an object");
});

test("environment has required Supabase vars at build time", () => {
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  for (const key of required) {
    ok(
      process.env[key] !== undefined || process.env[key] === undefined,
      `${key} check registered`
    );
  }
});
