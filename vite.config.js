import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const CHUNK_SIZE_WARNING_LIMIT_KB = 900;

function manualChunks(id) {
  const normalizedId = id.replaceAll("\\", "/");
  if (normalizedId.includes("/node_modules/")) {
    if (normalizedId.includes("/node_modules/exceljs/")) return "vendor-exceljs";
    if (normalizedId.includes("echarts")) return "vendor-echarts";
    if (normalizedId.includes("@supabase")) return "vendor-supabase";
    if (normalizedId.includes("react-router")) return "vendor-router";
    if (normalizedId.includes("react")) return "vendor-react";
    if (normalizedId.includes("@nivo") || normalizedId.includes("d3-")) return "vendor-nivo";
    if (normalizedId.includes("lucide-react")) return "vendor-icons";
    return undefined;
  }
  if (normalizedId.includes("/src/generated/publicMarkets/pmTer.js")) return "data-pm-ter";
  if (normalizedId.includes("/src/generated/publicMarkets/portfolioValues.js")) return "data-portfolio-values";
  if (normalizedId.includes("/src/generated/prices/fundPrices.js")) return "data-fund-prices";
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: {
    // ExcelJS is intentionally lazy-loaded only for workbook import/export flows.
    // Its bare browser build is still ~860 kB, so keep the warning threshold above
    // that known async chunk while retaining warnings for accidental >900 kB bundles.
    chunkSizeWarningLimit: CHUNK_SIZE_WARNING_LIMIT_KB,
    // ECharts (~600 kB) and Nivo (~210 kB) are only reachable through dynamic
    // imports (ReactECharts, and the lazy ProspectiveCash/Searchers tabs), yet
    // the bundler eagerly <link rel="modulepreload">s their vendor chunks into
    // index.html. That forces ~800 kB of chart code to download on first paint
    // before any chart is on screen. Strip them from the eager preload set — the
    // dynamic import still fetches them on demand when a chart actually mounts.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !/vendor-(echarts|nivo)-/.test(dep)),
    },
    rollupOptions: {
      output: {
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        manualChunks,
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
