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
