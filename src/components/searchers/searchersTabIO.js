import { parseSearchersCSV } from "../../utils.js";
import { upsertSearcher, saveSearchers, loadSearchers } from "../../db.js";
import { downloadSingleSheetXlsx, readWorkbookFromArrayBuffer, sheetToRows } from "../../utils/xlsx.js";
import { isMockNif } from "../../data/searchersTabHelpers.js";

export function makeHandleCSV({ toast, setHistoricData }) {
  return (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rows = parseSearchersCSV(ev.target.result);
        if (rows.length) {
          const mapped = rows.map(r => ({
            nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
            statusScreening: r.statusScreening, formEntrada: r.formEntrada,
            introPer: r.introPer, searcher1: r.searcher1 || "", searcher2: r.searcher2 || "",
            escola1: r.escola1 || "", escola2: r.escola2 || "",
          }));
          const { error } = await saveSearchers(mapped);
          if (error) {
            toast({ message: "Error carregant searchers: " + error.message, type: "error" });
            return;
          }
          const refreshed = await loadSearchers();
          setHistoricData(refreshed ?? mapped);
        }
      } catch {
        toast({ message: "No s'ha pogut llegir el CSV.", type: "error" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
}

export function makeExportNifExcel({ toast, historicData }) {
  return async () => {
    const rows = historicData.filter(r => isMockNif(r.nif));
    if (!rows.length) {
      toast({ message: "Tots els searchers ja tenen NIF real." });
      return;
    }
    const data = rows.map(r => ({
      id: r.id ?? "", nom: r.nom ?? "", nif_actual: r.nif ?? "", nif_nou: "",
      status: r.statusScreening ?? "", entrada: r.formEntrada ?? "",
      geo: r.geo ?? "", ticket: r.ticket ?? "",
    }));
    await downloadSingleSheetXlsx({
      sheetName: "NIFs",
      filename: `searchers_nif_${new Date().toISOString().slice(0, 10)}.xlsx`,
      columns: [
        { header: "id",         key: "id",         width: 10 },
        { header: "nom",        key: "nom",        width: 40 },
        { header: "nif_actual", key: "nif_actual", width: 30 },
        { header: "nif_nou",    key: "nif_nou",    width: 20 },
        { header: "status",     key: "status",     width: 30 },
        { header: "entrada",    key: "entrada",    width: 16 },
        { header: "geo",        key: "geo",        width: 6  },
        { header: "ticket",     key: "ticket",     width: 10 },
      ],
      rows: data,
    });
    toast({ message: `${rows.length} searchers exportats.` });
  };
}

export function makeHandleNifImport({ toast, historicData, setHistoricData }) {
  return (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const { XLSX, wb } = await readWorkbookFromArrayBuffer(ev.target.result);
        const rows = sheetToRows(XLSX, wb, wb.SheetNames?.[0]) ?? [];
        const updates = rows.filter(r => String(r.nif_nou ?? "").trim());
        if (!updates.length) {
          toast({ message: "Cap NIF nou trobat a la columna nif_nou." });
          return;
        }
        let ok = 0, fail = 0;
        for (const row of updates) {
          const id = Number(row.id);
          const newNif = String(row.nif_nou).trim();
          const target = historicData.find(s => s.id === id);
          if (!target) { fail++; continue; }
          const { error } = await upsertSearcher({ ...target, nif: newNif });
          if (error) { fail++; } else { ok++; }
        }
        const refreshed = await loadSearchers();
        if (Array.isArray(refreshed)) setHistoricData(refreshed);
        toast({ message: `NIFs actualitzats: ${ok} ok${fail ? `, ${fail} errors` : ""}.`, type: fail ? "error" : "success" });
      } catch (err) {
        toast({ message: "Error important NIFs: " + err.message, type: "error" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };
}
