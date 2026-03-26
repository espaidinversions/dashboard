let cache = { rate: null, fetchedAt: 0 };
const TTL = 60 * 60 * 1000;

export default async function handler(req, res) {
  try {
    if (Date.now() - cache.fetchedAt < TTL && cache.rate) {
      return res.json({ rate: cache.rate, source: "cache" });
    }
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const data = await r.json();
    cache = { rate: data.rates.USD, fetchedAt: Date.now() };
    res.json({ rate: cache.rate, source: "live" });
  } catch {
    res.json({ rate: 1.08, source: "fallback" });
  }
}
