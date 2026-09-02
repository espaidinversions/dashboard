function fmtMillionsCell(value) {
  return value != null ? +(Number(value) / 1e6).toFixed(3) : "";
}

function quarterSortValue(label) {
  const [, quarter = "0", year = "0"] = String(label ?? "").match(/Q(\d) (\d+)/) || [];
  return Number(year) * 4 + Number(quarter);
}

export function buildDashboardExportSheets({ companies = [], searchers = [], pipeline = [], cc = [], fundMeta = [] } = {}) {
  return [
    {
      name: "Capital Calls",
      rows: cc.map(r => ({
        "Fons": r.fons,
        "Tipus": r.tipus,
        "Categoria": r.cat,
        "Data": r.data,
        "Mes": r.mes,
        "Any": r.any,
        "FY": r.fy,
        "Estructura": r.est,
        "Import (€)": r.eur,
        "Divisa": r.divisa,
        "Import Divisa": r.amountNative ?? "",
        "FX BCE": r.fxRate ?? "",
        "Font FX": r.fxSource ?? "",
        "Comentaris": r.comentaris ?? "",
      })),
    },
    {
      name: "Fund Meta",
      rows: fundMeta.map(r => ({
        "Fons": r.fons,
        "TVPI": r.tvpi ?? "",
      })),
    },
    {
      name: "Pipeline",
      rows: pipeline.map(r => ({
        "ID": r.id,
        "Nom": r.name,
        "Import": r.amount,
        "Divisa": r.currency,
        "Geo": r.geography,
        "Estratègia": r.strategy,
        "Sector": r.sector,
        "Status": r.status,
        "Canal": r.canal,
        "Actiu": r.active ? "1" : "0",
      })),
    },
    {
      name: "Participades",
      rows: companies.map(c => ({
        "Nom": c.nom,
        "Tipus": c.tipus,
        "Segment": c.segment || "",
        "Entrepreneurs": c.entrepreneurs || "",
        "Origen": c.origen || "",
        "Geo": c.geo || "",
        "Ticket (€M)": c.ticket ? +(c.ticket / 1e6).toFixed(3) : "",
        "TVPI": c.tvpi ?? "",
        "Ingressos (€M)": c.rev ? +(c.rev / 1e6).toFixed(3) : "",
        "EBITDA (€M)": c.ebitda ? +(c.ebitda / 1e6).toFixed(3) : "",
        "Data Compromís": c.dataCompr || "",
        "Mesos Operant": c.mesosOperant ?? "",
      })),
    },
    buildQuarterlyKpiSheet(companies),
    {
      name: "Searchers",
      rows: searchers.map(r => ({
        "Nom": r.nom || "",
        "Status": r.statusScreening || "",
        "Forma Entrada": r.formEntrada || "",
        "Geo": r.geo || "",
        "Ticket (€M)": r.ticket ? +(r.ticket / 1e6).toFixed(3) : "",
        "Data Inici": r.dataInici || "",
        "Modalitat": r.modalitat || "",
      })),
    },
  ];
}

export function buildQuarterlyKpiSheet(companies = []) {
  const fields = [
    ["Ingressos (€M)", "rev"],
    ["Ing. Pressupost (€M)", "revBudget"],
    ["EBITDA (€M)", "ebitda"],
    ["EBITDA Pres. (€M)", "ebitdaBudget"],
    ["Deute Net (€M)", "dfn"],
    ["DFN Pres. (€M)", "dfnBudget"],
  ];
  const allQs = [...new Set(companies.flatMap(c => (c.quarters || []).map(q => q.q)))]
    .sort((a, b) => quarterSortValue(a) - quarterSortValue(b));
  const rows = companies.map(c => {
    const byQ = Object.fromEntries((c.quarters || []).map(q => [q.q, q]));
    const row = { "Nom": c.nom };
    allQs.forEach(q => {
      const data = byQ[q] || {};
      fields.forEach(([label, key]) => { row[`${q} | ${label}`] = fmtMillionsCell(data[key] ?? null); });
    });
    return row;
  });
  return { name: "KPIs Trimestral", rows };
}