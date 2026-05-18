const _CAT_MONTHS = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];

export function fmtFull(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("ca-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "€";
}

export function fmtM(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  const a=Math.abs(n);
  if(a>=1e6) return (n/1e6).toFixed(2)+"M€";
  if(a>=1e3) return (n/1e3).toFixed(0)+"K€";
  return n.toFixed(0)+"€";
}

export function fmtSignedM(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const value = Number(n);
  if (value === 0) return fmtM(0);
  return `${value > 0 ? "+" : "-"} ${fmtM(Math.abs(value))}`;
}

function _fmtNativeAbs(n, divisa) {
  const a = Math.abs(n);
  if (divisa === "USD") {
    if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M ${divisa}`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K ${divisa}`;
  return `${n.toFixed(0)} ${divisa}`;
}

export function fmtSignedNative(n, divisa) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const value = Number(n);
  const d = String(divisa ?? "EUR").trim().toUpperCase();
  if (d === "EUR") return fmtSignedM(value);
  if (value === 0) return _fmtNativeAbs(0, d);
  return `${value > 0 ? "+" : "-"} ${_fmtNativeAbs(Math.abs(value), d)}`;
}

export function fmtS(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  const a=Math.abs(n);
  if(a>=1e6) return (n/1e6).toFixed(1)+"M€";
  if(a>=1e3) return (n/1e3).toFixed(0)+"K€";
  return n.toFixed(0)+"€";
}

/** Accepts "YYYY-MM" or "YYYY-MM-DD". */
export function fmtMonth(s) {
  if (!s) return "";
  const parts = s.split("-");
  const y = parts[0], m = parts[1], d = parts[2];
  const label = `${_CAT_MONTHS[+m]} '${y.slice(2)}`;
  return d && +d !== 1 ? `${+d} ${label}` : label;
}

/** Format a "YYYY-MM" month key → e.g. "Mar '26" */
export function fmtMonthKey(v) {
  if (!v) return "";
  return fmtMonth(v.length === 7 ? v + "-01" : v);
}

export function formatIsoDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ca-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatIsoDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ca-ES", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function formatIsoDateDMY(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function formatMultiple(v) {
  return v != null ? `${v.toFixed(2)}×` : "—";
}

export function multipleColor(v, tc) {
  if (v == null) return tc?.textLight ?? "#999";
  if (v < 1) return tc?.red ?? "#C62828";
  if (v < 1.5) return tc?.warning ?? "#7A6000";
  return tc?.green ?? "#1C6B1D";
}

export function slugify(str) {
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function tvpiColor(t) {
  if (t == null) return "#999";
  if (t < 1.0)  return "#C62828";
  if (t < 1.5)  return "#7A6000";
  return "#1C6B1D";
}

export function tvpiBg(t) {
  if (t == null) return "#F5F5F5";
  if (t < 1.0)  return "#FDECEA";
  if (t < 1.5)  return "#FFF8E1";
  return "#E8F8E8";
}

export function calcMesos(iso) {
  if (!iso) return 0;
  const today = new Date();
  const d = new Date(iso);
  return Math.max(0, (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth()));
}

export function mesosColor(m) {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,38%)`;
}

export function mesosBg(m) {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,94%)`;
}

/** Returns the number of years between an ISO date string and a reference date. */
export function yearsHeld(dataCompra, asOf = new Date()) {
  if (!dataCompra) return 0;
  const end = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  return (end - new Date(dataCompra).getTime()) / (365.25 * 24 * 3600 * 1000);
}

/** Annualized CAGR from a total return % and holding years. */
export function cagr(rendPct, yearsHeldVal) {
  if (rendPct == null || yearsHeldVal <= 0) return null;
  return (Math.pow(1 + rendPct / 100, 1 / yearsHeldVal) - 1) * 100;
}

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Money-weighted return (XIRR) for irregular cash flows.
 * Outflows negative, inflows positive. Returns annualized %, or null if unsolvable.
 */
export function xirr(cashFlows, guess = 0.15) {
  const rows = (Array.isArray(cashFlows) ? cashFlows : [])
    .map((row) => ({ amount: Number(row?.amount), date: toValidDate(row?.date) }))
    .filter((row) => Number.isFinite(row.amount) && row.amount !== 0 && row.date);

  if (rows.length < 2) return null;
  if (!rows.some(r => r.amount < 0) || !rows.some(r => r.amount > 0)) return null;

  rows.sort((a, b) => a.date - b.date);
  const start = rows[0].date;
  const yearFrac = (date) => (date.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);

  const npv = (rate) => rows.reduce((s, r) => s + (r.amount / Math.pow(1 + rate, yearFrac(r.date))), 0);
  const dnpv = (rate) => rows.reduce((s, r) => {
    const t = yearFrac(r.date);
    if (t === 0) return s;
    return s - ((t * r.amount) / Math.pow(1 + rate, t + 1));
  }, 0);

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    if (rate <= -0.999999) rate = -0.999999;
    const value = npv(rate);
    if (Math.abs(value) < 1e-7) return rate * 100;
    const deriv = dnpv(rate);
    if (!Number.isFinite(deriv) || Math.abs(deriv) < 1e-10) break;
    const next = rate - (value / deriv);
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-10) return next * 100;
    rate = next;
  }

  let low = -0.9999, high = 10;
  let npvLow = npv(low), npvHigh = npv(high);
  let expand = 0;
  while (npvLow * npvHigh > 0 && expand < 25) { high *= 2; npvHigh = npv(high); expand++; }
  if (npvLow * npvHigh > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const value = npv(mid);
    if (Math.abs(value) < 1e-7) return mid * 100;
    if (npvLow * value <= 0) { high = mid; npvHigh = value; }
    else { low = mid; npvLow = value; }
  }
  return ((low + high) / 2) * 100;
}
