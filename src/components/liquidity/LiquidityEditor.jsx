import { useState } from "react";
import { AddRowModal } from "../shared/AddRowModal.jsx";
import { DeleteRowButton } from "../shared/DeleteRowButton.jsx";
import { SectionHeader } from "../shared/SectionHeader.jsx";
import { tableCardStyle } from "../shared/tableCardStyle.js";
import { fmtM } from "../../utils.js";
import { buildLatestAccounts } from "../../data/liquidityModel.js";
import {
  upsertLiquidityAccount, deleteLiquidityAccount,
  upsertLiquidityBalance, deleteLiquidityBalance,
} from "../../db.js";

const SECTION_LABELS = {
  alternatives: "Alternatius",
  "real-estate": "Real Estate",
  "mercats-publics": "Mercats Públics",
};
const SECTION_KEYS = Object.keys(SECTION_LABELS);
const SECTION_OPTION_LABELS = SECTION_KEYS.map((k) => SECTION_LABELS[k]);
const sectionKeyFromLabel = (label) => SECTION_KEYS.find((k) => SECTION_LABELS[k] === label) ?? "alternatives";
const DIVISA_OPTIONS = ["EUR", "USD", "GBP", "CHF"];

/**
 * Superuser-only liquidity CRUD: a registry-accounts table plus a per-account
 * monthly-balance history editor. Writes go through the superuser RPCs, then
 * `reloadLiquidity()` refreshes the shared dashboard state.
 */
export function LiquidityEditor({ registry, balances, reloadLiquidity, tc }) {
  const [accountModal, setAccountModal] = useState(null); // null | {} (new) | account (edit)
  const [balanceModal, setBalanceModal] = useState(null); // null | { accountId } | balance+accountId
  const [selectedId, setSelectedId] = useState(null);

  const list = Array.isArray(registry) ? registry : [];
  const bals = Array.isArray(balances) ? balances : [];
  const latestById = new Map(buildLatestAccounts(list, bals).map((a) => [a.id, a]));
  const selected = list.find((a) => a.id === selectedId) ?? null;
  const selectedBalances = bals
    .filter((b) => b.accountId === selectedId)
    .sort((a, b) => (a.data < b.data ? 1 : -1)); // newest first

  const saveAccount = async (values, setError) => {
    if (!String(values.nom ?? "").trim()) { setError("El nom del compte és obligatori."); return; }
    const { error } = await upsertLiquidityAccount({
      id: accountModal?.id ?? null,
      nom: values.nom,
      banc: values.banc,
      section: sectionKeyFromLabel(values.section),
      divisa: values.divisa,
    });
    if (error) { setError(error.message); return; }
    setAccountModal(null);
    await reloadLiquidity();
  };
  const removeAccount = async (id) => {
    const { error } = await deleteLiquidityAccount(id);
    if (!error) { if (selectedId === id) setSelectedId(null); await reloadLiquidity(); }
  };
  const saveBalance = async (values, setError) => {
    if (!values.data) { setError("La data és obligatòria."); return; }
    const { error } = await upsertLiquidityBalance({
      id: balanceModal?.id ?? null,
      accountId: balanceModal?.accountId,
      data: values.data,
      saldo: values.saldo,
      saldoNative: values.saldoNative,
    });
    if (error) { setError(error.message); return; }
    setBalanceModal(null);
    await reloadLiquidity();
  };
  const removeBalance = async (id) => {
    const { error } = await deleteLiquidityBalance(id);
    if (!error) await reloadLiquidity();
  };

  const accountFields = (acct) => [
    { key: "nom", label: "Compte", type: "text", defaultValue: acct?.nom ?? "" },
    { key: "banc", label: "Banc", type: "text", defaultValue: acct?.banc ?? "" },
    { key: "section", label: "Secció", type: "select", options: SECTION_OPTION_LABELS, defaultValue: SECTION_LABELS[acct?.section] ?? SECTION_LABELS.alternatives },
    { key: "divisa", label: "Divisa", type: "select", options: DIVISA_OPTIONS, defaultValue: acct?.divisa ?? "EUR" },
  ];
  const balanceFields = (bal, divisa) => [
    { key: "data", label: "Data", type: "date", defaultValue: bal?.data ?? "" },
    { key: "saldo", label: "Saldo (€)", type: "number", defaultValue: bal?.saldo != null ? String(bal.saldo) : "" },
    ...(divisa && divisa !== "EUR"
      ? [{ key: "saldoNative", label: `Saldo (${divisa})`, type: "number", defaultValue: bal?.saldoNative != null ? String(bal.saldoNative) : "" }]
      : []),
  ];

  const headCell = {
    padding: "9px 14px", fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight,
    textTransform: "uppercase", letterSpacing: "0.06em", background: tc.bgAlt,
    borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap",
  };
  const bodyCell = { padding: "10px 14px", borderBottom: `1px solid ${tc.border}` };
  const mono = { fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 };
  const addBtn = {
    padding: "6px 12px", borderRadius: "var(--radius-md)", border: "none",
    background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit",
    fontSize: "var(--text-sm)", fontWeight: 600,
  };
  const linkBtn = {
    padding: "4px 8px", borderRadius: "var(--radius-sm)", border: `1px solid ${tc.border}`,
    background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: "var(--text-xs)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
        <div style={{ padding: "14px 18px 0" }}>
          <SectionHeader
            title="Comptes"
            tc={tc}
            action={<button style={addBtn} onClick={() => setAccountModal({})}>Afegir compte</button>}
          />
        </div>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>Encara no hi ha comptes.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...headCell, textAlign: "left" }}>Compte</th>
                <th style={{ ...headCell, textAlign: "left" }}>Banc</th>
                <th style={{ ...headCell, textAlign: "left" }}>Secció</th>
                <th style={{ ...headCell, textAlign: "left" }}>Divisa</th>
                <th style={{ ...headCell, textAlign: "right" }}>Saldo actual</th>
                <th style={{ ...headCell, textAlign: "right" }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} style={a.id === selectedId ? { background: tc.bgAlt } : undefined}>
                  <td style={{ ...bodyCell, fontSize: 13, fontWeight: 600, color: tc.text }}>{a.nom}</td>
                  <td style={{ ...bodyCell, fontSize: 13, color: tc.textMid }}>{a.banc || "—"}</td>
                  <td style={{ ...bodyCell, fontSize: 13, color: tc.textMid }}>{SECTION_LABELS[a.section] ?? a.section}</td>
                  <td style={{ ...bodyCell, fontSize: 13, color: tc.textMid }}>{a.divisa}</td>
                  <td style={{ ...bodyCell, ...mono, textAlign: "right", color: tc.text }}>{fmtM(latestById.get(a.id)?.saldo ?? 0)}</td>
                  <td style={{ ...bodyCell, textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                      <button style={linkBtn} onClick={() => setSelectedId(a.id)}>Saldos</button>
                      <button style={linkBtn} onClick={() => setAccountModal(a)}>Edita</button>
                      <DeleteRowButton onDelete={() => removeAccount(a.id)} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
          <div style={{ padding: "14px 18px 0" }}>
            <SectionHeader
              title={`Saldos · ${selected.nom}`}
              tc={tc}
              action={<button style={addBtn} onClick={() => setBalanceModal({ accountId: selected.id })}>Afegir saldo</button>}
            />
          </div>
          {selectedBalances.length === 0 ? (
            <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>Encara no hi ha saldos per aquest compte.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...headCell, textAlign: "left" }}>Data</th>
                  <th style={{ ...headCell, textAlign: "right" }}>Saldo (€)</th>
                  {selected.divisa !== "EUR" && <th style={{ ...headCell, textAlign: "right" }}>{`Saldo (${selected.divisa})`}</th>}
                  <th style={{ ...headCell, textAlign: "right" }}>Accions</th>
                </tr>
              </thead>
              <tbody>
                {selectedBalances.map((b) => (
                  <tr key={b.id}>
                    <td style={{ ...bodyCell, fontSize: 13, color: tc.text }}>{b.data}</td>
                    <td style={{ ...bodyCell, ...mono, textAlign: "right", color: tc.text }}>{fmtM(b.saldo)}</td>
                    {selected.divisa !== "EUR" && (
                      <td style={{ ...bodyCell, ...mono, textAlign: "right", color: tc.textMid }}>
                        {b.saldoNative != null ? `${Math.round(b.saldoNative).toLocaleString("ca-ES")} ${selected.divisa}` : "—"}
                      </td>
                    )}
                    <td style={{ ...bodyCell, textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        <button style={linkBtn} onClick={() => setBalanceModal({ ...b, accountId: b.accountId })}>Edita</button>
                        <DeleteRowButton onDelete={() => removeBalance(b.id)} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {accountModal && (
        <AddRowModal
          title={accountModal.id ? "Editar compte" : "Afegir compte"}
          submitLabel="Desar"
          fields={accountFields(accountModal.id ? accountModal : null)}
          onSave={saveAccount}
          onClose={() => setAccountModal(null)}
        />
      )}
      {balanceModal && (
        <AddRowModal
          title={balanceModal.id ? "Editar saldo" : "Afegir saldo"}
          submitLabel="Desar"
          fields={balanceFields(balanceModal.id ? balanceModal : null, selected?.divisa)}
          onSave={saveBalance}
          onClose={() => setBalanceModal(null)}
        />
      )}
    </div>
  );
}
