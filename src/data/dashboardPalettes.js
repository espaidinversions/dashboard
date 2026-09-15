export function buildEstCfg(tc, dark = false) {
  return {
    "Fons Primari": { color: tc.navy, bg: dark ? "#112030" : "#E6EDF3" },
    "Fons Secundari": { color: tc.navyLight, bg: dark ? "#15263A" : "#EAF0F6" },
    "Fons de Fons": { color: tc.greenDark, bg: dark ? "#0A2010" : "#E8F8E8" },
    "Fons de Coinversió": { color: "#0F766E", bg: dark ? "#0B1F1D" : "#DFF7F3" },
    "Search Fund - Cerca": { color: "#2563A8", bg: dark ? "#0A1828" : "#DDEAF8" },
    "Search Fund - Participada": { color: "#1D4ED8", bg: dark ? "#101B3D" : "#E0E7FF" },
    "Participada (Altres)": { color: "#7A5A00", bg: dark ? "#1A1200" : "#FFF5D6" },
    "Fons Real Estate": { color: tc.purple || "#9B7CC8", bg: dark ? "#20163A" : "#F3EEF8" },
  };
}

export function buildGeoCfg(tc) {
  return {
    "Nord America": { color: tc.navy },
    "Nord d'Europa": { color: tc.green },
    "Sud d'Europa": { color: "#C9822E" },
    "Asia": { color: "#7A5AA6" },
    "LatAm": { color: "#2E9C8E" },
    "Sense classificar": { color: tc.textLight },
  };
}

export function buildSectorCfg(tc) {
  return {
    "Tecnologia": { color: tc.navy },
    "Consum": { color: "#C9822E" },
    "Salut": { color: "#3AA76D" },
    "Industrials / Materials": { color: "#6B7280" },
    "Energy": { color: "#E0A93B" },
    "Telecoms": { color: "#7A5AA6" },
    "Finance": { color: "#2E6FB0" },
    "Food & Agriculture": { color: "#8FA31E" },
    "Serveis": { color: "#2E9C8E" },
    "Real Estate & Infraestructure": { color: tc.purple || "#9B7CC8" },
    "Sense classificar": { color: tc.textLight },
  };
}

export function buildCatCfg(tc, dark = false) {
  return {
    "Capital Call": { color: tc.navy, bg: dark ? "#112030" : "#E6EDF3" },
    "Distribució": { color: tc.green, bg: dark ? "#0A2010" : "#E8F8E8" },
    "Retorn Capital": { color: tc.greenDark, bg: dark ? "#0A2010" : "#D6EAD6" },
    "Compromís": { color: tc.navyLight, bg: dark ? "#112030" : "#E6EDF3" },
    "Altres": { color: tc.textLight, bg: tc.bgAlt },
  };
}

export function buildDashboardPaletteConfig(tc, dark = false) {
  return {
    estCfg: buildEstCfg(tc, dark),
    geoCfg: buildGeoCfg(tc),
    sectorCfg: buildSectorCfg(tc),
    catCfg: buildCatCfg(tc, dark),
  };
}

function colorMapFromCfg(cfg) {
  return Object.fromEntries(Object.entries(cfg).map(([key, value]) => [key, value.color]));
}

export function buildGeoColorMap(tc) {
  return colorMapFromCfg(buildGeoCfg(tc));
}

export function buildSectorColorMap(tc) {
  return colorMapFromCfg(buildSectorCfg(tc));
}