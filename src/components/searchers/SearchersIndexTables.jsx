import { Badge, DeleteRowButton, FlagImg, indexPageStyles } from "../SharedComponents.jsx";
import { SEARCHER_STATUS_CFG } from "../../config.js";
import { fmtM, fmtSignedM, formatIsoDateDMY } from "../../utils.js";

const ENTRY_BADGE_CFG = {
  "Search Capital": { bg: "#E6EDF3", color: "#2563A8" },
  "Equity Gap": { bg: "#F5F0FA", color: "#6B2E7E" },
};

const SEARCHER_COLUMNS = [
  { k: "nom", label: "Nom", align: "left" },
  { k: "tipus", label: "Tipus", align: "left" },
  { k: "modalitat", label: "Modalitat", align: "left" },
  { k: "geo", label: "Geo", align: "center" },
  { k: "formEntrada", label: "Entrada", align: "left" },
  { k: "ticket", label: "Ticket", align: "right" },
  { k: "dataCompr", label: "Compromis", align: "left" },
  { k: "mesosCercant", label: "Mesos", align: "right" },
];

const TRANSACTION_COLUMNS = [
  { key: "data", label: "Data", align: "left" },
  { key: "fons", label: "Nom", align: "left" },
  { key: "tipus", label: "Tipus", align: "left" },
  { key: "cat", label: "Categoria", align: "left" },
  { key: "eur", label: "Import", align: "right" },
  { key: "fy", label: "FY", align: "left" },
];

function SortArrow({ columnKey, sortKey, sortDir }) {
  return (
    <span style={{ marginLeft: 3, opacity: sortKey === columnKey ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === columnKey && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

function SearcherNameCell({ row, tc }) {
  return (
    <td style={{ padding: "10px 12px", fontWeight: 700, color: tc.navy }}>
      {row.nom}
      {row.label && (
        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, borderRadius: 5, padding: "2px 7px", verticalAlign: "middle", ...(SEARCHER_STATUS_CFG[row.label] ?? { bg: "#FEF3E2", color: "#8B5E00" }) }}>
          {row.label}
        </span>
      )}
    </td>
  );
}

function SearcherRowCells({ row, tc }) {
  return (
    <>
      <SearcherNameCell row={row} tc={tc} />
      <td style={{ padding: "10px 12px" }}>{row.tipus || "-"}</td>
      <td style={{ padding: "10px 12px" }}>{row.modalitat || "-"}</td>
      <td style={{ padding: "10px 12px", textAlign: "center" }}><FlagImg geo={row.geo} /></td>
      <td style={{ padding: "10px 12px" }}>
        <Badge label={row.formEntrada || "-"} cfg={ENTRY_BADGE_CFG[row.formEntrada] || { bg: tc.bgAlt, color: tc.textMid }} />
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navyLight }}>{fmtM(row.ticket)}</td>
      <td style={{ padding: "10px 12px", color: tc.textMid }}>{formatIsoDateDMY(row.dataCompr)}</td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.textMid }}>{row.mesosCercant ?? "-"}</td>
    </>
  );
}

export function SearchersMainTable({ tc, rows, sortedRows, filters, setFilters, sortKey, sortDir, toggleSort, canEdit, navigate, onToggleLegacy, onDeleteSearcher }) {
  const hasFilters = Object.values(filters).some((value) => value !== "" && value !== "Tots");
  return (
    <div style={indexPageStyles.panel(tc)}>
      <div style={indexPageStyles.tableScroll}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: tc.bgAlt }}>
              {SEARCHER_COLUMNS.map(({ k, label, align }) => (
                <th key={k} onClick={() => toggleSort(k)}
                  style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                  {label}<SortArrow columnKey={k} sortKey={sortKey} sortDir={sortDir} />
                </th>
              ))}
              {canEdit ? <th style={{ padding: "10px 12px" }} /> : null}
            </tr>
            <tr style={{ background: tc.card, borderBottom: `1px solid ${tc.border}` }}>
              <th style={{ padding: "6px 12px" }}>
                <input value={filters.nom} onChange={(e) => setFilters((current) => ({ ...current, nom: e.target.value }))}
                  aria-label="Filtrar searchers per nom"
                  style={indexPageStyles.filterControl(tc)} />
              </th>
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
                {hasFilters ? (
                  <button onClick={() => setFilters({ nom: "", tipus: "Tots", modalitat: "Tots", geo: "Tots", entrada: "Tots" })}
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
            {sortedRows.length === 0 && (
              <tr><td colSpan={canEdit ? SEARCHER_COLUMNS.length + 1 : SEARCHER_COLUMNS.length} style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</td></tr>
            )}
            {sortedRows.map((row, index) => (
              <tr key={row.id ?? row.nom} className="hoverable"
                onClick={() => row.id && navigate(`/investments/searchers/${encodeURIComponent(row.id)}`)}
                style={{ background: index % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}`, cursor: row.id ? "pointer" : "default" }}>
                <SearcherRowCells row={row} tc={tc} />
                {canEdit ? (
                  <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleLegacy(row, true)}
                      title="Moure a Legacy"
                      style={{ marginRight: 4, padding: "3px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textLight, cursor: "pointer", fontSize: 11 }}
                    >
                      Legacy
                    </button>
                    <DeleteRowButton onDelete={() => onDeleteSearcher(row)} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SearchersLegacyTable({ tc, rows, hasRows, filters, setFilters, canEdit, onToggleLegacy }) {
  if (!hasRows) return <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap searcher a Legacy</div>;
  return (
    <div style={indexPageStyles.panel(tc)}>
      <div style={indexPageStyles.tableScroll}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: tc.bgAlt }}>
              {SEARCHER_COLUMNS.map(({ k, label, align }) => (
                <th key={k} style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {label}
                </th>
              ))}
              {canEdit ? <th style={{ padding: "10px 12px" }} /> : null}
            </tr>
            <tr style={{ background: tc.card, borderBottom: `1px solid ${tc.border}` }}>
              <th style={{ padding: "6px 12px" }}>
                <input value={filters.nom} onChange={(e) => setFilters((current) => ({ ...current, nom: e.target.value }))}
                  aria-label="Filtrar searchers legacy per nom"
                  style={indexPageStyles.filterControl(tc)} />
              </th>
              <th style={{ padding: "6px 12px" }} />
              <th style={{ padding: "6px 12px" }} />
              <th style={{ padding: "6px 12px" }} />
              <th style={{ padding: "6px 12px" }} />
              <th style={{ padding: "6px 12px", textAlign: "right" }}>
                {filters.nom ? (
                  <button onClick={() => setFilters((current) => ({ ...current, nom: "" }))}
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
            {rows.length === 0 && (
              <tr><td colSpan={canEdit ? SEARCHER_COLUMNS.length + 1 : SEARCHER_COLUMNS.length} style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</td></tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.id ?? row.nom} className="hoverable" style={{ background: index % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}>
                <SearcherRowCells row={row} tc={tc} />
                {canEdit ? (
                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => onToggleLegacy(row, false)}
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
  );
}

export function SearchersTransactionsPanel({ tc, filters, setFilters, transactionRowsBase, transactionRows, totalCommitment, totalCalls, totalPaidBack }) {
  return (
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

      {transactionRowsBase.length === 0 ? (
        <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap transacció</div>
      ) : (
        <div style={indexPageStyles.panel(tc)}>
          <div style={indexPageStyles.tableScroll}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {TRANSACTION_COLUMNS.map((col) => (
                    <th key={col.key} style={{ padding: "10px 12px", textAlign: col.align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: tc.card, borderBottom: `1px solid ${tc.border}` }}>
                  <th style={{ padding: "6px 12px" }} />
                  <th style={{ padding: "6px 12px" }}>
                    <input value={filters.nom} onChange={(e) => setFilters((current) => ({ ...current, nom: e.target.value }))}
                      aria-label="Filtrar transaccions de searchers per nom"
                      style={indexPageStyles.filterControl(tc)} />
                  </th>
                  <th style={{ padding: "6px 12px" }} />
                  <th style={{ padding: "6px 12px" }} />
                  <th style={{ padding: "6px 12px", textAlign: "right" }}>
                    {filters.nom ? (
                      <button onClick={() => setFilters((current) => ({ ...current, nom: "" }))}
                        style={indexPageStyles.clearButton(tc)}>
                        netejar
                      </button>
                    ) : null}
                  </th>
                  <th style={{ padding: "6px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {transactionRows.length === 0 && (
                  <tr><td colSpan={TRANSACTION_COLUMNS.length} style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</td></tr>
                )}
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
  );
}


