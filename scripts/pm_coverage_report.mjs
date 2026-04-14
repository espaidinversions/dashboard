import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { PM_MODEL_GENERATED } from "../src/generated/publicMarkets/publicMarketsModel.generated.js";
import { FUND_PRICES } from "../src/generated/prices/fundPrices.js";
import { ALL_PRICE_SERIES, ESTIMATED_PRICE_ISINS } from "../src/data/allPrices.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "pm-coverage-report.md");

const PM_POSITIONS     = PM_MODEL_GENERATED.holdings.active;
const PM_CLOSED        = PM_MODEL_GENERATED.holdings.closed;
const PM_POSITIONS_RAW = PM_MODEL_GENERATED.holdings.activeRaw;
const PM_TRANSACTIONS  = PM_MODEL_GENERATED.activity.transactions;

const ISIN_RE = /([A-Z]{2}[A-Z0-9]{10})/;
const cleanIsin = raw => (ISIN_RE.exec(String(raw ?? "").toUpperCase())?.[1]) ?? null;

const hasCsv = (dir, isin) => fs.existsSync(path.join(ROOT, "Mercats Públics", dir, `${isin}.csv`));

function sourceStrategy(isin) {
  if (!isin) return "manual / static";
  if (ESTIMATED_PRICE_ISINS.has(isin)) return "Estimated bond";
  if (hasCsv("prices", isin)) return "ETF/market";
  if (hasCsv("fund_prices", isin)) return "Morningstar";
  if (hasCsv("wam_prices", isin)) return "WAM PDF";
  return "manual / static";
}

function uniqBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function groupCount(items, keyFn) {
  const out = new Map();
  for (const item of items) {
    const key = keyFn(item);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

const activeRows = uniqBy(
  PM_POSITIONS
    .map(p => ({ ...p, isin: cleanIsin(p.isin) }))
    .filter(p => p.isin),
  p => `${p.isin}|${p.custodian ?? ""}`,
);

const closedRows = uniqBy(
  PM_CLOSED
    .map(p => ({ ...p, isin: cleanIsin(p.isin) }))
    .filter(p => p.isin),
  p => `${p.isin}|${p.any ?? ""}`,
);

const activeBySource = groupCount(activeRows, p => sourceStrategy(p.isin));
const closedBySource = groupCount(closedRows, p => sourceStrategy(p.isin));

const activePriceCovered = activeRows.filter(p => ALL_PRICE_SERIES[p.isin]).length;
const closedPriceCovered = closedRows.filter(p => ALL_PRICE_SERIES[p.isin]).length;

const activeValueCovered = activeRows.filter(p => p.valorMercat != null || p.costEur != null).length;
const closedValueCovered = closedRows.filter(p => p.valorMercat != null || p.costEur != null).length;

const activeCustodianCovered = activeRows.filter(p => !!p.custodian).length;

const closedAttribution = closedRows.map(p => {
  const directCustodian = p.custodian ?? null;
  const txBuy = PM_TRANSACTIONS.find(t => cleanIsin(t.isin) === p.isin && t.action === "buy");
  const txAny = txBuy ?? PM_TRANSACTIONS.find(t => cleanIsin(t.isin) === p.isin);
  const derivedCustodian = txBuy?.custodian ?? txAny?.custodian ?? null;
  const custodian = directCustodian ?? derivedCustodian;
  const gestor = p.gestor ?? txAny?.gestor ?? null;
  const strategy = p.tipus ?? txAny?.tipus ?? "—";
  const source = sourceStrategy(p.isin);
  return { ...p, custodian, gestor, strategy, source, attribution: directCustodian ? "direct" : (derivedCustodian ? "ledger" : "missing") };
});

const directCustodian = closedAttribution.filter(r => r.attribution === "direct").length;
const ledgerCustodian = closedAttribution.filter(r => r.attribution === "ledger").length;
const missingCustodian = closedAttribution.filter(r => r.attribution === "missing").length;

const unresolved = closedAttribution.filter(r => r.source === "manual / static");

function fmtPct(n, d) {
  return d > 0 ? `${(n / d * 100).toFixed(1)}%` : "—";
}

function rowTable(rows, headers, mapper) {
  const lines = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => ":---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${mapper(row).join(" | ")} |`);
  return lines.join("\n");
}

const totalActive = activeRows.length;
const totalClosed = closedRows.length;

const sourceSummary = [
  { label: "ETF / market", active: activeBySource.get("ETF/market") ?? 0, closed: closedBySource.get("ETF/market") ?? 0 },
  { label: "Morningstar", active: activeBySource.get("Morningstar") ?? 0, closed: closedBySource.get("Morningstar") ?? 0 },
  { label: "WAM PDF", active: activeBySource.get("WAM PDF") ?? 0, closed: closedBySource.get("WAM PDF") ?? 0 },
  { label: "Estimated bond", active: activeBySource.get("Estimated bond") ?? 0, closed: closedBySource.get("Estimated bond") ?? 0 },
  { label: "Manual / static", active: activeBySource.get("manual / static") ?? 0, closed: closedBySource.get("manual / static") ?? 0 },
];

const report = [
  "# PM Vehicle Data Coverage Report",
  "",
  `**Updated:** ${new Date().toISOString().slice(0, 10)}`,
  "**Scope:** current public-market vehicle rows, historical closed rows, price series, current value coverage, one-pager coverage, and custodian/strategy attribution.",
  "",
  "## Summary",
  "",
  `- Raw source rows: ${PM_POSITIONS_RAW.length} active tranches, ${PM_CLOSED.length} closed rows`,
  `- Deduped report rows: ${totalActive} active instrument keys, ${totalClosed} closed historical rows`,
  `- One-pagers: available for all active and closed rows via the shared detail route`,
  "",
  "| Bucket | Rows | Price series | Current value | Custodian attribution | Strategy attribution |",
  "| :--- | :---: | :---: | :---: | :---: | :---: |",
  `| Active rows | ${totalActive} | ${activePriceCovered}/${totalActive} | ${activeValueCovered}/${totalActive} | ${activeCustodianCovered}/${totalActive} | ${totalActive}/${totalActive} |`,
  `| Closed rows | ${totalClosed} | ${closedPriceCovered}/${totalClosed} | ${closedValueCovered}/${totalClosed} | ${directCustodian + ledgerCustodian}/${totalClosed} | ${totalClosed}/${totalClosed} |`,
  `| Total | ${totalActive + totalClosed} | ${(activePriceCovered + closedPriceCovered)}/${totalActive + totalClosed} | ${(activeValueCovered + closedValueCovered)}/${totalActive + totalClosed} | ${(activeCustodianCovered + directCustodian + ledgerCustodian)}/${totalActive + totalClosed} | ${(totalActive + totalClosed)}/${totalActive + totalClosed} |`,
  "",
  "## Data Strategy Coverage",
  "",
  "| Source strategy | Active rows | Closed rows | Notes |",
  "| :--- | :---: | :---: | :--- |",
  ...sourceSummary.map(s => `| ${s.label} | ${s.active} | ${s.closed} | ${s.label === "Manual / static" ? "Legacy rows without a public price feed" : "Fully covered"} |`),
  "",
  "## Custodian Attribution",
  "",
  `- Active rows with direct custodian attribution: ${activeCustodianCovered}/${totalActive}`,
  `- Closed rows with direct custodian attribution: ${directCustodian}/${totalClosed}`,
  `- Closed rows with custodian derived from the transaction ledger: ${ledgerCustodian}/${totalClosed}`,
  `- Closed rows still missing a deterministic custodian: ${missingCustodian}/${totalClosed}`,
  "",
  "## Unresolved Price-Series Gaps",
  "",
  "These are the closed rows that still have no public price history and remain on manual/static valuation paths.",
  "",
  rowTable(
    unresolved,
    ["Year", "Vehicle", "ISIN", "Custodian", "Strategy", "Source path"],
    r => [
      String(r.any ?? "—"),
      r.nom ? `\`${r.nom}\`` : "—",
      `\`${r.isin}\``,
      r.custodian ?? "—",
      r.strategy ?? "—",
      r.source,
    ],
  ),
  "",
  "## Notes",
  "",
  `- \`price series\` means an external historical CSV exists in \`Mercats Públics/prices\`, \`Mercats Públics/fund_prices\`, or \`Mercats Públics/wam_prices\` and is imported into \`src/generated/prices/fundPrices.js\`; ${ESTIMATED_PRICE_ISINS.size} additional bond ISINs are now covered by an explicit estimated series.`,
  "- `current value` means the vehicle has a current valuation in the public-market data model, even when there is no public history feed.",
  "- The closed ledger still has legacy rows where custodian attribution cannot be reconstructed from the transaction history alone.",
  "",
].join("\n");

fs.writeFileSync(OUT, report, "utf8");
console.log(`Wrote ${OUT}`);
console.log(`Active price coverage: ${activePriceCovered}/${totalActive}`);
console.log(`Closed price coverage: ${closedPriceCovered}/${totalClosed}`);
console.log(`Closed custodian attribution: ${directCustodian + ledgerCustodian}/${totalClosed}`);
