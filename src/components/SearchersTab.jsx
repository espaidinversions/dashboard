import { useEffect, useMemo, useState, useRef } from "react";
import { useTheme } from "../theme.js";
import { calcMesos, parseSearchersCSV, usePersistedState } from "../utils.js";
import { GEO_NAME } from "../config.js";
import { estSection } from "../data/capitalCallStrategyModel.js";
import { AddRowModal } from "./SharedComponents.jsx";
import { useAuth } from "../auth.jsx";
import { upsertSearcher, saveSearchers, loadSearchers, loadCompanies, loadCapitalCalls } from "../db.js";
import { useToast } from "../toast.jsx";
import { apiFetchJson } from "../apiClient.js";
import { isSfBackedCompany } from "../data/privateCompanyModel.js";
import { normalizeSearcherName, describeSearcherStage } from "../data/searcherModel.js";
import { SEARCHER_FORM_ENTRADA_OPTIONS, SEARCHER_MODALITAT_OPTIONS, SEARCHER_STATUS_OPTIONS } from "../config.js";
import { searcherKey, splitSearcherNames, splitSchoolNames, toggleActiveFilter } from "../data/searcherFormatting.js";
import { SankeySection } from "./searchers/SankeySection.jsx";
import { ActiveSearchersTable } from "./searchers/ActiveSearchersTable.jsx";
import { LegacyTable } from "./searchers/LegacyTable.jsx";
import { HistoricTable } from "./searchers/HistoricTable.jsx";
import { downloadSingleSheetXlsx, readWorkbookFromArrayBuffer, sheetToRows } from "../utils/xlsx.js";

// ── main component ─────────────────────────────────────────
export function SearchersTab({ search = "", subTab = "tots", rawCC = [] }) {
  const { tc: TC, dark } = useTheme();
  const { canEditSection } = useAuth();
  const canEdit = canEditSection("searchers");
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  const [historicData, setHistoricData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [histFilter, setHistFilter]     = useState({ status: "Tots", geo: "Tots", entrada: "Tots" });
  const [histSort, setHistSort]         = useState({ k: "nom", d: "asc" });
  const [activeGeoFilter, setActiveGeoFilter] = usePersistedState("ui_searchersGeo", "Tots");
  const [activeEntryFilter, setActiveEntryFilter] = usePersistedState("ui_searchersEntry", "Tots");
  const [activeStatusFilter, setActiveStatusFilter] = usePersistedState("ui_searchersStatus", "Tots");
  const [activeTypeFilter, setActiveTypeFilter] = usePersistedState("ui_searchersType", "Tots");
  const [activeModalityFilter, setActiveModalityFilter] = usePersistedState("ui_searchersModality", "Tots");
  const [activeSort, setActiveSort] = usePersistedState("ui_searchersSort", { k: "nom", d: "asc" });
  const csvRef    = useRef(null);
  const nifXlsRef = useRef(null);
  const [fetchedRawCC, setFetchedRawCC] = useState([]);
  const capitalCalls = useMemo(
    () => (Array.isArray(rawCC) && rawCC.length ? rawCC : fetchedRawCC),
    [rawCC, fetchedRawCC]
  );

  useEffect(() => {
    if (Array.isArray(rawCC) && rawCC.length) return;
    loadCapitalCalls().then((data) => {
      if (Array.isArray(data)) setFetchedRawCC(data);
    }).catch((error) => {
      console.error("Searchers capital calls refresh failed:", error);
    });
  }, [rawCC]);

  useEffect(() => {
    if (!Array.isArray(historicData) || historicData.length === 0) {
      loadSearchers().then((data) => {
        if (Array.isArray(data)) setHistoricData(data);
      }).catch((error) => {
        console.error("Searchers refresh failed:", error);
      });
    }
    if (!Array.isArray(companies) || companies.length === 0) {
      loadCompanies().then((data) => {
        if (Array.isArray(data)) setCompanies(data);
      }).catch((error) => {
        console.error("Companies refresh failed:", error);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyed by private_entity NIF (= row.id in rawCC = vehicle_id)
  const capitalCallsByNif = useMemo(() => {
    const map = new Map();
    (Array.isArray(capitalCalls) ? capitalCalls : []).forEach((row) => {
      if (estSection(row?.est) !== "SF" || !row?.id) return;
      const date = String(row?.data ?? "").slice(0, 10);
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
      const current = map.get(row.id) ?? { firstCommitmentDate: null, firstCommitmentEur: null };
      if (row?.eur > 0 && ["Compromís", "Capital Call"].includes(row?.cat) && (!current.firstCommitmentDate || date < current.firstCommitmentDate)) {
        current.firstCommitmentDate = date;
        if (current.firstCommitmentEur == null && row.eur != null) current.firstCommitmentEur = row.eur;
      }
      map.set(row.id, current);
    });
    return map;
  }, [capitalCalls]);

  // Fallback: keyed by normalised fund name for searchers without NIF set
  const capitalCallsBySearcher = useMemo(() => {
    const map = new Map();
    (Array.isArray(capitalCalls) ? capitalCalls : []).forEach((row) => {
      if (estSection(row?.est) !== "SF") return;
      const key = normalizeSearcherName(row?.fons);
      const date = String(row?.data ?? "").slice(0, 10);
      if (!key || !date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
      const current = map.get(key) ?? { firstCommitmentDate: null, firstCommitmentEur: null };
      if (row?.eur > 0 && ["Compromís", "Capital Call"].includes(row?.cat) && (!current.firstCommitmentDate || date < current.firstCommitmentDate)) {
        current.firstCommitmentDate = date;
        if (current.firstCommitmentEur == null && row.eur != null) current.firstCommitmentEur = row.eur;
      }
      map.set(key, current);
    });
    return map;
  }, [capitalCalls]);

  const enrichedSearchers = useMemo(() => (
    historicData.map((row) => {
      const searchers = [row.searcher1, row.searcher2].filter(Boolean).join(" / ");
      const stage = describeSearcherStage(row);
      const ccMeta = (row.nif && capitalCallsByNif.get(row.nif)) || capitalCallsBySearcher.get(normalizeSearcherName(row.nom));
      const derivedDataCompr = ccMeta?.firstCommitmentDate ?? row.dataCompr ?? null;
      const derivedTicket = ccMeta?.firstCommitmentEur ?? row.ticket ?? null;
      const investmentYear = derivedDataCompr ? Number(derivedDataCompr.slice(0, 4)) : null;
      return {
        ...row,
        ticket: derivedTicket,
        searchers,
        derivedDataCompr,
        investmentYear,
        stageLabel: stage.label,
        stageOrder: stage.order,
        mesosCercant: derivedDataCompr ? calcMesos(derivedDataCompr) : row.mesosCercant ?? null,
      };
    })
  ), [capitalCallsByNif, capitalCallsBySearcher, historicData]);

  const activeRows = useMemo(() => {
    const seen = new Set();
    return enrichedSearchers.filter((row) => {
      if (row.isLegacy) return false;
      if (row.companiaAdquirida) return false;
      const isActive = row.statusScreeningCode != null
        ? row.statusScreeningCode === 2
        : row.statusScreening === "Invertit en fase de cerca" || row.statusScreening === "Invested - Search Phase";
      if (!isActive) return false;
      const key = row.id ?? row.nom;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [enrichedSearchers]);

  const legacyRows = useMemo(() => {
    const seen = new Set();
    return enrichedSearchers.filter((row) => {
      if (!row.isLegacy) return false;
      const key = row.id ?? row.nom;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [enrichedSearchers]);

  const commitmentYearData = useMemo(() => {
    const counts = new Map();
    activeRows
      .filter((row) => !row.isMock && Number.isFinite(row.investmentYear))
      .forEach((row) => {
        counts.set(row.investmentYear, (counts.get(row.investmentYear) ?? 0) + 1);
      });
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year: String(year), count }));
  }, [activeRows]);

  // ── KPIs ──────────────────────────────────────────────────
  const totalSearchers  = activeRows.reduce((sum, row) => sum + (row.ticket ?? 0), 0);
  const soloCount       = activeRows.filter(r => r.modalitat === "Solo").length;
  const duoCount        = activeRows.filter(r => r.modalitat !== "Solo").length;

  const getActiveSortValue = (row, key) => {
    if (key === "stage") return row.stageOrder ?? 0;
    if (key === "geo") return GEO_NAME[row.geo] || row.geo || "";
    if (key === "formEntrada") return row.formEntrada ?? "";
    if (key === "ticket") return row.ticket ?? 0;
    if (key === "investmentYear") return row.investmentYear ?? 0;
    if (key === "mesosCercant") return row.mesosCercant ?? 0;
    if (key === "equityStake") return row.equityStake ?? 0;
    if (key === "dataCompr") return row.derivedDataCompr ?? "";
    if (key === "irr") return row.irr ?? -Infinity;
    if (key === "dpi") return row.dpi ?? -Infinity;
    if (key === "companiaAdquirida") return row.companiaAdquirida ?? "";
    return row[key] ?? "";
  };

  const displayedSearchers = useMemo(() => {
    let list = activeRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.nom.toLowerCase().includes(q) ||
        (r.searchers ?? "").toLowerCase().includes(q)
      );
    }
    if (activeGeoFilter !== "Tots") list = list.filter(r => r.geo === activeGeoFilter);
    if (activeEntryFilter !== "Tots") list = list.filter(r => r.formEntrada === activeEntryFilter);
    if (activeStatusFilter !== "Tots") list = list.filter(r => r.statusScreening === activeStatusFilter);
    if (activeTypeFilter !== "Tots") list = list.filter(r => r.tipus === activeTypeFilter);
    if (activeModalityFilter !== "Tots") list = list.filter(r => r.modalitat === activeModalityFilter);
    return [...list].sort((a, b) => {
      const va = getActiveSortValue(a, activeSort.k);
      const vb = getActiveSortValue(b, activeSort.k);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "ca", { sensitivity: "base" });
      if (cmp === 0) cmp = String(a.nom).localeCompare(String(b.nom), "ca", { sensitivity: "base" });
      return activeSort.d === "asc" ? cmp : -cmp;
    });
  }, [activeEntryFilter, activeGeoFilter, activeModalityFilter, activeRows, activeSort, activeStatusFilter, activeTypeFilter, search]);

  const displayedSearchersTicket = useMemo(
    () => displayedSearchers.reduce((sum, row) => sum + (row.ticket ?? 0), 0),
    [displayedSearchers]
  );

  // ── Sankey data ───────────────────────────────────────────
  const sankeyData = useMemo(() => {
    const real = enrichedSearchers.filter(r => !r.isMock);
    const sc   = real.filter(r => r.formEntrada === "Search Capital");
    const eg   = real.filter(r => r.formEntrada === "Equity Gap");

    const scBacked   = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const scAcq      = companies.filter(c => isSfBackedCompany(c) && c.origen === "Search Capital").length;
    const scCercant  = Math.max(scBacked - scAcq, 0);
    const egInvertit = eg.filter(r =>
      r.statusScreening === "Invertit en fase d'adquisició" ||
      r.statusScreening === "Invertit en fase de cerca"
    ).length;
    const portfolio  = scAcq + egInvertit;

    const links = [
      { source: "Searchers",    target: "Cercant",      value: scCercant  },
      { source: "Searchers",    target: "Acabat Cerca", value: scAcq      },
      { source: "Equity Gap",   target: "Portafoli",    value: egInvertit },
      { source: "Acabat Cerca", target: "Portafoli",    value: scAcq      },
      { source: "Portafoli",    target: "Operant",      value: portfolio  },
    ].filter(l => l.value > 0);

    const usedIds = new Set(links.flatMap(l => [l.source, l.target]));
    const nodes = [...usedIds].map(id => ({ id }));

    return { nodes, links };
  }, [companies, enrichedSearchers]);

  // ── Conversations stats ────────────────────────────────────
  const convStats = useMemo(() => {
    const real        = enrichedSearchers.filter(r => !r.isMock);
    const sc          = real.filter(r => r.formEntrada === "Search Capital");
    const eg          = real.filter(r => r.formEntrada === "Equity Gap");
    const scBacked    = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const egInvertit  = eg.filter(r => r.statusScreening === "Invertit en fase d'adquisició" || r.statusScreening === "Invertit en fase de cerca").length;
    const allDescartat = real.filter(r => ["Descartat", "Sobresuscrit", "No tancat"].includes(r.statusScreening)).length;
    const allRevisio  = real.filter(r => ["En anàlisi", "Pendent de formalitzar"].includes(r.statusScreening)).length;
    return { total: real.length, scBacked, egInvertit, allDescartat, allRevisio };
  }, [enrichedSearchers]);

  const handleGeoClick = (geo) => {
    setActiveGeoFilter((current) => toggleActiveFilter(current, geo));
  };

  const handleEntryFilterClick = (entry) => {
    setActiveEntryFilter((current) => toggleActiveFilter(current, entry));
  };

  // ── Geography data (searchers only) ──────────────────────
  const geoData = useMemo(() => {
    const m = {};
    activeRows.forEach(s => {
      if (!m[s.geo]) m[s.geo] = { geo: s.geo, name: GEO_NAME[s.geo] || s.geo, value: 0, count: 0 };
      m[s.geo].value += s.ticket ?? 0;
      m[s.geo].count += 1;
    });
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, [activeRows]);

  const geoCountData = useMemo(
    () => [...geoData].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ca", { sensitivity: "base" })),
    [geoData]
  );
  const geoTotal = geoData.reduce((s, r) => s + r.value, 0);
  const geoCountTotal = geoCountData.reduce((s, r) => s + r.count, 0);
  const sortActive = (k) => setActiveSort(p => ({ k, d: p.k === k && p.d === "asc" ? "desc" : "asc" }));

  const isSummaryView = subTab === "resum";
  const isAllView     = subTab === "tots";
  const isActiveView  = subTab === "actius";
  const isLegacyView  = subTab === "legacy";

  // ── Historic table ─────────────────────────────────────────
  const getHistoricSortValue = (row, key) => {
    if (key === "geo") return GEO_NAME[row.geo] || row.geo || "";
    if (key === "stageLabel") return row.stageOrder ?? 0;
    if (key === "investmentYear") return row.investmentYear ?? 0;
    return row[key] ?? "";
  };

  const filteredHistoric = useMemo(() => {
    let d = [...enrichedSearchers];
    if (histFilter.status !== "Tots") d = d.filter(r => r.statusScreening === histFilter.status);
    if (histFilter.geo    !== "Tots") d = d.filter(r => r.geo === histFilter.geo);
    if (histFilter.entrada !== "Tots") d = d.filter(r => r.formEntrada === histFilter.entrada);
    return [...d].sort((a, b) => {
      const va = getHistoricSortValue(a, histSort.k);
      const vb = getHistoricSortValue(b, histSort.k);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "ca", { sensitivity: "base" });
      if (cmp === 0) cmp = String(a.nom).localeCompare(String(b.nom), "ca", { sensitivity: "base" });
      return histSort.d === "asc" ? cmp : -cmp;
    });
  }, [enrichedSearchers, histFilter, histSort]);

  const sortHist = k => setHistSort(p => ({ k, d: p.k === k && p.d === "asc" ? "desc" : "asc" }));

  const handleCSV = e => {
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

  const isMockNif = (nif) => !nif || String(nif).startsWith("MOCKNIF:");

  const exportNifExcel = async () => {
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

  const handleNifImport = (e) => {
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

  const reloadSearchers = async () => {
    const refreshed = await loadSearchers();
    if (!Array.isArray(refreshed)) {
      toast({ message: "No s'han pogut refrescar els searchers des de la base de dades.", type: "error" });
      return;
    }
    setHistoricData(refreshed);
    toast({ message: "Searchers recarregats des de la base de dades." });
  };

  // ── Handlers for historic table ───────────────────────────
  const saveSearcherField = async (target, field, value) => {
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

  const handleAddSearcher = async (values, setError) => {
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

  const handleDeleteSearcher = async (target) => {
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

  return (
    <div style={{ padding: "0 0 40px" }}>

      {/* ── Data load bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: TC.textLight }}>
          {historicData.length} searchers a base de dades
          {historicData.filter(r => isMockNif(r.nif)).length > 0 && (
            <span style={{ marginLeft: 6, color: "#B01F17", fontWeight: 600 }}>
              · {historicData.filter(r => isMockNif(r.nif)).length} sense NIF real
            </span>
          )}
        </span>
        <button onClick={reloadSearchers}
          style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11, color: TC.textMid, fontFamily: "inherit" }}>
          Recarregar DB
        </button>
        <button onClick={exportNifExcel}
          style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11, color: TC.textMid, fontFamily: "inherit" }}>
          ↓ Exportar NIFs
        </button>
        <input ref={nifXlsRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleNifImport} />
        <button onClick={() => nifXlsRef.current?.click()}
          style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11, color: TC.textMid, fontFamily: "inherit" }}>
          ↑ Importar NIFs
        </button>
        <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSV} />
        <button onClick={() => csvRef.current?.click()}
          style={{ background: TC.navy, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
          ↑ Importar CSV
        </button>
      </div>

      {/* ── Summary view: KPIs + Sankey + Geography ── */}
      {isSummaryView && (
        <SankeySection
          TC={TC}
          dark={dark}
          activeRows={activeRows}
          totalSearchers={totalSearchers}
          soloCount={soloCount}
          duoCount={duoCount}
          historicData={historicData}
          sankeyData={sankeyData}
          convStats={convStats}
          geoData={geoData}
          geoTotal={geoTotal}
          geoCountData={geoCountData}
          geoCountTotal={geoCountTotal}
          activeGeoFilter={activeGeoFilter}
          activeEntryFilter={activeEntryFilter}
          commitmentYearData={commitmentYearData}
          setActiveEntryFilter={setActiveEntryFilter}
          setActiveGeoFilter={setActiveGeoFilter}
          handleGeoClick={handleGeoClick}
          handleEntryFilterClick={handleEntryFilterClick}
        />
      )}

      {/* ── Active Searchers table ── */}
      {isActiveView && (
        <ActiveSearchersTable
          TC={TC}
          dark={dark}
          canEdit={canEdit}
          displayedSearchers={displayedSearchers}
          displayedSearchersTicket={displayedSearchersTicket}
          activeRows={activeRows}
          search={search}
          activeGeoFilter={activeGeoFilter}
          activeEntryFilter={activeEntryFilter}
          activeStatusFilter={activeStatusFilter}
          activeTypeFilter={activeTypeFilter}
          activeModalityFilter={activeModalityFilter}
          activeSort={activeSort}
          setActiveEntryFilter={setActiveEntryFilter}
          setActiveGeoFilter={setActiveGeoFilter}
          setActiveStatusFilter={setActiveStatusFilter}
          setActiveTypeFilter={setActiveTypeFilter}
          setActiveModalityFilter={setActiveModalityFilter}
          sortActive={sortActive}
          saveSearcherField={saveSearcherField}
          setShowAddModal={setShowAddModal}
        />
      )}

      {/* ── Legacy table ── */}
      {isLegacyView && (
        <LegacyTable
          TC={TC}
          dark={dark}
          canEdit={canEdit}
          legacyRows={legacyRows}
          saveSearcherField={saveSearcherField}
        />
      )}

      {/* ── Historic table ── */}
      {isAllView && (
        <HistoricTable
          TC={TC}
          dark={dark}
          canEdit={canEdit}
          filteredHistoric={filteredHistoric}
          historicData={historicData}
          histFilter={histFilter}
          histSort={histSort}
          setHistFilter={setHistFilter}
          sortHist={sortHist}
          saveSearcherField={saveSearcherField}
          handleDeleteSearcher={handleDeleteSearcher}
          setShowAddModal={setShowAddModal}
        />
      )}

      {showAddModal && (
        <AddRowModal
          title="Nou searcher"
          fields={[
            { key: "nom", label: "Nom", type: "text", placeholder: "Nom del searcher" },
            { key: "nif", label: "NIF", type: "text", placeholder: "B12345678" },
            { key: "tipus", label: "Tipus", type: "select", options: ["", "Tradicional", "Self-funded"] },
            { key: "modalitat", label: "Modalitat", type: "select", options: ["", ...SEARCHER_MODALITAT_OPTIONS] },
            { key: "geo", label: "Geografia", type: "select", options: ["", ...Object.keys(GEO_NAME).sort()] },
            { key: "statusScreening", label: "Status", type: "select", options: ["", ...SEARCHER_STATUS_OPTIONS] },
            { key: "formEntrada", label: "Entrada", type: "select", options: ["", ...SEARCHER_FORM_ENTRADA_OPTIONS] },
            { key: "dataInici", label: "Data inici", type: "date" },
            { key: "ticket", label: "Ticket (€)", type: "number" },
            { key: "equityStake", label: "Equity stake (%)", type: "number" },
          ]}
          onSave={handleAddSearcher}
          onClose={() => setShowAddModal(false)}
        />
      )}

    </div>
  );
}
