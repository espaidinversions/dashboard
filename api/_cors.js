const DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGIN;
  if (raw) {
    return [...new Set(
      String(raw)
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
    )];
  }
  return process.env.NODE_ENV === "production" ? [] : DEV_ALLOWED_ORIGINS;
}

export function isOriginAllowed(origin) {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}

export function setCors(reqOrRes, maybeRes = null) {
  const req = maybeRes ? reqOrRes : null;
  const res = maybeRes ?? reqOrRes;
  const requestOrigin = req?.headers?.origin ?? null;
  const allowed = isOriginAllowed(requestOrigin);

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (allowed && requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }

  return { allowed, requestOrigin, allowedOrigins: getAllowedOrigins() };
}
