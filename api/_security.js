import { getRequestIp } from "./_adminAuth.js";
import { setCors } from "./_cors.js";
import { checkRateLimit } from "./_rateLimit.js";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export function sendJson(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
  return null;
}

function sendNoContent(res, status = 204) {
  if (typeof res.status === "function") {
    return res.status(status).end();
  }
  res.statusCode = status;
  res.end();
  return null;
}

export function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
}

export function enforceHttps(req, res) {
  if (process.env.NODE_ENV !== "production") return true;

  const forwardedProto = String(
    req.headers["x-forwarded-proto"]
    ?? req.headers["x-forwarded-protocol"]
    ?? ""
  ).split(",")[0].trim();

  if (!forwardedProto || forwardedProto === "https") return true;

  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const path = req.originalUrl ?? req.url ?? "/";
  res.setHeader("Location", `https://${host}${path}`);
  sendNoContent(res, 308);
  return false;
}

export function enforceCors(req, res) {
  const { allowed } = setCors(req, res);
  if (!allowed) {
    sendJson(res, 403, { error: "Origin not allowed" });
    return false;
  }
  return true;
}

export function handlePreflight(req, res) {
  if (req.method !== "OPTIONS") return false;
  sendNoContent(res, 204);
  return true;
}

export async function enforceRateLimit(req, res, bucket, overrides = {}) {
  const limit = await checkRateLimit(getRequestIp(req), bucket, overrides);
  res.setHeader("X-RateLimit-Limit", String(limit.limit));
  res.setHeader("X-RateLimit-Remaining", String(limit.remaining));
  res.setHeader("X-RateLimit-Reset", String(limit.resetAt));
  if (!limit.limited) return true;
  res.setHeader("Retry-After", String(limit.retryAfterSec));
  sendJson(res, 429, { error: "Too many requests" });
  return false;
}

export function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new ValidationError("Expected boolean");
}

export function sanitizeText(value, { maxLength = 200, allowNewlines = false } = {}) {
  if (value === null || value === undefined) return "";
  let text = String(value).replace(/\0/g, "");
  text = allowNewlines ? text.replace(/\r/g, "") : text.replace(/[\r\n\t]+/g, " ");
  text = text.replace(/\s+/g, allowNewlines ? " " : " ").trim();
  if (text.length > maxLength) {
    throw new ValidationError(`Value exceeds ${maxLength} characters`);
  }
  return text;
}

export function sanitizeEmail(email) {
  return sanitizeText(email, { maxLength: 320 }).toLowerCase();
}

export function sanitizeDomain(domain) {
  const normalized = sanitizeText(domain, { maxLength: 253 }).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    throw new ValidationError("Invalid domain");
  }
  return normalized;
}

export function toFiniteNumber(value, { allowNull = true, min = null, max = null } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowNull) return null;
    throw new ValidationError("Expected number");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError("Expected finite number");
  }
  if (min !== null && parsed < min) {
    throw new ValidationError(`Number must be >= ${min}`);
  }
  if (max !== null && parsed > max) {
    throw new ValidationError(`Number must be <= ${max}`);
  }
  return parsed;
}

export function toInteger(value, { allowNull = false, min = null, max = null } = {}) {
  const parsed = toFiniteNumber(value, { allowNull, min, max });
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) {
    throw new ValidationError("Expected integer");
  }
  return parsed;
}

export function parsePagination(query, { defaultPage = 1, defaultPageSize = 25, maxPageSize = 100 } = {}) {
  const page = Math.max(toInteger(query?.page ?? defaultPage, { allowNull: false, min: 1 }), 1);
  const pageSize = Math.min(
    Math.max(toInteger(query?.pageSize ?? defaultPageSize, { allowNull: false, min: 1 }), 1),
    maxPageSize
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}
