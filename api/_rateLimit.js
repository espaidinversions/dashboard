import { createClient } from "@supabase/supabase-js";

const rateLimitMap = new Map();
let rateLimitClientOverride = null;

export const RATE_LIMIT_BUCKETS = {
  public: { windowMs: 60_000, max: 60 },
  auth: { windowMs: 60_000, max: 20 },
  sensitive: { windowMs: 60_000, max: 20 },
  admin: { windowMs: 60_000, max: 12 },
};

export function resetRateLimitStore() {
  rateLimitMap.clear();
  rateLimitClientOverride = null;
}

export function setRateLimitClientForTests(client) {
  rateLimitClientOverride = client;
}

function getBucketConfig(bucket, overrides = {}) {
  return {
    ...(RATE_LIMIT_BUCKETS[bucket] ?? RATE_LIMIT_BUCKETS.public),
    ...overrides,
  };
}

function makeRateLimitClient() {
  if (rateLimitClientOverride) return rateLimitClientOverride;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// NOTE: local in-memory state is only a fallback for environments without the
// shared database-backed limiter.
export function isRateLimited(ip, bucket = "public", overrides = {}) {
  const now = Date.now();
  const config = getBucketConfig(bucket, overrides);
  const key = `${bucket}:${ip || "unknown"}`;
  const current = rateLimitMap.get(key);
  const isExpired = !current || now >= current.resetAt;

  if (isExpired) {
    const resetAt = now + config.windowMs;
    const next = { count: 1, resetAt };
    rateLimitMap.set(key, next);
    return {
      limited: false,
      limit: config.max,
      remaining: Math.max(config.max - next.count, 0),
      retryAfterSec: Math.ceil(config.windowMs / 1000),
      resetAt,
    };
  }

  if (current.count >= config.max) {
    return {
      limited: true,
      limit: config.max,
      remaining: 0,
      retryAfterSec: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  rateLimitMap.set(key, current);
  return {
    limited: false,
    limit: config.max,
    remaining: Math.max(config.max - current.count, 0),
    retryAfterSec: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    resetAt: current.resetAt,
  };
}

export async function checkRateLimit(ip, bucket = "public", overrides = {}) {
  const config = getBucketConfig(bucket, overrides);
  const subject = String(ip || "unknown").slice(0, 255);
  const client = makeRateLimitClient();

  if (client) {
    try {
      const { data, error } = await client.rpc("take_rate_limit", {
        p_bucket: bucket,
        p_subject: subject,
        p_window_ms: config.windowMs,
        p_max_requests: config.max,
      });
      if (!error && data) {
        const resetAt = Date.parse(data.reset_at);
        return {
          limited: Boolean(data.limited),
          limit: Number(data.limit ?? config.max),
          remaining: Number(data.remaining ?? 0),
          retryAfterSec: Number(data.retry_after_sec ?? Math.ceil(config.windowMs / 1000)),
          resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + config.windowMs,
        };
      }
      if (error) {
        console.warn("[rate-limit] falling back to local store:", error.message);
      }
    } catch (error) {
      console.warn("[rate-limit] falling back to local store:", error.message);
    }
  }

  return isRateLimited(subject, bucket, config);
}
