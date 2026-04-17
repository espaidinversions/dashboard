import test from "node:test";
import assert from "node:assert/strict";

import { getUserRole, verifyAdmin } from "../api/_adminAuth.js";
import { isOriginAllowed, setCors } from "../api/_cors.js";
import {
  checkRateLimit,
  resetRateLimitStore,
  setRateLimitClientForTests,
  isRateLimited,
} from "../api/_rateLimit.js";
import { enforceHttps, parsePagination, sanitizeDomain, ValidationError } from "../api/_security.js";

function withEnv(name, value, fn) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

test("setCors rejects unknown origins instead of reflecting wildcard access", () => {
  withEnv("ALLOWED_ORIGINS", "https://example.com", () => {
    const headers = new Map();
    const res = { setHeader: (key, value) => headers.set(key, value) };
    const result = setCors({ headers: { origin: "https://evil.example" } }, res);

    assert.equal(result.allowed, false);
    assert.equal(headers.get("Access-Control-Allow-Origin"), undefined);
  });
});

test("isOriginAllowed permits configured origins", () => {
  withEnv("ALLOWED_ORIGINS", "https://example.com,https://app.example.com", () => {
    assert.equal(isOriginAllowed("https://app.example.com"), true);
    assert.equal(isOriginAllowed("https://evil.example"), false);
  });
});

test("enforceHttps redirects insecure production requests", () => {
  withEnv("NODE_ENV", "production", () => {
    const headers = new Map();
    const res = {
      setHeader: (key, value) => headers.set(key, value),
      end: () => {},
      status: null,
    };
    const allowed = enforceHttps({
      headers: {
        "x-forwarded-proto": "http",
        "x-forwarded-host": "dashboard.example.com",
      },
      originalUrl: "/api/data-version",
    }, res);

    assert.equal(allowed, false);
    assert.equal(headers.get("Location"), "https://dashboard.example.com/api/data-version");
  });
});

test("parsePagination bounds page size", () => {
  const pagination = parsePagination({ page: "2", pageSize: "500" }, { defaultPageSize: 25, maxPageSize: 100 });
  assert.deepEqual(pagination, { page: 2, pageSize: 100, offset: 100 });
});

test("sanitizeDomain rejects invalid values", () => {
  assert.throws(() => sanitizeDomain("bad value"), ValidationError);
  assert.equal(sanitizeDomain("@Example.com"), "example.com");
});

test("rate limiting returns limited after bucket capacity is exceeded", () => {
  resetRateLimitStore();
  const first = isRateLimited("127.0.0.1", "admin", { max: 1, windowMs: 60_000 });
  const second = isRateLimited("127.0.0.1", "admin", { max: 1, windowMs: 60_000 });

  assert.equal(first.limited, false);
  assert.equal(second.limited, true);
});

test("checkRateLimit uses shared rpc limiter when available", async () => {
  resetRateLimitStore();
  setRateLimitClientForTests({
    rpc: async () => ({
      data: {
        limited: true,
        limit: 12,
        remaining: 0,
        retry_after_sec: 42,
        reset_at: "2026-04-14T10:00:00.000Z",
      },
      error: null,
    }),
  });

  const result = await checkRateLimit("127.0.0.1", "admin");

  assert.equal(result.limited, true);
  assert.equal(result.retryAfterSec, 42);
  assert.equal(result.limit, 12);
});

test("getUserRole ignores user_metadata role claims", () => {
  assert.equal(getUserRole({ user_metadata: { role: "admin" } }), "user");
  assert.equal(getUserRole({ app_metadata: { role: "superuser" }, user_metadata: { role: "admin" } }), "superuser");
});

test("verifyAdmin rejects admin only present in user_metadata", async () => {
  const req = { headers: { authorization: "Bearer token" } };
  const serviceClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "u1", user_metadata: { role: "admin" } } },
        error: null,
      }),
    },
  };

  const user = await verifyAdmin(req, serviceClient);
  assert.equal(user, null);
});
