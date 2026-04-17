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
