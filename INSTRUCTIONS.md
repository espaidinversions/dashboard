# Turtle Capital Dashboard — Instructions

## File Structure

```
01. Dashboard/
├── data/
│   ├── capital-calls.csv   ← EDIT THIS to add/update transactions
│   ├── pipeline.csv        ← EDIT THIS to add/update pipeline funds
│   ├── capital-calls.js    ← static fallback (auto-generated, do not edit)
│   └── pipeline.js         ← static fallback (auto-generated, do not edit)
├── config.js               ← UI colours, labels, derived constants
├── utils.js                ← formatting helpers + CSV parsers
├── SharedComponents.jsx    ← Logo, Badge, chart tooltips
├── FonsSelector.jsx        ← fund multi-selector panel
├── MesSelector.jsx         ← month/year dropdown
├── PipelineFY26.jsx        ← FY26 pipeline tab
├── MensualTab.jsx          ← monthly transactions tab
├── Dashboard.jsx           ← main component (entry point)
├── convert-data.py         ← optional: regenerates JS fallback from CSVs
└── INSTRUCTIONS.md         ← this file
```

---

## How to Update Data

### 1. Edit the CSV files

Open either file in Excel, Google Sheets, or any text editor.

#### `data/capital-calls.csv` — Transactions & Commitments

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

#### `data/pipeline.csv` — Pipeline FY26

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | integer | Unique ID (increment from last) | `17` |
| `name` | text | Fund name | `New Fund VII` |
| `amount` | number | Target commitment | `2.5` |
| `currency` | text | Currency | `EUR`, `USD` |
| `geography` | text | Geography | `EU`, `US`, `EU/US` |
| `strategy` | text | Strategy | `Fons primari`, `Coinversions`, `Fons secundaris`, `Fons de fons` |
| `sector` | text | Sector focus | `Software`, `Healthcare`, `Generalista`, `B2B Services`, `Software / B2B` |
| `status` | text | Current status | `En estudi`, `Aprovat`, `Descartat` |
| `canal` | text | Sourcing channel | `Arcano`, `Placement Agent`, `Propietari`, `Altres` |
| `active` | boolean | Show in dashboard | `true`, `false` |

**To remove a fund from the dashboard:** set `active` to `false` (keeps the history).

---

### 2. Load the CSV in the dashboard

No terminal needed. Directly from the dashboard:

1. Click **"↑ Carregar dades"** in the top-right of the header
2. Select the updated CSV file(s) using the file pickers in the modal
3. The dashboard updates instantly

Loaded data is **saved in the browser** (localStorage) and persists across page refreshes. The modal shows how many rows are currently loaded and when they were last updated.

> **Note:** If you clear browser storage, the dashboard falls back to the static data in `data/capital-calls.js` / `data/pipeline.js`.

---

## Working with Claude

Load only the files relevant to your task to avoid context overload:

| Task | Files to load |
|------|--------------|
| Add/fix transactions | `data/capital-calls.csv` |
| Add/fix pipeline funds | `data/pipeline.csv` |
| Fix pipeline UI | `PipelineFY26.jsx` |
| Fix monthly view UI | `MensualTab.jsx` |
| Fix fund selector | `FonsSelector.jsx` |
| Change colours/labels | `config.js` |
| Fix the main layout | `Dashboard.jsx` |
| Fix chart tooltips / badges | `SharedComponents.jsx` |

---

## Adding a New Fiscal Year

1. Add the new FY label to `FY_LIST` in `config.js` (e.g. `"FY 2027"`).
2. Add transactions for that year to `capital-calls.csv` with the matching `fy` value.
3. Load the updated CSV via "↑ Carregar dades" in the dashboard.

## Changing the EUR/USD Rate

Edit `EUR_USD` in `config.js`:

```js
export const EUR_USD = 1.08;  // ← change this value
```

## Regenerating the JS fallback (optional)

If you want to update the static fallback files (used when browser storage is empty), run:

```bash
python convert-data.py
```

**Requirements:** Python 3 (no extra packages needed).
