import { downloadSingleSheetXlsx } from "../../utils/xlsx.js";

export async function exportPipelineExcel({ funds, toEUR, toUSD, amt }) {
  await downloadSingleSheetXlsx({
    sheetName: "Pipeline FY26",
    filename: `Pipeline_FY26_${new Date().toISOString().slice(0,10)}.xlsx`,
    columns: [
      { header: "Nom",              key: "nom",       width: 28 },
      { header: "Gestor",           key: "gestor",    width: 20 },
      { header: "Compromís (orig)", key: "compOrig",  width: 14 },
      { header: "Moneda",           key: "moneda",    width: 9  },
      { header: "Compromís (€M)",   key: "compEur",   width: 15 },
      { header: "Compromís ($M)",   key: "compUsd",   width: 15 },
      { header: "Geografia",        key: "geo",       width: 10 },
      { header: "Estratègia",       key: "estrategia",width: 18 },
      { header: "Sector",           key: "sector",    width: 18 },
      { header: "Status",           key: "status",    width: 14 },
      { header: "Canal",            key: "canal",     width: 18 },
      { header: "Tancament Est.",   key: "tancament", width: 16 },
    ],
    rows: funds.map((f) => ({
      nom:        f.name,
      gestor:     f.manager || "",
      compOrig:   f.amount,
      moneda:     f.currency,
      compEur:    +toEUR(amt(f), f.currency).toFixed(3),
      compUsd:    +toUSD(amt(f), f.currency).toFixed(3),
      geo:        f.geography,
      estrategia: f.strategy,
      sector:     f.sector,
      status:     f.status,
      canal:      f.canal,
      tancament:  f.estimatedClosing || "",
    })),
  });
}
