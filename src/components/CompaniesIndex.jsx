import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { ThemeProvider, useTheme } from "../theme.js";
import { fmtM, formatMultiple, multipleColor } from "../utils.js";
import { Badge, indexPageStyles, tableCardStyle } from "./SharedComponents.jsx";
import { loadCapitalCalls, loadCompanies } from "../db.js";
import { isActualCompany } from "../data/privateCompanyModel.js";
import { SF_STRATEGY_ADQUISICIO, STRATEGY_PARTICIPADA_ALTRES } from "../data/searchFundSnapshotModel.js";

const TIPUS_CFG = {
  "SF": { color: "#28A029", bg: "#E8F8E8" },
  "PE": { color: "#2B5070", bg: "#E6EDF3" },
};

export function CompaniesIndexInner({ inline = false, searchOverride, subTab = "totes" }) {
  const { tc } = useTheme();
  const [searchLocal] = useState("");
  const search = searchOverride !== undefined ? searchOverride : searchLocal;
  const [sortKey, setSortKey] = useState("ticket");
  const [sortDir, setSortDir] = useState("desc");
  const [filters, setFilters] = useState({
    nom: "",
    id: "",
    tipus: "Tots",
    ticket: "",
    tvpi: "",
    dpi: "",
    rvpi: "",
  });
  const [companies, setCompanies] = useState([]);
  const [rawCC, setRawCC] = useState([]);

  useEffect(() => {
    loadCompanies().then((data) => {
      if (Array.isArray(data)) setCompanies(data);
    }).catch((error) => {
      console.error("Companies index refresh failed:", error);
    });
    loadCapitalCalls().then((data) => {
      if (Array.isArray(data)) setRawCC(data);
    }).catch((error) => {
      console.error("Companies transactions refresh failed:", error);
    });
  }, []);

  // Map vehicle_id → strategy, derived from capital calls (est field).
  // Used to infer company origin when company.tipus is missing or stale.
  const tipusFromEst = useMemo(() => {
    const m = new Map();
    (Array.isArray(rawCC) ? rawCC : []).forEach((row) => {
      if (!row?.vehicle_id) return;
      const id = String(row.vehicle_id);
      const est = row?.est;
      if (est === SF_STRATEGY_ADQUISICIO) m.set(id, "SF");
      else if (est === STRATEGY_PARTICIPADA_ALTRES && !m.has(id)) m.set(id, "PE");
    });
    return m;
  }, [rawCC]);

  const rows = useMemo(() =>
    companies.filter(isActualCompany).map(c => {
      const inferredTipus = tipusFromEst.get(String(c.id ?? "")) ?? null;
      // Stored tipus takes priority; fall back to estrategia inference.
      const effectiveTipus = c.tipus || inferredTipus;
      return {
        ...c,
        effectiveTipus,
        tipusFromTx: !c.tipus && !!inferredTipus, // inferred from transactions, not stored
        dpiMultiple: c.ticket > 0 && c.dpiEur != null ? c.dpiEur / c.ticket : null,
        rvpiMultiple: c.ticket > 0 && c.rvpiEur != null ? c.rvpiEur / c.ticket : null,
      };
    }),
  [companies, tipusFromEst]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (subTab === "via-sf" && r.effectiveTipus !== "SF") return false;
      if (subTab === "pe-directe" && r.effectiveTipus !== "PE") return false;
      if (q && !r.nom.toLowerCase().includes(q)) return false;
      if (filters.nom && !r.nom.toLowerCase().includes(filters.nom.toLowerCase())) return false;
      if (filters.id && !String(r.id ?? "").toLowerCase().includes(filters.id.toLowerCase())) return false;
      if (filters.tipus !== "Tots" && r.effectiveTipus !== filters.tipus && r.segment !== filters.tipus) return false;
      if (filters.ticket && !String(r.ticket ?? "").includes(filters.ticket)) return false;
      if (filters.tvpi && !String(r.tvpi ?? "").includes(filters.tvpi)) return false;
      if (filters.dpi && !String(r.dpiMultiple ?? "").includes(filters.dpi)) return false;
      if (filters.rvpi && !String(r.rvpiMultiple ?? "").includes(filters.rvpi)) return false;
      return true;
    });
  }, [rows, search, filters, subTab]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isMock !== b.isMock) return a.isMock ? -1 : 1;
      let av, bv;
      if (sortKey === "ticket") { av = a.ticket ?? 0; bv = b.ticket ?? 0; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else if (sortKey === "dpi") { av = a.dpiMultiple ?? -1; bv = b.dpiMultiple ?? -1; }
      else if (sortKey === "rvpi") { av = a.rvpiMultiple ?? -1; bv = b.rvpiMultiple ?? -1; }
      else if (sortKey === "id") { av = a.id; bv = b.id; }
      else { av = a.nom.toLowerCase(); bv = b.nom.toLowerCase(); }
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

  const COLS = [
    { k: "nom",    label: "Nom",    align: "left" },
    { k: "id",     label: "ID",     align: "left" },
    { k: "tipus",  label: "Tipus",  align: "left" },
    { k: "ticket", label: "Ticket", align: "right" },
    { k: "tvpi",   label: "TVPI",   align: "right" },
    { k: "dpi",    label: "DPI",    align: "right" },
    { k: "rvpi",   label: "RVPI",   align: "right" },
  ];

  return (
    <div style={indexPageStyles.page(tc, inline)}>
      <div style={indexPageStyles.contentWrap}>
        <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {COLS.map(({ k, label, align }) => (
                    <th key={k} onClick={() => toggleSort(k)}
                      style={{ padding: "9px 14px", textAlign: align, fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
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
                      {["Tots", ...Array.from(new Set([...rows.map((row) => row.tipus), ...rows.map((row) => row.segment)]).values()).filter(Boolean).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </th>
                  {["ticket","tvpi","dpi","rvpi"].map((key) => (
                    <th key={key} style={{ padding: "6px 12px" }}>
                      <input value={filters[key]} onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}
                        style={indexPageStyles.filterControl(tc)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={COLS.length} style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</td></tr>
                )}
                {sorted.map((r, i) => (
                  <tr key={r.id} className="hoverable" style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}`, opacity: r.isMock ? 0.45 : 1 }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link to={`/investments/companies/${encodeURIComponent(r.id)}`} style={{ color: tc.navy, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        {r.nom}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight }}>
                      {r.id}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        {r.effectiveTipus ? (
                          <span title={r.tipusFromTx ? "Origen inferit de transaccions" : undefined}>
                            <Badge label={r.effectiveTipus} cfg={TIPUS_CFG[r.effectiveTipus] || {}} />
                            {r.tipusFromTx && <span style={{ fontSize: 9, color: tc.textLight, marginLeft: 2 }}>TX</span>}
                          </span>
                        ) : null}
                        <span style={{ fontSize: 11, color: tc.textMid }}>{r.segment}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {fmtM(r.ticket)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi, tc) }}>
                      {formatMultiple(r.tvpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpiMultiple, tc) }}>
                      {formatMultiple(r.dpiMultiple)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpiMultiple, tc) }}>
                      {formatMultiple(r.rvpiMultiple)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
      </div>
    </div>
  );
}

export default function CompaniesIndex() {
  return (
    <ThemeProvider>
      <CompaniesIndexInner />
    </ThemeProvider>
  );
}
