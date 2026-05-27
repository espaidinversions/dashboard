import React from "react";
import { SEARCHER_FORM_ENTRADA_OPTIONS } from "../../config.js";
import { FlagImg, EditableCell, DeleteRowButton } from "../SharedComponents.jsx";
import { tableCardStyle } from "../SharedComponents.jsx";
import { SectionHeading, StatusBadge, StageBadge, ENTRY_BADGE_CFG } from "../SearchersBadges.jsx";
import { searcherKey } from "../../data/searcherFormatting.js";

export function HistoricTable({
  TC,
  dark,
  canEdit,
  filteredHistoric,
  historicData,
  histFilter,
  histSort,
  setHistFilter,
  sortHist,
  saveSearcherField,
  handleDeleteSearcher,
  setShowAddModal,
}) {
  const th = { padding: "9px 10px", fontSize: 10, fontWeight: 700, color: TC.navyLight ?? TC.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${TC.border}`, whiteSpace: "nowrap", userSelect: "none" };
  const sec = { fontSize: 10, letterSpacing: "0.11em", color: TC.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 };
  const inp = { border: `1px solid ${TC.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 11, color: TC.text, background: TC.card, outline: "none", fontFamily: "inherit", cursor: "pointer" };

  const HArr = ({ k }) => <span style={{ marginLeft: 3, opacity: histSort.k === k ? 1 : 0.2, fontSize: 9 }}>{histSort.k === k && histSort.d === "asc" ? "▲" : "▼"}</span>;

  const uniq     = key => ["Tots", ...Array.from(new Set(historicData.map(r => r[key]).filter(Boolean))).sort()];
  const uniqVals = key => Array.from(new Set(historicData.map(r => r[key]).filter(Boolean))).sort();

  return (
    <div style={{ ...tableCardStyle(TC), overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...sec, color: TC.textLight, marginBottom: 0 }}>
            <SectionHeading icon="🗂" color={dark ? "#112030" : "#E6EDF3"}>Historial de Searchers</SectionHeading>
          </div>
          {canEdit && (
            <button onClick={() => setShowAddModal(true)}
              style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${TC.border}`, background: "transparent", color: TC.navy, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
              + Nou searcher
            </button>
          )}
        </div>
        <div />
      </div>
      <div style={{ fontSize: 11, color: TC.textMid, marginBottom: 10 }}>
        <b style={{ color: TC.navy }}>{filteredHistoric.length}</b> / {historicData.length} searchers
        {Object.entries(histFilter).some(([, v]) => v !== "Tots") &&
          <button onClick={() => setHistFilter({ status: "Tots", geo: "Tots", entrada: "Tots" })}
            style={{ marginLeft: 8, background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "1px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}>
            ✕ netejar
          </button>
        }
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { label: "Nom SF",    k: "nom"             },
                { label: "NIF",       k: "nif"             },
                { label: "Tipus",     k: "tipus"           },
                { label: "Modalitat", k: "modalitat"       },
                { label: "País",      k: "geo"             },
                { label: "Status",    k: "statusScreening" },
                { label: "Fase",      k: "stageLabel"      },
                { label: "Any Inv.",  k: "investmentYear"  },
                { label: "Entrada",   k: "formEntrada"     },
                { label: "Searchers", k: "searcher1"       },
                { label: "Escola/MBA",k: "escola1"         },
                { label: "Intro per", k: "introPer"        },
              ].map(h => (
                <th key={h.k} style={{ ...th, cursor: "pointer" }} onClick={() => sortHist(h.k)}>
                  {h.label}<HArr k={h.k} />
                </th>
              ))}
              {canEdit && <th style={{ ...th, width: 40 }} />}
            </tr>
            <tr style={{ borderBottom: `1px solid ${TC.border}` }}>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }}>
                <select value={histFilter.geo} onChange={e => setHistFilter(p => ({ ...p, geo: e.target.value }))} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", ...Array.from(new Set(historicData.map(r => r.geo).filter(Boolean))).sort()].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }}>
                <select value={histFilter.status} onChange={e => setHistFilter(p => ({ ...p, status: e.target.value }))} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {uniq("statusScreening").map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }}>
                <select value={histFilter.entrada} onChange={e => setHistFilter(p => ({ ...p, entrada: e.target.value }))} style={{ ...inp, width: "100%", padding: "4px 6px", fontSize: 11 }}>
                  {["Tots", "Search Capital", "Equity Gap"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </th>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px", textAlign: "left" }}>
                {Object.entries(histFilter).some(([, v]) => v !== "Tots") ? (
                  <button onClick={() => setHistFilter({ status: "Tots", geo: "Tots", entrada: "Tots" })}
                    style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "1px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}>
                    netejar
                  </button>
                ) : null}
              </th>
              {canEdit && <th style={{ padding: "6px 10px" }} />}
            </tr>
          </thead>
          <tbody>
            {filteredHistoric.map((r, i) => (
              <tr key={`${r.nom}-${i}`} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                <td style={{ padding: "7px 10px", fontWeight: 500, color: TC.navy }}>
                  <EditableCell value={r.nom} type="text"
                    onSave={v => saveSearcherField(r, "nom", v)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "7px 10px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: TC.textLight }}>
                  <EditableCell value={r.nif ?? ""} type="text"
                    emptyDisplay="—"
                    onSave={v => saveSearcherField(r, "nif", v || null)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "7px 10px", color: TC.textMid, fontSize: 11 }}>
                  <EditableCell value={r.tipus} type="text"
                    onSave={v => saveSearcherField(r, "tipus", v)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "7px 10px" }}>
                  <EditableCell value={r.modalitat} type="text"
                    onSave={v => saveSearcherField(r, "modalitat", v)}
                    disabled={!canEdit}
                    fmt={v => (
                      <span style={{ background: v === "Solo" ? "#E8F8E8" : v === "Duo" ? "#E6EDF3" : "#F5F0FA", color: v === "Solo" ? TC.green : v === "Duo" ? TC.navy : "#5A3E9A", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 600 }}>{v}</span>
                    )} />
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center" }}>
                  <EditableCell
                    value={r.geo}
                    options={["ES", "EN", "IT", "DE", "FR", "PT", "NL", "US", "CH"]}
                    onSave={v => saveSearcherField(r, "geo", v)}
                    fmt={v => <FlagImg geo={v} />}
                    disabled={!canEdit}
                  />
                </td>
                <td style={{ padding: "7px 10px" }}>
                  <EditableCell
                    value={r.statusScreening}
                    options={uniqVals("statusScreening")}
                    allowCustom optionsKey="s_status"
                    onSave={v => saveSearcherField(r, "status", v)}
                    fmt={v => <StatusBadge s={v} />}
                    disabled={!canEdit}
                  />
                </td>
                <td style={{ padding: "7px 10px" }}>
                  <StageBadge label={r.stageLabel} />
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: TC.textMid }}>
                  {r.investmentYear || "—"}
                </td>
                <td style={{ padding: "7px 10px" }}>
                  <EditableCell value={r.formEntrada} options={SEARCHER_FORM_ENTRADA_OPTIONS}
                    allowCustom optionsKey="s_entrada"
                    onSave={v => saveSearcherField(r, "formEntrada", v)}
                    disabled={!canEdit}
                    badgeCfg={ENTRY_BADGE_CFG} />
                </td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: TC.text }}>
                  <EditableCell
                    value={[r.searcher1, r.searcher2].filter(Boolean).join(" / ") || "—"}
                    options={uniqVals("searcher1")}
                    allowCustom optionsKey="s_searchers"
                    onSave={v => saveSearcherField(r, "searchers", v)}
                    disabled={!canEdit} />
                </td>
                <td style={{ padding: "7px 10px", fontSize: 11 }}>
                  <EditableCell
                    value={[r.escola1, r.escola2].filter(Boolean).join(" / ")}
                    options={uniqVals("escola1")}
                    allowCustom optionsKey="s_escola"
                    onSave={v => saveSearcherField(r, "schools", v)}
                    disabled={!canEdit}
                    emptyDisplay="—"
                  />
                </td>
                <td style={{ padding: "7px 10px", color: TC.textMid, fontSize: 11 }}>
                  <EditableCell
                    value={r.introPer}
                    options={uniqVals("introPer")}
                    allowCustom optionsKey="s_introPer"
                    onSave={v => saveSearcherField(r, "introPer", v)}
                    disabled={!canEdit} />
                </td>
                {canEdit && (
                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                    <DeleteRowButton onDelete={() => handleDeleteSearcher(r)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
