import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "../theme.js";
import { calcMesos } from "../utils.js";
import { loadCapitalCalls, loadCompanies, loadSearchers } from "../db.js";
import { AddRowModal, indexPageStyles } from "./SharedComponents.jsx";
import { isActualCompany } from "../data/privateCompanyModel.js";
import { SEARCHER_FORM_ENTRADA_OPTIONS, SEARCHER_MODALITAT_OPTIONS, SEARCHER_STATUS_OPTIONS, GEO_NAME } from "../config.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";
import { apiFetchJson } from "../apiClient.js";
import { createSearcherCapitalCallMatcher, isActualCompanyCapitalCall, isActiveSearcher, isInvestedUnacquiredSearcher } from "../data/searcherModel.js";
import { SearchersLegacyTable, SearchersMainTable, SearchersTransactionsPanel } from "./searchers/SearchersIndexTables.jsx";


export function SearchersIndexInner({ inline = false, searchOverride, subTab: subTabOverride, rawCC: rawCCOverride }) {
  const { tc } = useTheme();
  const navigate = useNavigate();
  const { canEditSection } = useAuth();
  const { toast } = useToast();
  const canEdit = canEditSection("searchers");
  const globalSearch = searchOverride !== undefined ? searchOverride : "";
  const [subTab, setSubTab] = useState(subTabOverride ?? "tots");
  const showSubTabs = subTabOverride !== undefined;
  const [filters, setFilters] = useState({ nom: "", tipus: "Tots", modalitat: "Tots", geo: "Tots", entrada: "Tots" });
  const [sortKey, setSortKey] = useState("ticket");
  const [sortDir, setSortDir] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchers, setSearchers] = useState([]);
  const [rawCCStored, setRawCC] = useState([]);
  const [companies, setCompanies] = useState([]);
  const rawCC = rawCCOverride !== undefined ? rawCCOverride : rawCCStored;

  useEffect(() => {
    // Skip fetches when parent already provides the data via props
    if (rawCCOverride === undefined) {
      loadCapitalCalls().then((data) => {
        if (Array.isArray(data)) setRawCC(data);
      }).catch((error) => {
        console.error("Searchers transactions refresh failed:", error);
      });
    }
    if (!Array.isArray(searchers) || searchers.length === 0) {
      loadSearchers().then((data) => {
        if (Array.isArray(data)) setSearchers(data);
      }).catch((error) => {
        console.error("Searchers index refresh failed:", error);
      });
    }
    if (!Array.isArray(companies) || companies.length === 0) {
      loadCompanies().then((data) => {
        if (Array.isArray(data)) setCompanies(data);
      }).catch((error) => {
        console.error("Searchers companies refresh failed:", error);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (subTabOverride) setSubTab(subTabOverride);
  }, [subTabOverride]);

  const reloadSearchers = async () => {
    const refreshed = await loadSearchers();
    if (Array.isArray(refreshed)) setSearchers(refreshed);
    return refreshed;
  };

  const handleAddSearcher = async (values, setError) => {
    const nom = values.nom?.trim();
    if (!nom) { setError("El nom és obligatori"); return; }
    if (searchers.some((row) => String(row.nom ?? "").trim().toLowerCase() === nom.toLowerCase())) {
      setError("Ja existeix un searcher amb aquest nom");
      return;
    }
    const searcher = {
      nom,
      tipus: values.tipus || null,
      modalitat: values.modalitat || null,
      geo: values.geo || null,
      statusScreening: values.statusScreening || null,
      formEntrada: values.formEntrada || null,
      introPer: null,
      searcher1: null,
      searcher2: null,
      escola1: null,
      escola2: null,
      ticket: parseFloat(values.ticket) || null,
      dataInici: values.dataInici || null,
      dataCompr: null,
      mesosCercant: null,
      equityStake: parseFloat(values.equityStake) || null,
      isMock: false,
      nif: values.nif?.trim() || null,
    };
    try {
      await apiFetchJson("/api/searchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searcher),
      });
    } catch (error) {
      setError(error?.message || "Error en crear el searcher");
      return;
    }
    await reloadSearchers();
    setShowAddModal(false);
    toast({ message: `Searcher creat: ${nom}` });
  };

  const handleDeleteSearcher = async (row) => {
    if (!row?.id) {
      toast({ message: "No es pot eliminar aquest searcher.", type: "error" });
      return;
    }
    try {
      await apiFetchJson(`/api/searchers?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
    } catch (error) {
      toast({ message: "Error eliminant searcher: " + (error?.message || "error desconegut"), type: "error" });
      return;
    }
    await reloadSearchers();
    toast({ message: "Searcher eliminat." });
  };

  const handleToggleLegacy = async (row, isLegacy) => {
    if (!row?.id) {
      toast({ message: "No es pot modificar aquest searcher.", type: "error" });
      return;
    }
    try {
      await apiFetchJson(`/api/searchers?id=${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLegacy }),
      });
    } catch (error) {
      toast({ message: "Error actualitzant searcher: " + (error?.message || "error desconegut"), type: "error" });
      return;
    }
    await reloadSearchers();
    toast({ message: isLegacy ? `${row.nom} mogut a Legacy.` : `${row.nom} restaurat a Actius.` });
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((value) => value === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "nom" || key === "geo" ? "asc" : "desc"); }
  };

  const actualCompanyIds = useMemo(
    () => new Set((Array.isArray(companies) ? companies : []).filter(isActualCompany).map((company) => company.id).filter(Boolean)),
    [companies]
  );
  const belongsToTrackedSearcher = useMemo(
    () => createSearcherCapitalCallMatcher(searchers),
    [searchers]
  );

  const rows = useMemo(() => (
    searchers
      .filter((row) => !row.isLegacy && isInvestedUnacquiredSearcher(row, actualCompanyIds))
      .map((row) => ({
        ...row,
        mesosCercant: row.mesosCercant ?? calcMesos(row.dataCompr, { fallback: null }),
      }))
  ), [actualCompanyIds, searchers]);

  const legacyRows = useMemo(() => (
    searchers
      .filter((row) => row.isLegacy)
      .map((row) => ({
        ...row,
        mesosCercant: row.mesosCercant ?? calcMesos(row.dataCompr, { fallback: null }),
      }))
  ), [searchers]);

  const filtered = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    const nameQ = filters.nom.toLowerCase().trim();
    return rows.filter((row) => {
      if (subTab === "actius" && !isActiveSearcher(row)) return false;
      if (nameQ && !String(row.nom ?? "").toLowerCase().includes(nameQ)) return false;
      if (q && !(
        row.nom?.toLowerCase().includes(q) ||
        `${row.searcher1 ?? ""} ${row.searcher2 ?? ""}`.toLowerCase().includes(q)
      )) return false;
      if (filters.tipus !== "Tots" && row.tipus !== filters.tipus) return false;
      if (filters.modalitat !== "Tots" && row.modalitat !== filters.modalitat) return false;
      if (filters.geo !== "Tots" && row.geo !== filters.geo) return false;
      if (filters.entrada !== "Tots" && row.formEntrada !== filters.entrada) return false;
      return true;
    });
  }, [filters, globalSearch, rows, subTab]);

  const filteredLegacyRows = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    const nameQ = filters.nom.toLowerCase().trim();
    return legacyRows.filter((row) => {
      if (nameQ && !String(row.nom ?? "").toLowerCase().includes(nameQ)) return false;
      if (q && !(
        row.nom?.toLowerCase().includes(q) ||
        `${row.searcher1 ?? ""} ${row.searcher2 ?? ""}`.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [globalSearch, legacyRows, filters.nom]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av;
      let bv;
      if (sortKey === "ticket") { av = a.ticket ?? 0; bv = b.ticket ?? 0; }
      else if (sortKey === "dataCompr") { av = a.dataCompr ?? ""; bv = b.dataCompr ?? ""; }
      else if (sortKey === "mesosCercant") { av = a.mesosCercant ?? -1; bv = b.mesosCercant ?? -1; }
      else if (sortKey === "geo") { av = a.geo ?? ""; bv = b.geo ?? ""; }
      else { av = (a[sortKey] ?? "").toString().toLowerCase(); bv = (b[sortKey] ?? "").toString().toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortDir, sortKey]);

  const transactionRowsBase = useMemo(
    () => (Array.isArray(rawCC) ? rawCC : [])
      .filter((row) => row?.cat !== "Compromís" && !isActualCompanyCapitalCall(row, actualCompanyIds))
      .filter((row) => belongsToTrackedSearcher(row)),
    [actualCompanyIds, belongsToTrackedSearcher, rawCC]
  );

  const transactionRows = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    const nameQ = filters.nom.toLowerCase().trim();
    return transactionRowsBase
      .filter((row) => !nameQ || String(row?.fons ?? "").toLowerCase().includes(nameQ))
      .filter((row) => (
        !q ||
        String(row?.fons ?? "").toLowerCase().includes(q) ||
        String(row?.tipus ?? "").toLowerCase().includes(q) ||
        String(row?.cat ?? "").toLowerCase().includes(q)
      ))
      .sort((a, b) => String(b?.data ?? "").localeCompare(String(a?.data ?? "")));
  }, [globalSearch, transactionRowsBase, filters.nom]);

  const commitmentRows = useMemo(
    () => (Array.isArray(rawCC) ? rawCC : [])
      .filter((row) => row?.cat === "Compromís" && !isActualCompanyCapitalCall(row, actualCompanyIds))
      .filter((row) => belongsToTrackedSearcher(row)),
    [actualCompanyIds, belongsToTrackedSearcher, rawCC]
  );
  const totalCommitment = useMemo(
    () => commitmentRows.reduce((sum, row) => sum + Number(row?.eur ?? 0), 0),
    [commitmentRows]
  );
  const totalCalls = useMemo(
    () => transactionRows.filter((row) => row?.cat === "Capital Call").reduce((sum, row) => sum + Math.abs(Number(row?.eur ?? 0)), 0),
    [transactionRows]
  );
  const totalPaidBack = useMemo(
    () => transactionRows.filter((row) => row?.cat === "Distribució" || row?.cat === "Retorn Capital").reduce((sum, row) => sum + Math.abs(Number(row?.eur ?? 0)), 0),
    [transactionRows]
  );

  return (
    <div style={indexPageStyles.page(tc, inline)}>
      <div style={indexPageStyles.contentWrap}>
        {canEdit ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.navy, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}
            >
              + Nou searcher
            </button>
          </div>
        ) : null}

        {(subTab === "tots" || subTab === "actius" || !showSubTabs) ? (
          <SearchersMainTable
            tc={tc}
            rows={rows}
            sortedRows={sorted}
            filters={filters}
            setFilters={setFilters}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
            canEdit={canEdit}
            navigate={navigate}
            onToggleLegacy={handleToggleLegacy}
            onDeleteSearcher={handleDeleteSearcher}
          />
        ) : subTab === "legacy" ? (
          <SearchersLegacyTable
            tc={tc}
            rows={filteredLegacyRows}
            hasRows={legacyRows.length > 0}
            filters={filters}
            setFilters={setFilters}
            canEdit={canEdit}
            onToggleLegacy={handleToggleLegacy}
          />
        ) : (
          <SearchersTransactionsPanel
            tc={tc}
            filters={filters}
            setFilters={setFilters}
            transactionRowsBase={transactionRowsBase}
            transactionRows={transactionRows}
            totalCommitment={totalCommitment}
            totalCalls={totalCalls}
            totalPaidBack={totalPaidBack}
          />
        )}
      </div>

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

export default function SearchersIndex() {
  return (
    <ThemeProvider>
      <SearchersIndexInner />
    </ThemeProvider>
  );
}

