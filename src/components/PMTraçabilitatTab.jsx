import React, { useMemo } from "react";
import { useTheme } from "../theme.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { FUND_PRICES } from "../generated/prices/fundPrices.js";
import { ALL_PRICE_SERIES, ESTIMATED_PRICE_ISINS } from "../data/allPrices.js";
import { buildPmVehicleCoverageReport } from "../data/pmVehicleCoverage.js";
import { formatDateRange, maxDate, minDate } from "../utils/formatters.js";
import { Badge } from "./SharedComponents.jsx";

const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_CLOSED = PM_MODEL.holdings.closed;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
function monthIndex(month) {
  if (!month) return null;
  const [year, monthNum] = String(month).slice(0, 7).split("-").map(Number);
  if (!year || !monthNum) return null;
  return year * 12 + (monthNum - 1);
}
function formatCoverageGap(flowStart, valueStart) {
  const flowMonth = monthIndex(flowStart);
  const valueMonth = monthIndex(valueStart);
  if (flowMonth == null || valueMonth == null) return "—";
  const delta = valueMonth - flowMonth;
  if (delta === 0) return "0m";
  return `${delta > 0 ? "+" : ""}${delta}m`;
}

export function PMTraçabilitatTab() {
  const { tc, dark } = useTheme();

  const vehicleCoverageReport = useMemo(() => buildPmVehicleCoverageReport({
    pmModel: PM_MODEL,
    allPriceSeries: ALL_PRICE_SERIES,
    fundPrices: FUND_PRICES,
    estimatedPriceIsins: ESTIMATED_PRICE_ISINS,
  }), []);

  const rows = useMemo(() => {
    const coverageByIsin = new Map(vehicleCoverageReport.rows.map(r => [r.isin, r]));

    const activeByIsin = new Map();
    PM_POSITIONS.forEach(position => {
      if (!position?.isin) return;
      const cur = activeByIsin.get(position.isin) ?? {
        isin: position.isin, nom: position.nom ?? position.isin, status: "Present",
        custodians: new Set(), strategies: new Set(), startDate: null, endDate: null, trancheCount: 0,
      };
      cur.custodians.add(position.custodian ?? "Sense custodi");
      cur.strategies.add(position.tipus ?? "—");
      cur.startDate = minDate(cur.startDate, position.startDate ?? position.dataCompra ?? null);
      cur.endDate = maxDate(cur.endDate, position.endDate ?? null);
      cur.trancheCount += 1;
      activeByIsin.set(position.isin, cur);
    });

    const closedByIsin = new Map();
    PM_CLOSED.forEach(position => {
      if (!position?.isin) return;
      const cur = closedByIsin.get(position.isin) ?? {
        isin: position.isin, nom: position.nom ?? position.isin, status: "Discontinued",
        custodians: new Set(), strategies: new Set(), startDate: null, endDate: null, trancheCount: 0,
      };
      cur.custodians.add(position.custodian ?? "Sense custodi");
      cur.strategies.add(position.tipus ?? "—");
      cur.startDate = minDate(cur.startDate, position.dataCompra ?? position.startDate ?? null);
      cur.endDate = maxDate(cur.endDate, position.endDate ?? position.startDate ?? null);
      cur.trancheCount += 1;
      closedByIsin.set(position.isin, cur);
    });

    const txCoverageByIsin = new Map();
    PM_TRANSACTIONS.forEach(tx => {
      if (!tx?.isin || !tx?.date) return;
      const cur = txCoverageByIsin.get(tx.isin) ?? { start: null, end: null, custodians: new Set(), strategies: new Set() };
      cur.start = minDate(cur.start, tx.date);
      cur.end = maxDate(cur.end, tx.date);
      cur.custodians.add(tx.custodian ?? "Sense custodi");
      cur.strategies.add(tx.tipus ?? "—");
      txCoverageByIsin.set(tx.isin, cur);
    });

    const allIsins = new Set([
      ...activeByIsin.keys(), ...closedByIsin.keys(),
      ...coverageByIsin.keys(), ...txCoverageByIsin.keys(),
    ]);

    return [...allIsins].map(isin => {
      const active = activeByIsin.get(isin) ?? null;
      const closed = closedByIsin.get(isin) ?? null;
      const coverage = coverageByIsin.get(isin) ?? null;
      const valueCoverage = coverage?.valueCoverageStart
        ? { start: coverage.valueCoverageStart, end: coverage.valueCoverageEnd }
        : null;
      const txCoverage = txCoverageByIsin.get(isin) ?? null;
      const base = active ?? closed ?? {};
      const custodians = new Set([...(active?.custodians ?? []), ...(closed?.custodians ?? []), ...(txCoverage?.custodians ?? [])]);
      const strategies = new Set([...(active?.strategies ?? []), ...(closed?.strategies ?? []), ...(txCoverage?.strategies ?? [])]);
      const sources = [
        active ? "PM_POSITIONS" : null,
        closed ? "PM_CLOSED" : null,
        txCoverage ? "PM_TRANSACTIONS" : null,
        coverage?.priceSource === "FUND_PRICES" ? "FUND_PRICES" : null,
        coverage?.priceSource === "estimated" ? "ESTIMATED_PRICES" : null,
        coverage?.priceSource === "transactions" ? "TX_NAV" : null,
      ].filter(Boolean);
      const coverageNotes = [...(coverage?.notes ?? [])];
      if (base.startDate && valueCoverage?.start && valueCoverage.start < String(base.startDate).slice(0, 7))
        coverageNotes.push("Valors abans de l'inici del vehicle");
      if (base.endDate && valueCoverage?.end && valueCoverage.end > String(base.endDate).slice(0, 7))
        coverageNotes.push("Valors després de la venda del vehicle");
      if (!txCoverage && coverage?.unitSource === "missing") coverageNotes.push("Sense fluxos");
      return {
        isin,
        nom: base.nom ?? isin,
        status: base.status ?? (active ? "Present" : "Discontinued"),
        custodians: [...custodians].sort(),
        strategies: [...strategies].sort(),
        sources,
        valueCoverage: formatDateRange(valueCoverage?.start, valueCoverage?.end),
        txCoverage: formatDateRange(coverage?.txCoverageStart ?? txCoverage?.start, coverage?.txCoverageEnd ?? txCoverage?.end),
        coverageGap: formatCoverageGap(coverage?.txCoverageStart ?? txCoverage?.start, valueCoverage?.start),
        lifecycle: formatDateRange(coverage?.startMonth ?? base.startDate ?? null, coverage?.endMonth ?? base.endDate ?? null),
        notes: [...new Set(coverageNotes)].join(" · "),
        trancheCount: base.trancheCount ?? 0,
      };
    }).sort((a, b) => {
      if (a.status !== b.status) return a.status === "Present" ? -1 : 1;
      return a.nom.localeCompare(b.nom) || a.isin.localeCompare(b.isin);
    });
  }, [vehicleCoverageReport]);

  return (
    <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
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
                { label: "Vehicle" }, { label: "Estat" }, { label: "Custodi(s)" },
                { label: "Estratègia" }, { label: "Font(s)" }, { label: "Vida vehicle" },
                { label: "Cobertura valors" }, { label: "Cobertura fluxos" },
                { label: "Coverage gap" }, { label: "Notes" },
              ].map(h => (
                <th key={h.label} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, borderBottom: `1px solid ${tc.border}` }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
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
                    {row.custodians.length > 0 ? row.custodians.map(c => <div key={c}>{c}</div>) : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap" }}>
                    {row.strategies.length > 0 ? row.strategies.map(s => <div key={s}>{s}</div>) : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tc.border}` }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: row.sources.length ? 6 : 0 }}>
                      {row.sources.map(s => <Badge key={s} label={s} />)}
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
    </div>
  );
}
