const rateLimitMap = new Map();

export function isRateLimited(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 30;
  const entry = rateLimitMap.get(ip) ?? { count: 0, start: now };
  if (now - entry.start > window) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= max) return true;
  rateLimitMap.set(ip, { ...entry, count: entry.count + 1 });
  return false;
}
