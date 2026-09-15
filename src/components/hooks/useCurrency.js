import { useState, useEffect, useCallback } from "react";
import { EUR_USD as DEFAULT_EUR_USD, EUR_GBP as DEFAULT_EUR_GBP, EUR_SEK as DEFAULT_EUR_SEK } from "../../config.js";
import { apiFetchJson } from "../../apiClient.js";

export function useCurrency(initialRate = null) {
  const [eurUsd, setEurUsd] = useState(initialRate);
  const [eurGbp, setEurGbp] = useState(null);
  const [eurSek, setEurSek] = useState(null);

  useEffect(() => {
    if (initialRate > 0) return;
    apiFetchJson("/api/eur-usd")
      .then(({ rate, gbp, sek }) => {
        setEurUsd(rate);
        if (gbp) setEurGbp(gbp);
        if (sek) setEurSek(sek);
      })
      .catch(() => {});
  }, [initialRate]);

  const rate = eurUsd || DEFAULT_EUR_USD;
  const gbpRate = eurGbp || DEFAULT_EUR_GBP;
  const sekRate = eurSek || DEFAULT_EUR_SEK;

  const toEUR = useCallback((amount, currency) => {
    if (currency === "USD") return amount / rate;
    if (currency === "GBP") return amount / gbpRate;
    if (currency === "SEK") return amount / sekRate;
    return amount;
  }, [rate, gbpRate, sekRate]);

  const toUSD = useCallback((amount, currency) => {
    if (currency === "EUR") return amount * rate;
    return toEUR(amount, currency) * rate;
  }, [rate, toEUR]);

  const convert = useCallback((amount, currency, targetCurrency) => {
    if (currency === targetCurrency) return amount;
    if (targetCurrency === "EUR") return toEUR(amount, currency);
    return toUSD(amount, currency);
  }, [toEUR, toUSD]);

  return { eurUsd, setEurUsd, rate, eurGbp, eurSek, toEUR, toUSD, convert };
}
