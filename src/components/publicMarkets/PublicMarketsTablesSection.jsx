import React from "react";
import { Link } from "react-router-dom";
import { fmtM, cagr, yearsHeld } from "../../utils.js";
import { Badge } from "../SharedComponents.jsx";
import { getMgrPositions, isEtfPosition, PctChip, TIPUS_CFG } from "./PublicMarketsShared.jsx";

const _cy = new Date().getFullYear();
const _rendYTD   = `rend${_cy}`;
const _rendPrev  = `rend${_cy - 1}`;
const _rendPrev2 = `rend${_cy - 2}`;
import { makePmPositionRouteId } from "../../data/pmPositionRouting.js";
import { PM_MODEL } from "../../data/publicMarketsModel.js";

const PM_MONTHLY_STATIC = PM_MODEL.series.monthly;

// Monthly series columns per manager — used to find inception month.
const MGR_MONTHLY_COLS = {
  caixa:     ["caixaRV", "caixaRF"],
  ubs:       ["ubsRV", "ubsRF"],
  bankinter: ["abelBK"],
  abel:      ["abelBK"],
  andbank:   ["andbank"],
};

const _bankinterInceptionLabel = (() => {
  const first = PM_MONTHLY_STATIC.find(m => m.abelBK != null);
  return first?.label?.toLowerCase() ?? "abr '25";
})();

function monthsBetween(start, end) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm));
}

function inceptionMonthsFor(mgrId, monthly) {
  if (!monthly?.length) return null;
  const lastDate = monthly[monthly.length - 1]?.date;
  if (!lastDate) return null;
  const cols = MGR_MONTHLY_COLS[mgrId];
  const firstRow = cols
    ? monthly.find(m => cols.some(c => m[c] != null))
    : monthly[0];
  const startDate = firstRow?.date ?? monthly[0].date;
  return monthsBetween(startDate, lastDate);
}

function TerChip({ ter, tc }) {
  if (ter == null) return <span style={{ fontSize: 11, color: tc.textLight }}>—</span>;
  return (
    <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
      {ter.toFixed(2)}%
    </span>
  );
}

function MtmBadge({ mtm, tc }) {
  if (!mtm) return <span style={{ fontSize: 11, color: tc.textLight }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: mtm.color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
        {mtm.label}
      </span>
    </span>
  );
}

function SubPositionRow({ position, tc }) {
  const heldYears = yearsHeld(position.dataCompra);
  const positionCagr = cagr(position.rendInici, heldYears);
  const disc = position._discontinued === true;
  return (
    <tr style={{ borderBottom: `1px solid ${tc.border}`, opacity: disc ? 0.6 : 1 }}>
      <td style={{ padding: "5px 8px", color: tc.navy }}>
        {disc ? (
          <span style={{ fontWeight: 500, color: tc.textLight }}>
            {position.nom}
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: tc.red, background: tc.red + "18", borderRadius: 4, padding: "1px 4px" }}>DISC.</span>
          </span>
        ) : (
          <Link to={`/mercats-publics/${makePmPositionRouteId(position)}`} style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
            {position.nom}
          </Link>
        )}
      </td>
      <td style={{ padding: "5px 8px", fontSize: 10, color: tc.textLight }}>{position.custodian ?? "—"}</td>
      <td style={{ padding: "5px 8px" }}>
        <Badge label={position.tipus} cfg={TIPUS_CFG[position.tipus] || {}} />
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position[_rendYTD]}   tc={tc} /></td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position[_rendPrev]}  tc={tc} /></td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position[_rendPrev2]} tc={tc} /></td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position.rendInici} tc={tc} /></td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={positionCagr} tc={tc} /></td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
        {fmtM(position.valorMercat)}
      </td>
    </tr>
  );
}

const SUB_TABLE_COLS = [
  { label: "Nom", align: "left" },
  { label: "Custodi", align: "left" },
  { label: "Tipus", align: "left" },
  { label: "YTD", align: "right" },
  { label: String(_cy - 1), align: "right" },
  { label: String(_cy - 2), align: "right" },
  { label: "Des d'inici", align: "right" },
  { label: "CAGR", align: "right" },
  { label: "Valor mercat", align: "right" },
];

function SubTable({ positions, tc, sectionLabel }) {
  if (!positions.length) return null;
  return (
    <>
      {sectionLabel && (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: tc.textLight, marginTop: 10, marginBottom: 4 }}>
          {sectionLabel}
        </div>
      )}
      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 640 }}>
        <thead>
          <tr>
            {SUB_TABLE_COLS.map(({ label, align }) => (
              <th key={label} style={{ padding: "5px 8px", fontSize: 9, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${tc.border}`, textAlign: align }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <SubPositionRow key={position.id} position={position} tc={tc} />
          ))}
        </tbody>
      </table>
    </>
  );
}

export function PublicMarketsTablesSection({
  tc,
  dark,
  secLabel,
  displayManagers,
  monthly = PM_MONTHLY_STATIC,
  expanded,
  toggleExpand,
}) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflowX: "auto" }}>
      <div style={{ ...secLabel, marginBottom: 16 }}>Banc Custodi</div>
      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 820 }}>
        <thead>
          <tr>
            {[
              { label: "Banc Custodi", align: "left" },
              { label: "Tipus", align: "left" },
              { label: "AUM", align: "right" },
              { label: "YTD", align: "right" },
              { label: String(_cy - 1), align: "right" },
              { label: String(_cy - 2), align: "right" },
              { label: "Des d'inici (TWR)", align: "right" },
              { label: "CAGR inici", align: "right" },
              { label: "TER", align: "right" },
              { label: "Última MTM", align: "right" },
            ].map(({ label, align }) => (
              <th key={label} style={{ padding: "8px 12px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `2px solid ${tc.border}`, textAlign: align, whiteSpace: "nowrap" }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayManagers.map((manager, index) => {
            const isExpanded = expanded.has(manager.id);
            const zebra = index % 2 === 1;
            const inceptionMonths = inceptionMonthsFor(manager.id, monthly);
            const years = inceptionMonths != null ? inceptionMonths / 12 : null;
            const managerCagr = manager.rendPct != null && years != null ? cagr(manager.rendPct, years) : null;
            const subPositions = getMgrPositions(manager.id);
            const isExpandable = subPositions !== null;

            return (
              <React.Fragment key={manager.id}>
                <tr className="hoverable" style={{ background: zebra ? (dark ? tc.bgAlt : "#f8f9fb") : tc.card, borderBottom: `1px solid ${tc.border}` }}>
                  <td
                    style={{ padding: "8px 12px", fontWeight: 600, color: tc.navy, cursor: isExpandable ? "pointer" : "default", userSelect: "none" }}
                    onClick={() => isExpandable && toggleExpand(manager.id)}
                  >
                    <span style={{ display: "inline-block", width: 14, fontSize: 10, color: tc.textLight }}>
                      {isExpandable ? (isExpanded ? "▾" : "▸") : ""}
                    </span>
                    {manager.nom}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <Badge label={manager.tipus} cfg={TIPUS_CFG[manager.tipus] || {}} />
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
                    {fmtM(manager.valorActual)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager.ytd} tc={tc} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager[`r${_cy - 1}`]} tc={tc} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager[`r${_cy - 2}`]} tc={tc} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager.rendPct} tc={tc} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={managerCagr} tc={tc} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><TerChip ter={manager.ter} tc={tc} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}><MtmBadge mtm={manager.mtm} tc={tc} /></td>
                </tr>

                {isExpanded && isExpandable ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, background: dark ? "#0C1A28" : "#f0f4f8", borderBottom: `1px solid ${tc.border}` }}>
                      <div style={{ padding: "10px 16px 16px 32px" }}>
                        {subPositions.length === 0 ? (
                          <div style={{ fontSize: 11, color: tc.textLight, fontStyle: "italic" }}>
                            Cap posició per al filtre seleccionat.
                          </div>
                        ) : (() => {
                          const active = subPositions.filter(p => !p._discontinued);
                          const discontinued = subPositions.filter(p => p._discontinued);
                          const managed = active.filter(p => !isEtfPosition(p));
                          const etfs = active.filter(p => isEtfPosition(p));
                          const showGroups = managed.length > 0 && etfs.length > 0;

                          return (
                            <>
                              {showGroups ? (
                                <>
                                  <SubTable positions={managed} tc={tc} sectionLabel="Fons gestionats" />
                                  <SubTable positions={etfs} tc={tc} sectionLabel="ETFs" />
                                </>
                              ) : (
                                <SubTable positions={active} tc={tc} sectionLabel={null} />
                              )}
                              {discontinued.length > 0 && (
                                <SubTable positions={discontinued} tc={tc} sectionLabel={active.length > 0 ? "Discontinuats" : null} />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: tc.textLight, marginTop: 10, fontStyle: "italic" }}>
        {`Des d'inici: TWR des del primer snapshot mensual (UBS/Caixa/Andbank des des. 2023; Bankinter des de ${_bankinterInceptionLabel} — model, pot diferir dels estats del gestor). CAGR: retorn anualitzat equivalent. TER: mitjana ponderada del cost anual declarat per posició. MTM: darrera valoració disponible (verd ≤15d, ambre 16–30d, vermell >30d).`}
      </div>
    </div>
  );
}
