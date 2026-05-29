// src/echartsTheme.js
// Returns reusable ECharts style fragments keyed to the active theme context.
// Usage: const t = ecTheme(tc); then spread t.grid, t.tooltip, etc. into option.

export function ecTheme(tc) {
  const borderColor = tc.border ?? "#CFD9E4";
  return {
    grid: { containLabel: true },
    axisLabel: {
      fontSize: 10,
      color: tc.textLight ?? "#8A9BAC",
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    },
    axisLine:  { show: false },
    axisTick:  { show: false },
    splitLine: { lineStyle: { color: borderColor, opacity: 0.7 } },
    tooltip: {
      backgroundColor: tc.card ?? "#fff",
      borderColor,
      textStyle: {
        color: tc.text ?? "#1B2A36",
        fontSize: 11,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      },
      extraCssText: "border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.10);padding:8px 10px;",
    },
  };
}
