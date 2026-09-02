import { useEffect, useMemo, useState, useRef } from "react";
import { useTheme } from "../theme.js";
import { calcMesos, usePersistedState } from "../utils.js";
import { GEO_NAME } from "../config.js";
import { AddRowModal } from "./SharedComponents.jsx";
import { useAuth } from "../auth.jsx";
import { loadSearchers, loadCompanies, loadCapitalCalls } from "../db.js";
import { useToast } from "../toast.jsx";
import { isSfBackedCompany } from "../data/privateCompanyModel.js";
import { enrichSearchersWithCapitalCalls } from "../data/searcherModel.js";
import { toggleActiveFilter } from "../data/searcherFormatting.js";
import { SankeySection } from "./searchers/SankeySection.jsx";
import { ActiveSearchersTable } from "./searchers/ActiveSearchersTable.jsx";
import { LegacyTable } from "./searchers/LegacyTable.jsx";
import { HistoricTable } from "./searchers/HistoricTable.jsx";
import { getActiveSortValue, getHistoricSortValue } from "../data/searchersTabHelpers.js";
import { makeHandleCSV, makeExportNifExcel, makeHandleNifImport } from "./searchers/searchersTabIO.js";
import { makeSaveSearcherField, makeHandleAddSearcher, makeHandleDeleteSearcher } from "./searchers/searchersTabMutations.js";
import { SearchersDataLoadBar } from "./searchers/SearchersDataLoadBar.jsx";
import { SEARCHER_ADD_MODAL_FIELDS } from "./searchers/searchersAddModalFields.js";

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

  const enrichedSearchers = useMemo(
    () => enrichSearchersWithCapitalCalls(historicData, capitalCalls, { calcMonths: calcMesos }),
    [capitalCalls, historicData]
  );

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

  const handleCSV = makeHandleCSV({ toast, setHistoricData });

  const exportNifExcel = makeExportNifExcel({ toast, historicData });

  const handleNifImport = makeHandleNifImport({ toast, historicData, setHistoricData });

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
  const saveSearcherField = makeSaveSearcherField({ toast, historicData, setHistoricData });

  const handleAddSearcher = makeHandleAddSearcher({ toast, historicData, setHistoricData, setShowAddModal });

  const handleDeleteSearcher = makeHandleDeleteSearcher({ toast, historicData, setHistoricData });

  return (
    <div style={{ padding: "0 0 40px" }}>

      {/* ── Data load bar ── */}
      <SearchersDataLoadBar
        TC={TC}
        historicData={historicData}
        reloadSearchers={reloadSearchers}
        exportNifExcel={exportNifExcel}
        handleNifImport={handleNifImport}
        handleCSV={handleCSV}
        nifXlsRef={nifXlsRef}
        csvRef={csvRef}
      />

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
          fields={SEARCHER_ADD_MODAL_FIELDS}
          onSave={handleAddSearcher}
          onClose={() => setShowAddModal(false)}
        />
      )}

    </div>
  );
}
