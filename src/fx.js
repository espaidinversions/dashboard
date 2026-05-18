export function subtractOneCalendarDay(isoDate) {
  // Use noon UTC to avoid DST-edge midnight ambiguity when converting back to ISO.
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function getEcbRateWithObservedAt(date, baseCurrency, quoteCurrency = "EUR", fetcher) {
  const base = String(baseCurrency ?? "").trim().toUpperCase();
  const quote = String(quoteCurrency ?? "").trim().toUpperCase();
  if (!base || !quote || base === quote) return { rate: 1, observedAt: date };
  const isoDate = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("Valid FX date is required");
  }
  const fetch = fetcher ?? (await import("./apiClient.js")).apiFetchJson;
  const data = await fetch(
    `/api/fx-rate?date=${encodeURIComponent(isoDate)}&base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}`
  );
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX rate for ${base}/${quote} on ${isoDate}`);
  }
  const observedAt = String(data.observedAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) {
    throw new Error(`ECB response missing observedAt for ${base}/${quote} on ${isoDate}`);
  }
  return { rate, observedAt };
}

export async function convertAmountToEurOnDate({ amount, currency, date }, fetcher) {
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
    // All dates in UTC to avoid timezone shift at midnight.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const isFuture = date > todayUtc;

    // T-1 semantics: use the ECB rate from the business day BEFORE the transaction date.
    // For future dates, use yesterday's rate (latest available).
    // ECB's lastNObservations=1 skips weekends/holidays automatically.
    const rateDate = subtractOneCalendarDay(isFuture ? todayUtc : date);
    const { rate: fxRate, observedAt } = await getEcbRateWithObservedAt(rateDate, "USD", "EUR", fetcher);

    return {
      eur: roundCurrency(nativeAmount * fxRate),
      amountNative: roundCurrency(nativeAmount),
      fxRate,
      // fxSource encodes the ECB observation date (not the transaction date).
      fxSource: isFuture ? `ecb:estimated:${observedAt}` : `ecb:${observedAt}`,
    };
  }
  return {
    eur: roundCurrency(nativeAmount),
    amountNative: null,
    fxRate: null,
    fxSource: null,
  };
}
