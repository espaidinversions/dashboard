import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../../theme.js";
import { loadLiquidity } from "../../db.js";
import { LiquidityEditor } from "../liquidity/LiquidityEditor.jsx";

/**
 * Admin-panel wrapper around the liquidity editor. AdminPanel is a standalone
 * route with no dashboard-data context, so this self-loads the registry +
 * balances and provides its own reload after mutations.
 */
export default function AdminLiquidity() {
  const { tc } = useTheme();
  const [registry, setRegistry] = useState([]);
  const [balances, setBalances] = useState([]);

  const reloadLiquidity = useCallback(async () => {
    const res = await loadLiquidity();
    setRegistry(res.registry);
    setBalances(res.balances);
  }, []);

  useEffect(() => { reloadLiquidity().catch(console.error); }, [reloadLiquidity]);

  return <LiquidityEditor registry={registry} balances={balances} reloadLiquidity={reloadLiquidity} tc={tc} />;
}
