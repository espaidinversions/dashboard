import { useCallback, useState } from "react";
import { exportMultiXLSX } from "../../utils.js";
import { buildDashboardExportSheets } from "../../data/dashboardExportModel.js";

/**
 * Wires the dashboard export actions (print PDF, PNG snapshot, multi-sheet
 * XLSX). Extracted from Dashboard.jsx; heavy deps (html2canvas) stay lazily
 * imported inside the handlers.
 *
 * @param {{
 *   companiesData: Array<Record<string, unknown>>,
 *   searchersData: Array<Record<string, unknown>>,
 *   funds0: Array<Record<string, unknown>>,
 *   rawCC: Array<Record<string, unknown>>,
 *   fundMeta: unknown,
 * }} params
 */
export function useDashboardExports({ companiesData, searchersData, funds0, rawCC, fundMeta }) {
  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(() => { window.print(); }, []);

  const exportPNG = useCallback(async () => {
    const el = document.getElementById("dashboard-content");
    if (!el) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } finally { setExporting(false); }
  }, []);

  const exportAll = useCallback(async () => {
    setExporting(true);
    try {
      await exportMultiXLSX(buildDashboardExportSheets({
        companies: companiesData,
        searchers: searchersData,
        pipeline: funds0,
        cc: rawCC,
        fundMeta,
      }), "TurtleCapital_Data");
    } finally { setExporting(false); }
  }, [companiesData, searchersData, funds0, rawCC, fundMeta]);

  return { exporting, exportPDF, exportPNG, exportAll };
}
