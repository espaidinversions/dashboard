import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

function collectDataFiles(rootDir, baseDir = rootDir) {
  if (!existsSync(baseDir)) return [];
  const files = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDataFiles(rootDir, fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(js|json|csv)$/i.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

export function getLatestDataVersion(srcDataDir) {
  return collectDataFiles(srcDataDir).reduce((latest, filePath) => {
    return Math.max(latest, statSync(filePath).mtimeMs);
  }, 0);
}
