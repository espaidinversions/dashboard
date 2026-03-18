# Claude Code Meta-Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five Claude Code workflow improvements: Context Preservation in CLAUDE.md, auto-generated HANDOFF.md via Stop hook, four project-specific skills, PostToolUse JSX syntax check, and an autoresearch meta-skill.

**Architecture:** All changes are additive config/content files in `.claude/` and `CLAUDE.md`. No dashboard source code is touched. The Stop hook generates HANDOFF.md from git log + tasks/todo.md on every response. The PostToolUse hook runs @babel/parser on edited JS/JSX files. Skills are markdown SOPs invocable via `/skill-name`.

**Tech Stack:** Bash (hook scripts), Node.js CJS (syntax check script), Markdown (skills), JSON (settings.json)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `CLAUDE.md` | Modify | Append `## Context Preservation` section |
| `.gitignore` | Modify | Add `HANDOFF.md`; add exceptions for `.claude/settings.json`, `.claude/hooks/`, `.claude/skills/` |
| `.claude/hooks/generate-handoff.sh` | Create | Bash script: generates HANDOFF.md from git/tasks artifacts |
| `.claude/hooks/check-syntax.js` | Create | Node CJS script: warn-only JSX/JS syntax check via @babel/parser |
| `.claude/settings.json` | Create | Project-level hook config (Stop + PostToolUse). Coexists with `settings.local.json`. |
| `.claude/skills/add-portfolio-company.md` | Create | SOP for adding PORTFOLIO_COMPANIES entry |
| `.claude/skills/update-capital-calls.md` | Create | SOP for adding RAW_CC transaction row |
| `.claude/skills/verify-dashboard.md` | Create | Pre-commit verification checklist |
| `.claude/skills/new-feature.md` | Create | Feature workflow SOP |
| `.claude/skills/autoresearch.md` | Create | Meta-skill: scored quality improvement loop for any skill |

---

## Task 1: CLAUDE.md Context Preservation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read CLAUDE.md to find insertion point**

Open `CLAUDE.md` and confirm the file ends after the `→ See PROJECT.md for project context, file map, and Kanvas commands.` line.

- [ ] **Step 2: Append Context Preservation section**

Add the following to the end of `CLAUDE.md`:

```markdown

---

## Context Preservation

> When context is compressed, Claude must preserve these patterns exactly.

- **ThemeContext pattern** — Outer wrapper: `const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1")`. Provider receives `{ tc, dark, toggle: () => setDark(d => !d) }` — never the raw color object (`TC_LIGHT`/`TC_DARK`). `useTheme()` returns `{ tc, dark, toggle }`.
- **Data loading pattern** — `localStorage.getItem("tc_rawCC")` with `RAW_CC_DEFAULT` fallback (imported from `src/config.js`). `loadFromLS` is private to `Dashboard.jsx` — never import or call it elsewhere.
- **Routing** — `BrowserRouter` + `AppRoutes` in `src/router.jsx`. Fund IDs: `slugify(r.fons)`. Company IDs: `slugify(c.nom)`. Routes: `/` (Dashboard), `/investments` (InvestmentsIndex), `/fund/:id` (FundDetail), `/company/:id` (CompanyDetail).
- **Active task status** — current `[ ]` items in `tasks/todo.md`.
- **Files modified this session** — list of files changed so Claude doesn't re-read everything next turn.
```

- [ ] **Step 3: Verify**

Read `CLAUDE.md` and confirm the `## Context Preservation` section appears at the end.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add Context Preservation section to CLAUDE.md"
```

---

## Task 2: .gitignore Updates

**Background:** `.claude/` is currently fully gitignored. We need to un-ignore specific subdirs so skills and hooks are tracked. `HANDOFF.md` (project root) is ephemeral and must be gitignored.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add HANDOFF.md and .claude/ exceptions**

In `.gitignore`, replace the existing `.claude/` line with:

```
.claude/*
!.claude/settings.json
!.claude/hooks/
!.claude/skills/
HANDOFF.md
```

**Why `.claude/*` and not `.claude/`:** Git cannot un-ignore files inside an ignored directory. Using `.claude/*` ignores the directory's contents without ignoring the directory itself, which allows the `!` negations to work. `settings.local.json` remains ignored because it is inside `.claude/*` and is not explicitly un-ignored.

- [ ] **Step 2: Verify**

```bash
git check-ignore -v .claude/settings.local.json
```
Expected output: `.gitignore:7:.claude/   .claude/settings.local.json` (still ignored)

```bash
git check-ignore -v .claude/settings.json
```
Expected output: empty (not ignored — `!.claude/settings.json` negates it)

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: un-ignore .claude/hooks/ and .claude/skills/ for project tracking"
```

---

## Task 3: generate-handoff.sh

**Files:**
- Create: `.claude/hooks/generate-handoff.sh`

- [ ] **Step 1: Create the hooks directory**

```bash
mkdir -p ".claude/hooks"
```

- [ ] **Step 2: Create generate-handoff.sh**

Create `.claude/hooks/generate-handoff.sh` with this exact content:

```bash
#!/usr/bin/env bash
# Generates HANDOFF.md from git + tasks artifacts.
# Anchors to project root using script location (safe regardless of cwd).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

RECENT_COMMITS="$(git log --oneline -10 2>/dev/null || echo '(no git history)')"
GIT_STATUS="$(git status --short 2>/dev/null || echo '(clean)')"

if [ -f "tasks/todo.md" ]; then
  TASKS="$(cat tasks/todo.md)"
else
  TASKS="(tasks/todo.md not found)"
fi

cat > "$PROJECT_ROOT/HANDOFF.md" << HANDOFF
# Session Handoff
Generated: $TIMESTAMP

## Recent Commits
\`\`\`
$RECENT_COMMITS
\`\`\`

## Current Tasks

$TASKS

## Dirty Files
\`\`\`
$GIT_STATUS
\`\`\`

## Resume With
At the start of the next session, read:
1. \`CLAUDE.md\` — project rules and context preservation patterns
2. \`HANDOFF.md\` (this file) — last session state
3. \`tasks/lessons.md\` — past corrections
HANDOFF
```

- [ ] **Step 3: Make script executable**

```bash
chmod +x ".claude/hooks/generate-handoff.sh"
```

- [ ] **Step 4: Verify — run the script manually**

```bash
bash ".claude/hooks/generate-handoff.sh"
```

Expected: `HANDOFF.md` appears in project root. Read it — should contain timestamp, git log, tasks section, dirty files, and "Resume With" block.

- [ ] **Step 5: Commit**

```bash
git add ".claude/hooks/generate-handoff.sh"
git commit -m "feat: add generate-handoff.sh Stop hook script"
```

---

## Task 4: check-syntax.js

**Files:**
- Create: `.claude/hooks/check-syntax.js`

- [ ] **Step 1: Create check-syntax.js**

Create `.claude/hooks/check-syntax.js` with this exact content:

```js
// Warn-only JSX/JS syntax checker using @babel/parser (already in node_modules).
// Invoked by PostToolUse hook after Edit/Write on any file.
// Always exits 0 (non-blocking).
'use strict';
const path = require('path');
const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) process.exit(0);

const ext = path.extname(filePath).toLowerCase();
if (ext !== '.js' && ext !== '.jsx') process.exit(0);

let code;
try { code = fs.readFileSync(filePath, 'utf8'); }
catch { process.exit(0); }

let parser;
try {
  parser = require(path.join(__dirname, '../../node_modules/@babel/parser'));
} catch { process.exit(0); } // silently skip if @babel/parser not found

try {
  parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
} catch (err) {
  console.log(`⚠ Syntax warning in ${filePath}:\n  ${err.message}`);
}
process.exit(0);
```

- [ ] **Step 2: Verify on a valid file**

```bash
node ".claude/hooks/check-syntax.js" "src/utils.js"
```

Expected: no output (valid file, no warning)

- [ ] **Step 3: Verify on an invalid snippet**

Create a temp file with bad JSX, run the checker, then delete it:

```bash
echo 'const x = <div unclosed' > /tmp/bad.jsx
node ".claude/hooks/check-syntax.js" /tmp/bad.jsx
rm /tmp/bad.jsx
```

Expected output contains: `⚠ Syntax warning in /tmp/bad.jsx:`

- [ ] **Step 4: Commit**

```bash
git add ".claude/hooks/check-syntax.js"
git commit -m "feat: add check-syntax.js PostToolUse hook script"
```

---

## Task 5: .claude/settings.json

**Files:**
- Create: `.claude/settings.json`

**Important:** This file coexists with `.claude/settings.local.json`. Do NOT edit or overwrite `settings.local.json`.

- [ ] **Step 1: Create .claude/settings.json**

Create `.claude/settings.json` with this exact content:

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "bash .claude/hooks/generate-handoff.sh"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/check-syntax.js \"$CLAUDE_TOOL_INPUT_FILE_PATH\""
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/check-syntax.js \"$CLAUDE_TOOL_INPUT_FILE_PATH\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('VALID')"
```

Expected: `VALID`

- [ ] **Step 3: Verify settings.local.json is untouched**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8')); console.log('UNTOUCHED')"
```

Expected: `UNTOUCHED`

- [ ] **Step 4: Commit**

```bash
git add ".claude/settings.json"
git commit -m "feat: add project-level Claude Code hook config (Stop + PostToolUse)"
```

---

## Task 6: Project Skills

**Files:**
- Create: `.claude/skills/add-portfolio-company.md`
- Create: `.claude/skills/update-capital-calls.md`
- Create: `.claude/skills/verify-dashboard.md`
- Create: `.claude/skills/new-feature.md`

- [ ] **Step 1: Create skills directory**

```bash
mkdir -p ".claude/skills"
```

- [ ] **Step 2: Create add-portfolio-company.md**

Create `.claude/skills/add-portfolio-company.md`:

```markdown
---
name: add-portfolio-company
description: SOP for adding a new acquired company to PORTFOLIO_COMPANIES in src/data/searchers.js
type: project
---

# Add Portfolio Company

**Trigger:** Use this skill when adding a new company to the portfolio (post-acquisition).

## Steps

1. Open `src/data/searchers.js`
2. Add an entry to the `PORTFOLIO_COMPANIES` array with all required fields:

```js
{
  nom: "Company Name",     // string — display name and URL slug source
  tipus: "SF",             // "SF" (Search Fund) or "PE" (Private Equity)
  segment: "Software",     // industry segment string
  ticket: 400000,          // number — investment in EUR
  tvpi: 1.23,              // number or null
  rvpiEur: 400000,         // number or null — residual value in EUR
  dpiEur: 0,               // number or null — distributed value in EUR
  mesosOperant: 24,        // number or null — months since acquisition
  dataCompr: "2023-01-15", // string "YYYY-MM-DD" or null
  multEntry: 5.0,          // number or null — entry EV/EBITDA multiple
  origen: "Equity Gap",    // string or null — deal source
  entrepreneurs: "Name",   // string or null — founder(s)
  geo: "ES",               // ISO-2 country code or null
  rev: 5000000,            // number or null — LTM revenue (company native currency)
  ebitda: 800000,          // number or null — LTM EBITDA (company native currency)
  dfn: 1000000,            // number or null — net debt (company native currency)
  grossEV: 10000000,       // number or null — gross EV (company native currency)
}
```

3. Check for slug collision: `slugify(nom)` must not match any existing company slug. `slugify` is in `src/utils.js`: lowercase, remove accents, replace non-alphanumeric with `-`.
4. Start dev server: `npm run dev`
5. Navigate to `/investments` — new company should appear in the table
6. Navigate to `/company/<slug>` — verify KPI cards, operative metrics, and entry info

## Gotchas

- `rvpiEur` and `dpiEur` display as `0` if null — set explicitly to avoid misleading KPI cards
- `geo` drives `FlagImg` — ISO-2 codes: `"ES"`, `"US"`, `"EN"` (UK), `"DE"`, `"IT"`, `"FR"`, `"PT"`
- Slug collision: rename `nom` in source data if two companies produce the same slug
- `rev`, `ebitda`, `dfn`, `grossEV` are in **company native currency**, not EUR
```

- [ ] **Step 3: Create update-capital-calls.md**

Create `.claude/skills/update-capital-calls.md`:

```markdown
---
name: update-capital-calls
description: SOP for recording a new transaction in RAW_CC (capital calls, distributions, commitments)
type: project
---

# Update Capital Calls

**Trigger:** Use when recording any new fund transaction: capital call, distribution, commitment, return of capital.

## Steps

1. Open `src/data/capital-calls.js`
2. Add a row to the `RAW_CC` array:

```js
{
  fons: "Fund Name",      // string — exact fund name (slug derived from this)
  tipus: "Aportació",     // string — free-text label from source document
  cat: "Capital Call",    // enum — see allowed values below
  data: "2025-03-15",     // string "YYYY-MM-DD"
  mes: 3,                 // number — month (1–12), derived from data
  any: 2025,              // number — year, derived from data
  fy: "FY 2025",          // string — fiscal year, derived from data
  vcpe: "PE",             // enum — see allowed values below
  est: "Fons Primari",    // enum — see allowed values below
  eur: 100000.0,          // number — positive = outflow, negative = inflow
}
```

**`cat` values:** `"Capital Call"` | `"Distribució"` | `"Retorn Capital"` | `"Compromís"` | `"Altres"`

**`vcpe` values:** `"PE"` | `"VC"` | `"RE"`

**`est` values:** `"Fons Primari"` | `"Fons de Fons"` | `"SOCIMI"`

3. Navigate to `/fund/<slug>` in dev server — KPI cards and J-curve should reflect the new row

## Sign Convention

| Transaction | `eur` sign |
|---|---|
| Capital Call | **positive** (money out) |
| Compromís | **positive** |
| Distribució | **negative** (money in) |
| Retorn Capital | **negative** (money in) |

## Gotchas

- Distributions **must be negative** — `FundDetail.jsx` uses `Math.abs(r.eur)`, so sign drives KPI math
- `fons` must match exactly — a typo creates a ghost fund in `/investments`
- New fund: add a `Compromís` row first, or the Compromís KPI card shows `—`
- `mes`, `any`, `fy` must be derived from `data` explicitly — they drive fiscal year charts
```

- [ ] **Step 4: Create verify-dashboard.md**

Create `.claude/skills/verify-dashboard.md`:

```markdown
---
name: verify-dashboard
description: Pre-commit verification checklist for the Turtle Capital Dashboard
type: project
---

# Verify Dashboard

**Trigger:** Run before any commit. Run after any non-trivial code change.

## Checklist

- [ ] Dev server starts without errors: `npm run dev`
- [ ] `/` loads — Dashboard shows portfolio summary cards
- [ ] `/investments` loads — table shows both funds and companies
- [ ] `/fund/<any-slug>` loads — KPI cards, J-curve chart, and transaction log visible
- [ ] `/company/<any-slug>` loads — KPI cards, operative metrics, and entry info visible
- [ ] Dark/light toggle works on all pages (sun/moon icon in header)
- [ ] No red errors in browser console
- [ ] No React key warnings in browser console
- [ ] Build passes: `npm run build` exits 0

## Gotchas

- **Blank page, no error** — ThemeContext crash. The page's outer wrapper must pass `{ tc, dark, toggle }` to `ThemeContext.Provider`. Never pass a raw color object (`TC_LIGHT`/`TC_DARK`). `useTheme()` returns `{ tc, dark, toggle }`.
- **"Not found" page** — Slug mismatch. Verify `slugify(fons)` or `slugify(nom)` matches the URL segment. Check `src/utils.js` for the `slugify` function.
```

- [ ] **Step 5: Create new-feature.md**

Create `.claude/skills/new-feature.md`:

```markdown
---
name: new-feature
description: Workflow SOP for starting any new dashboard feature or significant change
type: project
---

# New Feature

**Trigger:** Use when starting any new dashboard feature or significant change.

## Steps

1. Create a feature branch (never work directly on `main`):
   ```bash
   git checkout -b feat/<feature-name>
   ```
   Or use `superpowers:using-git-worktrees` for an isolated worktree.

2. Invoke `superpowers:brainstorming` — **do not skip, even for "simple" features**. Produces a spec in `docs/superpowers/specs/`.

3. After the spec review loop passes, invoke `superpowers:writing-plans` — produces a plan in `docs/superpowers/plans/`.

4. Execute with `superpowers:subagent-driven-development`.

## Reference

- `docs/superpowers/specs/` — existing specs for pattern reference
- `docs/superpowers/plans/` — existing plans for task structure reference

## Gotchas

- Spec review loop must pass before writing the plan (enforced by brainstorming skill)
- Don't skip brainstorming — unexamined assumptions in "simple" features cause the most wasted work
```

- [ ] **Step 6: Verify all four files exist**

```bash
ls ".claude/skills/"
```

Expected: `add-portfolio-company.md  new-feature.md  update-capital-calls.md  verify-dashboard.md`

- [ ] **Step 7: Commit**

```bash
git add ".claude/skills/"
git commit -m "feat: add four project-specific skills (portfolio, capital-calls, verify, new-feature)"
```

---

## Task 7: Autoresearch Skill

**Files:**
- Create: `.claude/skills/autoresearch.md`

- [ ] **Step 1: Create autoresearch.md**

Create `.claude/skills/autoresearch.md`:

```markdown
---
name: autoresearch
description: Meta-skill that auto-improves any skill via a scored quality loop (Karpathy autoresearch method)
type: project
---

# Autoresearch

**Trigger:** Use when a skill feels weak, vague, or incomplete. Use after creating a new skill to sharpen it.

**Invocation:** `/autoresearch <skill-name>`

Examples:
- `/autoresearch verify-dashboard`
- `/autoresearch update-capital-calls`
- `/autoresearch superpowers:brainstorming`

## Quality Checklist

Score the target skill on each item (yes = 1, no = 0):

1. **Trigger** — Does the skill clearly state when to invoke it?
2. **Gotchas** — Does it have a pitfalls/gotchas section?
3. **Examples** — Does it include at least one concrete example?
4. **Progressive disclosure** — Summary/trigger first, details after?
5. **Tool specificity** — Does it name specific tools/commands (not vague "check the code")?
6. **Verification** — Does it include a verification step?
7. **Conciseness** — No filler, no redundant instructions?
8. **Actionability** — Steps are actions, not principles?

## Loop

```
1. Load skill content
2. Score against checklist (count yes / 8)
3. Identify the lowest-scoring item
4. Make ONE targeted change to address it
5. Re-score
6. Keep change if score improved; revert if not
7. Repeat until score ≥ 7/8 or two consecutive iterations produce no improvement
8. Commit
```

## Loading Skills

- **Project skills** (`.claude/skills/`): use `Read` tool, edit with `Edit` tool
- **Superpowers plugin skills**: use `Skill` tool to load content; the skill output header shows "Base directory" — use `Edit` tool on the skill file at that path

## Stopping Conditions

- Score reaches 7/8 or 8/8
- Two consecutive iterations produce no improvement
- Skill is a stub (< 100 words) — flag to user before looping, request more context
```

- [ ] **Step 2: Verify the file**

```bash
wc -l ".claude/skills/autoresearch.md"
```

Expected: more than 50 lines.

- [ ] **Step 3: Commit**

```bash
git add ".claude/skills/autoresearch.md"
git commit -m "feat: add autoresearch meta-skill for quality-improving any skill"
```

---

## Final Verification

After all tasks are complete:

- [ ] `CLAUDE.md` has `## Context Preservation` section
- [ ] `HANDOFF.md` is gitignored: `git check-ignore -v HANDOFF.md` returns a match
- [ ] `.claude/skills/` has 5 files: `add-portfolio-company.md`, `update-capital-calls.md`, `verify-dashboard.md`, `new-feature.md`, `autoresearch.md`
- [ ] `.claude/hooks/` has 2 files: `generate-handoff.sh`, `check-syntax.js`
- [ ] `.claude/settings.json` is valid JSON with `Stop` and `PostToolUse` hooks
- [ ] `.claude/settings.local.json` is unchanged (run `git diff .claude/settings.local.json` — should be empty)
- [ ] Run `bash .claude/hooks/generate-handoff.sh` — `HANDOFF.md` generated at project root
- [ ] Run `node .claude/hooks/check-syntax.js src/utils.js` — no output
