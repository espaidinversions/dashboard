# Turtle Capital Dashboard — User Guide

> How to navigate the dashboard, manage data, and use the admin tools.

---

## Table of Contents

1. [General Navigation](#1-general-navigation)
2. [Private Markets (Alternatives)](#2-private-markets-alternatives)
   - [Capital Calls (Per Fons)](#21-capital-calls-per-fons)
   - [Searchers](#22-searchers)
   - [Portfolio Companies (Participades)](#23-portfolio-companies-participades)
   - [Pipeline FY26](#24-pipeline-fy26)
3. [Public Markets (Mercats Públics)](#3-public-markets-mercats-públics)
   - [Holdings & Positions](#31-holdings--positions)
   - [Transactions](#32-transactions)
   - [Overrides & Metadata (Admin)](#33-overrides--metadata-admin)
4. [Admin Panel](#4-admin-panel)
5. [Roles & Permissions](#5-roles--permissions)
6. [Data Persistence](#6-data-persistence)

---

## 1. General Navigation

### Sections
The top navy bar has three main sections:
- **Alternatives** — Private markets (default landing page)
- **Mercats Públics** — Public equity and fixed income
- **Real Estate** — Coming soon

### Header Controls (all users)
| Control | What it does |
|---------|-------------|
| Search box | Filters data across the current section |
| ↓ Excel | Exports the current view to an Excel file |
| ☀️ / 🌙 | Toggles light/dark theme (persisted across sessions) |
| Admin | Opens the admin panel (visible to admins only) |
| Sortir | Signs out |

### Keyboard Shortcuts
- **← →** arrows cycle between tabs in the current section
- **Ctrl+P** triggers print view (UI chrome hidden automatically)

### Session & Login
- Sessions expire after **30 minutes of inactivity**. The page will prompt you to log in again.
- Access is restricted to email addresses from approved domains. Contact an admin to add a new domain.

---

## 2. Private Markets (Alternatives)

The Alternatives section has a second navigation bar (blue) for its four main areas: **Fons**, **Searchers**, **Participades**, and **Detall per Inversió**.

---

### 2.1 Capital Calls (Per Fons)

The **Per Fons** tab is the main capital call ledger. It lists every capital call, distribution, and return grouped by fund.

#### Viewing & Filtering
- Use the fiscal year selector (FY 2019–2027) to scope the view
- Filter by type (PE / VC / RE), fund structure, or category (Capital Call / Distribució / Retorn Capital)
- Use the text search to find a specific fund name
- Click chart elements to filter the table to that segment

#### Adding a Capital Call *(admin only)*
1. Click **+ Afegeix moviment** at the bottom of the fund's moviments section
2. Fill in the modal:
   - **Fons** — fund name
   - **Categoria** — Capital Call, Distribució, Retorn Capital, or Altres
   - **Data** — date of the movement (day/month/year)
   - **Import EUR** — amount in euros
   - **Divisa** / Import en divisa — original currency and amount if not EUR
   - **VC/PE/RE** — asset class
   - **Estructura** — Fons Primari, Fons de Fons, or SOCIMI
3. Click **Desa**. The `mes`, `year`, and `FY` fields are derived automatically from the date.

#### Editing a Capital Call *(admin only)*
Click the pencil icon on any row to open the edit modal. Change the fields and click **Desa**.

#### Deleting a Capital Call *(admin only)*
Click the trash icon on the row. No confirmation dialog — the row is removed immediately and the totals update.

#### Excluding a Fund from Analysis
Click the fund name pill in the Fons Selector (top of tab) to toggle it in/out of the aggregations. Excluded funds turn grey. This is a local UI preference and does not affect the data.

---

### 2.2 Searchers

Shows all search capital and equity gap partners tracked through the investment lifecycle.

#### Viewing
- Filter by status, geography, or entry form (Search Capital / Equity Gap)
- The Sankey diagram on the left shows the flow from searchers through stages to portfolio companies

#### Adding a Searcher *(admin only)*
1. Click **+ Afegeix searcher**
2. Fill in: name, status, entry form, geography, ticket size, start date, modality (Solo / Duo / Trio / Partnership)
3. Click **Desa**

#### Editing a Searcher *(admin only)*
Click any cell in the table to edit it inline. The cell turns editable (blue border). Press **Enter** to save or **Escape** to cancel.

Editable fields: status, modality, entry form, geography, ticket, start date.

#### Deleting a Searcher *(admin only)*
Click the trash icon at the end of the row.

---

### 2.3 Portfolio Companies (Participades)

The full list of portfolio companies with operational and financial metrics.

#### Viewing
- Rows are colour-coded by origin (Search Capital, Equity Gap, Direct PE)
- Charts show distribution by origin, geography, segment, and type
- Click a column header to sort

#### Adding a Company *(admin only)*
1. Click **+ Afegeix participada**
2. Required field: **Nom** (company name)
3. Optional: type (SF / PE), segment, entrepreneurs, origin, geography, ticket, TVPI, revenue, EBITDA, commitment date, months operating
4. Click **Desa**

#### Editing a Company *(admin only)*
Click any cell to edit inline. Fields: type, segment, entrepreneurs, origin, geography, ticket, TVPI, revenue, EBITDA, commitment date, months operating.

#### Deleting a Company *(admin only)*
Click the trash icon on the row.

#### Bulk Loading via JSON *(admin only)*
Click **Carregar JSON** to upload a JSON file containing an array of company objects. The file is validated before saving. Existing companies are overwritten by name match; new ones are appended.

#### Refreshing from Database
Click **Refrescar** to reload company data from Supabase, discarding any cached local state.

---

### 2.4 Pipeline FY26

The deal pipeline for the current fiscal year.

#### Viewing
- Filter by geography, strategy, status, canal, and active/inactive
- The aggregation tables at the bottom break down commitments by geo, strategy, sector, status, and canal

#### Adding a Deal *(admin only)*
1. Click **+ Afegeix deal**
2. Fill in: name, amount, currency (EUR / USD), geography, strategy, sector, status, canal, estimated closing date
3. Click **Desa**

#### Editing a Deal *(admin only)*
Click any cell in the row to edit inline. Editable fields: all except the deal ID.

#### Toggling Active / Inactive *(admin only)*
Click the **Actiu** toggle on the row. Inactive deals are hidden from the summary charts by default but remain in the database.

#### Deleting a Deal *(admin only)*
Click the trash icon on the row.

---

## 3. Public Markets (Mercats Públics)

The public markets section shows equity and fixed income holdings. Sub-tabs (green bar): **Resum**, **Renda Variable**, **Renda Fixa**, **Posicions**, **Transaccions**.

The first four tabs are read-only computed views. Data is driven by the PM model (aggregated from fund prices, position metadata, and transaction history). To change what appears there, use the tools below.

---

### 3.1 Holdings & Positions

**Resum** — Portfolio-level KPIs, composition charts, and monthly flow charts. Read-only.

**Renda Variable / Renda Fixa** — Live equity and fixed income tables, filterable by custodian, sector, and geography. Read-only.

**Posicions** — Full list of all active and closed positions. Toggle the **Tancades** switch to see closed positions. Read-only.

---

### 3.2 Transactions

The **Transaccions** tab is where raw transaction data is maintained.

#### Adding a Transaction *(admin only)*
1. Click **+ Afegeix transacció**
2. Fill in: action (Buy / Sell / Income), date, ISIN, asset name, type (RV / RF), custodian, units, NAV, value in EUR
3. Click **Desa**

#### Editing a Transaction *(admin only)*
Click any cell in the row to edit inline. Press **Enter** to save or **Escape** to cancel.

#### Deleting a Transaction *(admin only)*
Click the trash icon. The position and summary views recalculate on next load.

---

### 3.3 Overrides & Metadata (Admin)

These tools are in the **Admin → PM Operacions** section (see §4.5 below). They let you correct or supplement data that comes from the PM model without touching the model itself.

| Tool | What it controls |
|------|-----------------|
| **TER** | Total Expense Ratio overrides per fund. Set when the model's TER is wrong or missing. |
| **Overrides** | Manual corrections for position-level values: valorMercat, rendInici, rend2026, rend2025, costAnual. Overridden values show an orange **OV** badge in the Holdings table. |
| **Metadades** | Custom nom, gestora, and custodian labels per position. Overrides appear with an **OV** badge in PMPositionDetail. |

To add an override: go to the relevant sub-tab, click **+ Afegeix**, fill in the ISIN and the value, optionally add a **Nota** explaining why, and save.

To edit: click the cell inline.

To remove: click the trash icon. The Holdings table will revert to the model value on next load.

---

## 4. Admin Panel

Accessible at `/admin` for users with **admin** or **superuser** role.

---

### 4.1 Usuaris

- Lists all registered users (active + pending approval)
- **Change role:** Select a new role from the dropdown next to each user (user / admin / superuser)
- **Delete user:** Click the trash icon
- **Approve pending user:** Users who registered but haven't been approved appear in the Pending tab. Click **Aprovar** to activate their account.
- **Invite user:** Enter an email address and select a role, then click **Invitar**. The user receives an invite email from Supabase.

---

### 4.2 Activitat

Audit log of every data change in the system.

- Shows: timestamp, user, table, action (INSERT / UPDATE / DELETE), before and after values
- Filter by user, table, or action type
- Summary cards: changes today, most active user, most modified table
- Read-only

---

### 4.3 Dades

Bulk data management tools.

- **Importar dades:** Redirects to the DataLoader modal in the main dashboard. Accepts CSV, Excel, and JSON files for capital calls, portfolio companies, searchers, and pipeline deals.
- **Exportar:** Triggers the Excel export for the full dataset.
- **Esborrar taula:** Permanently deletes all rows from a selected table (capital_calls, portfolio_companies, searchers, or pipeline). You must type the table name to confirm. **This cannot be undone.**

---

### 4.4 Entitats

Registry of all private entities (companies and investment vehicles) used for disambiguation.

- Columns: ID, kind (company / vehicle), canonical name, source name, workbook name, match type, ISIN, country, first investment date, active
- **Match type** indicates data quality:
  - `manual` — matched by hand (most reliable)
  - `normalized` — matched by name normalisation
  - `workbook_id` — matched by workbook row ID
  - `fallback` (red) — no reliable match found; needs review
- **Rename:** Click the canonical name cell to edit it inline

---

### 4.5 PM Operacions

Four sub-tabs for managing public markets operational data.

#### Transaccions
Full CRUD for PM transactions (same as the Transaccions tab in Mercats Públics, but with admin-only add/edit/delete controls).

#### Metadades
Position-level metadata overrides. Lets you set a custom **nom**, **gestora**, or **custodian** for a position when the model's value is wrong or incomplete.

#### TER
Expense ratio overrides. Add the ISIN and the correct TER percentage. Optionally add a note explaining the source.

#### Overrides
Position-level value overrides. Add the ISIN and override any of: `valor_mercat`, `rend_inici`, `rend_2026`, `rend_2025`, `cost_anual`. Add a note explaining the source (e.g., "Bloomberg 2026-04-15"). Overridden cells show an orange **OV** badge in the Holdings table.

---

### 4.6 Configuració

- **Dominis permesos:** List of email domains allowed to register. Add a domain (e.g. `espaidinversions.com`) and click **Desa**. Click the × on a tag to remove a domain. If the list is empty, any email domain can register.

---

## 5. Roles & Permissions

| Action | user | admin | superuser |
|--------|------|-------|-----------|
| View all data | ✓ | ✓ | ✓ |
| Export to Excel | ✓ | ✓ | ✓ |
| Toggle theme | ✓ | ✓ | ✓ |
| Add / edit / delete capital calls | — | ✓ | ✓ |
| Add / edit / delete searchers | — | ✓ | ✓ |
| Add / edit / delete portfolio companies | — | ✓ | ✓ |
| Add / edit / delete pipeline deals | — | ✓ | ✓ |
| Add / edit / delete PM transactions | — | ✓ | ✓ |
| Manage PM overrides, TER, metadata | — | ✓ | ✓ |
| Access admin panel | — | ✓ | ✓ |
| Manage users (invite, approve, delete) | — | ✓ | ✓ |
| Change user roles | — | — | ✓ |
| Clear entire tables | — | ✓ | ✓ |
| Configure allowed domains | — | ✓ | ✓ |

---

## 6. Data Persistence

Understanding where data lives helps avoid surprises.

### Live data (Supabase)
All CRUD operations persist to Supabase immediately. The tables involved are:

| Table | What it stores |
|-------|---------------|
| `capital_calls` | All fund movements (calls, distributions, returns) |
| `portfolio_companies` | Company records and quarterly KPIs |
| `searchers` | Searcher tracking |
| `pipeline` | Deal pipeline |
| `pm_transactions` | Public markets buy/sell/income events |
| `pm_ter_overrides` | Fund expense ratio corrections |
| `pm_position_meta` | Custom labels per ISIN |
| `pm_position_overrides` | Manual value corrections per ISIN |
| `private_entities` | Entity registry |
| `audit_logs` | Immutable change log (auto-populated) |
| `allowed_domains` | Registration whitelist |

### Client cache (localStorage)
The dashboard caches Supabase data in the browser for fast page loads. If you see stale data after an edit made from another device, click **Refrescar** (where available) or do a hard reload (**Ctrl+Shift+R**) to force a fresh fetch.

### Generated / static data
Some data is pre-generated by Python scripts and bundled as JavaScript files in `src/generated/`. This includes fund price history and the PM model. These files are not editable via the UI — they are updated by running the corresponding script and deploying. Any live PM transaction you add via the UI is stored in Supabase and layered on top of the static model at runtime.

---

*Last updated: 2026-04-17*
