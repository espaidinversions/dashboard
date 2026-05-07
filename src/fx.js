import { apiFetchJson } from "./apiClient.js";

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function getHistoricalFxRate(date, baseCurrency, quoteCurrency = "EUR") {
  const base = String(baseCurrency ?? "").trim().toUpperCase();
  const quote = String(quoteCurrency ?? "").trim().toUpperCase();
  if (!base || !quote || base === quote) return 1;
  const isoDate = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("Valid FX date is required");
  }
  const { rate } = await apiFetchJson(
    `/api/fx-rate?date=${encodeURIComponent(isoDate)}&base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}`
  );
  if (!Number.isFinite(Number(rate)) || Number(rate) <= 0) {
    throw new Error(`Invalid FX rate for ${base}/${quote} on ${isoDate}`);
  }
  return Number(rate);
}

export async function convertAmountToEurOnDate({ amount, currency, date }) {
  const nativeAmount = Number(amount);
  const divisa = String(currency ?? "EUR").trim().toUpperCase();
  if (!Number.isFinite(nativeAmount)) {
    throw new Error("Valid amount is required for FX conversion");
  }
  if (!date) {
    throw new Error("Date is required for FX conversion");
  }
  if (divisa === "EUR") {
    const rounded = roundCurrency(nativeAmount);
    return {
      eur: rounded,
      amountNative: rounded,
      fxRate: 1,
      fxSource: "identity",
    };
  }
  if (divisa === "USD") {
    const fxRate = await getHistoricalFxRate(date, "USD", "EUR");
    return {
      eur: roundCurrency(nativeAmount * fxRate),
      amountNative: roundCurrency(nativeAmount),
      fxRate,
      fxSource: `ecb:${String(date).slice(0, 10)}`,
    };
  }
  return {
    eur: roundCurrency(nativeAmount),
    amountNative: null,
    fxRate: null,
    fxSource: null,
  };
}
