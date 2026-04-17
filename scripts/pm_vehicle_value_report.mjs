import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { PM_MODEL } from "../src/data/publicMarketsModel.js";
import { FUND_PRICES } from "../src/generated/prices/fundPrices.js";
import { ALL_PRICE_SERIES, ESTIMATED_PRICE_ISINS } from "../src/data/allPrices.js";
import { buildPmVehicleCoverageReport } from "../src/data/pmVehicleCoverage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT_MD = path.join(ROOT, "docs", "pm-vehicle-value-gap-report.md");
const OUT_JSON = path.join(ROOT, "docs", "pm-vehicle-value-gap-report.json");

const fmtInt = (value) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value ?? 0);

function spanLabel(start, end) {
  if (!start || !end) return "—";
  if (start === end) return start;
  return `${start} → ${end}`;
}

function fmtSpans(spans) {
  if (!spans.length) return "—";
  return spans.map(([start, end]) => {
    const [startYear, startMonth] = start.split("-").map(Number);
    const [endYear, endMonth] = end.split("-").map(Number);
    const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    return `${spanLabel(start, end)} (${months}m)`;
  }).join("; ");
}

function markdownTable(rows) {
  const headers = [
    "Vehicle",
    "ISIN",
    "Estat",
    "Vida",
    "Unitats",
    "Preu",
    "Mesos valor",
    "Mesos vida",
    "Gaps",
    "Notes",
  ];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => ":---").join(" | ")} |`,
  ];
  rows.forEach((row) => {
    const gapText = [
      row.unitSource === "missing" ? "unitats missing" : null,
      row.priceSource === "missing" ? "preu missing" : null,
      row.missingPriceMonths.length ? `preu: ${fmtSpans(row.missingPriceMonths)}` : null,
    ].filter(Boolean).join(" · ") || "—";
    lines.push(`| ${[
      row.name,
      `\`${row.isin}\``,
      row.status,
      spanLabel(row.startMonth, row.endMonth),
      row.unitSource,
      row.priceSource,
      fmtInt(row.valueMonths),
      fmtInt(row.lifecycleMonths),
      gapText,
      row.notes.length ? row.notes.join(" · ") : "—",
    ].join(" | ")} |`);
  });
  return lines.join("\n");
}

function main() {
  const { reportEndMonth, summary, rows, actionableGaps, closedPlaceholders } = buildPmVehicleCoverageReport({
    pmModel: PM_MODEL,
    allPriceSeries: ALL_PRICE_SERIES,
    fundPrices: FUND_PRICES,
    estimatedPriceIsins: ESTIMATED_PRICE_ISINS,
  });

  const report = [
    "# PM Vehicle Value Coverage Report",
    "",
    `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
    "**Goal:** reconstruct each vehicle as `unitats x preu` from 2019-01 or acquisition date until sale or today, and expose where either units or price coverage is missing.",
    "",
    "## Summary",
    "",
    `- Vehicles tracked: ${summary.total}`,
    `- Vehicles with price series: ${summary.withPrice}/${summary.total}`,
    `- Vehicles with reconstructable unit series: ${summary.withUnits}/${summary.total}`,
    `- Closed placeholders isolated: ${closedPlaceholders.length}/${summary.total}`,
    `- Fully covered vehicles: ${summary.fullCoverage}/${summary.total}`,
    `- Vehicles with any actionable gap: ${actionableGaps.length}/${summary.total}`,
    `- Total lifecycle months: ${fmtInt(summary.totalLifecycle)}`,
    `- Total value-covered months: ${fmtInt(summary.totalValueMonths)}`,
    "",
    "## Gap Report",
    "",
    markdownTable(actionableGaps.length ? actionableGaps : rows),
    "",
    "## Closed Placeholders",
    "",
    closedPlaceholders.length ? markdownTable(closedPlaceholders) : "_None_",
    "",
    "## Notes",
    "",
    "- `Unitats` means we can reconstruct a month-end unit series from transactions, or from active tranches when transactions are missing.",
    "- `Preu` comes from `src/generated/prices/fundPrices.js`.",
    "- `Mesos valor` counts months where both units and price exist and the position is actually held.",
    "- `Gaps` only lists contiguous missing spans; months between separate holding intervals are not treated as gaps.",
    "",
  ].join("\n");

  const json = {
    generatedAt: new Date().toISOString(),
    reportEndMonth,
    summary,
    rows,
    actionableGaps,
    closedPlaceholders,
  };

  fs.writeFileSync(OUT_MD, report, "utf8");
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2), "utf8");

  console.log(`Wrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Vehicles: ${summary.total}`);
  console.log(`Full coverage: ${summary.fullCoverage}/${summary.total}`);
  console.log(`Actionable gaps: ${actionableGaps.length}/${summary.total}`);
  console.log(`Closed placeholders: ${closedPlaceholders.length}/${summary.total}`);
}

main();
