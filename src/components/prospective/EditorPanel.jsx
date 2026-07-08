import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { fmtC, numberAtYear, yearMapValue, tdStyle, periodBg, editorNumberStyle, buttonStyle, inputStyle } from "./prospectiveUtils.js";
import { Segmented, Th } from "./ProspectivePrimitives.jsx";

export function EditorPanel({
  tc,
  editorData,
  committedByFund,
  committedOverrides,
  paidInByFund,
  actualsByFundYear = {},
  fundNames,
  editorType,
  setEditorType,
  editorSearch,
  setEditorSearch,
  updateFundValue,
  updateCommittedOverride,
  saveAndApply,
  exportEditorCsv,
  resetDraft,
  dirty,
  saving,
  editorInputMode,
  setEditorInputMode,
  fundRouteIds = {},
  entityScope = "funds",
  setEntityScope = () => {},
  showScope = true,
  entityText = { plural: "fons", searchPlaceholder: "Cercar..." },
  entityMetaByName = {},
}) {
  const key = `model_${editorType}`;
  const yearCols = editorData.years;
  // Actuals are available through the end of the previous year; ≥ this year is editable prediction.
  const ACTUALS_THROUGH_YEAR = 2025;

  const actualsNorm = useMemo(() => {
    const m = {};
    for (const [k, v] of Object.entries(actualsByFundYear)) {
      m[k.trim().toLowerCase()] = v;
    }
    return m;
  }, [actualsByFundYear]);

  const committedNorm = useMemo(() => {
    const m = {};
    Object.entries(committedByFund).forEach(([k, v]) => { m[k.trim().toLowerCase()] = v; });
    return m;
  }, [committedByFund]);

  const paidInNorm = useMemo(() => {
    const m = {};
    Object.entries(paidInByFund).forEach(([k, v]) => { m[k.trim().toLowerCase()] = v; });
    return m;
  }, [paidInByFund]);

  const entityColLabel = entityScope === "companies" ? "Companyia" : entityScope === "re" ? "Fons RE" : entityScope === "funds" ? "Vehicle" : "Fons";

  const rowLink = (name) => {
    const meta = entityMetaByName?.[name] ?? null;
    if (entityScope === "companies" && meta?.id) {
      if (meta.vehicleTipus === "PC") return `/investments/companies/${encodeURIComponent(meta.id)}`;
      if (meta.vehicleTipus === "SF") return `/investments/searchers/${encodeURIComponent(meta.id)}`;
    }
    if (fundRouteIds?.[name]) return `/investments/funds/${encodeURIComponent(fundRouteIds[name])}`;
    return null;
  };

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.07em" }}>Prediccio</span>
        {showScope && (
          <Segmented
            tc={tc}
            value={entityScope}
            onChange={setEntityScope}
            options={[
              { id: "funds", label: "Vehicles" },
              { id: "companies", label: "Companyies" },
            ]}
          />
        )}
        <Segmented tc={tc} value={editorType} onChange={setEditorType} options={[{ id: "calls", label: "Capital Calls" }, { id: "dist", label: "Distribucions" }]} />
        <Segmented tc={tc} value={editorInputMode} onChange={setEditorInputMode} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
        <input value={editorSearch} onChange={(event) => setEditorSearch(event.target.value)} placeholder={entityText.searchPlaceholder} style={{ ...inputStyle(tc), width: 220 }} />
        <span style={{ fontSize: 11, color: tc.textLight }}>{fundNames.length} {entityText.plural}</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportEditorCsv} style={buttonStyle(tc)}>CSV</button>
        <button onClick={resetDraft} style={buttonStyle(tc)}>Restaurar base</button>
        <button onClick={saveAndApply} disabled={saving} style={buttonStyle(tc, dirty && !saving)}>
          {saving ? "Desant..." : "Aplica i desa"}
        </button>
      </div>
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${tc.border}`, color: tc.textLight, fontSize: 12 }}>
        Els imports reals i els compromisos venen del model de capital calls del dashboard. Aquesta taula només edita la previsio de calls i distribucions.
      </div>
      <div style={{ overflow: "auto", maxHeight: "70vh" }}>
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <Th tc={tc} align="left">{entityColLabel}</Th>
              <Th tc={tc}>Base</Th>
              {yearCols.map((year) => <Th key={year} tc={tc}>{year}</Th>)}
              <Th tc={tc}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {fundNames.map((fundName) => {
              const data = editorData.funds[fundName] ?? {};
              const values = data[key] ?? {};
              const normKey = fundName.trim().toLowerCase();
              const committed = committedByFund[fundName] ?? committedNorm[normKey] ?? data.committed ?? 0;
              const paidIn = paidInByFund[fundName] ?? paidInNorm[normKey] ?? 0;
              const base = editorType === "calls" ? Number(committed) || 0 : Number(paidIn) || 0;
              const inPct = editorInputMode === "pct" && base > 0;
              const total = Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0);
              return (
                <tr key={fundName} className="hoverable">
                  <td style={{ ...tdStyle(tc, "left"), position: "sticky", left: 0, background: tc.card, zIndex: 1, fontWeight: 700 }}>
                    {rowLink(fundName)
                      ? <Link to={rowLink(fundName)} title={fundName} style={{ color: tc.navy, textDecoration: "none" }}>{fundName.length > 48 ? `${fundName.slice(0, 48)}...` : fundName}</Link>
                      : (fundName.length > 48 ? `${fundName.slice(0, 48)}...` : fundName)}
                  </td>
                  <td style={tdStyle(tc)}>
                    {editorType === "calls" ? (
                      <input
                        type="number"
                        value={Number(committedOverrides?.[fundName] ?? "") || ""}
                        onChange={(e) => updateCommittedOverride(fundName, e.target.value)}
                        style={{ ...editorNumberStyle(tc), width: 90 }}
                        placeholder="—"
                      />
                    ) : (
                      <span className="num" style={{ color: tc.textLight }}>{fmtC(base)}</span>
                    )}
                  </td>
                  {yearCols.map((year) => {
                    const isPast = year <= ACTUALS_THROUGH_YEAR;
                    if (isPast) {
                      const normKey = fundName.trim().toLowerCase();
                      const fundActuals = actualsByFundYear[fundName] ?? actualsNorm[normKey] ?? {};
                      const actual = (fundActuals[editorType]?.[year]) ?? 0;
                      const pct = actual && base ? `${((actual / base) * 100).toFixed(1)}%` : null;
                      return (
                        <td key={year} style={{ ...tdStyle(tc), background: periodBg(tc, year) }}>
                          {actual ? (
                            <>
                              <div style={{ fontSize: 11, color: tc.textMid, fontWeight: 600 }}>{fmtC(actual)}</div>
                              {pct && <div style={{ fontSize: 9, color: tc.textLight }}>{pct}</div>}
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: tc.textLight }}>—</div>
                          )}
                        </td>
                      );
                    }
                    const value = numberAtYear(values, year);
                    const displayValue = inPct ? (value ? ((value / base) * 100).toFixed(1) : "") : (value || "");
                    const hint = inPct
                      ? (value ? fmtC(value) : null)
                      : (value && base ? `${((value / base) * 100).toFixed(1)}%` : null);
                    return (
                      <td key={year} style={{ ...tdStyle(tc), background: periodBg(tc, year) }}>
                        <input
                          type="number"
                          value={displayValue}
                          onChange={(event) => {
                            const raw = Number(event.target.value);
                            const stored = inPct ? (raw / 100) * base : raw;
                            updateFundValue(fundName, (draft) => ({ ...draft, [key]: yearMapValue(draft[key], year, stored || "") }));
                          }}
                          style={editorNumberStyle(tc)}
                        />
                        {hint ? <div style={{ fontSize: 9, color: tc.textLight }}>{hint}</div> : null}
                      </td>
                    );
                  })}
                  <td style={tdStyle(tc)}>
                    <strong>{inPct ? `${((total / base) * 100).toFixed(1)}%` : fmtC(total)}</strong>
                    {inPct && <div style={{ fontSize: 9, color: tc.textLight }}>{fmtC(total)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
