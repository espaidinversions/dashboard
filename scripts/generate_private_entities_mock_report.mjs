import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RAW_CC } from "../src/data/capital-calls.js";
import { PORTFOLIO_COMPANIES } from "../src/data/searchers.js";
import { resolvePrivateEntity } from "../src/data/privateEntities.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_PATH = path.resolve(__dirname, "../docs/private-entities-mock-ids.json");
const MD_PATH = path.resolve(__dirname, "../docs/private-entities-mock-ids.md");

function uniqueById(rows) {
  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

const vehicles = uniqueById(
  [...new Set(RAW_CC.map((row) => row.fons))]
    .map((name) => ({ name, ...resolvePrivateEntity("vehicle", name) }))
    .filter((row) => row.matchType === "fallback"),
);

const companies = uniqueById(
  PORTFOLIO_COMPANIES
    .map((row) => ({ name: row.nom, ...resolvePrivateEntity("company", row.nom) }))
    .filter((row) => row.matchType === "fallback"),
);

const payload = {
  generatedAt: new Date().toISOString(),
  counts: {
    companies: companies.length,
    vehicles: vehicles.length,
    total: companies.length + vehicles.length,
  },
  companies,
  vehicles,
};

const markdown = `# Private Entity Mock IDs

Generated at: \`${payload.generatedAt}\`

## Summary

- Companies: \`${companies.length}\`
- Vehicles: \`${vehicles.length}\`
- Total mock IDs: \`${payload.counts.total}\`

## Companies

${companies.map((row) => `- \`${row.id}\` → ${row.name}`).join("\n")}

## Vehicles

${vehicles.map((row) => `- \`${row.id}\` → ${row.name}`).join("\n")}
`;

fs.writeFileSync(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(MD_PATH, `${markdown}\n`, "utf8");
