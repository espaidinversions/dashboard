#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

function emit(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
}

function main() {
  const raw = fs.readFileSync(0, "utf8");
  if (!raw.trim()) return;

  const payload = JSON.parse(raw);
  const toolInput = payload.tool_input || {};
  const cwd = payload.cwd || process.cwd();
  const filePath = toolInput.file_path || toolInput.path;
  if (!filePath) return;

  const resolved = path.resolve(cwd, filePath);
  const normalized = normalizePath(resolved);
  const migrationPrefix = normalizePath(path.resolve(cwd, "supabase/migrations")) + "/";
  const protectedPrefixes = [
    normalizePath(path.resolve(cwd, "node_modules")) + "/",
    normalizePath(path.resolve(cwd, "dist")) + "/",
    normalizePath(path.resolve(cwd, ".vercel")) + "/",
    normalizePath(path.resolve(cwd, ".git")) + "/",
  ];

  if (protectedPrefixes.some(prefix => normalized.startsWith(prefix))) {
    emit("deny", "This path is generated or tool-managed. Edit source files instead.");
    return;
  }

  if (normalized.startsWith(migrationPrefix) && fs.existsSync(resolved)) {
    emit("deny", "Existing Supabase migrations are immutable. Create a new migration file instead.");
  }
}

main();
