import express from "express";
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync, watch } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DATA  = join(__dirname, "src/data");
const RAW_DATA  = join(__dirname, "raw-data");
const BACKUP_DIR = join(__dirname, "raw-data/backups");
const CANVAS_FILE = join(__dirname, "Dashboard.canvas");
const PORT      = 3001;

const app = express();
app.use(express.json({ limit: "20mb" }));

// ── CORS ─────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
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

// ── POST /api/pipeline ────────────────────────────────────
// Body: array of fund objects

app.post("/api/pipeline", (req, res) => {
  try {
    const funds = req.body;
    if (!Array.isArray(funds)) return res.status(400).json({ error: "Expected array" });

    // JS file
    writeJs("pipeline.js", "FUNDS0", funds);

    // CSV file (including estimatedClosing)
    const cols = ["id","name","amount","currency","geography","strategy","sector","status","canal","active","estimatedClosing"];
    const rows = funds.map(f => cols.map(c => csvEscape(f[c] ?? "")).join(","));
    const csvContent = [cols.join(","), ...rows].join("\n");
    writeFileSync(join(RAW_DATA, "pipeline.csv"), csvContent, "utf-8");
    backupCsv("pipeline.csv", csvContent);

    res.json({ ok: true, saved: funds.length });
  } catch (e) {
    console.error("/api/pipeline error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/capital-calls ───────────────────────────────
// Body: { csv: "<raw csv text>" }

app.post("/api/capital-calls", (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: "Missing csv" });

    // Save raw CSV + backup
    writeFileSync(join(RAW_DATA, "capital-calls.csv"), csv, "utf-8");
    backupCsv("capital-calls.csv", csv);

    // Convert to JS (mirrors convert-data.py logic)
    const lines = csv.trim().split("\n");
    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    const rows = lines.slice(1).filter(l => l.trim()).map((line, i) => {
      const vals = parseCsvLine(line);
      const r = {};
      headers.forEach((h, j) => r[h] = (vals[j] ?? "").trim());
      return {
        fons:   r.fons,
        tipus:  r.tipus,
        cat:    r.cat,
        data:   r.data,
        mes:    parseInt(r.mes),
        any:    parseInt(r.any),
        fy:     r.fy,
        vcpe:   r.vcpe,
        est:    r.est,
        eur:    parseFloat(r.eur),
        divisa: r.divisa,
      };
    });

    writeJs("capital-calls.js", "RAW_CC", rows);

    res.json({ ok: true, saved: rows.length });
  } catch (e) {
    console.error("/api/capital-calls error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/eur-usd ──────────────────────────────────────
// Fetches live EUR/USD rate from frankfurter.app (free, no key needed).
// Falls back to the hardcoded 1.08 if the request fails.

const RATE_CACHE = { rate: null, fetchedAt: 0 };
const RATE_TTL = 60 * 60 * 1000; // 1 hour

app.get("/api/eur-usd", async (req, res) => {
  try {
    if (Date.now() - RATE_CACHE.fetchedAt < RATE_TTL && RATE_CACHE.rate) {
      return res.json({ rate: RATE_CACHE.rate, source: "cache" });
    }
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const data = await r.json();
    RATE_CACHE.rate = data.rates.USD;
    RATE_CACHE.fetchedAt = Date.now();
    res.json({ rate: RATE_CACHE.rate, source: "live" });
  } catch (e) {
    res.json({ rate: 1.08, source: "fallback" });
  }
});

// ── GET /api/data-version ─────────────────────────────────
// Returns the most recent mtime of any file in src/data/.
// Used by the prod reload watcher in the React app.

app.get("/api/data-version", (req, res) => {
  try {
    const files = ["capital-calls.js", "pipeline.js", "searchers.js", "searchers_all.js"];
    const latest = files.reduce((max, f) => {
      const p = join(SRC_DATA, f);
      if (!existsSync(p)) return max;
      return Math.max(max, statSync(p).mtimeMs);
    }, 0);
    res.json({ version: latest });
  } catch (e) {
    console.error("/api/data-version error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin helpers ─────────────────────────────────────────

function makeAdminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function verifyAdminToken(req, supabase) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || user?.user_metadata?.role !== "admin") return null;
  return user;
}

// ── GET /api/admin/users ──────────────────────────────────
app.get("/api/admin/users", async (req, res) => {
  try {
    const supabase = makeAdminClient();
    const admin = await verifyAdminToken(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    res.json({ users: data.users });
  } catch (e) {
    console.error("/api/admin/users GET error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/users ─────────────────────────────────
app.post("/api/admin/users", async (req, res) => {
  try {
    const supabase = makeAdminClient();
    const admin = await verifyAdminToken(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });
    const { email, role } = req.body ?? {};
    if (!email) return res.status(400).json({ error: "Email required" });
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role: role || "user" },
    });
    if (error) throw error;
    res.json({ user: data?.user ?? null });
  } catch (e) {
    console.error("/api/admin/users POST error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/admin/users/:id ────────────────────────────
app.patch("/api/admin/users/:id", async (req, res) => {
  try {
    const supabase = makeAdminClient();
    const admin = await verifyAdminToken(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { role, email_confirm } = req.body ?? {};
    const updates = {};
    if (role !== undefined) updates.user_metadata = { role };
    if (email_confirm) updates.email_confirm = true;
    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
    if (error) throw error;
    res.json({ user: data?.user ?? null });
  } catch (e) {
    console.error("/api/admin/users PATCH error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────
app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const supabase = makeAdminClient();
    const admin = await verifyAdminToken(req, supabase);
    if (!admin) return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const admins = (allUsers?.users ?? []).filter(u => u.user_metadata?.role === "admin");
    const target = admins.find(u => u.id === id);
    if (target && admins.length <= 1) {
      return res.status(409).json({ error: "Cannot delete the last admin" });
    }
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error("/api/admin/users DELETE error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/board ────────────────────────────────────────
// Returns raw canvas JSON { nodes, edges } from Dashboard.canvas

app.get("/api/board", (req, res) => {
  try {
    if (!existsSync(CANVAS_FILE)) {
      return res.status(404).json({ error: "Canvas not found" });
    }
    const raw = readFileSync(CANVAS_FILE, "utf-8");
    const canvas = JSON.parse(raw);
    res.json({ nodes: canvas.nodes || [], edges: canvas.edges || [] });
  } catch (e) {
    console.error("/api/board error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
