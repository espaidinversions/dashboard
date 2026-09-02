import { upsertSearcher, loadSearchers } from "../../db.js";
import { apiFetchJson } from "../../apiClient.js";
import { searcherKey, splitSearcherNames, splitSchoolNames } from "../../data/searcherFormatting.js";

export function makeSaveSearcherField({ toast, historicData, setHistoricData }) {
  return async (target, field, value) => {
    const targetKey = searcherKey(target);
    const targetIndex = historicData.findIndex((searcher) => {
      const candidateKey = searcherKey(searcher);
      return targetKey != null ? candidateKey === targetKey : searcher.nom === target.nom;
    });
    if (targetIndex === -1) return;
    const fieldPatch = field === "searchers"
      ? splitSearcherNames(value)
      : field === "schools"
        ? splitSchoolNames(value)
        : field === "status"
          ? { statusScreening: value }
          : { [field]: value };
    const updated = historicData.map((searcher, index) => (
      index === targetIndex ? { ...searcher, ...fieldPatch } : searcher
    ));
    setHistoricData(updated);
    const searcher = updated[targetIndex];
    if (searcher) {
      const { data, error } = await upsertSearcher(searcher);
      if (error) {
        toast({ message: "Error desant canvis: " + error.message, type: "error" });
        return;
      }
      if (data) {
        setHistoricData((current) => current.map((row, index) => (
          index === targetIndex ? data : row
        )));
      }
    }
  };
}

export function makeHandleAddSearcher({ toast, historicData, setHistoricData, setShowAddModal }) {
  return async (values, setError) => {
    const nom = values.nom?.trim();
    if (!nom) { setError("El nom és obligatori"); return; }
    if (historicData.some(s => String(s.nom ?? "").trim().toLowerCase() === nom.toLowerCase())) {
      setError("Ja existeix un searcher amb aquest nom");
      return;
    }
    const searcher = {
      nom, tipus: values.tipus || null, modalitat: values.modalitat || null,
      geo: values.geo || null, statusScreening: values.statusScreening || null,
      formEntrada: values.formEntrada || null, introPer: null,
      searcher1: null, searcher2: null, escola1: null, escola2: null,
      ticket: parseFloat(values.ticket) || null,
      dataInici: values.dataInici || null, dataCompr: null, mesosCercant: null,
      equityStake: parseFloat(values.equityStake) || null, isMock: false,
      nif: values.nif?.trim() || null,
    };
    let inserted = null;
    try {
      const response = await apiFetchJson("/api/searchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searcher),
      });
      inserted = response?.data ?? null;
    } catch (error) {
      setError(error?.message || "Error en crear el searcher");
      return;
    }
    if (!inserted) { setError("Error en crear el searcher"); return; }
    const refreshed = await loadSearchers();
    setHistoricData(Array.isArray(refreshed) ? refreshed : [inserted, ...historicData]);
    setShowAddModal(false);
    toast({ message: `Searcher creat: ${nom}` });
  };
}

export function makeHandleDeleteSearcher({ toast, historicData, setHistoricData }) {
  return async (target) => {
    if (target?.id) {
      try {
        await apiFetchJson(`/api/searchers?id=${encodeURIComponent(target.id)}`, { method: "DELETE" });
      } catch (error) {
        toast({ message: "Error eliminant searcher: " + (error?.message || "error desconegut"), type: "error" });
        return;
      }
    }
    const targetKey = searcherKey(target);
    setHistoricData(historicData.filter((searcher) => (
      targetKey != null ? searcherKey(searcher) !== targetKey : searcher.nom !== target.nom
    )));
    toast({ message: "Searcher eliminat." });
  };
}
