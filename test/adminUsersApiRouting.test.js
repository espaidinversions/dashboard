import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/components/admin/AdminUsers.jsx"), "utf-8");

test("admin user mutations use the collection endpoint with a query id", () => {
  assert.match(source, /const userEndpoint = \(id\) => `\/api\/admin\/users\?id=\$\{encodeURIComponent\(id\)\}`;/);
  assert.doesNotMatch(source, /\/api\/admin\/users\/\$\{id\}/);
});
