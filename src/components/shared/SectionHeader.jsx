import { useTheme } from "../../theme.js";

export function SectionHeader({ title, count, action, tc: tcProp }) {
  const { tc: tcTheme } = useTheme();
  const tc = tcProp ?? tcTheme;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      paddingBottom: 11,
      borderBottom: `1px solid ${tc.border}`,
      boxShadow: `0 1px 0 0 ${tc.brass ?? "#AE8836"}33`,
      marginBottom: 18,
    }}>
      <span style={{ width: 3, height: 20, background: tc.brass ?? "#AE8836", borderRadius: 1, flexShrink: 0 }} />
      <span style={{
        fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: tc.navyDark,
        lineHeight: 1.1, letterSpacing: "-0.005em",
      }}>{title}</span>
      {(action || count != null) && (
        <div style={{ marginLeft: "auto" }}>
          {action ?? (
            <span style={{
              fontSize: 11, color: tc.textLight, fontWeight: 700,
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.04em",
            }}>
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
