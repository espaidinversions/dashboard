import React from "react";
import { fmtM } from "../../utils.js";
import { FilterPills } from "./PublicMarketsFilters.jsx";
import { fmtTxMonth } from "./PublicMarketsShared.jsx";

export function PublicMarketsTransactionsSection({
  tc,
  dark,
  txFiltered,
  transactionCount,
  txCustodians,
  txActionFilter,
  setTxActionFilter,
  txCustodianFilter,
  setTxCustodianFilter,
  openTxMonths,
  toggleTxMonth,
  txByMonth,
  setMercatsPublicsTab,
}) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "18px 20px 14px", borderBottom: `1px solid ${tc.border}` }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, flex: 1 }}>
          Moviments · {txFiltered.length}
        </div>
        <button
          onClick={() => setMercatsPublicsTab?.("transaccions")}
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            border: `1.5px solid ${tc.green}`,
            background: dark ? "#0A2010" : "#E8F8E8",
            color: tc.green,
            fontWeight: 700,
          }}
        >
          + Nova
        </button>
        <FilterPills
          options={[
            { id: "all", label: "Totes" },
            { id: "buy", label: "Compres" },
            { id: "sell", label: "Vendes" },
          ]}
          value={txActionFilter}
          onChange={setTxActionFilter}
          tc={tc}
          dark={dark}
          compact={true}
        />
        <FilterPills
          options={[
            { id: "all", label: "Tot custodi" },
            ...txCustodians.map((custodian) => ({ id: custodian, label: custodian })),
          ]}
          value={txCustodianFilter}
          onChange={setTxCustodianFilter}
          tc={tc}
          dark={dark}
          compact={true}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 700 }}>
          <tbody>
            {txByMonth.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "18px 20px", fontStyle: "italic", color: tc.textLight, fontSize: 12 }}>
                  {transactionCount === 0
                    ? "Sense moviments registrats."
                    : "Sense transaccions amb aquest filtre."}
                </td>
              </tr>
            ) : null}
            {txByMonth.map(([month, rows]) => {
              const isOpen = openTxMonths.has(month);
              const buys = rows.filter((tx) => tx.action === "buy");
              const sells = rows.filter((tx) => tx.action === "sell");
              const buyTotal = buys.reduce((sum, tx) => sum + (tx.valueEur ?? 0), 0);
              const sellTotal = sells.reduce((sum, tx) => sum + (tx.valueEur ?? 0), 0);
              const net = buyTotal - sellTotal;
              const isNoDate = month === "????-??";

              return (
                <React.Fragment key={month}>
                  <tr
                    role="button"
                    aria-expanded={isOpen}
                    tabIndex={0}
                    onClick={() => toggleTxMonth(month)}
                    onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && toggleTxMonth(month)}
                    style={{ cursor: "pointer", borderTop: `1px solid ${tc.border}`, borderBottom: isOpen ? "none" : `1px solid ${tc.border}`, userSelect: "none" }}
                  >
                    <td style={{ padding: "11px 8px 11px 16px", width: 28, fontSize: 13, color: tc.navy, fontWeight: 700 }}>
                      {isOpen ? "▾" : "▸"}
                    </td>
                    <td style={{ padding: "11px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: isNoDate ? tc.textLight : tc.navy, fontStyle: isNoDate ? "italic" : "normal" }}>
                      {fmtTxMonth(month)}
                    </td>
                    <td colSpan={7} style={{ padding: "11px 10px" }}>
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {buys.length > 0 ? (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#E8F8E8", color: "#1C6B1D", fontWeight: 600 }}>
                            Compres: {buys.length} · {fmtM(buyTotal)}
                          </span>
                        ) : null}
                        {sells.length > 0 ? (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#FDECEA", color: "#C62828", fontWeight: 600 }}>
                            Vendes: {sells.length} · {fmtM(sellTotal)}
                          </span>
                        ) : null}
                        {buys.length > 0 && sells.length > 0 ? (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontFamily: "'DM Mono',monospace", background: net > 0 ? "#E8F8E8" : net < 0 ? "#FDECEA" : tc.bgAlt, color: net > 0 ? tc.green : net < 0 ? tc.red : tc.textLight }}>
                            Net: {net > 0 ? "+" : ""}
                            {fmtM(net)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>

                  {isOpen ? rows.map((tx, index) => {
                    const isBuy = tx.action === "buy";
                    const rowBg = index % 2 === 0
                      ? (dark ? "#091C0B" : "#F4FBF4")
                      : (dark ? "#071A08" : "#E8F8E8");
                    return (
                      <tr key={tx.id} style={{ borderBottom: `1px solid ${tc.border}`, background: rowBg }}>
                        <td />
                        <td style={{ padding: "7px 10px 7px 28px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight, whiteSpace: "nowrap" }}>
                          {tx.date ?? "—"}
                        </td>
                        <td style={{ padding: "7px 10px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ color: tc.navy, fontWeight: 600 }}>{tx.nom}</span>
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: tx.tipus === "RV" ? "#E6EDF3" : "#FFF8E1", color: tx.tipus === "RV" ? "#2B5070" : "#7A6000" }}>
                            {tx.tipus}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: isBuy ? "#E8F8E8" : "#FDECEA", color: isBuy ? "#1C6B1D" : "#C62828", fontWeight: 600 }}>
                            {isBuy ? "Compra" : "Venda"}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                          {tx.units != null ? tx.units.toLocaleString("ca-ES", { maximumFractionDigits: 0 }) : "—"}
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                          {tx.nav != null ? tx.nav.toFixed(2) : "—"}
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.navy }}>
                          {tx.valueEur != null ? fmtM(tx.valueEur) : "—"}
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: tc.textLight }}>
                          {tx.custodian}
                        </td>
                      </tr>
                    );
                  }) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
