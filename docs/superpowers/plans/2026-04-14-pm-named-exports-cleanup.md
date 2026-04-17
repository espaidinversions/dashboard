# PM Named Exports Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two unused re-export shims and migrate `pm_coverage_report.mjs` off the old named exports so that `PM_POSITIONS / PM_CLOSED / PM_VALUES / PM_TRANSACTIONS` are only used inside `pm_model_export_js.mjs` (the builder that legitimately constructs them).

**Architecture:** The canonical generated artifact is `src/generated/publicMarkets/publicMarketsModel.generated.js` (rebuilt by `npm run pm:refresh`). All scripts that need read-only access to the model should import `PM_MODEL_GENERATED` from there. The builder (`pm_model_export_js.mjs`) is the only legitimate exception — it must import from the raw source files because it creates the generated file.

**Tech Stack:** Node.js ESM scripts (`.mjs`), no framework, no bundler needed for scripts.

---

### File Map

| Action | Path | Reason |
|--------|------|--------|
| Modify | `scripts/pm_coverage_report.mjs` | Still imports old named exports; migrate to `PM_MODEL_GENERATED` |
| Delete | `src/data/pmTransactions.js` | Unused re-export shim — nothing imports it |
| Delete | `src/data/portfolioValues.js` | Unused re-export shim — nothing imports it |
| No change | `scripts/pm_model_export_js.mjs` | The builder; must import from source — intentional |

---

### Task 1: Migrate `pm_coverage_report.mjs` to `PM_MODEL_GENERATED`

**Files:**
- Modify: `scripts/pm_coverage_report.mjs:1-8`

- [ ] **Step 1: Replace the two old import lines**

Current lines 5-6:
```js
import { PM_POSITIONS, PM_CLOSED, PM_POSITIONS_RAW } from "../src/data/publicMarkets.js";
import { PM_TRANSACTIONS } from "../src/generated/publicMarkets/pmTransactions.js";
```

Replace with:
```js
import { PM_MODEL_GENERATED } from "../src/generated/publicMarkets/publicMarketsModel.generated.js";
```

Then add destructuring constants immediately after the imports block (after the `__dirname` block, before any logic, around line 16):
```js
const PM_POSITIONS     = PM_MODEL_GENERATED.holdings.active;
const PM_CLOSED        = PM_MODEL_GENERATED.holdings.closed;
const PM_POSITIONS_RAW = PM_MODEL_GENERATED.holdings.activeRaw;
const PM_TRANSACTIONS  = PM_MODEL_GENERATED.activity.transactions;
```

The rest of the file is unchanged — it already uses these four names.

- [ ] **Step 2: Verify the script runs without errors**

```bash
node scripts/pm_coverage_report.mjs
```

Expected output (numbers will vary by data):
```
Wrote .../docs/pm-coverage-report.md
Active price coverage: N/M
Closed price coverage: N/M
Closed custodian attribution: N/M
```

No import errors, no `undefined is not iterable` crashes.

- [ ] **Step 3: Commit**

```bash
git add scripts/pm_coverage_report.mjs
git commit -m "refactor: migrate pm_coverage_report to PM_MODEL_GENERATED"
```

---

### Task 2: Delete unused re-export shims

**Files:**
- Delete: `src/data/pmTransactions.js`
- Delete: `src/data/portfolioValues.js`

- [ ] **Step 1: Verify nothing imports the shims**

```bash
grep -r "from.*data/pmTransactions\|from.*data/portfolioValues" src/ scripts/ test/
```

Expected: no matches (both files are only re-export shims and have no consumers left).

- [ ] **Step 2: Delete the files**

```bash
rm "src/data/pmTransactions.js" "src/data/portfolioValues.js"
```

- [ ] **Step 3: Run the full build to confirm nothing broke**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Run tests**

```bash
node --test --test-isolation=none test/chartSeries.test.js test/pmValueUtils.test.js test/publicMarketsModel.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -u src/data/pmTransactions.js src/data/portfolioValues.js
git commit -m "chore: delete unused PM re-export shims (pmTransactions, portfolioValues)"
```

---

### Post-cleanup state

After both tasks:

| Named export | File | Only consumer |
|---|---|---|
| `PM_POSITIONS` | `src/data/publicMarkets.js` | `scripts/pm_model_export_js.mjs` (builder) |
| `PM_CLOSED` | `src/data/publicMarkets.js` | `scripts/pm_model_export_js.mjs` (builder) |
| `PM_TRANSACTIONS` | `src/generated/publicMarkets/pmTransactions.js` | `scripts/pm_model_export_js.mjs` (builder) |
| `PM_VALUES` | `src/generated/publicMarkets/portfolioValues.js` | `scripts/pm_model_export_js.mjs` (builder) |

All UI code and all non-builder scripts use `PM_MODEL` (runtime API) or `PM_MODEL_GENERATED` (generated artifact). The old named exports are fully contained within the build pipeline.
