export function searcherKey(row) {
  return row?.id ?? row?.nom ?? null;
}

export function splitSearcherNames(value) {
  const parts = String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    searcher1: parts[0] ?? null,
    searcher2: parts[1] ?? null,
  };
}

export function splitSchoolNames(value) {
  const parts = String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    escola1: parts[0] ?? null,
    escola2: parts[1] ?? null,
  };
}

export function toggleActiveFilter(currentValue, nextValue) {
  if (!nextValue || nextValue === "Tots") return "Tots";
  return currentValue === nextValue ? "Tots" : nextValue;
}

export function sankeyNodeToEntry(nodeId) {
  if (nodeId === "Searchers") return "Search Capital";
  if (nodeId === "Equity Gap") return "Equity Gap";
  return null;
}

export function formatPercent(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

export function formatEquityStake(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
}
