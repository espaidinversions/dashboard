export const PROSPECTIVE_CASH_MODES = [
  { id: "calls", label: "Aportacions" },
  { id: "dist", label: "Distribucions" },
  { id: "net", label: "Net CF" },
];

export const PROSPECTIVE_CASH_PERIODS = [
  { id: "closed", label: "Tancat <=2025", color: "green" },
  { id: "current", label: "En curs 2026", color: "yellow" },
  { id: "fwd", label: "Projeccio >2026", color: "muted" },
];

export const EXCLUDED_CASH_MODEL_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);
