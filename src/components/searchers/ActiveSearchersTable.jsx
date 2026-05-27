import React from "react";
import { fmtM, formatIsoDateDMY, mesosColor, mesosBg, tvpiColor, tvpiBg, formatMultiple } from "../../utils.js";
import { SEARCHER_FORM_ENTRADA_OPTIONS, SEARCHER_MODALITAT_OPTIONS } from "../../config.js";
import { FlagImg, EditableCell } from "../SharedComponents.jsx";
import { SectionHeading, StageBadge, ENTRY_BADGE_CFG } from "../SearchersBadges.jsx";
import { searcherKey, formatEquityStake } from "../../data/searcherFormatting.js";
import { tableCardStyle } from "../SharedComponents.jsx";

export function ActiveSearchersTable({
  TC,
  dark,
  canEdit,
  displayedSearchers,
  displayedSearchersTicket,
  activeRows,
  search,
  activeGeoFilter,
  activeEntryFilter,
  activeStatusFilter,
  activeTypeFilter,
  activeModalityFilter,
  activeSort,
  setActiveEntryFilter,
  setActiveGeoFilter,
  setActiveStatusFilter,
  setActiveTypeFilter,
  setActiveModalityFilter,
  sortActive,
  saveSearcherField,
  setShowAddModal,
}) {
  const th = { padding: "9px 10px", fontSize: 10, fontWeight: 700, color: TC.navyLight ?? TC.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${TC.border}`, whiteSpace: "nowrap", userSelect: "none" };
  const sec = { fontSize: 10, letterSpacing: "0.11em", color: TC.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 };
  const inp = { border: `1px solid ${TC.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 11, color: TC.text, background: TC.card, outline: "none", fontFamily: "inherit", cursor: "pointer" };

  const AArr = ({ k }) => <span style={{ marginLeft: 3, opacity: activeSort.k === k ? 1 : 0.2, fontSize: 9 }}>{activeSort.k === k && activeSort.d === "asc" ? "▲" : "▼"}</span>;

  return (
    <div style={{ ...tableCardStyle(TC), marginBottom: 14 }}>
      <div style={{ ...sec, color: TC.textLight }}>
        <SectionHeading icon="🔍" color={dark ? "#162840" : "#EAF2FB"}>Searchers Actius</SectionHeading>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { label: "Search Fund", k: "nom" },
                { label: "Searchers", k: "searchers" },
                { label: "Entrada", k: "formEntrada" },
                { label: "Modalitat", k: "modalitat" },
                { label: "Pais", k: "geo" },
                { label: "Fase", k: "stage" },
                { label: "Companyia Adquirida", k: "companiaAdquirida" },
                { label: "Ticket", k: "ticket", right: true },
                { label: "TVPI", k: "tvpi", right: true },
                { label: "IRR", k: "irr", right: true },
                { label: "DPI", k: "dpi", right: true },
                { label: "Any Inv.", k: "investmentYear", center: true },
                { label: "Data Compromis", k: "dataCompr" },
                { label: "Mesos Cercant", k: "mesosCercant", center: true },
                { label: "Equity Stake", k: "equityStake", right: true },
              ].map(h => (
                <th
                  key={h.k}
                  style={{ ...th, cursor: "pointer", textAlign: h.right ? "right" : h.center ? "center" : "left" }}
                  onClick={() => sortActive(h.k)}
                >
                  {h.label}<AArr k={h.k} />
                </th>
              ))}
              {canEdit && <th style={{ ...th, textAlign: "center" }}>Legacy</th>}
            </tr>
            <tr style={{ borderBottom: `1px solid ${TC.border}` }}>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }}>
                <select value={activeEntryFilter} onChange={e => setActiveEntryFilter(e.target.value)} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", ...Array.from(new Set(activeRows.map(r => r.formEntrada).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }}>
                <select value={activeModalityFilter} onChange={e => setActiveModalityFilter(e.target.value)} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", ...Array.from(new Set(activeRows.map(r => r.modalitat).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }}>
                <select value={activeGeoFilter} onChange={e => setActiveGeoFilter(e.target.value)} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", ...Array.from(new Set(activeRows.map(r => r.geo).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }}>
                <select value={activeStatusFilter} onChange={e => setActiveStatusFilter(e.target.value)} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", ...Array.from(new Set(activeRows.map(r => r.statusScreening).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px", textAlign: "right" }}>
                <select value={activeTypeFilter} onChange={e => setActiveTypeFilter(e.target.value)} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", ...Array.from(new Set(activeRows.map(r => r.tipus).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px", textAlign: "center" }}>
                {(activeGeoFilter !== "Tots" || activeEntryFilter !== "Tots" || activeStatusFilter !== "Tots" || activeTypeFilter !== "Tots" || activeModalityFilter !== "Tots") ? (
                  <button onClick={() => {
                    setActiveGeoFilter("Tots");
                    setActiveEntryFilter("Tots");
                    setActiveStatusFilter("Tots");
                    setActiveTypeFilter("Tots");
                    setActiveModalityFilter("Tots");
                  }}
                    style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "1px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}>
                    netejar
                  </button>
                ) : null}
              </th>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              {canEdit && <th style={{ padding: "6px 10px" }} />}
            </tr>
          </thead>
          <tbody>
            {displayedSearchers.map((r, i) => (
              <tr key={searcherKey(r) ?? r.nom} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt, opacity: r.isMock ? 0.45 : 1 }}>
                <td style={{ padding: "9px 10px", fontWeight: 600, color: TC.navy }}>
                  {canEdit
                    ? <EditableCell value={r.nom} type="text" onSave={v => saveSearcherField(r, "nom", v)} />
                    : r.nom}
                </td>
                <td style={{ padding: "9px 10px", color: TC.text, fontSize: 11 }}>
                  {canEdit
                    ? <EditableCell value={r.searchers} type="text" onSave={v => saveSearcherField(r, "searchers", v)} />
                    : r.searchers}
                </td>
                <td style={{ padding: "9px 10px" }}>
                  {canEdit ? (
                    <EditableCell
                      value={r.formEntrada}
                      options={SEARCHER_FORM_ENTRADA_OPTIONS}
                      allowCustom optionsKey="s_entrada"
                      onSave={v => saveSearcherField(r, "formEntrada", v)}
                      badgeCfg={ENTRY_BADGE_CFG}
                      emptyDisplay="—"
                    />
                  ) : (
                    <span style={{ background: r.formEntrada === "Equity Gap" ? "#E8F8E8" : "#E6EDF3", color: r.formEntrada === "Equity Gap" ? TC.green : TC.navy, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {r.formEntrada || "—"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "9px 10px" }}>
                  {canEdit ? (
                    <EditableCell
                      value={r.modalitat}
                      options={SEARCHER_MODALITAT_OPTIONS}
                      allowCustom optionsKey="s_modalitat"
                      onSave={v => saveSearcherField(r, "modalitat", v)}
                      badgeCfg={{
                        Solo: { bg: "#E8F8E8", color: TC.green, border: "#E8F8E8" },
                        Duo: { bg: "#E6EDF3", color: TC.navy, border: "#E6EDF3" },
                        Partnership: { bg: "#F5F0FA", color: "#5A3E9A", border: "#F5F0FA" },
                      }}
                    />
                  ) : (
                    <span style={{ background: r.modalitat === "Solo" ? "#E8F8E8" : "#E6EDF3", color: r.modalitat === "Solo" ? TC.green : TC.navy, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 600 }}>{r.modalitat}</span>
                  )}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}>
                  {canEdit ? (
                    <EditableCell
                      value={r.geo}
                      options={["ES", "EN", "IT", "DE", "FR", "PT", "NL", "US", "CH"]}
                      onSave={v => saveSearcherField(r, "geo", v)}
                      fmt={v => <FlagImg geo={v} />}
                    />
                  ) : <FlagImg geo={r.geo} />}
                </td>
                <td style={{ padding: "9px 10px" }}>
                  <StageBadge label={r.stageLabel} />
                </td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: TC.text }}>
                  {canEdit
                    ? <EditableCell value={r.companiaAdquirida ?? ""} type="text" emptyDisplay="—" onSave={v => saveSearcherField(r, "companiaAdquirida", v || null)} />
                    : (r.companiaAdquirida || "—")}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: TC.navy }}>
                  {canEdit
                    ? <EditableCell value={r.ticket} type="number" align="right" fmt={fmtM} onSave={v => saveSearcherField(r, "ticket", v)} />
                    : fmtM(r.ticket)}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}>
                  <EditableCell value={r.tvpi} type="number" align="center"
                    fmt={v => v != null ? <span style={{ background: tvpiBg(v), color: tvpiColor(v), borderRadius: 20, padding: "2px 8px", fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{formatMultiple(v)}</span> : <span style={{ color: TC.textLight, fontSize: 10, fontStyle: "italic" }}>Pendent</span>}
                    onSave={v => saveSearcherField(r, "tvpi", v)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11, color: TC.navyLight }}>
                  <EditableCell value={r.irr} type="number" align="right"
                    fmt={v => v != null ? `${Number(v).toFixed(1)}%` : "—"}
                    onSave={v => saveSearcherField(r, "irr", v)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11, color: TC.navyLight }}>
                  <EditableCell value={r.dpi} type="number" align="right"
                    fmt={v => v != null ? formatMultiple(v) : "—"}
                    onSave={v => saveSearcherField(r, "dpi", v)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "9px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", color: TC.textMid }}>
                  {r.investmentYear || "—"}
                </td>
                <td style={{ padding: "9px 10px", color: TC.textMid, fontSize: 11 }}>
                  {canEdit
                    ? <EditableCell
                        value={r.derivedDataCompr ?? ""}
                        type="date"
                        fmt={formatIsoDateDMY}
                        emptyDisplay="—"
                        onSave={v => saveSearcherField(r, "dataCompr", v || null)}
                      />
                    : formatIsoDateDMY(r.derivedDataCompr)}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", minWidth: 32, textAlign: "center",
                    background: mesosBg(r.mesosCercant), color: mesosColor(r.mesosCercant),
                    borderRadius: 20, padding: "2px 8px", fontWeight: 700, fontSize: 11,
                  }}>{r.mesosCercant}</span>
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: TC.navyLight }}>
                  {canEdit
                    ? <EditableCell value={r.equityStake} type="number" align="right" fmt={formatEquityStake} onSave={v => saveSearcherField(r, "equityStake", v)} />
                    : formatEquityStake(r.equityStake)}
                </td>
                {canEdit && (
                  <td style={{ padding: "9px 10px", textAlign: "center" }}>
                    <button
                      title="Mou a Legacy"
                      onClick={() => saveSearcherField(r, "isLegacy", true)}
                      style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}
                    >Legacy</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${TC.border}` }}>
              <td colSpan={7} style={{ padding: "9px 10px", fontWeight: 700, fontSize: 11, color: TC.navyLight }}>TOTAL ({displayedSearchers.length}{search.trim() || activeGeoFilter !== "Tots" || activeEntryFilter !== "Tots" ? `/${activeRows.length}` : ""} searchers)</td>
              <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: TC.navy }}>{fmtM(displayedSearchersTicket)}</td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
