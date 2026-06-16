import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { VCPE_CFG, EST_CFG, VEHICLE_TIPUS_CFG } from "../config.js";
import { ThemeProvider, useTheme } from "../theme.js";
import { fmtM, readStoredJSON, writeStoredJSON, formatMultiple, multipleColor } from "../utils.js";
import { Badge, EditableCell, DeleteRowButton, indexPageStyles, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
import { upsertFundMeta, upsertFundMetaFiEnd, updateFundMetaVehicleTipus, insertFund, deleteFund, loadAll, loadCapitalCalls, loadFundMeta, renamePrivateEntity } from "../db.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";
import { getVehiclePermissionSection } from "../permissions.js";
import { computeFundIrrFromRows, makeFundRouteId } from "../data/fundDetailModel.js";
import { convertAmountToEurOnDate } from "../fx.js";
import { CAPITAL_CALL_STRATEGY_OPTIONS, defaultCapitalCallStrategyForVehicleTipus } from "../data/capitalCallStrategyModel.js";

export function FundsIndexInner({ inline = false, searchOverride, vcpeTypes, excludeIds }) {
  const { canAccessSection, canEditSection, isAdmin, isSuperuser } = useAuth();
  const { toast } = useToast();
  const { tc } = useTheme();
  const canAccessAlternatives = canAccessSection("alternatives");
  const canAccessRealEstate = canAccessSection("real-estate");
  const canEditAlternatives = canEditSection("alternatives");
  const canEditRealEstate = canEditSection("real-estate");
  const canEditAny = canEditAlternatives || canEditRealEstate;
  const [searchLocal, setSearchLocal] = useState("");
  const search = searchOverride !== undefined ? searchOverride : searchLocal;
  const [sortKey, setSortKey] = useState("compromis");
  const [sortDir, setSortDir] = useState("desc");
  const [filters, setFilters] = useState({
    nom: "",
    id: "",
    tipus: "Tots",
    year: "",
    compromis: "",
    cridat: "",
    utilizat: "",
    tvpi: "",
    irr: "",
    dpi: "",
    rvpi: "",
    recallablePool: "",
  });

  const [rawCC, setRawCC] = useState(() => readStoredJSON("tc_rawCC", []));

  useEffect(() => {
    const handler = () => setRawCC(readStoredJSON("tc_rawCC", []));
    window.addEventListener("tc-rawcc-updated", handler);
    return () => window.removeEventListener("tc-rawcc-updated", handler);
  }, []);

  const persistRawCC = (updated) => {
    setRawCC(updated);
    writeStoredJSON("tc_rawCC", updated);
  };

  const [fundMeta, setFundMeta] = useState(() => readStoredJSON("tc_fundMeta", []));

  useEffect(() => {
    loadFundMeta().then((meta) => {
      if (Array.isArray(meta)) {
        setFundMeta(meta);
        writeStoredJSON("tc_fundMeta", meta);
      }
    }).catch((error) => {
      console.error("Fund meta refresh failed:", error);
    });
  }, []);

  const saveTvpi = async (fund, tvpi) => {
    const fundRows = rawCC.filter((row) => makeFundRouteId(row) === fund.routeId);
    const irr = computeFundIrrFromRows(fundRows, tvpi);
    const updated = fundMeta.some(m => (m.id ?? m.fons) === (fund.id ?? fund.fons))
      ? fundMeta.map(m => (m.id ?? m.fons) === (fund.id ?? fund.fons) ? { ...m, tvpi, irr } : m)
      : [...fundMeta, { id: fund.id ?? undefined, fons: fund.fons, tvpi, irr }];
    setFundMeta(updated);
    writeStoredJSON("tc_fundMeta", updated);
    const { error } = await upsertFundMeta(fund, tvpi, irr);
    if (error) toast({ message: "Error desant TVPI: " + error.message, type: "error" });
  };

  const saveFiEnd = async (fund, fiEnd) => {
    const val = fiEnd || null;
    const updated = fundMeta.some(m => (m.id ?? m.fons) === (fund.id ?? fund.fons))
      ? fundMeta.map(m => (m.id ?? m.fons) === (fund.id ?? fund.fons) ? { ...m, fiEnd: val } : m)
      : [...fundMeta, { id: fund.id ?? undefined, fons: fund.fons, fiEnd: val }];
    setFundMeta(updated);
    writeStoredJSON("tc_fundMeta", updated);
    const { error } = await upsertFundMetaFiEnd(fund, val);
    if (error) toast({ message: "Error desant fi inversió: " + error.message, type: "error" });
  };

  const saveVehicleTipus = async (fund, vehicleTipus) => {
    if (!fund.id) return;
    const { error } = await updateFundMetaVehicleTipus(fund.id, vehicleTipus || null);
    if (error) { toast({ message: "Error desant tipus: " + error.message, type: "error" }); return; }
    const updatedMeta = fundMeta.some(m => (m.id ?? m.fons) === (fund.id ?? fund.fons))
      ? fundMeta.map(m => (m.id ?? m.fons) === (fund.id ?? fund.fons) ? { ...m, vehicleTipus: vehicleTipus || null } : m)
      : [...fundMeta, { id: fund.id, fons: fund.fons, vehicleTipus: vehicleTipus || null }];
    setFundMeta(updatedMeta);
    writeStoredJSON("tc_fundMeta", updatedMeta);
    const freshCC = await loadCapitalCalls({ skipCompanions: true });
    if (freshCC) {
      persistRawCC(freshCC);
      window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
    }
    toast({ message: "Tipus desat" });
  };

  const handleDeleteFund = async (fund) => {
    const err = await deleteFund(fund);
    if (err) {
      toast({ message: "Error eliminant fons: " + err.message, type: "error" });
      return;
    }
    const fundId = fund?.id ?? null;
    const fundName = fund?.fons ?? "";
    const updatedCC = rawCC.filter(r => (fundId ? r.id !== fundId : r.fons !== fundName));
    persistRawCC(updatedCC);
    const updatedMeta = fundMeta.filter(m => (fundId ? m.id !== fundId : m.fons !== fundName));
    setFundMeta(updatedMeta);
    writeStoredJSON("tc_fundMeta", updatedMeta);
    toast({ message: `Fons "${fundName}" eliminat.` });
  };

  const defaultVcpe = canEditAlternatives ? "PE" : "RE";
  const [addingFund, setAddingFund] = useState(false);
  const [newFund, setNewFund] = useState({ fons: "", vehicleTipus: defaultVcpe, est: defaultCapitalCallStrategyForVehicleTipus(defaultVcpe), compromis: "", divisa: "EUR" });

  useEffect(() => {
    setNewFund((current) => {
      if (current.vehicleTipus === "RE" && canEditRealEstate) return current;
      if ((current.vehicleTipus === "PE" || current.vehicleTipus === "VC") && canEditAlternatives) return current;
      return { ...current, vehicleTipus: defaultVcpe, est: defaultCapitalCallStrategyForVehicleTipus(defaultVcpe) };
    });
  }, [canEditAlternatives, canEditRealEstate, defaultVcpe]);

  const handleAddFund = async (e) => {
    e.preventDefault();
    if (!newFund.fons.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    let conversion;
    try {
      conversion = await convertAmountToEurOnDate({
        amount: parseFloat(newFund.compromis) || 0,
        currency: newFund.divisa,
        date: today,
      });
    } catch (error) {
      toast({ message: "Error calculant canvi EUR/USD: " + (error?.message || "error desconegut"), type: "error" });
      return;
    }
    const row = await insertFund(
      newFund.fons.trim(),
      newFund.vehicleTipus,
      newFund.est,
      conversion.eur,
      newFund.divisa,
      conversion,
    );
    if (!row) { toast({ message: "Error en crear el fons", type: "error" }); return; }
    persistRawCC([...rawCC, row]);
    setFundMeta(prev => [...prev, { id: row.id, fons: row.fons, vehicleTipus: row.vehicleTipus, tvpi: null, irr: null }]);
    setAddingFund(false);
    setNewFund({ fons: "", vehicleTipus: defaultVcpe, est: defaultCapitalCallStrategyForVehicleTipus(defaultVcpe), compromis: "", divisa: "EUR" });
    toast({ message: `Fons "${newFund.fons.trim()}" afegit.` });
  };

  const rows = useMemo(() => {
    const map = new Map();
    const vcpeSet = vcpeTypes ?? null;
    for (const r of rawCC.filter((row) => (!vcpeSet || vcpeSet.includes(row?.vehicleTipus)) && !(excludeIds?.has(row?.id)))) {
      const key = makeFundRouteId(r);
      if (!map.has(key)) map.set(key, { id: r.id ?? null, routeId: key, fons: r.fons, vehicleTipus: r.vehicleTipus, est: r.est, compromis: 0, calls: 0, dist: 0, recallablePool: 0, year: null, isMock: !!r.isMock });
      const f = map.get(key);
      if (r.cat === "Compromís") {
        f.compromis += r.eur;
        const yr = r.data ? Number(String(r.data).slice(0, 4)) : null;
        if (yr && Number.isFinite(yr) && (f.year === null || yr < f.year)) f.year = yr;
      }
      if (r.cat === "Capital Call") f.calls += r.eur;
      if (r.cat === "Distribució" || r.cat === "Retorn Capital") f.dist += Math.abs(r.eur);
      if (r.cat === "Distribució" && r.recallable) f.recallablePool += Number(r.recallable);
      if (r.cat === "Capital Call" && r.from_recallable) f.recallablePool -= Number(r.from_recallable);
    }
    return Array.from(map.values()).map(f => {
      const meta = fundMeta.find(m => (m.id ?? m.fons) === (f.id ?? f.fons));
      const tvpi = meta?.tvpi ?? null;
      const dpi = f.calls > 0 ? f.dist / f.calls : 0;
      const rvpi = tvpi != null ? tvpi - dpi : null;
      const fundRows = rawCC.filter((row) => makeFundRouteId(row) === f.routeId);
      const irr = meta?.irr ?? computeFundIrrFromRows(fundRows, tvpi);
      return {
        ...f,
        vehicleTipus: meta?.vehicleTipus ?? null,
        utilizat: f.compromis > 0 ? (f.calls / f.compromis) * 100 : null,
        tvpi,
        irr,
        dpi,
        rvpi,
        fiEnd: meta?.fiEnd ?? null,
        recallablePool: Math.max(0, Math.round(f.recallablePool * 100) / 100),
      };
    });
  }, [rawCC, fundMeta, vcpeTypes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const shouldIncludeRow = (row) => {
      if (Array.isArray(vcpeTypes) && vcpeTypes.length > 0) {
        const sectionId = getVehiclePermissionSection(row);
        if (vcpeTypes.includes("RE")) return sectionId === "real-estate" && canAccessRealEstate;
        return sectionId === "alternatives" && canAccessAlternatives;
      }
      const sectionId = getVehiclePermissionSection(row);
      if (canAccessAlternatives) return sectionId === "alternatives";
      if (canAccessRealEstate) return sectionId === "real-estate";
      return false;
    };
    return rows.filter((row) => {
      if (!shouldIncludeRow(row)) return false;
      if (q && !row.fons.toLowerCase().includes(q)) return false;
      if (filters.nom && !row.fons.toLowerCase().includes(filters.nom.toLowerCase())) return false;
      if (filters.id && !String(row.id ?? "").toLowerCase().includes(filters.id.toLowerCase())) return false;
      if (filters.tipus !== "Tots" && row.vehicleTipus !== filters.tipus) return false;
      if (filters.year && !String(row.year ?? "").includes(filters.year)) return false;
      if (filters.compromis && !String(row.compromis ?? "").includes(filters.compromis)) return false;
      if (filters.cridat && !String(row.calls ?? "").includes(filters.cridat)) return false;
      if (filters.utilizat && !String(row.utilizat ?? "").includes(filters.utilizat)) return false;
      if (filters.tvpi && !String(row.tvpi ?? "").includes(filters.tvpi)) return false;
      if (filters.irr && !String(row.irr ?? "").includes(filters.irr)) return false;
      if (filters.dpi && !String(row.dpi ?? "").includes(filters.dpi)) return false;
      if (filters.rvpi && !String(row.rvpi ?? "").includes(filters.rvpi)) return false;
      if (filters.recallablePool && !String(row.recallablePool ?? "").includes(filters.recallablePool)) return false;
      return true;
    });
  }, [rows, search, canAccessAlternatives, canAccessRealEstate, vcpeTypes, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isMock !== b.isMock) return a.isMock ? -1 : 1;
      let av, bv;
      if (sortKey === "compromis") { av = a.compromis ?? 0; bv = b.compromis ?? 0; }
      else if (sortKey === "cridat") { av = a.calls ?? 0; bv = b.calls ?? 0; }
      else if (sortKey === "utilizat") { av = a.utilizat ?? -1; bv = b.utilizat ?? -1; }
      else if (sortKey === "id") { av = a.id ?? ""; bv = b.id ?? ""; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else if (sortKey === "irr") { av = a.irr ?? -Infinity; bv = b.irr ?? -Infinity; }
      else if (sortKey === "dpi") { av = a.dpi ?? -1; bv = b.dpi ?? -1; }
      else if (sortKey === "rvpi") { av = a.rvpi ?? -1; bv = b.rvpi ?? -1; }
      else if (sortKey === "year") { av = a.year ?? 9999; bv = b.year ?? 9999; }
      else if (sortKey === "vcpe") { av = a.vehicleTipus ?? ""; bv = b.vehicleTipus ?? ""; }
      else if (sortKey === "fiEnd") { av = a.fiEnd ?? "9999"; bv = b.fiEnd ?? "9999"; }
      else if (sortKey === "recallablePool") { av = a.recallablePool ?? 0; bv = b.recallablePool ?? 0; }
      else { av = a.fons.toLowerCase(); bv = b.fons.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const utilizatColor = v => {
    if (v == null) return tc.textLight;
    if (v < 50) return tc.red;
    if (v < 80) return tc.warning;
    return tc.green;
  };

  const COLS = [
    { k: "nom",       label: "Nom",      align: "left" },
    { k: "id",        label: "NIF",      align: "left" },
    { k: "vcpe",      label: "Fons",     align: "left" },
    { k: "year",      label: "Any",      align: "right" },
    { k: "compromis", label: "Compromís",align: "right" },
    { k: "cridat",        label: "Cridat",    align: "right" },
    { k: "utilizat",  label: "Utilizat", align: "right" },
    { k: "tvpi",      label: "TVPI",     align: "right", title: "Total Value to Paid-In" },
    { k: "irr",       label: "IRR",      align: "right", title: "Money-weighted return based on dated flows and current residual value" },
    { k: "dpi",       label: "DPI",      align: "right", title: "Distributions to Paid-In" },
    { k: "rvpi",      label: "RVPI",     align: "right", title: "Residual Value to Paid-In" },
    { k: "fiEnd",     label: "Fi Inv.",  align: "right", title: "Fi del període d'inversió — quan el capital compromès no cridat queda lliure" },
  ];

  return (
    <div style={indexPageStyles.page(tc, inline)}>
      <div style={indexPageStyles.contentWrap}>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
          : (
          <>
            <SectionHeader title="Vehicles" count={filtered.length} tc={tc} />
            <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {COLS.map(({ k, label, align, title }) => (
                    <th key={k} onClick={() => toggleSort(k)} title={title}
                      style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap", userSelect: "none", textAlign: align, cursor: "pointer" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
                  {canEditAny && <th style={{ width: 40, padding: "9px 14px", fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap", userSelect: "none" }} />}
                </tr>
                <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
                  <th style={{ padding: "6px 12px" }}>
                    <input value={filters.nom} onChange={(e) => setFilters((current) => ({ ...current, nom: e.target.value }))}
                      style={indexPageStyles.filterControl(tc)} />
                  </th>
                  <th style={{ padding: "6px 12px" }}>
                    <input value={filters.id} onChange={(e) => setFilters((current) => ({ ...current, id: e.target.value }))}
                      style={indexPageStyles.filterControl(tc)} />
                  </th>
                  <th style={{ padding: "6px 12px" }}>
                    <select value={filters.tipus} onChange={(e) => setFilters((current) => ({ ...current, tipus: e.target.value }))}
                      style={indexPageStyles.filterControl(tc)}>
                      {["Tots", ...Array.from(new Set(rows.map((row) => row.vehicleTipus).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </th>
                  {["year","compromis","cridat","utilizat","tvpi","irr","dpi","rvpi"].map((key) => (
                    <th key={key} style={{ padding: "6px 12px" }}>
                      <input value={filters[key]} onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}
                        style={indexPageStyles.filterControl(tc)} />
                    </th>
                  ))}
                  {canEditAny && (
                    <th style={{ padding: "6px 12px" }}>
                      {Object.values(filters).some((value) => value !== "" && value !== "Tots") ? (
                        <button onClick={() => setFilters({ nom: "", id: "", tipus: "Tots", year: "", compromis: "", cridat: "", utilizat: "", tvpi: "", irr: "", dpi: "", rvpi: "" })}
                          style={indexPageStyles.clearButton(tc)}>
                          netejar
                        </button>
                      ) : null}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const rowCanEdit = getVehiclePermissionSection(r) === "real-estate" ? canEditRealEstate : canEditAlternatives;
                  const canEditTvpi = rowCanEdit || isAdmin || isSuperuser;
                  return (
                  <tr key={r.routeId ?? r.id ?? r.fons} className="hoverable" style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}`, opacity: r.isMock ? 0.45 : 1 }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link to={`/investments/funds/${encodeURIComponent(r.routeId ?? r.id ?? r.fons)}`} style={{ color: tc.navy, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        <EditableCell value={r.fons} type="text"
                          onSave={async (value) => {
                            const nextName = value?.trim();
                            if (!nextName || !r.id) return;
                            const { error } = await renamePrivateEntity(r.id, nextName);
                            if (error) {
                              toast({ message: "Error canviant el nom del vehicle: " + error.message, type: "error" });
                              return;
                            }
                            const refreshed = await loadAll();
                            if (refreshed?.rawCC) persistRawCC(refreshed.rawCC);
                            if (refreshed?.fundMeta) {
                              setFundMeta(refreshed.fundMeta);
                              writeStoredJSON("tc_fundMeta", refreshed.fundMeta);
                            }
                          }}
                          disabled={!rowCanEdit || !r.id} />
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight }}>
                      {r.id ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {rowCanEdit && r.id ? (
                        <select
                          value={r.vehicleTipus ?? ""}
                          onChange={e => saveVehicleTipus(r, e.target.value)}
                          style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}
                        >
                          <option value="">—</option>
                          {["PE", "VC", "RE", "SF", "PC"].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : r.vehicleTipus ? (
                        <Badge label={r.vehicleTipus} cfg={VEHICLE_TIPUS_CFG[r.vehicleTipus] || {}} />
                      ) : (
                        <span style={{ color: "#aaa", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.textMid }}>
                      {r.year ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {r.compromis ? fmtM(r.compromis) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {r.calls ? fmtM(r.calls) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: utilizatColor(r.utilizat) }}>
                      {r.utilizat != null ? `${r.utilizat.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi, tc) }}>
                      <EditableCell value={r.tvpi} type="number" align="right"
                        fmt={formatMultiple} onSave={v => saveTvpi(r, v)}
                        disabled={!canEditTvpi} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi, tc) }}>
                      {r.irr != null ? `${r.irr.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpi, tc) }}>
                      {formatMultiple(r.dpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpi, tc) }}>
                      {formatMultiple(r.rvpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.textMid }}>
                      <EditableCell value={r.fiEnd} type="text" align="right"
                        emptyDisplay="—" onSave={v => saveFiEnd(r, v)}
                        disabled={!canEditTvpi} />
                    </td>
                    {canEditAny && (
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        {rowCanEdit ? <DeleteRowButton onDelete={() => handleDeleteFund(r)} /> : null}
                      </td>
                    )}
                  </tr>
                );})}
              </tbody>
            </table>
            </div>
          </>
          )
        }
      {canEditAny && (
        <div style={{ marginTop: 16 }}>
          {!addingFund ? (
            <button onClick={() => setAddingFund(true)}
              style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 10,
                padding: "8px 16px", cursor: "pointer", fontSize: 12, color: tc.textMid,
                fontFamily: "inherit", fontWeight: 600 }}>
              + Nou fons
            </button>
          ) : (
            <form onSubmit={handleAddFund}
              style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end",
                background: tc.bgAlt, padding: 12, borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nom</div>
                <input value={newFund.fons} onChange={e => setNewFund(p => ({ ...p, fons: e.target.value }))}
                  placeholder="Nom del fons" style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              </div>
              {[
                { label: "Fons", key: "vehicleTipus", options: [...(canEditAlternatives ? ["PE", "VC"] : []), ...(canEditRealEstate ? ["RE"] : [])] },
                { label: "Estructura", key: "est", options: CAPITAL_CALL_STRATEGY_OPTIONS },
                { label: "Divisa", key: "divisa", options: ["EUR", "USD"] },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</div>
                  <select value={newFund[f.key]} onChange={e => setNewFund(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Compromís</div>
                <input type="number" value={newFund.compromis} onChange={e => setNewFund(p => ({ ...p, compromis: e.target.value }))}
                  placeholder="0" style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: 100 }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit"
                  style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                  Afegir
                </button>
                <button type="button" onClick={() => setAddingFund(false)}
                  style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                  Cancel·lar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default function FundsIndex() {
  return (
    <ThemeProvider>
      <FundsIndexInner />
    </ThemeProvider>
  );
}
