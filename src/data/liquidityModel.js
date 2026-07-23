// Cross-section liquidity summary. Accounts are cash/bank positions, each tagged
// to a portfolio section, with a EUR balance (`saldo`) and optional native balance.

export const LIQUIDITY_SECTIONS = ["alternatives", "real-estate", "mercats-publics"];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {Array} accounts - liquidity accounts ({ section, saldo, ... }).
 * @param {{ section?: string }} [options] - when set, total/byAccount are scoped
 *   to that section. `bySection` is always the full breakdown across all sections.
 * @returns {{ total: number, byAccount: Array, bySection: Record<string, number> }}
 */
export function buildLiquiditySummary(accounts, { section } = {}) {
  const all = Array.isArray(accounts) ? accounts : [];
  const scoped = section ? all.filter((a) => a?.section === section) : all;

  const total = scoped.reduce((sum, a) => sum + toNumber(a?.saldo), 0);

  const byAccount = [...scoped].sort((a, b) => toNumber(b?.saldo) - toNumber(a?.saldo));

  const bySection = { alternatives: 0, "real-estate": 0, "mercats-publics": 0 };
  for (const account of all) {
    if (account?.section in bySection) bySection[account.section] += toNumber(account.saldo);
  }

  return { total, byAccount, bySection };
}

/**
 * Groups liquidity by bank, summing EUR `saldo`. Accounts with a falsy `banc`
 * fall under a stable "—" label.
 * @param {Array} accounts
 * @returns {Array<{ banc: string, total: number }>} sorted by total descending.
 */
export function buildLiquidityByBank(accounts) {
  const all = Array.isArray(accounts) ? accounts : [];
  const totals = new Map();
  for (const account of all) {
    const banc = account?.banc || "—";
    totals.set(banc, (totals.get(banc) ?? 0) + toNumber(account?.saldo));
  }
  return [...totals.entries()]
    .map(([banc, total]) => ({ banc, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Groups liquidity by currency, summing the EUR-equivalent `saldo` per `divisa`
 * (so USD-denominated cash is still expressed in EUR). Missing `divisa`
 * defaults to "EUR".
 * @param {Array} accounts
 * @returns {Array<{ divisa: string, total: number }>} sorted by total descending.
 */
export function buildLiquidityByCurrency(accounts) {
  const all = Array.isArray(accounts) ? accounts : [];
  const totals = new Map();
  for (const account of all) {
    const divisa = account?.divisa || "EUR";
    totals.set(divisa, (totals.get(divisa) ?? 0) + toNumber(account?.saldo));
  }
  return [...totals.entries()]
    .map(([divisa, total]) => ({ divisa, total }))
    .sort((a, b) => b.total - a.total);
}

function monthKey(dateStr) {
  return String(dateStr).slice(0, 7); // YYYY-MM
}

/**
 * Latest balance per registry account, projected into the existing account
 * shape so snapshot consumers need no changes.
 * @param {Array} registry - [{ id, nom, banc, section, divisa }]
 * @param {Array} balances - [{ accountId, data, saldo, saldoNative }]
 */
export function buildLatestAccounts(registry, balances) {
  const accts = Array.isArray(registry) ? registry : [];
  const rows = Array.isArray(balances) ? balances : [];

  const latest = new Map(); // accountId → balance with max data
  for (const b of rows) {
    if (b?.accountId == null || !b?.data) continue;
    const prev = latest.get(b.accountId);
    if (!prev || b.data > prev.data) latest.set(b.accountId, b);
  }

  return accts.map((a) => {
    const b = latest.get(a.id);
    return {
      id: a.id,
      nom: a.nom ?? "",
      banc: a.banc ?? null,
      section: a.section,
      saldo: b ? toNumber(b.saldo) : 0,
      saldoNative: b && b.saldoNative != null ? toNumber(b.saldoNative) : null,
      divisa: a.divisa ?? "EUR",
      data: b ? b.data : null,
    };
  });
}

/**
 * Cash-over-time by section for a stacked-area chart. Months are the sorted
 * unique YYYY-MM buckets present in the data; each section's value at a month
 * is the sum of its accounts' latest balance as-of ≤ that month (carry-forward).
 * @returns {{ months: string[], series: Array<{ section: string, values: number[] }> }}
 */
export function buildLiquidityTrend(registry, balances) {
  const accts = Array.isArray(registry) ? registry : [];
  const rows = (Array.isArray(balances) ? balances : []).filter((b) => b?.data && b.accountId != null);
  if (rows.length === 0) return { months: [], series: [] };

  const months = [...new Set(rows.map((b) => monthKey(b.data)))].sort();

  const byAccount = new Map(); // accountId → balances sorted by date asc
  for (const b of rows) {
    if (!byAccount.has(b.accountId)) byAccount.set(b.accountId, []);
    byAccount.get(b.accountId).push(b);
  }
  for (const list of byAccount.values()) {
    list.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));
  }

  const sectionOf = new Map(accts.map((a) => [a.id, a.section]));

  const series = LIQUIDITY_SECTIONS.map((section) => ({
    section,
    values: months.map((m) => {
      let sum = 0;
      for (const [accountId, list] of byAccount) {
        if (sectionOf.get(accountId) !== section) continue;
        let val = 0;
        for (const b of list) {
          if (monthKey(b.data) <= m) val = toNumber(b.saldo);
          else break;
        }
        sum += val;
      }
      return sum;
    }),
  }));

  return { months, series };
}
