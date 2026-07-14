import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");

function collectFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(js|jsx)$/i.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

test("frontend source contains no console.log statements", () => {
  const offenders = collectFiles(SRC_ROOT).filter(filePath => {
    const source = readFileSync(filePath, "utf-8");
    return /\bconsole\.log\s*\(/.test(source);
  });

  assert.deepEqual(offenders, []);
});

test("filter-bearing index tables keep the table (and its column filters) mounted when empty", () => {
  // Regression: when a per-column filter matched zero rows, these tables replaced the
  // whole <table> (header + filter inputs) with a standalone <div>Cap resultat</div>,
  // so the user could no longer see or clear the filter that emptied the list — the
  // table appeared to "disappear". The empty state must live inside <tbody> as a
  // colSpan row so the header and filters stay visible.
  const tableIndexes = ["FundsIndex.jsx", "CompaniesIndex.jsx", "SearchersIndex.jsx"];
  const offenders = [];
  for (const name of tableIndexes) {
    const source = readFileSync(join(SRC_ROOT, "components", name), "utf-8");
    if (source.includes("Cap resultat</div>")) offenders.push(`${name}: standalone <div> empty state`);
    if (!/colSpan=\{[^}]*\}[^>]*>Cap resultat<\/td>/.test(source)) {
      offenders.push(`${name}: missing in-table colSpan empty row`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("frontend source contains no obvious secret or service-role tokens", () => {
  const secretPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/,
    /\bservice_role\b/i,
    /\bsk_(live|test)_[a-z0-9]+/i,
    /\bpostgres(?:ql)?:\/\/[^"'`\s]+/i,
  ];

  const offenders = [];
  for (const filePath of collectFiles(SRC_ROOT)) {
    const source = readFileSync(filePath, "utf-8");
    if (secretPatterns.some(pattern => pattern.test(source))) {
      offenders.push(filePath);
    }
  }

  assert.deepEqual(offenders, []);
});
