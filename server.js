import express from "express";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DATA  = join(__dirname, "src/data");
const RAW_DATA  = join(__dirname, "raw-data");
const CANVAS_FILE = join(__dirname, "Dashboard.canvas");
const PORT      = 3001;

const app = express();
app.use(express.json({ limit: "20mb" }));

// ── Helpers ───────────────────────────────────────────────

function csvEscape(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
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
    writeFileSync(join(RAW_DATA, "pipeline.csv"), [cols.join(","), ...rows].join("\n"), "utf-8");

    res.json({ ok: true, saved: funds.length });
  } catch (e) {
    console.error("/api/pipeline error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/capital-calls ───────────────────────────────
// Body: { csv: "<raw csv text>" }

app.post("/api/capital-calls", (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: "Missing csv" });

    // Save raw CSV
    writeFileSync(join(RAW_DATA, "capital-calls.csv"), csv, "utf-8");

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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`));
