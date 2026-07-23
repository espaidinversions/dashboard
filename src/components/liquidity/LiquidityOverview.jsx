import { useState } from "react";
import { fmtM } from "../../utils.js";
import { KpiCard } from "../shared/KpiCard.jsx";
import { LiquiditatSection } from "../shared/LiquiditatSection.jsx";
import { LiquidityCharts, LiquidityTrendChart } from "./LiquidityCharts.jsx";
import { LiquidityEditor } from "./LiquidityEditor.jsx";
import { buildLiquiditySummary, buildLiquidityByBank } from "../../data/liquidityModel.js";

/**
 * Global "Liquiditat" page: cash across all portfolio sections. KPI row, three
 * charts (section donut, bank bar, currency donut) and the reused per-account
 * table. Presentation-only over `liquidity_accounts`.
 *
 * @param {{ accounts: Array, tc: object, dark: boolean }} props
 */
export function LiquidityOverview({ accounts, registry, balances, reloadLiquidity, canManage, tc, dark }) {
  const [managing, setManaging] = useState(false);
  const list = Array.isArray(accounts) ? accounts : [];
  const { total } = buildLiquiditySummary(list);
  const bankCount = buildLiquidityByBank(list).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setManaging((m) => !m)}
            style={{ padding: "6px 14px", borderRadius: "var(--radius-md)", border: `1.5px solid ${tc.border}`,
              background: managing ? tc.navy : "transparent", color: managing ? "#fff" : tc.textMid,
              cursor: "pointer", fontFamily: "inherit", fontSize: "var(--text-sm)", fontWeight: 600 }}
          >
            {managing ? "Tanca" : "Gestiona"}
          </button>
        </div>
      )}

      {managing && (
        <LiquidityEditor registry={registry} balances={balances} reloadLiquidity={reloadLiquidity} tc={tc} />
      )}

      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <KpiCard hero label="Liquiditat Total" value={fmtM(total)} sub="tots els comptes" tc={tc} />
        <KpiCard label="Comptes" value={list.length} sub="comptes de liquiditat" tc={tc} />
        <KpiCard label="Bancs" value={bankCount} sub="entitats" tc={tc} />
      </div>

      <LiquidityTrendChart registry={registry} balances={balances} tc={tc} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <LiquidityCharts accounts={list} tc={tc} dark={dark} />
      </div>

      <LiquiditatSection accounts={list} tc={tc} title="Comptes" />
    </div>
  );
}
