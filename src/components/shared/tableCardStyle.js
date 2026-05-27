import { TC_LIGHT } from "../../theme.js";

export function tableCardStyle(tc = TC_LIGHT) {
  return {
    background: tc.card,
    borderRadius: tc.radius?.md ?? 10,
    boxShadow: tc.shadows?.card ?? "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    overflow: "hidden",
    border: `1px solid ${tc.border}`,
  };
}

