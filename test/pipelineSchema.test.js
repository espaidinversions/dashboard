import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("pipeline schema and save path preserve estimated closing", () => {
  const dbSource = readFileSync(join(process.cwd(), "src", "db", "pipeline.js"), "utf-8");
  const schemaSource = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf-8");

  assert.match(dbSource, /estimated_closing:\s*r\.estimatedClosing\s*\?\?\s*null/);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS pipeline[\s\S]*estimated_closing TEXT/i);
});
