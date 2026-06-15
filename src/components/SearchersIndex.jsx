import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "../theme.js";
import { fmtM, fmtSignedM, formatIsoDateDMY, usePersistedState } from "../utils.js";
import { loadCapitalCalls, loadCompanies, loadSearchers } from "../db.js";
import { FlagImg, Badge, AddRowModal, DeleteRowButton, indexPageStyles } from "./SharedComponents.jsx";
import { isActualCompany } from "../data/privateCompanyModel.js";
import { SEARCHER_FORM_ENTRADA_OPTIONS, SEARCHER_MODALITAT_OPTIONS, SEARCHER_STATUS_OPTIONS, SEARCHER_STATUS_CFG, GEO_NAME } from "../config.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";
import { apiFetchJson } from "../apiClient.js";
import { normalizeSearcherName } from "../data/searcherModel.js";
import { estSection } from "../data/capitalCallStrategyModel.js";

const ENTRY_BADGE_CFG = {
  "Search Capital": { bg:"#E6EDF3", color:"#2563A8" },
  "Equity Gap": { bg:"#F5F0FA", color:"#6B2E7E" },
};

function calcMesos(dateIso) {
  if (!dateIso) return null;
  const start = new Date(dateIso);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

function isActiveSearcher(row) {
  if (row?.statusScreeningCode != null) return row.statusScreeningCode === 2;
  return row?.statusScreening === "Invertit en fase de cerca" || row?.statusScreening === "Invested - Search Phase";
}

function isInvestedUnacquiredSearcher(row, actualCompanyIds) {
  if (!(Number(row?.ticket ?? 0) > 0)) return false;
  // Already acquired a company → is now a participada, not an active searcher
  if (row?.companiaAdquirida) return false;
  // nif matches the private_entities.id used as the portfolio company's id
  const nif = String(row?.nif ?? "").trim();
  if (nif && actualCompanyIds.has(nif)) return false;
  return true;
}

export function SearchersIndexInner({ inline = false, searchOverride, subTab: subTabOverride, rawCC: rawCCOverride }) {
  const { tc } = useTheme();
  const navigate = useNavigate();
  const { canEditSection } = useAuth();
  const { toast } = useToast();
  const canEdit = canEditSection("searchers");
  const [searchLocal, setSearchLocal] = useState("");
  const search = searchOverride !== undefined ? searchOverride : searchLocal;
  const [subTab, setSubTab] = useState(subTabOverride ?? "tots");
  const showSubTabs = subTabOverride !== undefined;
  const [filters, setFilters] = useState({ tipus: "Tots", modalitat: "Tots", geo: "Tots", entrada: "Tots" });
  const [sortKey, setSortKey] = useState("ticket");
  const [sortDir, setSortDir] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchers, setSearchers] = usePersistedState("tc_allSearchers", []);
  const [rawCCStored, setRawCC] = usePersistedState("tc_rawCC", []);
  const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", []);
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

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const cols = [
    { k: "nom", label: "Nom", align: "left" },
    { k: "tipus", label: "Tipus", align: "left" },
    { k: "modalitat", label: "Modalitat", align: "left" },
    { k: "geo", label: "Geo", align: "center" },
    { k: "formEntrada", label: "Entrada", align: "left" },
    { k: "ticket", label: "Ticket", align: "right" },
    { k: "dataCompr", label: "Compromis", align: "left" },
    { k: "mesosCercant", label: "Mesos", align: "right" },
  ];

  const actualCompanyIds = useMemo(
    () => new Set((Array.isArray(companies) ? companies : []).filter(isActualCompany).map((company) => company.id).filter(Boolean)),
    [companies]
  );
  const trackedSearcherIds = useMemo(
    () => new Set(
      (Array.isArray(searchers) ? searchers : [])
        .map((row) => String(row?.nif ?? row?.id ?? "").trim())
        .filter(Boolean)
    ),
    [searchers]
  );
  const trackedSearcherNames = useMemo(
    () => new Set(
      (Array.isArray(searchers) ? searchers : [])
        .map((row) => normalizeSearcherName(row?.nom))
        .filter(Boolean)
    ),
    [searchers]
  );
  const trackedSearcherCoreTokens = useMemo(
    () => new Set(
      (Array.isArray(searchers) ? searchers : [])
        .map((row) => {
          const token = normalizeSearcherName(row?.nom).split(" ")[0];
          return token && token.length >= 4 ? token : null;
        })
        .filter(Boolean)
    ),
    [searchers]
  );

  const belongsToTrackedSearcher = (row) => {
    const entityId = String(row?.id ?? "").trim();
    if (entityId && trackedSearcherIds.has(entityId)) return true;
    const rNorm = normalizeSearcherName(row?.fons);
    if (trackedSearcherNames.has(rNorm)) return true;
    const coreToken = rNorm.split(" ")[0];
    if (coreToken && coreToken.length >= 4 && trackedSearcherCoreTokens.has(coreToken)) return true;
    return false;
  };

  const rows = useMemo(() => (
    searchers
      .filter((row) => !row.isLegacy && isInvestedUnacquiredSearcher(row, actualCompanyIds))
      .map((row) => ({
        ...row,
        mesosCercant: row.mesosCercant ?? calcMesos(row.dataCompr),
      }))
  ), [actualCompanyIds, searchers]);

  const legacyRows = useMemo(() => (
    searchers
      .filter((row) => row.isLegacy)
      .map((row) => ({
        ...row,
        mesosCercant: row.mesosCercant ?? calcMesos(row.dataCompr),
      }))
  ), [searchers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      if (subTab === "actius" && !isActiveSearcher(row)) return false;
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
  }, [filters, rows, search, subTab]);

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

  const transactionRows = useMemo(() => {
    const q = search.toLowerCase();
    return (Array.isArray(rawCC) ? rawCC : [])
      .filter((row) => estSection(row?.est) === "SF" && row?.cat !== "Compromís" && !actualCompanyIds.has(row?.id))
      .filter((row) => belongsToTrackedSearcher(row))
      .filter((row) => (
        !q ||
        String(row?.fons ?? "").toLowerCase().includes(q) ||
        String(row?.tipus ?? "").toLowerCase().includes(q) ||
        String(row?.cat ?? "").toLowerCase().includes(q)
      ))
      .sort((a, b) => String(b?.data ?? "").localeCompare(String(a?.data ?? "")));
  }, [actualCompanyIds, rawCC, search, trackedSearcherIds, trackedSearcherNames]);

  const commitmentRows = useMemo(
    () => (Array.isArray(rawCC) ? rawCC : [])
      .filter((row) => estSection(row?.est) === "SF" && row?.cat === "Compromís" && !actualCompanyIds.has(row?.id))
      .filter((row) => belongsToTrackedSearcher(row)),
    [actualCompanyIds, rawCC, trackedSearcherIds, trackedSearcherNames]
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div />
          {canEdit ? (
            <button
              onClick={() => setShowAddModal(true)}
              style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.navy, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}
            >
              + Nou searcher
            </button>
          ) : null}
        </div>

        {(subTab === "tots" || subTab === "actius" || !showSubTabs) && sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
        ) : (subTab === "tots" || subTab === "actius" || !showSubTabs) ? (
          <div style={indexPageStyles.panel(tc)}>
            <div style={indexPageStyles.tableScroll}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {cols.map(({ k, label, align }) => (
                  <th key={k} onClick={() => toggleSort(k)}
                    style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                    {label}<SortArrow k={k} />
                  </th>
                ))}
              </tr>
              <tr style={{ background: tc.card, borderBottom: `1px solid ${tc.border}` }}>
                <th style={{ padding: "6px 12px" }} />
                <th style={{ padding: "6px 12px" }}>
                  <select value={filters.tipus} onChange={(e) => setFilters((current) => ({ ...current, tipus: e.target.value }))}
                    style={indexPageStyles.filterControl(tc)}>
                    {["Tots", ...Array.from(new Set(rows.map((row) => row.tipus).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 12px" }}>
                  <select value={filters.modalitat} onChange={(e) => setFilters((current) => ({ ...current, modalitat: e.target.value }))}
                    style={indexPageStyles.filterControl(tc)}>
                    {["Tots", ...Array.from(new Set(rows.map((row) => row.modalitat).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 12px" }}>
                  <select value={filters.geo} onChange={(e) => setFilters((current) => ({ ...current, geo: e.target.value }))}
                    style={indexPageStyles.filterControl(tc)}>
                    {["Tots", ...Array.from(new Set(rows.map((row) => row.geo).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 12px" }}>
                  <select value={filters.entrada} onChange={(e) => setFilters((current) => ({ ...current, entrada: e.target.value }))}
                    style={indexPageStyles.filterControl(tc)}>
                    {["Tots", ...Array.from(new Set(rows.map((row) => row.formEntrada).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding: "6px 12px", textAlign: "right" }}>
                  {Object.values(filters).some((value) => value !== "Tots") ? (
                    <button onClick={() => setFilters({ tipus: "Tots", modalitat: "Tots", geo: "Tots", entrada: "Tots" })}
                      style={indexPageStyles.clearButton(tc)}>
                      netejar
                    </button>
                  ) : null}
                </th>
                <th style={{ padding: "6px 12px" }} />
                <th style={{ padding: "6px 12px" }} />
                {canEdit ? <th style={{ padding: "6px 12px" }} /> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => (
                <tr key={row.id ?? row.nom} className="hoverable"
                  onClick={() => row.id && navigate(`/investments/searchers/${encodeURIComponent(row.id)}`)}
                  style={{ background: index % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}`, cursor: row.id ? "pointer" : "default" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: tc.navy }}>
                    {row.nom}
                    {row.label && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, borderRadius: 5, padding: "2px 7px", verticalAlign: "middle", ...(SEARCHER_STATUS_CFG[row.label] ?? { bg: "#FEF3E2", color: "#8B5E00" }) }}>
                        {row.label}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{row.tipus || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{row.modalitat || "-"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}><FlagImg geo={row.geo} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge label={row.formEntrada || "-"} cfg={ENTRY_BADGE_CFG[row.formEntrada] || { bg: tc.bgAlt, color: tc.textMid }} />
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navyLight }}>{fmtM(row.ticket)}</td>
                  <td style={{ padding: "10px 12px", color: tc.textMid }}>{formatIsoDateDMY(row.dataCompr)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.textMid }}>{row.mesosCercant ?? "-"}</td>
                  {canEdit ? (
                    <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleLegacy(row, true)}
                        title="Moure a Legacy"
                        style={{ marginRight: 4, padding: "3px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textLight, cursor: "pointer", fontSize: 11 }}
                      >
                        Legacy
                      </button>
                      <DeleteRowButton onDelete={() => handleDeleteSearcher(row)} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </div>
        ) : subTab === "legacy" ? (
          legacyRows.length === 0 ? (
            <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap searcher a Legacy</div>
          ) : (
            <div style={indexPageStyles.panel(tc)}>
              <div style={indexPageStyles.tableScroll}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: tc.bgAlt }}>
                      {cols.map(({ k, label, align }) => (
                        <th key={k} style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {label}
                        </th>
                      ))}
                      {canEdit ? <th style={{ padding: "10px 12px" }} /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {legacyRows.map((row, index) => (
                      <tr key={row.id ?? row.nom} className="hoverable" style={{ background: index % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: tc.navy }}>
                          {row.nom}
                          {row.label && (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, borderRadius: 5, padding: "2px 7px", verticalAlign: "middle", ...(SEARCHER_STATUS_CFG[row.label] ?? { bg: "#FEF3E2", color: "#8B5E00" }) }}>
                              {row.label}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>{row.tipus || "-"}</td>
                        <td style={{ padding: "10px 12px" }}>{row.modalitat || "-"}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><FlagImg geo={row.geo} /></td>
                        <td style={{ padding: "10px 12px" }}>
                          <Badge label={row.formEntrada || "-"} cfg={ENTRY_BADGE_CFG[row.formEntrada] || { bg: tc.bgAlt, color: tc.textMid }} />
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navyLight }}>{fmtM(row.ticket)}</td>
                        <td style={{ padding: "10px 12px", color: tc.textMid }}>{formatIsoDateDMY(row.dataCompr)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.textMid }}>{row.mesosCercant ?? "-"}</td>
                        {canEdit ? (
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>
                            <button
                              onClick={() => handleToggleLegacy(row, false)}
                              title="Restaurar a Actius"
                              style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.navyLight, cursor: "pointer", fontSize: 11 }}
                            >
                              Actiu
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { label: "Compromís", value: fmtM(totalCommitment), color: tc.navyLight },
                { label: "Capital Cridat", value: fmtM(totalCalls), color: tc.navy },
                { label: "Total Rebut", value: fmtM(totalPaidBack), color: tc.green },
              ].map((card) => (
                <div key={card.label} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "14px 18px", borderTop: `3px solid ${card.color}` }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.06em", color: tc.textLight, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{card.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: card.color, fontFamily: "'DM Mono',monospace" }}>{card.value}</div>
                </div>
              ))}
            </div>

            {transactionRows.length === 0 ? (
              <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap transacció</div>
            ) : (
              <div style={indexPageStyles.panel(tc)}>
                <div style={indexPageStyles.tableScroll}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: tc.bgAlt }}>
                    {[
                      { key: "data", label: "Data", align: "left" },
                      { key: "fons", label: "Nom", align: "left" },
                      { key: "tipus", label: "Tipus", align: "left" },
                      { key: "cat", label: "Categoria", align: "left" },
                      { key: "eur", label: "Import", align: "right" },
                      { key: "fy", label: "FY", align: "left" },
                    ].map((col) => (
                      <th key={col.key} style={{ padding: "10px 12px", textAlign: col.align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactionRows.map((row, index) => (
                    <tr key={row._rowId ?? `${row.fons}-${row.data}-${row.cat}-${index}`} style={{ background: index % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}>
                      <td style={{ padding: "10px 12px", color: tc.textMid }}>{formatIsoDateDMY(row.data)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: tc.navy }}>{row.fons || "-"}</td>
                      <td style={{ padding: "10px 12px" }}>{row.tipus || "-"}</td>
                      <td style={{ padding: "10px 12px" }}>{row.cat || "-"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: row.eur < 0 ? tc.green : tc.navyLight }}>
                        {fmtSignedM(row.eur)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{row.fy || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </div>
            )}
          </div>
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
