import React from "react";
import { Link } from "react-router-dom";
import { fmtM, cagr, yearsHeld } from "../../utils.js";
import { Badge } from "../SharedComponents.jsx";
import { getMgrPositions, PctChip, TIPUS_CFG } from "./PublicMarketsShared.jsx";

export function PublicMarketsTablesSection({
  tc,
  dark,
  secLabel,
  vehicleTraceabilityRows,
  displayManagers,
  expanded,
  toggleExpand,
}) {
  return (
    <>
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, flex: 1 }}>
            Traçabilitat per vehicle
          </div>
        </div>
        <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 14, maxWidth: 980, lineHeight: 1.5 }}>
          Taula de diagnosi per veure quines fonts alimenten cada vehicle i quina cobertura de valor reconstruïble té cada cas. La cobertura de valors es calcula amb la mateixa lògica del report de vehicle coverage: unitats reconstruïdes i sèrie de preus, no només des de la sèrie activa agregada.
        </div>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 1080 }}>
          <thead>
            <tr>
              {[
                { label: "Vehicle", align: "left" },
                { label: "Estat", align: "left" },
                { label: "Custodi(s)", align: "left" },
                { label: "Estratègia", align: "left" },
                { label: "Font(s)", align: "left" },
                { label: "Vida vehicle", align: "left" },
                { label: "Cobertura valors", align: "left" },
                { label: "Cobertura fluxos", align: "left" },
                { label: "Coverage gap", align: "left" },
                { label: "Notes", align: "left" },
              ].map((header) => (
                <th key={header.label} style={{ textAlign: header.align, padding: "8px 10px", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, borderBottom: `1px solid ${tc.border}` }}>
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicleTraceabilityRows.map((row, idx) => {
              const zebra = idx % 2 === 1;
              const statusCfg = row.status === "Present"
                ? { bg: dark ? "#0E2415" : "#E8F8E8", color: tc.green }
                : { bg: dark ? "#24140E" : "#FDECEA", color: tc.red };
              return (
                <tr key={`${row.isin}-${row.nom}`} style={{ background: zebra ? (dark ? "rgba(255,255,255,.02)" : "#FAFBFC") : "transparent" }}>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: tc.navy }}>{row.nom}</div>
                    <div style={{ fontSize: 10, color: tc.textLight, fontFamily: "'DM Mono', monospace" }}>{row.isin}</div>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}` }}>
                    <Badge label={row.status === "Present" ? "Present" : "Discontinued"} cfg={statusCfg} />
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap" }}>
                    {row.custodians.length > 0 ? row.custodians.map((custodian) => <div key={custodian}>{custodian}</div>) : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap" }}>
                    {row.strategies.length > 0 ? row.strategies.map((strategy) => <div key={strategy}>{strategy}</div>) : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}` }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: row.sources.length ? 6 : 0 }}>
                      {row.sources.map((source) => <Badge key={source} label={source} />)}
                    </div>
                    <div style={{ fontSize: 10, color: tc.textLight }}>
                      {row.trancheCount > 1 ? `${row.trancheCount} trams` : "1 tram"}
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontFamily: "'DM Mono', monospace" }}>{row.lifecycle}</td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontFamily: "'DM Mono', monospace" }}>{row.valueCoverage}</td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontFamily: "'DM Mono', monospace" }}>{row.txCoverage}</td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontFamily: "'DM Mono', monospace", color: tc.navy, fontWeight: 700 }}>{row.coverageGap}</td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, color: tc.textLight }}>{row.notes || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflowX: "auto" }}>
        <div style={{ ...secLabel, marginBottom: 16 }}>Banc Custodi</div>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 700 }}>
          <thead>
            <tr>
              {[
                { label: "Banc Custodi", align: "left" },
                { label: "Tipus", align: "left" },
                { label: "AUM", align: "right" },
                { label: "YTD", align: "right" },
                { label: "2025", align: "right" },
                { label: "2024", align: "right" },
                { label: "Des d'inici (TWR)", align: "right" },
                { label: "CAGR inici", align: "right" },
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
              const inceptionMonths = manager.id === "abel" ? 11 : 27;
              const years = inceptionMonths / 12;
              const managerCagr = manager.rendPct != null ? cagr(manager.rendPct, years) : null;
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
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager.r2025} tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager.r2024} tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={manager.rendPct} tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={managerCagr} tc={tc} /></td>
                  </tr>

                  {isExpanded && isExpandable ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 0, background: dark ? "#0C1A28" : "#f0f4f8", borderBottom: `1px solid ${tc.border}` }}>
                        <div style={{ padding: "10px 16px 16px 32px" }}>
                          {subPositions !== null && subPositions.length === 0 ? (
                            <div style={{ fontSize: 11, color: tc.textLight, fontStyle: "italic" }}>
                              Cap posició per al filtre seleccionat.
                            </div>
                          ) : null}

                          {subPositions !== null && subPositions.length > 0 ? (
                            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 640 }}>
                              <thead>
                                <tr>
                                  {[
                                    { label: "Nom", align: "left" },
                                    { label: "Custodi", align: "left" },
                                    { label: "Tipus", align: "left" },
                                    { label: "YTD", align: "right" },
                                    { label: "2025", align: "right" },
                                    { label: "2024", align: "right" },
                                    { label: "Des d'inici", align: "right" },
                                    { label: "CAGR", align: "right" },
                                    { label: "Valor mercat", align: "right" },
                                  ].map(({ label, align }) => (
                                    <th key={label} style={{ padding: "5px 8px", fontSize: 9, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${tc.border}`, textAlign: align }}>
                                      {label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {subPositions.map((position) => {
                                  const heldYears = yearsHeld(position.dataCompra);
                                  const positionCagr = cagr(position.rendInici, heldYears);
                                  const disc = position._discontinued === true;
                                  return (
                                    <tr key={position.id} style={{ borderBottom: `1px solid ${tc.border}`, opacity: disc ? 0.6 : 1 }}>
                                      <td style={{ padding: "5px 8px", color: tc.navy }}>
                                        {disc ? (
                                          <span style={{ fontWeight: 500, color: tc.textLight }}>
                                            {position.nom}
                                            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: tc.red, background: tc.red + "18", borderRadius: 3, padding: "1px 4px" }}>DISC.</span>
                                          </span>
                                        ) : (
                                          <Link to={`/mercats-publics/${position.id}`} style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                                            {position.nom}
                                          </Link>
                                        )}
                                      </td>
                                      <td style={{ padding: "5px 8px", fontSize: 10, color: tc.textLight }}>{position.custodian ?? "—"}</td>
                                      <td style={{ padding: "5px 8px" }}>
                                        <Badge label={position.tipus} cfg={TIPUS_CFG[position.tipus] || {}} />
                                      </td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position.rend2026} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position.rend2025} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position.rend2024} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={position.rendInici} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={positionCagr} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
                                        {fmtM(position.valorMercat)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : null}
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
          Des d'inici: TWR reportat pels gestors (WAM/Andbank des de creació; UBS YTD; Abel BK des d'abr. 2025). CAGR: retorn anualitzat equivalent.
        </div>
      </div>
    </>
  );
}
