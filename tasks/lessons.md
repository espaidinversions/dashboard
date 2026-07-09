# Lessons Learned — Turtle Capital Dashboard

> Updated after every user correction. Reviewed at session start.
> Format: **Rule** → Why → How to apply.

---

<!-- TEMPLATE

## [Short title of mistake]

**Rule:** What to do (or not do) from now on.

**Why:** What went wrong / what the user corrected.

**How to apply:** When does this rule kick in?

---
-->

_No lessons yet. This file grows as corrections are made._

---

## [Shipped an undefined-reference crash — build/tests were green]

**Rule:** Before deploying (especially after a wide refactor), actually load each affected route/page in the running app — don't treat "build + tests green" as sufficient. When adding a new call to an imported helper, verify the import landed in the same file.

**Why:** During the vehicleTipus→est refactor, an `estSection(...)` call was added to `ProspectiveCashTab.jsx` but its import edit was blocked by a hook and never retried, so the usage shipped without the import. Vite/rolldown does no undefined-reference analysis and no test renders that lazy-loaded component, so CI was green and the Model/prospective page crashed at runtime in production ("estSection is not defined"). It was extra costly because the DB migration had already been applied, so the bad deploy left prod broken.

**How to apply:** (1) After multi-file edits where individual edits can be independently blocked/retried (e.g. gated hooks), re-grep to confirm every new symbol usage has a matching import. (2) For frontend changes, smoke-load the actual routes (or at least the ones you touched) before/after deploy. (3) Sequence irreversible steps last: deploy + verify the new frontend BEFORE applying destructive DB migrations, not after.

---

## [Duplicated KpiCard component]

**Rule:** Always extract duplicated components to SharedComponents.jsx before starting new work.

**Why:** Found KpiCard defined identically in FundDetail.jsx and CompanyDetail.jsx.

**How to apply:** When creating a component, grep codebase first. If identical/similar exists, import and extend it.

---

## [Centralized configs]

**Rule:** Keep all configuration objects (colors, badges, categories) in config.js, never define them inline.

**Why:** FundDetail.jsx had local vcpeCfg/estCfg that were duplicated versions of config.js's VCPE_CFG/EST_CFG.

**How to apply:** When adding a new config object, check config.js first. Add there, import everywhere.

---

## [Centralized utilities]

**Rule:** Extract duplicated patterns (localStorage keys, formatting) to utils.js.

**Why:** LocalStorage cleanup keys were duplicated in auth.jsx.

**How to apply:** When repeating 3+ lines across files, extract to utils.js with proper documentation.

---

## [Lazy loading for code splitting]

**Rule:** Use React.lazy() for all route components to enable code splitting.

**Why:** Dashboard.jsx (582KB) was loading everything upfront, blocking initial render.

**How to apply:** Wrap route components with lazy() and Suspense as demonstrated in router.jsx.

---

## [Error boundaries for stability]

**Rule:** Wrap routes in ErrorBoundary component to prevent full app crashes.

**Why:** Chart or component failures could crash entire React tree.

**How to apply:** router.jsx now has ErrorBoundary wrapping all routes. Add ErrorBoundary to any complex component subtree.

---

## [Flexible component props]

**Rule:** Design shared components with optional props for flexibility (badgeCfg, emptyDisplay, etc.).

**Why:** Consolidating EditableSelect and EditCell required adding badge styling support to EditableCell.

**How to apply:** When creating variants of a component, add optional props instead of creating new components.

---

## [Relative import paths in subfolders]

**Rule:** Use correct relative paths when files are in subdirectories.

**Why:** ResumTab.jsx in `components/tabs/` was importing from `./SharedComponents.jsx` instead of `../SharedComponents.jsx`.

**How to apply:** Remember: from `components/tabs/`, use `../` for sibling files in `components/`, `../../` for files in `src/` root.


