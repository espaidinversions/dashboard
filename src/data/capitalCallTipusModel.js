function slugifyTipus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const CAPITAL_CALL_TIPUS_CONCEPTS = [
  "Compromís",
  "Aportació",
  "Fee d'Intermediació",
  "Prima d'Equalització",
  "Distribució",
  "Retorn Capital",
  "Distribució Retinguda",
  "Préstec",
  "Dividends",
  "Interessos",
  "Management Fee",
  "Transferència Participacions",
  "Conversió Participacions",
  "Venture Debt",
];

const CAPITAL_CALL_TIPUS_MODEL = [
  // Source: 260424_Equivalència_Conceptes.xlsx
  { originalTipus: "Capital Call", concept: "Aportació" },
  { originalTipus: "Ampliació Capital", concept: "Aportació" },
  { originalTipus: "Compromís", concept: "Compromís" },
  { originalTipus: "Aportació", concept: "Aportació" },
  { originalTipus: "aportació", concept: "Aportació" },
  { originalTipus: "Aportació capital", concept: "Aportació" },
  { originalTipus: "Aportació Capital", concept: "Aportació" },
  { originalTipus: "Aportació capital (abans Préstec convertible (The Umai Group))", concept: "Aportació" },
  { originalTipus: "Compra participacions", concept: "Aportació" },
  { originalTipus: "Prestació accesòria", concept: "Aportació" },
  { originalTipus: "Secundari", concept: "Aportació" },
  { originalTipus: "Aportació Capital a gestionar (no equity)", concept: "Aportació" },
  { originalTipus: "Aportació no capital", concept: "Aportació" },
  { originalTipus: "Aportació Temporal", concept: "Aportació" },
  { originalTipus: "Assessorament financer", concept: "Fee d'Intermediació" },
  { originalTipus: "Brokerage Fees", concept: "Fee d'Intermediació" },
  { originalTipus: "Comissió de subscripció", concept: "Fee d'Intermediació" },
  { originalTipus: "Origination Fee", concept: "Fee d'Intermediació" },
  { originalTipus: "Fee d'Intermediació", concept: "Fee d'Intermediació" },
  { originalTipus: "Close Interest", concept: "Prima d'Equalització" },
  { originalTipus: "Closing Notional Interest", concept: "Prima d'Equalització" },
  { originalTipus: "Compensació", concept: "Prima d'Equalització" },
  { originalTipus: "Compensació tancament", concept: "Prima d'Equalització" },
  { originalTipus: "Compensation Indmen.", concept: "Prima d'Equalització" },
  { originalTipus: "Distribución EQ Fee", concept: "Prima d'Equalització" },
  { originalTipus: "Equalisation Payment", concept: "Prima d'Equalització" },
  { originalTipus: "Equalisation Premium", concept: "Prima d'Equalització" },
  { originalTipus: "Late Closing Interest", concept: "Prima d'Equalització" },
  { originalTipus: "Late Closing Interest (payable-receivable)", concept: "Prima d'Equalització" },
  { originalTipus: "Prima", concept: "Prima d'Equalització" },
  { originalTipus: "Prima Act.", concept: "Prima d'Equalització" },
  { originalTipus: "Prima Ecualización", concept: "Prima d'Equalització" },
  { originalTipus: "Prima Eq.", concept: "Prima d'Equalització" },
  { originalTipus: "Subscription Fee", concept: "Prima d'Equalització" },
  { originalTipus: "Subscription Premium", concept: "Prima d'Equalització" },
  { originalTipus: "Prima d'Equalització", concept: "Prima d'Equalització" },
  { originalTipus: "Prima Equalització", concept: "Prima d'Equalització" },
  { originalTipus: "Desinversió", concept: "Distribució" },
  { originalTipus: "Distribució", concept: "Distribució" },
  { originalTipus: "Distribució PE", concept: "Distribució" },
  { originalTipus: "Tax distribution", concept: "Distribució" },
  { originalTipus: "Venda 14 part.", concept: "Distribució" },
  { originalTipus: "Venda participacions", concept: "Distribució" },
  { originalTipus: "Devol. Capital", concept: "Retorn Capital" },
  { originalTipus: "Devolució", concept: "Retorn Capital" },
  { originalTipus: "Devolució Capital", concept: "Retorn Capital" },
  { originalTipus: "Retorn Capital", concept: "Retorn Capital" },
  { originalTipus: "Devolució capital temporal", concept: "Distribució Retinguda" },
  { originalTipus: "Devolució retinguda", concept: "Distribució Retinguda" },
  { originalTipus: "Distribució no dinerària", concept: "Distribució Retinguda" },
  { originalTipus: "Distribució temporal", concept: "Distribució Retinguda" },
  { originalTipus: "Distribució Retinguda", concept: "Distribució Retinguda" },
  { originalTipus: "Devolució Préstec + interessos", concept: "Préstec" },
  { originalTipus: "Devolució Venture Debt", concept: "Préstec" },
  { originalTipus: "Préstec", concept: "Préstec" },
  { originalTipus: "Préstec convertible", concept: "Préstec" },
  { originalTipus: "Préstec participatiu", concept: "Préstec" },
  { originalTipus: "Préstec pont", concept: "Préstec" },
  { originalTipus: "Dividendos", concept: "Dividends" },
  { originalTipus: "Dividends", concept: "Dividends" },
  { originalTipus: "Interessos", concept: "Interessos" },
  { originalTipus: "Interessos ", concept: "Interessos" },
  { originalTipus: "Interessos i comissions", concept: "Interessos" },
  { originalTipus: "Interessos préstec capitalitzat", concept: "Interessos" },
  { originalTipus: "Management fees", concept: "Management Fee" },
  { originalTipus: "Retrib. Admor. 2024", concept: "Management Fee" },
  { originalTipus: "Retrib. Admor. 2025", concept: "Management Fee" },
  { originalTipus: "Management Fee", concept: "Management Fee" },
  { originalTipus: "Saldo apertura 2019", concept: "Transferència Participacions" },
  { originalTipus: "Saldo Tancament 2019", concept: "Transferència Participacions" },
  { originalTipus: "Transferència Participacions", concept: "Transferència Participacions" },
  { originalTipus: "Transmissió/Conversió", concept: "Conversió Participacions" },
  { originalTipus: "Conversió Participacions", concept: "Conversió Participacions" },
  { originalTipus: "Venture Debt", concept: "Venture Debt" },
];

const tipusConceptMap = new Map(
  CAPITAL_CALL_TIPUS_MODEL.map((entry) => [slugifyTipus(entry.originalTipus), entry.concept]),
);

export const CAPITAL_CALL_TIPUS_OPTIONS = [...CAPITAL_CALL_TIPUS_CONCEPTS];

export const DISTRIBUCIONS_SET = new Set(["Distribució", "Distribució Retinguda", "Dividends", "Retorn Capital", "Interessos"]);

export const CAPITAL_CALL_TIPUS_GROUPED = [
  ...CAPITAL_CALL_TIPUS_CONCEPTS.filter(c => !DISTRIBUCIONS_SET.has(c)),
  { group: "Distribucions", items: ["Distribució", "Distribució Retinguda", "Dividends", "Retorn Capital", "Interessos"] },
];

const VCPE_CODES = new Set(["PE", "VC", "RE", "SF", "PC"]);

export function normalizeCapitalCallTipus(value) {
  const raw = String(value ?? "").trim();
  if (!raw || VCPE_CODES.has(raw)) return null;
  return tipusConceptMap.get(slugifyTipus(raw)) ?? raw;
}

export function inferCapitalCallCategoryFromTipus(tipus, eur) {
  const concept = normalizeCapitalCallTipus(tipus);
  if (!concept) return Number(eur) >= 0 ? "Capital Call" : "Distribució";

  switch (concept) {
    case "Compromís":
      return "Compromís";
    case "Distribució":
    case "Distribució Retinguda":
    case "Dividends":
    case "Interessos":
      return "Distribució";
    case "Retorn Capital":
      return "Retorn Capital";
    default:
      break;
  }

  const label = slugifyTipus(concept);
  if (Number(eur) < 0 && /(retorn|devolucio|devol)/.test(label)) {
    return "Retorn Capital";
  }
  return Number(eur) >= 0 ? "Capital Call" : "Distribució";
}

export function normalizeCapitalCallSignedAmount(tipus, eur) {
  const amount = Number(eur);
  if (!Number.isFinite(amount) || amount === 0) return amount;

  const concept = normalizeCapitalCallTipus(tipus);
  switch (concept) {
    case "Distribució":
    case "Distribució Retinguda":
    case "Retorn Capital":
    case "Dividends":
    case "Interessos":
      return -Math.abs(amount);
    case "Compromís":
    case "Aportació":
    case "Fee d'Intermediació":
    case "Préstec":
    case "Transferència Participacions":
    case "Conversió Participacions":
    case "Venture Debt":
      return Math.abs(amount);
    case "Management Fee":
    case "Prima d'Equalització":
      return amount;
    default:
      break;
  }

  const category = inferCapitalCallCategoryFromTipus(tipus, amount);
  if (category === "Capital Call" || category === "Compromís") return Math.abs(amount);
  if (category === "Distribució" || category === "Retorn Capital") return -Math.abs(amount);
  return amount;
}
