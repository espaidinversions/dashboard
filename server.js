import express from "express";
import { writeFileSync, readFileSync, existsSync, mkdirSync, watch } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { getLatestDataVersion } from "./api/_dataVersion.js";
import { getUserRole, isAllowedRole, isValidEmail, makeServiceClient, verifyAdmin, verifyUser } from "./api/_adminAuth.js";
import {
  ValidationError,
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  normalizeBoolean,
  parsePagination,
  sanitizeDomain,
  sanitizeEmail,
  sanitizeText,
  sendJson,
  toFiniteNumber,
  toInteger,
} from "./api/_security.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DATA  = join(__dirname, "src/data");
const RAW_DATA  = join(__dirname, "raw-data");
const BACKUP_DIR = join(__dirname, "raw-data/backups");
const CANVAS_FILE = join(__dirname, "Dashboard.canvas");
const PORT      = 3001;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }
  return next(error);
});
app.use((req, res, next) => {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;
  next();
});

// ── Helpers ───────────────────────────────────────────────

function sanitizeCsvValue(v) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function csvEscape(v) {
  const s = sanitizeCsvValue(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function backupCsv(filename, content) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  writeFileSync(join(BACKUP_DIR, `${ts}_${filename}`), content, "utf-8");
}

function writeJs(filename, varname, data) {
  writeFileSync(
    join(SRC_DATA, filename),
    `// AUTO-GENERATED — edit via dashboard or raw-data files\n\nexport const ${varname} = ${JSON.stringify(data, null, 2)};\n`,
    "utf-8"
  );
}

function parseCsvLine(line) {
  const fields = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      fields.push(cur); cur = "";
    } else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function ensureIsoDate(value, fieldName) {
  const normalized = sanitizeText(value, { maxLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ValidationError(`${fieldName} must be YYYY-MM-DD`);
  }
  return normalized;
}

function validatePipelineRows(payload) {
  if (!Array.isArray(payload)) throw new ValidationError("Expected array");
  if (payload.length > 5000) throw new ValidationError("Too many pipeline rows");

  return payload.map((row, index) => {
    const prefix = `Row ${index + 1}`;
    const name = sanitizeText(row?.name, { maxLength: 200 });
    if (!name) throw new ValidationError(`${prefix}: name required`);
    return {
      id: toInteger(row?.id, { allowNull: false, min: 1 }),
      name,
      amount: toFiniteNumber(row?.amount, { allowNull: true, min: 0 }),
      currency: sanitizeText(row?.currency, { maxLength: 12 }).toUpperCase(),
      geography: sanitizeText(row?.geography, { maxLength: 80 }),
      strategy: sanitizeText(row?.strategy, { maxLength: 80 }),
      sector: sanitizeText(row?.sector, { maxLength: 80 }),
      status: sanitizeText(row?.status, { maxLength: 80 }),
      canal: sanitizeText(row?.canal, { maxLength: 80 }),
      active: normalizeBoolean(row?.active, true),
      estimatedClosing: row?.estimatedClosing
        ? sanitizeText(row.estimatedClosing, { maxLength: 20 })
        : null,
    };
  });
}

function normalizeCapitalCallsCsv(csv) {
  if (typeof csv !== "string" || !csv.trim()) {
    throw new ValidationError("Missing csv");
  }
  if (csv.length > 10 * 1024 * 1024) {
    throw new ValidationError("CSV exceeds 10 MB");
  }

  const normalized = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = normalized.split("\n").filter(Boolean);
  if (lines.length < 2) throw new ValidationError("CSV must include header and at least one row");
  if (lines.length > 20_000) throw new ValidationError("CSV has too many rows");

  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const requiredHeaders = ["fons", "tipus", "cat", "data", "mes", "any", "fy", "vcpe", "est", "eur", "divisa"];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new ValidationError(`Missing CSV header: ${header}`);
    }
  }

  const rows = lines.slice(1).map((line, index) => {
    const vals = parseCsvLine(line);
    const record = {};
    headers.forEach((header, position) => {
      record[header] = (vals[position] ?? "").trim();
    });

    return {
      fons: sanitizeText(record.fons, { maxLength: 200 }),
      tipus: sanitizeText(record.tipus, { maxLength: 80 }),
      cat: sanitizeText(record.cat, { maxLength: 80 }),
      data: ensureIsoDate(record.data, `Row ${index + 2} data`),
      mes: toInteger(record.mes, { allowNull: false, min: 1, max: 12 }),
      any: toInteger(record.any, { allowNull: false, min: 2000, max: 2100 }),
      fy: sanitizeText(record.fy, { maxLength: 20 }),
      vcpe: sanitizeText(record.vcpe, { maxLength: 80 }),
      est: sanitizeText(record.est, { maxLength: 80 }),
      eur: toFiniteNumber(record.eur, { allowNull: false, min: -1e12, max: 1e12 }),
      divisa: sanitizeText(record.divisa, { maxLength: 12 }).toUpperCase(),
    };
  });

  return {
    csv: [headers.join(","), ...lines.slice(1)].join("\n"),
    rows,
  };
}

function errorResponse(res, error, context) {
  if (error instanceof ValidationError) {
    return sendJson(res, 400, { error: error.message });
  }
  console.error(`${context}:`, error);
  return sendJson(res, 500, { error: "Internal server error" });
}

function withGuard({ auth = "none", rateLimit = "public" }, handler) {
  return async (req, res) => {
    if (!await enforceRateLimit(req, res, rateLimit)) return;
    try {
      const supabase = auth === "none" ? null : makeServiceClient();
      let user = null;
      if (auth === "user") {
        user = await verifyUser(req, supabase);
        if (!user) return sendJson(res, 401, { error: "Unauthorized" });
      }
      if (auth === "admin") {
        user = await verifyAdmin(req, supabase);
        if (!user) return sendJson(res, 403, { error: "Forbidden" });
      }
      return await handler(req, res, { supabase, user });
    } catch (error) {
      return errorResponse(res, error, `[${req.method}] ${req.path}`);
    }
  };
}

// ── POST /api/pipeline ────────────────────────────────────
// Body: array of fund objects

app.post("/api/pipeline", withGuard({ auth: "admin", rateLimit: "sensitive" }, async (req, res) => {
  const funds = validatePipelineRows(req.body);

  writeJs("pipeline.js", "FUNDS0", funds);

  const cols = ["id", "name", "amount", "currency", "geography", "strategy", "sector", "status", "canal", "active", "estimatedClosing"];
  const rows = funds.map(fund => cols.map(col => csvEscape(fund[col] ?? "")).join(","));
  const csvContent = [cols.join(","), ...rows].join("\n");
  writeFileSync(join(RAW_DATA, "pipeline.csv"), csvContent, "utf-8");
  backupCsv("pipeline.csv", csvContent);

  return res.json({ ok: true, saved: funds.length });
}));

// ── POST /api/capital-calls ───────────────────────────────
// Body: { csv: "<raw csv text>" }

app.post("/api/capital-calls", withGuard({ auth: "admin", rateLimit: "sensitive" }, async (req, res) => {
  const { csv } = req.body ?? {};
  const normalized = normalizeCapitalCallsCsv(csv);

  writeFileSync(join(RAW_DATA, "capital-calls.csv"), normalized.csv, "utf-8");
  backupCsv("capital-calls.csv", normalized.csv);
  writeJs("capital-calls.js", "RAW_CC", normalized.rows);

  return res.json({ ok: true, saved: normalized.rows.length });
}));

// ── GET /api/eur-usd ──────────────────────────────────────
// Fetches live EUR/USD rate from frankfurter.app (free, no key needed).
// Falls back to the hardcoded 1.08 if the request fails.

const RATE_CACHE = { rate: null, fetchedAt: 0 };
const RATE_TTL = 60 * 60 * 1000; // 1 hour

app.get("/api/eur-usd", withGuard({ auth: "user", rateLimit: "public" }, async (_req, res) => {
  try {
    if (Date.now() - RATE_CACHE.fetchedAt < RATE_TTL && RATE_CACHE.rate) {
      return res.json({ rate: RATE_CACHE.rate, source: "cache" });
    }
    const response = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const data = await response.json();
    RATE_CACHE.rate = toFiniteNumber(data?.rates?.USD, { allowNull: false, min: 0.1, max: 10 });
    RATE_CACHE.fetchedAt = Date.now();
    return res.json({ rate: RATE_CACHE.rate, source: "live" });
  } catch {
    return res.json({ rate: 1.08, source: "fallback" });
  }
}));

// ── GET /api/auth-settings ────────────────────────────────
// Returns app-wide auth settings such as the registration domain allowlist.

app.get("/api/auth-settings", withGuard({ auth: "none", rateLimit: "auth" }, async (_req, res) => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "allowed_domains")
    .maybeSingle();
  if (error) throw error;
  const allowedDomains = Array.isArray(data?.value)
    ? data.value.map(domain => sanitizeDomain(domain))
    : [];
  return res.json({ allowed_domains: allowedDomains });
}));

// ── GET /api/data-version ─────────────────────────────────
// Returns the most recent mtime of any file in src/data/.
// Used by the prod reload watcher in the React app.

app.get("/api/data-version", withGuard({ auth: "user", rateLimit: "public" }, async (_req, res) => {
  return res.json({ version: getLatestDataVersion(SRC_DATA) });
}));

// ── GET /api/admin/users ──────────────────────────────────
app.get("/api/admin/users", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const { page, pageSize, offset } = parsePagination(req.query, { defaultPageSize: 25, maxPageSize: 100 });
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const users = data?.users ?? [];
  const pagedUsers = users.slice(offset, offset + pageSize);
  return res.json({
    users: pagedUsers,
    pagination: {
      page,
      pageSize,
      total: users.length,
      totalPages: Math.max(Math.ceil(users.length / pageSize), 1),
    },
  });
}));

// ── POST /api/admin/users ─────────────────────────────────
app.post("/api/admin/users", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const email = sanitizeEmail(req.body?.email);
  const role = req.body?.role ? sanitizeText(req.body.role, { maxLength: 20 }) : "user";
  if (!email) return sendJson(res, 400, { error: "Email required" });
  if (!isValidEmail(email)) return sendJson(res, 400, { error: "Invalid email" });
  if (!isAllowedRole(role)) return sendJson(res, 400, { error: "Invalid role" });
  if (role !== "user" && getUserRole(req.user) !== "admin") {
    return sendJson(res, 403, { error: "Assigning elevated roles requires admin" });
  }

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "allowed_domains")
    .maybeSingle();
  const allowedDomains = Array.isArray(setting?.value)
    ? setting.value.map(domain => sanitizeDomain(domain))
    : [];
  if (allowedDomains.length > 0) {
    const emailDomain = email.split("@")[1];
    if (!allowedDomains.includes(emailDomain)) {
      return sendJson(res, 400, { error: "Email domain not allowed" });
    }
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) throw error;

  if (data?.user?.id) {
    const { error: roleError } = await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role },
    });
    if (roleError) throw roleError;
  }

  return res.json({ user: data?.user ?? null });
}));

// ── PATCH /api/admin/users?id=:id ─────────────────────────
app.patch("/api/admin/users", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const id = sanitizeText(req.query?.id, { maxLength: 128 });
  if (!id) return sendJson(res, 400, { error: "User id required" });

  const role = req.body?.role !== undefined ? sanitizeText(req.body.role, { maxLength: 20 }) : undefined;
  const emailConfirm = req.body?.email_confirm !== undefined ? normalizeBoolean(req.body.email_confirm, false) : false;
  const updates = {};
  if (role !== undefined) {
    if (getUserRole(req.user) !== "admin") {
      return sendJson(res, 403, { error: "Role changes require admin" });
    }
    if (!isAllowedRole(role)) return sendJson(res, 400, { error: "Invalid role" });
    updates.app_metadata = { role };
  }
  if (emailConfirm) updates.email_confirm = true;
  const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
  if (error) throw error;
  return res.json({ user: data?.user ?? null });
}));

// ── PATCH /api/admin/users/:id ────────────────────────────
app.patch("/api/admin/users/:id", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const id = sanitizeText(req.params.id, { maxLength: 128 });
  const role = req.body?.role !== undefined ? sanitizeText(req.body.role, { maxLength: 20 }) : undefined;
  const emailConfirm = req.body?.email_confirm !== undefined ? normalizeBoolean(req.body.email_confirm, false) : false;
  const updates = {};
  if (role !== undefined) {
    if (getUserRole(req.user) !== "admin") {
      return sendJson(res, 403, { error: "Role changes require admin" });
    }
    if (!isAllowedRole(role)) return sendJson(res, 400, { error: "Invalid role" });
    updates.app_metadata = { role };
  }
  if (emailConfirm) updates.email_confirm = true;
  const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
  if (error) throw error;
  return res.json({ user: data?.user ?? null });
}));

// ── DELETE /api/admin/users?id=:id ────────────────────────
app.delete("/api/admin/users", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const id = sanitizeText(req.query?.id, { maxLength: 128 });
  if (!id) return sendJson(res, 400, { error: "User id required" });

  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const admins = (allUsers?.users ?? []).filter(user => getUserRole(user) === "admin");
  const target = admins.find(user => user.id === id);
  if (target && admins.length <= 1) {
    return sendJson(res, 409, { error: "Cannot delete the last admin" });
  }
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw error;
  return res.json({ ok: true });
}));

// ── DELETE /api/admin/users/:id ───────────────────────────
app.delete("/api/admin/users/:id", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const id = sanitizeText(req.params.id, { maxLength: 128 });
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const admins = (allUsers?.users ?? []).filter(user => getUserRole(user) === "admin");
  const target = admins.find(user => user.id === id);
  if (target && admins.length <= 1) {
    return sendJson(res, 409, { error: "Cannot delete the last admin" });
  }
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw error;
  return res.json({ ok: true });
}));

// ── GET/PATCH /api/admin/settings/allowed-domains ────────
app.get("/api/admin/settings/allowed-domains", withGuard({ auth: "admin", rateLimit: "admin" }, async (_req, res, { supabase }) => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "allowed_domains")
    .maybeSingle();
  if (error) throw error;
  const domains = Array.isArray(data?.value)
    ? data.value.map(domain => sanitizeDomain(domain))
    : [];
  return res.json({ domains });
}));

app.patch("/api/admin/settings/allowed-domains", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  if (!Array.isArray(req.body?.domains)) {
    return sendJson(res, 400, { error: "domains must be an array" });
  }
  if (req.body.domains.length > 100) {
    return sendJson(res, 400, { error: "Too many domains" });
  }
  const domains = [...new Set(req.body.domains.map(domain => sanitizeDomain(domain)))];
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: "allowed_domains", value: domains, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw error;
  return res.json({ domains });
}));

// ── GET /api/admin/audit-log ──────────────────────────────
app.get("/api/admin/audit-log", withGuard({ auth: "admin", rateLimit: "admin" }, async (req, res, { supabase }) => {
  const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 50, maxPageSize: 200 });
  const user = req.query?.user ? sanitizeText(req.query.user, { maxLength: 320 }) : "";
  const table = req.query?.table ? sanitizeText(req.query.table, { maxLength: 80 }) : "";
  const action = req.query?.action ? sanitizeText(req.query.action, { maxLength: 20 }) : "";

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (user) query = query.ilike("user_email", `%${user}%`);
  if (table) query = query.eq("table_name", table);
  if (action) query = query.eq("action", action);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return res.json({
    logs: data ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(Math.ceil((count ?? 0) / pageSize), 1),
    },
  });
}));

// ── GET /api/board ────────────────────────────────────────
// Returns raw canvas JSON { nodes, edges } from Dashboard.canvas

app.get("/api/board", withGuard({ auth: "user", rateLimit: "public" }, async (_req, res) => {
  if (!existsSync(CANVAS_FILE)) {
    return sendJson(res, 404, { error: "Canvas not found" });
  }
  const raw = readFileSync(CANVAS_FILE, "utf-8");
  const canvas = JSON.parse(raw);
  return res.json({ nodes: canvas.nodes || [], edges: canvas.edges || [] });
}));

// ── Static (production) ───────────────────────────────────
// In production (NODE_ENV=production) Express serves the built Vite app.
// In dev, Vite's dev server handles the frontend.

if (process.env.NODE_ENV === "production") {
  const DIST = join(__dirname, "dist");
  app.use(express.static(DIST));
  app.use(express.static(join(__dirname, "public")));
  app.get("*", (req, res) => res.sendFile(join(DIST, "index.html")));
}

// ── Raw-data file watcher ─────────────────────────────────
// When capital-calls.csv changes on disk (e.g. manual drop or script),
// auto-convert to src/data/capital-calls.js so Vite HMR (dev) or
// the /api/data-version poller (prod) picks it up.

if (existsSync(RAW_DATA)) {
  let debounce = null;
  watch(RAW_DATA, (_, filename) => {
    if (filename !== "capital-calls.csv") return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        const csv = readFileSync(join(RAW_DATA, "capital-calls.csv"), "utf-8");
        const lines = csv.trim().split("\n");
        const headers = parseCsvLine(lines[0]).map(h => h.trim());
        const rows = lines.slice(1).filter(l => l.trim()).map(line => {
          const vals = parseCsvLine(line);
          const r = {};
          headers.forEach((h, j) => r[h] = (vals[j] ?? "").trim());
          return { fons: r.fons, tipus: r.tipus, cat: r.cat, data: r.data,
            mes: parseInt(r.mes), any: parseInt(r.any), fy: r.fy, vcpe: r.vcpe,
            est: r.est, eur: parseFloat(r.eur), divisa: r.divisa };
        });
        writeJs("capital-calls.js", "RAW_CC", rows);
        console.log(`[watcher] capital-calls.csv → src/data/capital-calls.js (${rows.length} rows)`);
      } catch (e) {
        console.error("[watcher] capital-calls.csv conversion failed:", e.message);
      }
    }, 300);
  });
  console.log("Watching raw-data/ for CSV changes…");
}

app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`));
