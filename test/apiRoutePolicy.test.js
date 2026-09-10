import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Route-policy guardrail for the Vercel serverless `api/` layer.
//
// Replaces the old server.js-based test (removed with the Express backend).
// Instead of asserting middleware wiring on a single router, it scans each
// serverless handler's source and asserts the security policy it must declare:
//   - every admin handler enforces admin-tier auth AND a privileged rate-limit bucket
//   - the public `api/app.js` dispatcher declares an explicit bucket per route
//   - the privileged buckets are configured fail-closed
//
// A new admin route added without a guard, or a public route without an
// explicit bucket, fails this test — which is the point.

const API_DIR = join(process.cwd(), "api");

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

const ADMIN_DIR = join(API_DIR, "admin");
const ADMIN_HANDLERS = listJsFiles(ADMIN_DIR);

// Handlers that intentionally authenticate + role-gate (verifyUser + role check)
// instead of being strictly admin-only. New admin routes are admin-only by
// default; adding one here must be a deliberate, reviewed decision.
const ROLE_GATED_ADMIN_HANDLERS = new Set(["user-permissions.js"]);

function basename(file) {
  return file.split(/[\\/]/).pop();
}

test("every admin serverless handler authenticates the caller", () => {
  assert.ok(ADMIN_HANDLERS.length > 0, "expected admin handlers under api/admin");
  for (const file of ADMIN_HANDLERS) {
    const source = readFileSync(file, "utf-8");
    assert.match(
      source,
      /verifyAdminOnly\s*\(|verifyAdmin\s*\(|verifyUser\s*\(/,
      `${file} must authenticate via verifyAdminOnly/verifyAdmin/verifyUser`,
    );
  }
});

test("admin serverless handlers are admin-only unless explicitly role-gated", () => {
  for (const file of ADMIN_HANDLERS) {
    if (ROLE_GATED_ADMIN_HANDLERS.has(basename(file))) continue;
    const source = readFileSync(file, "utf-8");
    assert.match(
      source,
      /verifyAdminOnly\s*\(|verifyAdmin\s*\(/,
      `${file} must guard with verifyAdminOnly/verifyAdmin (or be added to ROLE_GATED_ADMIN_HANDLERS with review)`,
    );
  }
});

test("every admin serverless handler enforces a privileged rate-limit bucket", () => {
  for (const file of ADMIN_HANDLERS) {
    const source = readFileSync(file, "utf-8");
    assert.match(
      source,
      /enforceRateLimit\(\s*req,\s*res,\s*"(admin|sensitive)"/,
      `${file} must enforceRateLimit with an "admin" or "sensitive" bucket`,
    );
  }
});

test("api/app.js declares an explicit rate-limit bucket per public route", () => {
  const source = readFileSync(join(API_DIR, "app.js"), "utf-8");

  // route name -> required rate-limit bucket (the declared policy)
  const expectedBuckets = new Map([
    ["auth-settings", "auth"],
    ["board", "public"],
    ["data-version", "public"],
    ["eur-usd", "public"],
    ["fx-rate", "public"],
    ["searchers", "sensitive"],
    ["pipeline", "sensitive"],
    ["vehicles", "sensitive"],
    ["companies", "sensitive"],
    ["merge-entity", "sensitive"],
  ]);

  for (const [route, bucket] of expectedBuckets) {
    const marker = `route === "${route}"`;
    const routeIndex = source.indexOf(marker);
    assert.notEqual(routeIndex, -1, `Route "${route}" not found in api/app.js`);
    // Look at the dispatch block immediately after the route match.
    const window = source.slice(routeIndex, routeIndex + 220);
    assert.match(
      window,
      new RegExp(`enforceRateLimit\\(\\s*req,\\s*res,\\s*"${bucket}"`),
      `Route "${route}" must enforce the "${bucket}" rate-limit bucket`,
    );
  }
});

test("privileged rate-limit buckets are configured fail-closed", () => {
  const source = readFileSync(join(API_DIR, "_rateLimit.js"), "utf-8");
  const match = source.match(/FAIL_CLOSED_BUCKETS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  assert.ok(match, "FAIL_CLOSED_BUCKETS set not found in _rateLimit.js");
  const contents = match[1];
  assert.match(contents, /"sensitive"/, '"sensitive" must be fail-closed');
  assert.match(contents, /"admin"/, '"admin" must be fail-closed');
});
