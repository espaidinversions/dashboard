# Turtle Capital Dashboard — Instructions

## File Structure

```
01. Dashboard/
├── raw-data/                    ← DROP CSV FILES HERE — auto-converted on save
│   ├── capital-calls.csv        ← EDIT THIS to add/update transactions
│   └── pipeline.csv             ← EDIT THIS to add/update pipeline funds
├── src/
│   ├── data/
│   │   ├── capital-calls.js     ← auto-generated from CSV (do not edit)
│   │   └── pipeline.js          ← auto-generated from CSV (do not edit)
│   ├── components/
│   │   ├── Dashboard.jsx        ← main component (entry point)
│   │   ├── PipelineFY26.jsx     ← FY pipeline tab
│   │   ├── MensualTab.jsx       ← monthly transactions tab
│   │   ├── SearchersTab.jsx     ← searchers / relationships tab
│   │   ├── PortfolioCompaniesTab.jsx ← portfolio companies tab
│   │   ├── FonsSelector.jsx     ← fund multi-selector panel
│   │   ├── MesSelector.jsx      ← month/year dropdown
│   │   └── SharedComponents.jsx ← Logo, Badge, EmptyState, chart tooltips
│   ├── config.js                ← UI colours, labels, FY list
│   ├── utils.js                 ← formatting helpers + CSV parsers
│   └── index.css                ← global styles, animations, responsive grids
├── public/
│   └── board.html               ← read-only Kanvas board viewer
├── data/                        ← local Excel/PDF source documents for scripts/ (git-ignored)
├── server.js                    ← Express API + raw-data watcher + static serving
├── convert-data.py              ← CSV → JS converter (called automatically by server)
├── canvas-watcher.cjs           ← Obsidian canvas linter (run separately)
├── Dockerfile                   ← multi-stage Docker build
├── docker-compose.yml           ← one-liner deployment
└── INSTRUCTIONS.md              ← this file
```

---

## How to Update Data

### Option A — Drop & forget (recommended)

1. Edit `raw-data/capital-calls.csv` or `raw-data/pipeline.csv` in Excel / Sheets.
2. Save the file.
3. The server detects the change, auto-converts it to `src/data/*.js`, and the dashboard reloads automatically within ~10 seconds.

No terminal, no manual steps needed.

### Option B — Manual conversion

If the server is not running, convert manually:

```bash
python convert-data.py
```

**Requirements:** Python 3 (no extra packages needed).

---

## CSV Columns

### `raw-data/capital-calls.csv` — Transactions & Commitments

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `fons` | text | Fund name | `ACP Secondaries 4` |
| `tipus` | text | Transaction sub-type | `Aportació`, `Prima Act.`, `Distribució` |
| `cat` | text | Category (used for colouring) | `Capital Call`, `Distribució`, `Retorn Capital`, `Compromís`, `Altres` |
| `data` | date | Transaction date | `2024-03-15` (YYYY-MM-DD) |
| `mes` | integer | Month number | `3` |
| `any` | integer | Year | `2024` |
| `fy` | text | Fiscal year label | `FY 2024` |
| `vcpe` | text | Asset class | `PE`, `VC`, `RE` |
| `est` | text | Strategy | `Fons Primari`, `Fons de Fons`, `SOCIMI` |
| `eur` | number | Amount in EUR | `500000` |
| `divisa` | text | Original currency | `EUR`, `USD` |

**To add a new transaction:** append a new row at the bottom.

### `raw-data/pipeline.csv` — Pipeline

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | integer | Unique ID (increment from last) | `17` |
| `name` | text | Fund name | `New Fund VII` |
| `amount` | number | Target commitment | `2.5` |
| `currency` | text | Currency | `EUR`, `USD` |
| `geography` | text | Geography | `EU`, `US`, `EU/US` |
| `strategy` | text | Strategy | `Fons primari`, `Coinversions`, `Fons secundaris`, `Fons de fons` |
| `sector` | text | Sector focus | `Software`, `Healthcare`, `Generalista`, `B2B Services` |
| `status` | text | Current status | `En estudi`, `Aprovat`, `Descartat` |
| `canal` | text | Sourcing channel | `Arcano`, `Placement Agent`, `Propietari`, `Altres` |
| `active` | boolean | Show in dashboard | `true`, `false` |

**To remove a fund from the dashboard:** set `active` to `false` (keeps history).

---

## Running the Dashboard

### Development (hot-reload)

```bash
npm run dev
```

Opens at `http://localhost:5173`. Vite HMR updates the UI instantly on any source file change.

### Production (Docker — one-liner)

```bash
docker compose up --build
```

Opens at `http://localhost:3001`. Mounts `raw-data/` and `src/data/` as volumes so data updates work without rebuilding.

### Production (Node, no Docker)

```bash
npm run start
```

Builds with Vite first (`npm run build`), then serves at `http://localhost:3001`.

---

## Kanvas Board

The read-only board is always available at `/board.html` (e.g. `http://localhost:3001/board.html`).

To use the full interactive Kanvas workflow (task management in Obsidian):

1. Open the `01. Dashboard` folder as an Obsidian vault.
2. Open `Dashboard.canvas`.
3. Run the canvas watcher in a terminal to get live linting and auto-blocked-state management:

```bash
node kanvas/canvas-watcher.cjs
```

Use `canvas-tool.py` for CLI task operations:

```bash
python kanvas/canvas-tool.py Dashboard.canvas start DA-01
python kanvas/canvas-tool.py Dashboard.canvas finish DA-01
python kanvas/canvas-tool.py Dashboard.canvas status
```

---

## Adding a New Fiscal Year

1. Add the new FY label to `FY_LIST` in `src/config.js` (e.g. `"FY 2027"`).
2. Add transactions for that year to `raw-data/capital-calls.csv` with the matching `fy` value.
3. The server auto-converts and reloads.

---

## EUR/USD Rate

The dashboard fetches the live EUR/USD rate automatically from [frankfurter.app](https://frankfurter.app) (free, no key needed) with a 1-hour cache. The fallback rate (used if the API is unavailable) is defined in `src/config.js`:

```js
export const EUR_USD = 1.08;  // fallback only — live rate is fetched automatically
```

---

## Working with Claude

Load only the files relevant to your task to avoid context overload:

| Task | Files to load |
|------|--------------|
| Add/fix transactions | `raw-data/capital-calls.csv` |
| Add/fix pipeline funds | `raw-data/pipeline.csv` |
| Fix pipeline UI | `src/components/PipelineFY26.jsx` |
| Fix monthly view UI | `src/components/MensualTab.jsx` |
| Fix fund selector | `src/components/FonsSelector.jsx` |
| Change colours/labels | `src/config.js` |
| Fix the main layout | `src/components/Dashboard.jsx` |
| Fix chart tooltips / badges | `src/components/SharedComponents.jsx` |
| Add global styles | `src/index.css` |
| Change API endpoints | `server.js` |
