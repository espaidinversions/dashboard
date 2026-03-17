# Turtle Capital Dashboard — Project Context

> Claude behavioral rules are in CLAUDE.md. This file covers project-specific context.

---

## Tech Stack

- **Frontend:** React 18.3 + Vite 6 + Recharts 2.13
- **Backend:** Express 4.18 (Node.js, ESM, port 3001)
- **Styling:** Inline JSX styles via `useTheme()` + `src/index.css` for globals
- **Language:** Catalan (ca-ES) UI, English variable names
- **Build:** `npm run dev` (concurrently runs Vite on 5173 + Express on 3001)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/Dashboard.jsx` | Main app — tabs, KPIs, filters, charts |
| `src/components/PipelineFY26.jsx` | FY26 pipeline tab |
| `src/components/MensualTab.jsx` | Monthly breakdown tab |
| `src/components/SearchersTab.jsx` | Search fund tab |
| `src/components/PortfolioCompaniesTab.jsx` | Portfolio companies tab |
| `src/components/SharedComponents.jsx` | Logo, Badge, chart tooltips |
| `src/theme.js` | TC_LIGHT / TC_DARK palettes + ThemeContext |
| `src/config.js` | FY_LIST, color maps, EUR_USD rate |
| `src/utils.js` | Number formatters, CSV parsers |
| `src/index.css` | Global resets, animations, card hover |
| `server.js` | Express API — /api/pipeline, /api/capital-calls, /api/board |
| `public/board.html` | Standalone Kanvas board viewer |
| `Dashboard.canvas` | Kanvas task board (JSON) |
| `canvas-tool.py` | CLI for Kanvas board management |

See `INSTRUCTIONS.md` for full data schema (CSV columns, pipeline fields).

---

## Kanvas Session Commands

Run at session start:
```bash
python canvas-tool.py Dashboard.canvas status
python canvas-tool.py Dashboard.canvas normalize
python canvas-tool.py Dashboard.canvas ready
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

Board viewer: `http://localhost:5173/board.html`

**Never edit `Dashboard.canvas` directly. Never mark a card green (human only).**
