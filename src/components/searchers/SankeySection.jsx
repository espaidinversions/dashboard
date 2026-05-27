import React from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { SearcherYearChart, SearcherGeoPieChart, SearcherGeoBarChart } from "../SearcherCharts.jsx";
import { fmtM } from "../../utils.js";
import { GEO_NAME } from "../../config.js";
import { KpiCard } from "../SharedComponents.jsx";
import { SectionHeading, SANKEY_NODE_COLORS } from "../SearchersBadges.jsx";
import { sankeyNodeToEntry } from "../../data/searcherFormatting.js";
import { ecTheme } from "../../echartsTheme.js";

export function SankeySection({
  TC,
  dark,
  activeRows,
  totalSearchers,
  soloCount,
  duoCount,
  historicData,
  sankeyData,
  convStats,
  geoData,
  geoTotal,
  geoCountData,
  geoCountTotal,
  activeGeoFilter,
  activeEntryFilter,
  commitmentYearData,
  setActiveEntryFilter,
  setActiveGeoFilter,
  handleGeoClick,
  handleEntryFilterClick,
}) {
  const t = ecTheme(TC);
  const card = { background: TC.card, border: `1px solid ${TC.border}`, borderRadius: 10, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,.06)" };
  const sec  = { fontSize: 10, letterSpacing: "0.11em", color: TC.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 };

  return (
    <>
      <div className="grid-4" style={{ gap: 12, marginBottom: 18 }}>
        <KpiCard hero label="Searchers Actius" value={activeRows.length} sub={`${soloCount} solo / ${duoCount} duo`} tc={TC} />
        <KpiCard label="Capital Compromès" value={fmtM(totalSearchers)} sub="total search capital" tc={TC} />
        <KpiCard label="Ticket Promig" value={activeRows.length ? fmtM(totalSearchers / activeRows.length) : "—"} sub="per searcher" tc={TC} />
        <KpiCard label="Total DB" value={historicData.length} sub="searchers en base de dades" tc={TC} />
      </div>

      <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ ...sec, color: TC.textLight }}>
            <SectionHeading icon="🧭" color={dark ? "#112030" : "#E6EDF3"}>Participades per Forma d'Entrada i Resultat</SectionHeading>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, padding: "10px 14px", background: TC.bgAlt, borderRadius: 10 }}>
            {[
              { label: "Total converses", value: convStats.total,        color: TC.navy },
              { label: "SC backed",       value: convStats.scBacked,     color: "#2563A8" },
              { label: "Equity Gap",      value: convStats.egInvertit,   color: "#6B2E7E" },
              { label: "Descartats",      value: convStats.allDescartat, color: "#B01F17" },
              { label: "En Revisió",      value: convStats.allRevisio,   color: "#8A6400" },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span style={{ color: TC.border, alignSelf: "center" }}>·</span>}
                <span style={{ fontSize: 11, color: TC.textMid }}>
                  <b style={{ color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</b>
                  {" "}{s.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div style={{ height: 340 }}>
            {sankeyData.links.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: TC.textLight, fontSize: 12 }}>Sense dades</div>
            ) : (
              <ResponsiveSankey
                data={sankeyData}
                margin={{ top: 16, right: 180, bottom: 16, left: 180 }}
                align="start"
                colors={node => SANKEY_NODE_COLORS[node.id] || TC.navy}
                nodeOpacity={0.92}
                nodeThickness={20}
                nodeInnerPadding={4}
                nodeBorderWidth={0}
                nodeBorderRadius={3}
                nodePadding={28}
                linkOpacity={0.22}
                enableLinkGradient={true}
                labelPosition="outside"
                labelOrientation="horizontal"
                label={node => `${node.id} (${node.value})`}
                labelTextColor={node => SANKEY_NODE_COLORS[node.id] || TC.textMid}
                onClick={(node) => {
                  const entry = sankeyNodeToEntry(node?.id);
                  if (entry) handleEntryFilterClick(entry);
                }}
                theme={{
                  text: { fontSize: 11, fontFamily: "'Outfit',system-ui,sans-serif", fill: TC.text },
                  tooltip: {
                    container: {
                      background: TC.card,
                      border: `1px solid ${TC.border}`,
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "'Outfit',system-ui,sans-serif",
                      color: TC.text,
                    },
                  },
                }}
              />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minHeight: 20 }}>
            {activeEntryFilter !== "Tots" ? (
              <>
                <span style={{ fontSize: 11, color: TC.textMid }}>
                  Filtre actiu: <b style={{ color: TC.navy }}>{activeEntryFilter}</b>
                </span>
                <button
                  onClick={() => setActiveEntryFilter("Tots")}
                  style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "1px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}
                >
                  ✕ netejar
                </button>
              </>
            ) : (
              <span style={{ fontSize: 11, color: TC.textLight }}>Clica `Searchers` o `Equity Gap` per filtrar la taula d'actius per entrada.</span>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ ...sec, color: TC.textLight }}>
            <SectionHeading icon="🌍" color={dark ? "#0A2010" : "#E8F8E8"}>Allocation Geogràfica — Searchers (€)</SectionHeading>
          </div>
          <SearcherGeoPieChart
            geoData={geoData}
            geoTotal={geoTotal}
            activeGeoFilter={activeGeoFilter}
            t={t}
            TC={TC}
            onGeoClick={handleGeoClick}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minHeight: 20 }}>
            {activeGeoFilter !== "Tots" ? (
              <>
                <span style={{ fontSize: 11, color: TC.textMid }}>
                  Filtre actiu: <b style={{ color: TC.navy }}>{GEO_NAME[activeGeoFilter] || activeGeoFilter}</b>
                </span>
                <button
                  onClick={() => setActiveGeoFilter("Tots")}
                  style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 4, padding: "1px 8px", cursor: "pointer", fontSize: 10, color: TC.textMid, fontFamily: "inherit" }}
                >
                  ✕ netejar
                </button>
              </>
            ) : (
              <span style={{ fontSize: 11, color: TC.textLight }}>Clica un segment per filtrar la taula d'actius per geografia.</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ ...sec, color: TC.textLight }}>
            <SectionHeading icon="📅" color={dark ? "#162840" : "#EAF2FB"}>Any de Compromís — Nombre de Searchers</SectionHeading>
          </div>
          {commitmentYearData.length === 0 ? (
            <div style={{ padding: "36px 0 12px", textAlign: "center", color: TC.textLight, fontSize: 12 }}>
              Sense dades de compromís a capital calls.
            </div>
          ) : (
            <SearcherYearChart commitmentYearData={commitmentYearData} t={t} TC={TC} />
          )}
        </div>
        <div style={card}>
          <div style={{ ...sec, color: TC.textLight }}>
            <SectionHeading icon="🗺️" color={dark ? "#162840" : "#EAF2FB"}>Searchers Actius per Geografia</SectionHeading>
          </div>
          {geoCountData.length === 0 ? (
            <div style={{ padding: "36px 0 12px", textAlign: "center", color: TC.textLight, fontSize: 12 }}>
              Sense dades geogràfiques.
            </div>
          ) : (
            <SearcherGeoBarChart
              geoCountData={geoCountData}
              geoCountTotal={geoCountTotal}
              activeGeoFilter={activeGeoFilter}
              t={t}
              TC={TC}
              onGeoClick={handleGeoClick}
            />
          )}
        </div>
      </div>
    </>
  );
}
