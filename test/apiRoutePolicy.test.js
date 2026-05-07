import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SERVER_SOURCE = readFileSync(join(process.cwd(), "server.js"), "utf-8");

test("server api routes declare explicit guard policies", () => {
  const expectedPolicies = new Map([
    ["/api/pipeline", 'withGuard({ auth: "admin"'],
    ["/api/capital-calls", 'withGuard({ auth: "admin"'],
    ["/api/eur-usd", 'withGuard({ auth: "user"'],
    ["/api/auth-settings", 'withGuard({ auth: "none"'],
    ["/api/data-version", 'withGuard({ auth: "user"'],
    ["/api/admin/users", 'withGuard({ auth: "admin-only"'],
    ["/api/admin/users/:id", 'withGuard({ auth: "admin-only"'],
    ["/api/admin/settings/allowed-domains", 'withGuard({ auth: "admin-only"'],
    ["/api/admin/audit-log", 'withGuard({ auth: "admin-only"'],
    ["/api/board", 'withGuard({ auth: "user"'],
  ]);

  for (const [route, guardSnippet] of expectedPolicies.entries()) {
    const routeIndex = SERVER_SOURCE.indexOf(`"${route}"`);
    assert.notEqual(routeIndex, -1, `Route ${route} not found`);
    const searchWindow = SERVER_SOURCE.slice(Math.max(routeIndex - 120, 0), routeIndex + 120);
    assert.match(searchWindow, new RegExp(guardSnippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
