# Turtle Capital Dashboard — Project Context

> Claude behavioral rules are in CLAUDE.md. This file covers project-specific context.

---

## Tech Stack

- **Frontend:** React 19.2 + Vite 6 + ECharts 6 (tree-shaken via `src/echarts.js`) + @nivo/sankey + html2canvas 1.4 + exceljs (lazy-loaded)
- **Backend:** Express 5.2 (Node.js, ESM, port 3001) + Supabase (auth, RLS, data)
- **Styling:** Inline JSX styles via `useTheme()` + `src/index.css` for globals/animations/responsive grids
- **Language:** Catalan (ca-ES) UI, English variable names
- **Build:** `npm run dev` (Vite on 5173 + Express on 3001) · `docker compose up --build` for prod

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/Dashboard.jsx` | Main app — tabs, KPIs, filters, charts, DataLoader modal |
| `src/components/PipelineFY26.jsx` | FY pipeline tab with inline editing |
| `src/components/MensualTab.jsx` | Monthly breakdown tab |
| `src/components/SearchersTab.jsx` | Searchers / relationships tab |
| `src/components/PortfolioCompaniesTab.jsx` | Portfolio companies tab |
| `src/components/SharedComponents.jsx` | Logo, Badge, EmptyState, chart tooltips |
| `src/theme.js` | TC_LIGHT / TC_DARK palettes + ThemeContext |
| `src/config.js` | FY_LIST, color maps, EUR_USD fallback rate |
| `src/utils.js` | Number formatters, CSV parsers, `usePersistedState` hook |
| `src/index.css` | Global resets, animations, responsive grid classes |
| `server.js` | Express API + raw-data watcher + production static serving |
| `public/board.html` | Standalone Kanvas board viewer |
| `raw-data/` | Drop CSVs here — server auto-converts on save |
| `Dashboard.canvas` | Kanvas task board (JSON) |
| `kanvas/canvas-tool.py` | CLI for Kanvas board management |
| `kanvas/canvas-watcher.cjs` | Obsidian canvas linter + blocked-state manager |
| `kanvas/KANVAS_RULES.md` | Kanvas workflow rules reference |
| `Dockerfile` + `docker-compose.yml` | Multi-stage build + one-liner deployment |

See `INSTRUCTIONS.md` for full data schema (CSV columns, pipeline fields).

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/board` | GET | Kanvas board JSON for board.html |
| `/api/pipeline` | GET / POST | Pipeline funds data |
| `/api/capital-calls` | POST | Persist uploaded CSV |
| `/api/eur-usd` | GET | Live EUR/USD rate (1h cache, frankfurter.app) |
| `/api/data-version` | GET | Max mtime of src/data/*.js (triggers prod hot-reload) |

---

## Kanvas Session Commands

Run at session start:
```bash
python kanvas/canvas-tool.py Dashboard.canvas status
python kanvas/canvas-tool.py Dashboard.canvas normalize
python kanvas/canvas-tool.py Dashboard.canvas ready
```

Quick reference:

| Command | Purpose |
|---------|---------|
| `status` | Board overview |
| `ready` | Red tasks available to start |
| `blocked` | Blocked tasks + causes |
| `show <ID>` | Full task detail |
| `start <ID>` | Red → Orange |
| `finish <ID>` | Orange → Cyan |
| `propose <GROUP> "<title>" "<desc>"` | Add purple proposal |
| `normalize` | Assign IDs, update blocked states |

Board viewer: `http://localhost:5173/board.html` (dev) · `http://localhost:3001/board.html` (prod)

**Never edit `Dashboard.canvas` directly. Never mark a card green (human only).**
