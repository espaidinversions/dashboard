import { fmtM } from "../../utils.js";
import { buildLiquiditySummary } from "../../data/liquidityModel.js";
import { SectionHeader } from "./SectionHeader.jsx";
import { tableCardStyle } from "./tableCardStyle.js";

/**
 * Shared "Liquiditat" block: a total headline plus a per-account table
 * (bank, account, balance, as-of date). Reused by every section summary and
 * portfoli. Pass `section` to scope to one section's accounts; omit for all.
 */
export function LiquiditatSection({ accounts, section, tc, title = "Liquiditat" }) {
  const { total, byAccount } = buildLiquiditySummary(accounts, section ? { section } : {});

  const headCell = {
    padding: "9px 14px", fontSize: 10, fontWeight: 700,
    color: tc.navyLight ?? tc.textLight, textTransform: "uppercase",
    letterSpacing: "0.06em", background: tc.bgAlt,
    borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap",
  };
  const bodyCell = { padding: "10px 14px", borderBottom: `1px solid ${tc.border}` };
  const mono = { fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 };

  return (
    <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
      <div style={{ padding: "14px 18px 0" }}>
        <SectionHeader
          title={title}
          tc={tc}
          action={
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.06em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>Total</div>
              <div style={{ ...mono, fontSize: 18, color: tc.navy }}>{fmtM(total)}</div>
            </div>
          }
        />
      </div>
      {byAccount.length === 0 ? (
        <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>
          Encara no hi ha comptes de liquiditat.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: "left" }}>Banc</th>
              <th style={{ ...headCell, textAlign: "left" }}>Compte</th>
              <th style={{ ...headCell, textAlign: "right" }}>Saldo</th>
              <th style={{ ...headCell, textAlign: "right" }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {byAccount.map((account) => (
              <tr key={account.id ?? `${account.nom}-${account.banc}`}>
                <td style={{ ...bodyCell, fontSize: 13, color: tc.textMid }}>{account.banc || "—"}</td>
                <td style={{ ...bodyCell, fontSize: 13, fontWeight: 600, color: tc.text }}>{account.nom}</td>
                <td style={{ ...bodyCell, ...mono, textAlign: "right", color: tc.text }}>
                  {fmtM(account.saldo)}
                  {account.divisa && account.divisa !== "EUR" && account.saldoNative != null && (
                    <span style={{ display: "block", fontSize: 10, fontWeight: 400, color: tc.textLight }}>
                      {`${Math.round(account.saldoNative).toLocaleString("ca-ES")} ${account.divisa}`}
                    </span>
                  )}
                </td>
                <td style={{ ...bodyCell, fontSize: 12, textAlign: "right", color: tc.textMid }}>{account.data || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
