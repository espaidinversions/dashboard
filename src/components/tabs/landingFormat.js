export const EUR_FMT = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 });

export function formatEur(n) {
  const value = Number(n);
  return `${EUR_FMT.format(Number.isFinite(value) ? value : 0)} €`;
}
