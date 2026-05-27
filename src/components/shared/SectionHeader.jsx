import React from "react";
import { useTheme } from "../../theme.js";

export function SectionHeader({ title, count, action, tc: tcProp }) {
  const { tc: tcTheme } = useTheme();
  const tc = tcProp ?? tcTheme;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      paddingBottom: 10,
      borderBottom: `1px solid ${tc.border}`,
      marginBottom: 14,
    }}>
      <span style={{
        fontSize: 14, fontWeight: 700, color: tc.navyDark,
        letterSpacing: "-0.01em",
      }}>{title}</span>
      {(action || count != null) && (
        <div style={{ marginLeft: "auto" }}>
          {action ?? (
            <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 400 }}>
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

