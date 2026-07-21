export function canonicalPmCustodian(custodian) {
  const value = String(custodian ?? "").trim();
  if (value === "Credit Suisse") return "UBS";
  if (value === "WAM") return "Andbank";
  return value;
}

export function isPmPlaceholderPosition(position = null) {
  const isin = String(position?.isin ?? "").trim().toUpperCase();
  const nom = String(position?.nom ?? "").trim().toLowerCase();
  const value = Number(position?.valorMercat ?? 0);
  return isin === "ISIN" && nom === "nom" && Math.abs(value) < 0.01;
}

export function isEtfPosition(position = null) {
  const nom = String(position?.nom ?? "").toUpperCase();
  return nom.includes("ETF") || nom.includes("ISHARES") || nom.includes("XETRA");
}

export function sumMarketValue(positions = []) {
  return (positions ?? []).reduce((sum, position) => sum + (Number(position?.valorMercat) || 0), 0);
}

export function makeAggregatePosition({
  id,
  nom,
  custodian,
  tipus,
  positions = [],
  valorMercat,
  gestor,
}) {
  const value = valorMercat ?? sumMarketValue(positions);
  const weighted = (field) => {
    let total = 0;
    let weight = 0;
    for (const position of positions ?? []) {
      const v = position?.[field];
      const mv = Number(position?.valorMercat) || 0;
      if (v == null || mv <= 0) continue;
      total += Number(v) * mv;
      weight += mv;
    }
    return weight > 0 ? total / weight : null;
  };

  return {
    id,
    nom,
    gestor,
    custodian,
    tipus,
    valorMercat: value,
    costEur: positions.reduce((sum, position) => sum + (Number(position?.costEur) || 0), 0),
    rendInici: weighted("rendInici"),
    rend2023: weighted("rend2023"),
    rend2024: weighted("rend2024"),
    rend2025: weighted("rend2025"),
    rend2026: weighted("rend2026"),
    costAnual: weighted("costAnual"),
    _aggregate: true,
    _sourcePositions: positions,
  };
}

export function splitIbPositions(positions = []) {
  const ib = (positions ?? []).filter(position => canonicalPmCustodian(position?.custodian) === "Interactive Brokers");
  return {
    etfs: ib.filter(isEtfPosition),
    stocks: ib.filter(position => !isEtfPosition(position)),
  };
}
