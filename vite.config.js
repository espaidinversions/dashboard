import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("echarts")) return "vendor-echarts";
            if (id.includes("xlsx")) return "vendor-xlsx";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("react")) return "vendor-react";
            return undefined;
          }
          if (id.includes("/src/generated/publicMarkets/pmTer.js")) return "data-pm-ter";
          if (id.includes("/src/generated/publicMarkets/portfolioValues.js")) return "data-portfolio-values";
          if (id.includes("/src/generated/prices/fundPrices.js")) return "data-fund-prices";
          return undefined;
        },
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
