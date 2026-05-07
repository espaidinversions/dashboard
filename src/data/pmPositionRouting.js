function normalizeCustodian(custodian) {
  return String(custodian ?? "").trim();
}

function routeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "none";
}

export function makeIsinCustodianKey(isin, custodian) {
  const cleanIsin = String(isin ?? "").trim();
  if (!cleanIsin) return null;
  return `${cleanIsin}||${normalizeCustodian(custodian)}`;
}

export function makeClosedPositionRouteId(position = null) {
  const isin = String(position?.isin ?? "").trim();
  if (!isin) return null;
  return `closed:${isin}:${routeSlug(position?.custodian)}:${position?.any ?? "unknown"}`;
}

function parseClosedPositionRouteId(routeId) {
  const match = /^closed:([^:]+):([^:]*):([^:]*)$/u.exec(String(routeId ?? ""));
  if (!match) return null;
  return {
    isin: match[1],
    custodianSlug: match[2] || "none",
    year: match[3] || "unknown",
  };
}

export function findActivePositionByRouteId(routeId, positions = [], aliases = {}) {
  const direct = (positions ?? []).find(position => position?.id === routeId);
  if (direct) return direct;

  const aliasTarget = aliases?.[routeId];
  if (aliasTarget) {
    return (positions ?? []).find(position => position?.id === aliasTarget) ?? null;
  }

  const sameIsin = (positions ?? []).filter(position => position?.isin === routeId);
  return sameIsin.length === 1 ? sameIsin[0] : null;
}

export function findClosedPositionByRouteId(routeId, positions = []) {
  const parsed = parseClosedPositionRouteId(routeId);
  if (parsed) {
    const exact = (positions ?? []).find(position =>
      position?.isin === parsed.isin &&
      routeSlug(position?.custodian) === parsed.custodianSlug &&
      String(position?.any ?? "unknown") === parsed.year
    );
    if (exact) return exact;
  }

  const sameIsin = (positions ?? []).filter(position => position?.isin === routeId);
  return sameIsin.length === 1 ? sameIsin[0] : null;
}

export function makePmPositionRouteId(position = null) {
  if (position?.id) return position.id;
  return makeClosedPositionRouteId(position);
}

export function resolvePmTransactionRouteId(tx, positions = [], closedPositions = []) {
  const exactKey = makeIsinCustodianKey(tx?.isin, tx?.custodian);
  const exactActive = (positions ?? []).find(position => makeIsinCustodianKey(position?.isin, position?.custodian) === exactKey);
  if (exactActive?.id) return exactActive.id;

  const sameIsinActive = (positions ?? []).filter(position => position?.isin === tx?.isin);
  if (sameIsinActive.length === 1) return sameIsinActive[0].id;

  const exactClosed = (closedPositions ?? []).find(position =>
    position?.isin === tx?.isin &&
    normalizeCustodian(position?.custodian) === normalizeCustodian(tx?.custodian)
  );
  if (exactClosed) return makeClosedPositionRouteId(exactClosed);

  const sameIsinClosed = (closedPositions ?? []).filter(position => position?.isin === tx?.isin);
  if (sameIsinClosed.length === 1) return makeClosedPositionRouteId(sameIsinClosed[0]);

  return String(tx?.isin ?? "").trim() || null;
}
