import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getLatestDataVersion } from "../api/_dataVersion.js";

test("getLatestDataVersion includes nested src/data files", async () => {
  const root = mkdtempSync(join(tmpdir(), "tc-data-version-"));
  const nested = join(root, "nested");
  mkdirSync(nested);

  writeFileSync(join(root, "alpha.js"), "export const alpha = 1;\n");
  await new Promise(resolve => setTimeout(resolve, 20));
  writeFileSync(join(nested, "beta.json"), "{\"ok\":true}\n");

  const latest = getLatestDataVersion(root);
  assert.ok(Number.isFinite(latest));
  assert.equal(latest, getLatestDataVersion(root));
});
