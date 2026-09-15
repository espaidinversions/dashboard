import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { loadCompanies, upsertCompany } from "../db.js";
import { useToast } from "../toast.jsx";
import { ThemeProvider, useTheme } from "../theme.js";
import { fmtM, slugify, formatMultiple, multipleColor } from "../utils.js";
import { FlagImg, Logo, KpiCard, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
import { MetricChart } from "./companies/MetricChart.jsx";
import { useCompanyMetrics } from "./companies/useCompanyMetrics.js";
import { QuarterlyDataSection } from "./companies/QuarterlyDataSection.jsx";

function CompanyDetailInner() {
  const { id } = useParams();
  const { tc, dark, toggle } = useTheme();
  const { canEditSection } = useAuth();
  const canEdit = canEditSection("companies");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState("quarterly");
  const [quarterFilters, setQuarterFilters] = useState({ trimestre: "", ingressos: "", ebitda: "", dfn: "", ingPress: "", ebitdaPress: "", dfnPress: "" });

  const [companies, setCompanies] = useState([]);

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

  const { ltm, annualData, quarterlyWithLTM, revCAGR, ebitdaCAGR } = useCompanyMetrics(quarters);

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

        <QuarterlyDataSection
          tc={tc}
          quarters={quarters}
          canEdit={canEdit}
          quarterFilters={quarterFilters}
          setQuarterFilters={setQuarterFilters}
          filteredQuarters={filteredQuarters}
          saveQuarterField={saveQuarterField}
          addingQuarter={addingQuarter}
          setAddingQuarter={setAddingQuarter}
          newQ={newQ}
          setNewQ={setNewQ}
          addQuarter={addQuarter}
        />

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
  return (
    <ThemeProvider>
      <CompanyDetailInner />
    </ThemeProvider>
  );
}
