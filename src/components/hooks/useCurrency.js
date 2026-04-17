import { useState, useEffect, useCallback } from "react";
import { EUR_USD as DEFAULT_EUR_USD } from "../../config.js";
import { apiFetchJson } from "../../apiClient.js";

export function useCurrency(initialRate = null) {
  const [eurUsd, setEurUsd] = useState(initialRate);

  useEffect(() => {
    apiFetchJson("/api/eur-usd")
      .then(({ rate }) => setEurUsd(rate))
      .catch(() => {});
  }, []);

  const rate = eurUsd || DEFAULT_EUR_USD;
  const toEUR = useCallback((amount, currency) => {
    return currency === "USD" ? amount / rate : amount;
  }, [rate]);

  const toUSD = useCallback((amount, currency) => {
    return currency === "EUR" ? amount * rate : amount;
  }, [rate]);

  const convert = useCallback((amount, currency, targetCurrency) => {
    if (currency === targetCurrency) return amount;
    if (targetCurrency === "EUR") return toEUR(amount, currency);
    return toUSD(amount, currency);
  }, [toEUR, toUSD]);

  return { eurUsd, setEurUsd, rate, toEUR, toUSD, convert };
}
