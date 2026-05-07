import React, { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useAuth } from "../auth.jsx";
import { loadCompanies, upsertCompany } from "../db.js";
import { useToast } from "../toast.jsx";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify, usePersistedState, formatMultiple, multipleColor, readStoredFlag } from "../utils.js";
import { EditableCell, FlagImg, Logo, KpiCard, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";

function MetricChart({ title, data, actualKey, budgetKey, ltmKey, color, view, tc, withMargin }) {
  const isLTM = view === "ltm" && ltmKey != null;
  const activeKey = isLTM ? ltmKey : actualKey;
  const hasBudget = !isLTM && data.some(q => q[budgetKey] != null);
  const marginKey = isLTM ? "ltmMarginPct" : "ebitdaMarginPct";
  const hasMarginData = !!withMargin && data.some(q => q[marginKey] != null);
  const hasData = data.some(q => q[activeKey] != null);
  const t = ecTheme(tc);

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        {hasMarginData && <span style={{ color: "#E8A020", fontSize: 10, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>— Marge %</span>}
      </div>
      {!hasData ? (
        <div style={{ border: `2px dashed ${tc.border}`, borderRadius: 10, padding: "40px 0", textAlign: "center", color: tc.textLight, fontSize: 12 }}>
          Sense dades
        </div>
      ) : (
        <ReactECharts
          style={{ width: "100%", height: 210 }}
          opts={{ renderer: "canvas" }}
          option={{
            grid: { top: 18, right: hasMarginData ? 44 : 8, bottom: 0, left: 0, containLabel: true },
            tooltip: {
              ...t.tooltip,
              trigger: "axis",
              axisPointer: { type: "shadow" },
              formatter: params => {
                const label = params[0]?.axisValue ?? "";
                let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                params.forEach(p => {
                  if (p.value == null) return;
                  if (p.seriesName === "margin") {
                    html += `<div>${p.marker}Marge EBITDA: ${p.value != null ? `${p.value.toFixed(1)}%` : "—"}</div>`;
                  } else if (p.seriesName === "ltm") {
                    html += `<div>${p.marker}LTM: ${fmtM(p.value)}</div>`;
                  } else if (p.seriesName === "budget") {
                    html += `<div>${p.marker}Pressupost: ${fmtM(p.value)}</div>`;
                  } else {
                    html += `<div>${p.marker}Real: ${fmtM(p.value)}</div>`;
                  }
                });
                return html;
              },
            },
            xAxis: {
              type: "category",
              data: data.map(d => d.q),
              axisLabel: { ...t.axisLabel, fontSize: 9 },
              axisLine: t.axisLine,
              axisTick: t.axisTick,
            },
            yAxis: [
              {
                type: "value",
                axisLabel: { ...t.axisLabel, formatter: v => fmtM(v) },
                splitLine: t.splitLine,
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              },
              ...(hasMarginData ? [{
                type: "value",
                position: "right",
                axisLabel: { ...t.axisLabel, formatter: v => `${v.toFixed(0)}%` },
                splitLine: { show: false },
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              }] : []),
            ],
            series: [
              {
                name: isLTM ? "ltm" : "actual",
                type: "bar",
                yAxisIndex: 0,
                data: data.map(d => d[activeKey] ?? null),
                itemStyle: { color: isLTM ? "#E8A020" : color, opacity: 1 },
                barMaxWidth: 28,
              },
              ...(hasBudget ? [{
                name: "budget",
                type: "bar",
                yAxisIndex: 0,
                data: data.map(d => d[budgetKey] ?? null),
                itemStyle: { color, opacity: 0.3 },
                barMaxWidth: 28,
              }] : []),
              ...(hasMarginData ? [{
                name: "margin",
                type: "line",
                yAxisIndex: 1,
                data: data.map(d => d[marginKey] ?? null),
                lineStyle: { color: "#E8A020", width: 2 },
                itemStyle: { color: "#E8A020" },
                symbol: "circle",
                symbolSize: 5,
                connectNulls: false,
              }] : []),
            ],
          }}
        />
      )}
    </div>
  );
}

function CompanyDetailInner() {
  const { id } = useParams();
  const { tc, dark, toggle } = useTheme();
  const { canEditSection } = useAuth();
  const canEdit = canEditSection("companies");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState("quarterly");
  const [quarterFilters, setQuarterFilters] = useState({ trimestre: "", ingressos: "", ebitda: "", dfn: "", ingPress: "", ebitdaPress: "", dfnPress: "" });

  const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", []);

  useEffect(() => {
    loadCompanies()
      .then((data) => {
        if (Array.isArray(data)) {
          setCompanies(data);
        }
      })
      .catch((error) => {
        console.error("Company detail refresh failed:", error);
      });
  }, [setCompanies]);

  const decodedId = decodeURIComponent(id ?? "");
  const company = companies.find(c => c.id === decodedId || slugify(c.nom) === decodedId);

  const saveQuarterField = async (qLabel, field, value) => {
    if (!company) return;
    const updatedQuarters = company.quarters.map(q =>
      q.q === qLabel ? { ...q, [field]: value === null ? null : parseFloat(value) || null } : q
    );
    const updatedCompany = { ...company, quarters: updatedQuarters };
    const updatedCompanies = companies.map(c => c.id === company.id ? updatedCompany : c);
    setCompanies(updatedCompanies);
    const { data, error } = await upsertCompany(updatedCompany);
    if (error) {
      toast({ message: "Error desant KPI: " + error.message, type: "error" });
      return;
    }
    if (data) {
      setCompanies((current) => current.map((row) => (row.id === company.id ? data : row)));
    }
  };

  const [addingQuarter, setAddingQuarter] = useState(false);
  const [newQ, setNewQ] = useState({ q: "1", year: String(new Date().getFullYear()) });

  const addQuarter = async () => {
    if (!company) return;
    const label = `Q${newQ.q} ${newQ.year}`;
    if (company.quarters.some(q => q.q === label)) return;
    const blank = { q: label, rev: null, ebitda: null, dfn: null, revBudget: null, ebitdaBudget: null, dfnBudget: null };
    const updatedCompany = { ...company, quarters: [...company.quarters, blank] };
    const updatedCompanies = companies.map(c => c.id === company.id ? updatedCompany : c);
    setCompanies(updatedCompanies);
    const { data, error } = await upsertCompany(updatedCompany);
    if (error) {
      toast({ message: "Error desant trimestre: " + error.message, type: "error" });
      return;
    }
    if (data) {
      setCompanies((current) => current.map((row) => (row.id === company.id ? data : row)));
    }
    setAddingQuarter(false);
    setNewQ({ q: "1", year: String(new Date().getFullYear()) });
  };

  if (!company) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 13, fontFamily: "inherit", padding: 0 }}>← Participades</button>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>Empresa no trobada.</div>
      </div>
    );
  }

  const { nom, tipus, segment, entrepreneurs, origen, geo, ticket,
          tvpi, rvpiEur, dpiEur, mesosOperant,
          dataCompr, multEntry, quarters = [] } = company;

  const tvpiColor = multipleColor(tvpi, tc);

  // LTM: last 4 actual quarters
  const ltm = useMemo(() => {
    if (quarters.length === 0) return null;
    const withActuals = quarters.filter(q => q.rev != null || q.ebitda != null || q.dfn != null);
    const last4 = withActuals.slice(-4);
    const sum = key => last4.reduce((s, q) => s + (q[key] ?? 0), 0);
    return { rev: sum("rev"), ebitda: sum("ebitda"), dfn: sum("dfn"), n: last4.length };
  }, [quarters]);

  // Annual aggregation: flows summed, dfn takes last Q (stock)
  const annualData = useMemo(() => {
    if (quarters.length === 0) return [];
    const map = new Map();
    quarters.forEach(q => {
      const year = q.q.split(" ")[1];
      if (!map.has(year)) map.set(year, { q: year });
      const e = map.get(year);
      if (q.rev          != null) e.rev          = (e.rev          ?? 0) + q.rev;
      if (q.ebitda       != null) e.ebitda        = (e.ebitda        ?? 0) + q.ebitda;
      if (q.dfn          != null) e.dfn           = q.dfn;
      if (q.revBudget    != null) e.revBudget     = (e.revBudget     ?? 0) + q.revBudget;
      if (q.ebitdaBudget != null) e.ebitdaBudget  = (e.ebitdaBudget ?? 0) + q.ebitdaBudget;
      if (q.dfnBudget    != null) e.dfnBudget     = q.dfnBudget;
    });
    return Array.from(map.values()).map(e => ({
      ...e,
      ebitdaMarginPct: (e.ebitda != null && e.rev != null && e.rev !== 0)
        ? (e.ebitda / e.rev) * 100 : null,
    }));
  }, [quarters]);

  // Quarterly + rolling LTM + per-period EBITDA margin
  const quarterlyWithLTM = useMemo(() => {
    const actuals = quarters.filter(q => q.rev != null || q.ebitda != null);
    return quarters.map(q => {
      const base = {
        ...q,
        ebitdaMarginPct: (q.ebitda != null && q.rev != null && q.rev !== 0)
          ? (q.ebitda / q.rev) * 100 : null,
      };
      const ai = actuals.findIndex(a => a.q === q.q);
      if (ai < 3) return base;
      const last4 = actuals.slice(ai - 3, ai + 1);
      const sum = key => last4.every(a => a[key] != null) ? last4.reduce((s, a) => s + a[key], 0) : null;
      const ltmRev = sum("rev"), ltmEbitda = sum("ebitda");
      return {
        ...base, ltmRev, ltmEbitda,
        ltmMarginPct: (ltmRev != null && ltmEbitda != null && ltmRev !== 0)
          ? (ltmEbitda / ltmRev) * 100 : null,
      };
    });
  }, [quarters]);

  const chartData = chartView === "annual" ? annualData : quarterlyWithLTM;
  const filteredQuarters = useMemo(() => quarters.filter((q) => {
    if (quarterFilters.trimestre && !String(q.q ?? "").toLowerCase().includes(quarterFilters.trimestre.toLowerCase())) return false;
    if (quarterFilters.ingressos && !String(q.rev ?? "").includes(quarterFilters.ingressos)) return false;
    if (quarterFilters.ebitda && !String(q.ebitda ?? "").includes(quarterFilters.ebitda)) return false;
    if (quarterFilters.dfn && !String(q.dfn ?? "").includes(quarterFilters.dfn)) return false;
    if (quarterFilters.ingPress && !String(q.revBudget ?? "").includes(quarterFilters.ingPress)) return false;
    if (quarterFilters.ebitdaPress && !String(q.ebitdaBudget ?? "").includes(quarterFilters.ebitdaPress)) return false;
    if (quarterFilters.dfnPress && !String(q.dfnBudget ?? "").includes(quarterFilters.dfnPress)) return false;
    return true;
  }), [quarterFilters, quarters]);

  // CAGR from annual data (requires positive first + last values)
  const { revCAGR, ebitdaCAGR } = useMemo(() => {
    const cagr = (rows, key) => {
      if (rows.length < 2) return null;
      const first = rows[0][key], last = rows[rows.length - 1][key];
      if (!first || !last || first <= 0 || last <= 0) return null;
      return (Math.pow(last / first, 1 / (rows.length - 1)) - 1) * 100;
    };
    return {
      revCAGR:    cagr(annualData.filter(y => y.rev    > 0), "rev"),
      ebitdaCAGR: cagr(annualData.filter(y => y.ebitda > 0), "ebitda"),
    };
  }, [annualData]);

  // LTM-derived operating KPIs
  const ltmMarginPct = (ltm?.ebitda != null && ltm?.rev != null && ltm.rev !== 0)
    ? (ltm.ebitda / ltm.rev) * 100 : null;
  const ltmLeverage  = (ltm?.dfn != null && ltm?.ebitda != null && ltm.ebitda > 0)
    ? ltm.dfn / ltm.ebitda : null;

  const marginColor   = ltmMarginPct == null ? tc.textLight : ltmMarginPct >= 15 ? tc.green : ltmMarginPct >= 0 ? tc.warning : tc.red;
  const leverageColor = ltmLeverage  == null ? tc.textLight : ltmLeverage <= 2.5 ? tc.green : ltmLeverage <= 4  ? tc.warning : tc.red;
  const cagrColor = v => v == null ? tc.textLight : v >= 0 ? tc.green : tc.red;
  const fmtPct    = v  => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—";
  const ltmSub    = ltm?.n != null && ltm.n < 4 ? `Últims ${ltm.n} trim.` : "Últims 12 mesos";
  const cagrYears = annualData.length >= 2 ? `${annualData[0].q}–${annualData[annualData.length - 1].q}` : null;

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Top bar */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}><Logo /></Link>
        <div style={{ flex: 1 }} />
        <button onClick={toggle} style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 16, color: tc.textMid, fontFamily: "inherit" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
      {/* Entity bar */}
      <div style={{ background: tc.navy, padding: "0 32px", display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit", padding: 0 }}>← Participades</button>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 8px", fontWeight: 600, letterSpacing: "0.04em" }}>{tipus}</span>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{segment}</span>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", borderRadius: 4, padding: "2px 8px", fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{company.id}</span>
          {geo && <FlagImg geo={geo} size={18} />}
        </div>
      </div>

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Row 1 — Investment KPIs */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard label="Ticket" value={fmtM(ticket)} tc={tc} hero />
          <KpiCard label="TVPI"          value={formatMultiple(tvpi)} valueColor={tvpiColor} tc={tc} />
          <KpiCard label="RVPI"          value={fmtM(rvpiEur ?? 0)} tc={tc} />
          <KpiCard label="DPI"           value={fmtM(dpiEur ?? 0)} tc={tc} />
          <KpiCard label="Mesos operant" value={mesosOperant ?? "—"} tc={tc} />
        </div>

        {/* Row 2 — Operating KPIs */}
        {ltm && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <KpiCard label="Ingressos LTM"  value={ltm.rev    != null ? fmtM(ltm.rev)    : "—"} sub={ltmSub} tc={tc} />
            <KpiCard label="EBITDA LTM"     value={ltm.ebitda != null ? fmtM(ltm.ebitda) : "—"} sub={ltmSub} tc={tc} />
            <KpiCard label="Marge EBITDA"   value={ltmMarginPct != null ? `${ltmMarginPct.toFixed(1)}%` : "—"} sub={ltmSub} valueColor={marginColor} tc={tc} />
            <KpiCard label="Ràtio de Deute" value={ltmLeverage  != null ? `${ltmLeverage.toFixed(1)}×`  : "—"} sub="DFN / EBITDA LTM" valueColor={leverageColor} tc={tc} />
            <KpiCard label="CAGR Ingressos" value={fmtPct(revCAGR)}    sub={cagrYears} valueColor={cagrColor(revCAGR)}    tc={tc} />
            <KpiCard label="CAGR EBITDA"    value={fmtPct(ebitdaCAGR)} sub={cagrYears} valueColor={cagrColor(ebitdaCAGR)} tc={tc} />
          </div>
        )}

        {/* Charts */}
        {quarters.length === 0 ? (
          <div style={{ background: tc.card, border: `2px dashed ${tc.border}`, borderRadius: 10, padding: "48px 24px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>
            Afegeix dades històriques per veure l'evolució
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Shared view toggle */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
              {[["quarterly", "Trimestral"], ["ltm", "LTM"], ["annual", "Anual"]].map(([v, label]) => (
                <button key={v} onClick={() => setChartView(v)}
                  style={{ padding: "4px 10px", borderRadius: 4, border: `1.5px solid ${chartView === v ? tc.green : tc.border}`, background: chartView === v ? (dark ? "#0A2010" : "#E8F8E8") : "transparent", color: chartView === v ? tc.green : tc.textLight, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: chartView === v ? 700 : 400 }}>
                  {label}
                </button>
              ))}
            </div>
            {/* 3 charts stacked */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <MetricChart
                title="Ingressos" data={chartData}
                actualKey="rev" budgetKey="revBudget" ltmKey="ltmRev"
                color="#28A029" view={chartView} tc={tc}
              />
              <MetricChart
                title="EBITDA" data={chartData}
                actualKey="ebitda" budgetKey="ebitdaBudget" ltmKey="ltmEbitda"
                color="#2B5070" view={chartView} tc={tc} withMargin
              />
              <MetricChart
                title="Deute Net" data={chartData}
                actualKey="dfn" budgetKey="dfnBudget" ltmKey={null}
                color="#6B2E7E" view={chartView} tc={tc}
              />
            </div>
          </div>
        )}

        {/* Quarter data table (editable) */}
        {quarters.length > 0 && (
          <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
            <SectionHeader title="Dades trimestrals" tc={tc} />
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
              <thead>
                <tr>
                  {["Trimestre", "Ingressos", "EBITDA", "DFN", "Ing. Pres.", "EBITDA Pres.", "DFN Pres."].map(h => (
                    <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
                <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.trimestre} onChange={e => setQuarterFilters(v => ({ ...v, trimestre: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ingressos} onChange={e => setQuarterFilters(v => ({ ...v, ingressos: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ebitda} onChange={e => setQuarterFilters(v => ({ ...v, ebitda: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.dfn} onChange={e => setQuarterFilters(v => ({ ...v, dfn: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ingPress} onChange={e => setQuarterFilters(v => ({ ...v, ingPress: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ebitdaPress} onChange={e => setQuarterFilters(v => ({ ...v, ebitdaPress: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                  <th style={{ padding: "6px 8px" }}><input value={quarterFilters.dfnPress} onChange={e => setQuarterFilters(v => ({ ...v, dfnPress: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuarters.map(q => (
                  <tr key={q.q} style={{ borderTop: `1px solid ${tc.border}` }}>
                    <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: tc.text, whiteSpace: "nowrap" }}>{q.q}</td>
                    <td style={{ padding: "2px 4px" }}>
                      <EditableCell value={q.rev} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "rev", v)} disabled={!canEdit} />
                    </td>
                    <td style={{ padding: "2px 4px" }}>
                      <EditableCell value={q.ebitda} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "ebitda", v)} disabled={!canEdit} />
                    </td>
                    <td style={{ padding: "2px 4px" }}>
                      <EditableCell value={q.dfn} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "dfn", v)} disabled={!canEdit} />
                    </td>
                    <td style={{ padding: "2px 4px" }}>
                      <EditableCell value={q.revBudget} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "revBudget", v)} disabled={!canEdit} />
                    </td>
                    <td style={{ padding: "2px 4px" }}>
                      <EditableCell value={q.ebitdaBudget} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "ebitdaBudget", v)} disabled={!canEdit} />
                    </td>
                    <td style={{ padding: "2px 4px" }}>
                      <EditableCell value={q.dfnBudget} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "dfnBudget", v)} disabled={!canEdit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canEdit && (
              <div style={{ marginTop: 12 }}>
                {!addingQuarter ? (
                  <button onClick={() => setAddingQuarter(true)}
                    style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 6,
                      padding: "6px 14px", cursor: "pointer", fontSize: 12, color: tc.textMid,
                      fontFamily: "inherit", fontWeight: 600 }}>
                    + Nou trimestre
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Trimestre</div>
                      <select value={newQ.q} onChange={e => setNewQ(p => ({ ...p, q: e.target.value }))}
                        style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
                        {["1","2","3","4"].map(v => <option key={v} value={v}>Q{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Any</div>
                      <input type="number" value={newQ.year} onChange={e => setNewQ(p => ({ ...p, year: e.target.value }))}
                        style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 80 }} />
                    </div>
                    <button onClick={addQuarter}
                      style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                      Afegir
                    </button>
                    <button onClick={() => setAddingQuarter(false)}
                      style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                      Cancel·lar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* "Nou trimestre" button when no quarters exist yet */}
        {quarters.length === 0 && canEdit && (
          <div style={{ marginTop: 8 }}>
            {!addingQuarter ? (
              <button onClick={() => setAddingQuarter(true)}
                style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 6,
                  padding: "6px 14px", cursor: "pointer", fontSize: 12, color: tc.textMid,
                  fontFamily: "inherit", fontWeight: 600 }}>
                + Nou trimestre
              </button>
            ) : (
              <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Trimestre</div>
                    <select value={newQ.q} onChange={e => setNewQ(p => ({ ...p, q: e.target.value }))}
                      style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
                      {["1","2","3","4"].map(v => <option key={v} value={v}>Q{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Any</div>
                    <input type="number" value={newQ.year} onChange={e => setNewQ(p => ({ ...p, year: e.target.value }))}
                      style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 80 }} />
                  </div>
                  <button onClick={addQuarter}
                    style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                    Afegir
                  </button>
                  <button onClick={() => setAddingQuarter(false)}
                    style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                    Cancel·lar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Entry info */}
        <div style={{ ...tableCardStyle(tc) }}>
          <SectionHeader title="Entrada" tc={tc} />
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              ["Data d'entrada",   dataCompr || "—"],
              ["Múltiple entrada", multEntry != null ? `${multEntry}×` : "—"],
              ["Origen",           origen || "—"],
              ["Emprenedors",      entrepreneurs || "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: tc.text }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const [dark, setDark] = useState(() => readStoredFlag("tc_dark"));
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <CompanyDetailInner />
    </ThemeContext.Provider>
  );
}
