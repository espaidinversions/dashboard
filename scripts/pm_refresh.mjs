import { spawnSync } from "child_process";

const steps = [
  {
    label: "Parse bank movements PDF",
    command: "python",
    args: ["-m", "scripts.parse_bank_movements_pdf"],
  },
  {
    label: "Regenerate workbook overlay and PM audit",
    command: "node",
    args: ["scripts/pm_autoresearch.mjs"],
  },
  {
    label: "Regenerate PM transactions",
    command: "python",
    args: ["-m", "scripts.transactions_export_js"],
  },
  {
    label: "Rebuild PM portfolio values CSV",
    command: "python",
    args: ["-m", "scripts.portfolio_build_values"],
  },
  {
    label: "Export PM portfolio values JS",
    command: "python",
    args: ["-m", "scripts.portfolio_export_js"],
  },
  {
    label: "Export canonical PM model JS",
    command: "node",
    args: ["scripts/pm_model_export_js.mjs"],
  },
  {
    label: "Refresh PM vehicle value coverage report",
    command: "node",
    args: ["scripts/pm_vehicle_value_report.mjs"],
  },
];

for (const step of steps) {
  console.log(`\n==> ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPM refresh completed.");
