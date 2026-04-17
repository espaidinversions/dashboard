# Task Log — Turtle Capital Dashboard

> One task block per feature/fix. Add new blocks at the top.
> Mark items `[x]` as you complete them.

---

<!-- TEMPLATE — copy this block for each new task

## [TASK TITLE] — YYYY-MM-DD

**Goal:** What needs to happen and why.

**Plan:**
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

**Verification:**
- [ ] Does it work as expected?
- [ ] No regressions introduced?
- [ ] Would a staff engineer approve this?

**Review:**
> (Fill in after completion — what was done, any trade-offs, lessons.)

---
-->

## Data Integrity & Editable Surfaces — 2026-04-16

**Goal:** Full implementation of the "only edit inputs and overrides, never derived models" principle across Alternatives and Public Markets.

### Step 1 — Verify no active data-loading regression ✓
- [x] Confirmed no regression (audit finding: canEdit already gated in all 7 components)

### Step 2 — Formalize canEdit ✓
- [x] Audit confirmed existing guards are correct — no action needed

### Step 3 — Enum selects + DB constraints ✓
- [x] 10 option arrays added to `src/config.js`
- [x] `SearchersTab`, `PortfolioCompaniesTab`, `PipelineFY26` updated to import + use them
- [x] Migration written: `supabase/migrations/202604162100_enum_constraints_and_date_types.sql`
- [x] Migration applied in Supabase SQL editor (2026-04-17)

### Step 4 — Computed date/month fields ✓ (capital_calls only)
- [x] `parseDateParts()` in db.js derives `mes`/`year`/`fy` from `data`
- [x] `capitalCallToRow` + `rowToCapitalCall` updated; `_rowId` added
- [x] Migration written (same file as Step 3: `ALTER COLUMN data TYPE date`)
- [x] Migration applied (same as above)
- [ ] Deferred: `mesos_cercant` / `mesos_operant` computed from dates (not yet done)

### Step 5 — Capital calls CRUD ✓
- [x] `insertCapitalCall`, `updateCapitalCall`, `deleteCapitalCall`, `loadCapitalCalls` in db.js
- [x] Add/edit/delete UI wired into Dashboard.jsx inline fons tab (expanded moviments section)
- [x] `tabs/FonsTab.jsx` also enhanced with same CRUD (for future use)

### Step 6 — PM Operations admin area ✓
- [x] `src/components/admin/AdminPMOperations.jsx` — 4 tabs: Transaccions, Metadades, TER, Overrides
- [x] Wired into `AdminPanel.jsx` as "PM Operacions" nav item
- [x] Load helpers added to db.js: `loadPMTransactions`, `deletePMTransaction`, `loadPMTerOverridesTable`, `loadPMPositionMetaTable`, `loadPMPositionOverridesTable`

### Step 7 — Provenance badges + override notes ✓
- [x] `notes` column added to `pm_position_overrides` + `pm_ter_overrides` (migration)
- [x] TER + Overrides admin tabs show notes field
- [x] `HoldingsTable`: orange OV badge on valorMercat, rendInici, rend2026, rend2025, costAnual
- [x] `PMPositionDetail`: OV badge on overridden nom, custodian, TER

---

**Verification:**
- [ ] Apply migration then confirm app loads cleanly
- [ ] Enum CHECK constraints reject invalid values at DB level
- [ ] Capital calls CRUD: add/edit/delete works, mes/year/fy auto-derive from date
- [ ] PM Operations: all 4 tabs load, edit, and persist correctly
- [ ] OV badges appear on positions with manual overrides

**Remaining deferred:**
- `mesos_cercant` / `mesos_operant` computed from dates (Step 4 partial)

**Review:**
> Steps 3–7 fully implemented. Migration file covers both DATE column change and all 7 CHECK constraints. Capital calls CRUD added inline to Dashboard fons tab. AdminPMOperations is a new admin section with 4 sub-tabs. OV badges use orange #E65100 background to distinguish manual overrides from model data.

---

## Karpathy Practices Setup — 2026-03-17

**Goal:** Implement Karpathy workflow orchestration practices for the project.

**Plan:**
- [x] Create `CLAUDE.md` with standing instructions (auto-loaded each session)
- [x] Create `tasks/todo.md` for task tracking
- [x] Create `tasks/lessons.md` for self-improvement loop

**Verification:**
- [x] CLAUDE.md is in project root (Claude Code auto-loads it)
- [x] tasks/ directory exists with both files

**Review:**
> Workflow infrastructure created. All future non-trivial tasks should start with a plan block here, verified before implementation begins.

---

## Emil Design Rework — 2026-03-17

**Goal:** Apply Emil Kowalski design engineering principles to the frontend.

**Plan:**
- [x] Add custom CSS easing curves (`--ease-out`, `--ease-in-out`)
- [x] Fix `button:active` — add `transform: scale(0.97)` press feedback
- [x] Fix button `transition` — list exact properties, remove implicit `all`
- [x] Fix `transition: "all 0.15s"` on VCPE pill buttons in Dashboard.jsx
- [x] Add KPI card stagger animation (0 / 45 / 90 / 135 / 180ms)
- [x] Add modal overlay fade-in + card scale-in (`scale(0.96→1)`)
- [x] Add tab panel fade + lift animation on every view switch
- [x] Guard card hover behind `@media (hover: hover) and (pointer: fine)`
- [x] Add `prefers-reduced-motion` protection for all animations
- [x] Apply `className="kpi-card card-hover"` to the 5 KPI stat cards
- [x] Apply `className="modal-overlay"` + `className="modal-card"` to DataLoader
- [x] Apply `className="tab-panel"` to all tab content sections

**Verification:**
- [x] index.css has no `transition: all`
- [x] All animations under 300ms (UI elements)
- [x] No `scale(0)` entry — modal starts at `scale(0.96)`

**Review:**
> Clean rework. All transitions now use explicit properties. Custom cubic-bezier curves give animations intentional punch vs. default browser easings. Stagger on KPI cards creates rhythm on load. Touch devices will no longer false-fire hover states.

---
## TODO: Extract useMonthlyGrouping hook
**What:** Extract byMonth/openMonths/toggleMonth into a shared custom hook (`src/utils/useMonthlyGrouping.js`)
**Why:** byMonth grouping + openMonths Set + toggleMonth handler will be duplicated in PMTransaccionsTab.jsx and PublicMarketsTab.jsx after Feature 1 ships. Three usages would be the right extraction trigger.
**Pros:** Eliminates duplication, single place to fix bugs, consistent behavior.
**Cons:** New abstraction for what is currently 30 lines per component.
**Trigger:** When a 3rd monthly accordion is added.
**Found during:** /plan-eng-review of 2026-03-26-pm-resum-txs-closed-positions.md
