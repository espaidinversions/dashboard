const DIST_CATS = new Set(["Distribució", "Retorn Capital"]);

export const SECTION_NAV_TARGET = {
  alternatives: "alt-resum",
  "real-estate": "re-directe",
  "mercats-publics": "mp-resum",
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function countPositions(rows) {
  const ids = new Set();
  for (const r of rows) ids.add(r.id ?? r.fons);
  ids.delete(undefined);
  ids.delete(null);
  return ids.size;
}

export function buildSectionSummary({ tx, compr, sectionId, label }) {
  const txRows = Array.isArray(tx) ? tx : [];
  const comprRows = Array.isArray(compr) ? compr : [];

  const invertit = txRows
    .filter((r) => r.cat === "Capital Call")
    .reduce((s, r) => s + num(r.eur), 0);
  const retornat = txRows
    .filter((r) => DIST_CATS.has(r.cat))
    .reduce((s, r) => s + Math.abs(num(r.eur)), 0);
  const committed = comprRows.reduce((s, r) => s + num(r.eur), 0);
  const compromesPendent = Math.max(0, committed - invertit);
  const nPosicions = countPositions([...txRows, ...comprRows]);

  return {
    sectionId,
    label,
    kind: "cashflow",
    invertit,
    compromesPendent,
    retornat,
    netCashFlow: retornat - invertit,
    nPosicions,
  };
}

export function buildLandingModel({ altTx, altCompr, reTx, reCompr, pmSummary, canAccess }) {
  const allow = typeof canAccess === "function" ? canAccess : () => true;
  const cards = [];

  if (allow("alternatives")) {
    cards.push(buildSectionSummary({ tx: altTx, compr: altCompr, sectionId: "alternatives", label: "Alternatius" }));
  }
  if (allow("real-estate")) {
    cards.push(buildSectionSummary({ tx: reTx, compr: reCompr, sectionId: "real-estate", label: "Real Estate" }));
  }
  if (allow("mercats-publics") && pmSummary) {
    cards.push({
      sectionId: "mercats-publics",
      label: "Mercats Públics",
      kind: "value",
      valorActual: num(pmSummary.valorActual),
      nGestors: num(pmSummary.nGestors),
    });
  }

  const cashCards = cards.filter((c) => c.kind === "cashflow");
  let headline;
  if (cashCards.length > 0) {
    headline = {
      kind: "cashflow",
      invertit: cashCards.reduce((s, c) => s + c.invertit, 0),
      compromesPendent: cashCards.reduce((s, c) => s + c.compromesPendent, 0),
      retornat: cashCards.reduce((s, c) => s + c.retornat, 0),
      nPosicions: cashCards.reduce((s, c) => s + c.nPosicions, 0),
    };
  } else {
    const pmCard = cards.find((c) => c.kind === "value");
    headline = { kind: "value", valorActual: pmCard ? pmCard.valorActual : 0 };
  }

  return { headline, cards };
}
