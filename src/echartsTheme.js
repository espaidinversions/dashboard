// src/echartsTheme.js
// Returns reusable ECharts style fragments keyed to the active theme context.
// Usage: const t = ecTheme(tc); then spread t.grid, t.tooltip, etc. into option.

export function ecTheme(tc) {
  return {
    grid: { containLabel: true },
    axisLabel: { fontSize: 9, color: tc.textLight ?? "#8A9BAC" },
    axisLine:  { show: false },
    axisTick:  { show: false },
    splitLine: { lineStyle: { color: tc.border ?? "#E5EAF0" } },
    tooltip: {
      backgroundColor: tc.card  ?? "#fff",
      borderColor:     tc.border ?? "#E5EAF0",
      textStyle: { color: tc.text ?? "#1A2B3C", fontSize: 11 },
      extraCssText: "border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);",
    },
  };
}
