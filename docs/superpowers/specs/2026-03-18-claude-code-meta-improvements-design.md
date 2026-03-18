# Claude Code Meta-Improvements — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Five targeted improvements to the Claude Code setup for the Turtle Capital Dashboard, derived from Anthropic's published best practices, Karpathy's autoresearch method, and community handbooks. All are non-breaking, additive changes to the `.claude/` directory and `CLAUDE.md`. No dashboard source code is touched.

**Ordered by value:**
1. CLAUDE.md Compact Instructions
2. HANDOFF.md auto-generation via Stop hook
3. Project-specific skills
4. PostToolUse JSX/JS syntax check hook
5. Autoresearch skill

---

## 1. CLAUDE.md Compact Instructions

### What
Add a `## Context Preservation` section to `CLAUDE.md` that instructs Claude on what to retain during automatic context compression.

### Content to preserve
- **ThemeContext pattern** — outer wrapper reads `dark` from localStorage, passes `{ tc, dark, toggle }` (not the raw color object) to `ThemeContext.Provider`. `useTheme()` returns `{ tc, dark, toggle }`.
- **Data loading pattern** — inline `localStorage.getItem("tc_rawCC")` with `RAW_CC_DEFAULT` fallback. Never import or call `loadFromLS` — it is private to `Dashboard.jsx`.
- **Routing** — `BrowserRouter` + `AppRoutes` in `src/router.jsx`. Fund IDs: `slugify(fons)`. Company IDs: `slugify(nom)`. Routes: `/`, `/investments`, `/fund/:id`, `/company/:id`.
- **Active task status** — current `[ ]` items in `tasks/todo.md`.
- **Files modified this session** — list of files changed so Claude doesn't re-read everything from scratch next turn.

### Files modified
- `CLAUDE.md` — append `## Context Preservation` section

---

## 2. HANDOFF.md Auto-generation via Stop Hook

### What
A Stop hook that generates `HANDOFF.md` every time Claude finishes responding. Built from deterministic sources — no Claude reasoning required.

### Script: `.claude/hooks/generate-handoff.sh`
The script anchors its working directory to the project root using `__dirname`-equivalent bash:
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"
```

Reads:
- `git log --oneline -10` — last 10 commits
- `tasks/todo.md` — full content (current task status)
- `git status --short` — modified and untracked files

Writes `HANDOFF.md` to project root with:
- Timestamp
- Recent commits
- Current tasks (full `tasks/todo.md` content)
- Dirty files list
- Static "Resume with:" block reminding Claude to read `CLAUDE.md`, `HANDOFF.md`, `tasks/lessons.md` at session start

### Hook config: `.claude/settings.json` (project-level)
New file — coexists with existing `.claude/settings.local.json` (which holds session-specific API permissions). Do NOT merge or overwrite `settings.local.json`.

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "bash .claude/hooks/generate-handoff.sh"
      }
    ]
  }
}
```

### `.gitignore`
Add `HANDOFF.md` — it is ephemeral session state, not source of truth.

---

## 3. Project-Specific Skills

### Location
`.claude/skills/` in project root. Four markdown files, each a focused SOP.

### Skill: `add-portfolio-company.md`
**Trigger:** Adding a new company to the portfolio.

**Steps:**
1. Open `src/data/searchers.js`
2. Add entry to `PORTFOLIO_COMPANIES` array with all required fields
3. Required fields: `nom`, `tipus` (`"SF"` or `"PE"`), `segment`, `ticket` (number in EUR), `tvpi` (number or null), `rvpiEur` (number or null), `dpiEur` (number or null), `mesosOperant` (number or null), `dataCompr` (string `"YYYY-MM-DD"` or null), `multEntry` (number or null), `origen` (string or null), `entrepreneurs` (string or null), `geo` (ISO-2 country code or null), `rev` (number or null), `ebitda` (number or null), `dfn` (number or null — net debt in company native currency), `grossEV` (number or null — gross enterprise value in company native currency)
4. Run slug collision check: `slugify(nom)` must not match any existing company slug
5. Verify: navigate to `/investments` and `/company/<slug>` in dev server

**Gotchas:**
- `rvpiEur` and `dpiEur` default to 0 in display if null — always set explicitly
- `geo` drives `FlagImg` — use ISO-2 code (`"ES"`, `"US"`, etc.)
- Slug collision: if two companies produce the same slug, rename in source data

### Skill: `update-capital-calls.md`
**Trigger:** Recording a new capital call, distribution, commitment, or other fund transaction.

**Steps:**
1. Open `src/data/capital-calls.js`
2. Add row to `RAW_CC` array
3. Required fields: `fons` (string, exact fund name), `data` (string `"YYYY-MM-DD"`), `mes` (number, month 1-12), `any` (number, year e.g. 2025), `fy` (string e.g. `"FY 2025"`), `cat` (enum), `eur` (number), `vcpe` (enum), `est` (enum), `tipus` (string, free text description)
   Note: `mes`, `any`, and `fy` are derived from `data` — derive them explicitly, they are used for fiscal year aggregation
4. `cat` enum values: `"Capital Call"`, `"Distribució"`, `"Retorn Capital"`, `"Compromís"`, `"Altres"`
5. `vcpe` enum values: `"PE"`, `"VC"`, `"RE"`
6. `est` enum values: `"Fons Primari"`, `"Fons de Fons"`, `"SOCIMI"`
7. Sign convention: Capital Calls are **positive** EUR (outflows). Distributions/Retorn Capital are **negative** EUR (inflows). Compromís is positive.
8. Verify: navigate to `/fund/<slug>` — KPI cards and J-curve should update

**Gotchas:**
- Distributions must be **negative** to display correctly in FundDetail (`Math.abs(r.eur)` is used for display)
- `fons` must match exactly — the slug is derived from this string
- New fund: ensure at least one `Compromís` row exists or the KPI card shows `—`

### Skill: `verify-dashboard.md`
**Trigger:** Before any commit. After any non-trivial code change.

**Checklist:**
- [ ] Dev server starts without errors (`npm run dev`)
- [ ] `/` loads — Dashboard shows portfolio summary cards
- [ ] `/investments` loads — table shows funds and companies
- [ ] `/fund/<any-slug>` loads — KPI cards, J-curve, transaction log visible
- [ ] `/company/<any-slug>` loads — KPI cards, operative metrics, entry info visible
- [ ] Dark/light toggle works on all pages (click sun/moon icon)
- [ ] No red errors in browser console
- [ ] No React key warnings in browser console
- [ ] Build passes: `npm run build` exits 0

**Gotchas:**
- ThemeContext crash is silent — if a page shows blank with no error, check that Provider receives `{ tc, dark, toggle }` not a raw color object
- Slug mismatch shows "not found" page — verify `slugify(fons)` matches the URL you're testing

### Skill: `new-feature.md`
**Trigger:** Starting any new dashboard feature or significant change.

**Steps:**
1. Invoke `superpowers:brainstorming` — do NOT skip this, even for "simple" features
2. Brainstorming produces a spec in `docs/superpowers/specs/`
3. Invoke `superpowers:writing-plans` — produces plan in `docs/superpowers/plans/`
4. Execute with `superpowers:subagent-driven-development`
5. Reference existing specs in `docs/superpowers/specs/` for patterns

**Gotchas:**
- Don't start on `main` branch — use a feature branch or worktree (`superpowers:using-git-worktrees`)
- Spec review loop must pass before writing the plan

---

## 4. PostToolUse JSX/JS Syntax Hook

### What
A warn-only hook that parses `.jsx`/`.js` files after every `Edit` or `Write` using `@babel/parser` (already in `node_modules`). Non-blocking — prints a warning but does not roll back the edit.

### Script: `.claude/hooks/check-syntax.js`
```js
// Uses @babel/parser from node_modules (already a project dependency)
// Warn-only: always exits 0
const path = require('path');
const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) process.exit(0);

const ext = path.extname(filePath).toLowerCase();
if (ext !== '.js' && ext !== '.jsx') process.exit(0);

let code;
try { code = fs.readFileSync(filePath, 'utf8'); }
catch { process.exit(0); }

try {
  const parser = require(path.join(__dirname, '../../node_modules/@babel/parser'));
  parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
} catch (err) {
  console.log(`⚠ Syntax warning in ${filePath}:\n  ${err.message}`);
}
process.exit(0);
```

### Hook config added to `.claude/settings.json`
Two separate entries (pipe syntax `|` not supported in matchers):
```json
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
```

### Edge cases
- Non-JS/JSX files: silently skipped
- File not found (e.g., temp path): silently skipped
- `@babel/parser` not found: silently skipped (no crash)

### Complete `.claude/settings.json` (both hooks merged)
The implementer must produce a single file with both `Stop` and `PostToolUse` under one `"hooks"` key:
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
        "hooks": [{ "type": "command", "command": "node .claude/hooks/check-syntax.js \"$CLAUDE_TOOL_INPUT_FILE_PATH\"" }]
      },
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/check-syntax.js \"$CLAUDE_TOOL_INPUT_FILE_PATH\"" }]
      }
    ]
  }
}
```

---

## 5. Autoresearch Skill

### Location
`.claude/skills/autoresearch.md`

### Invocation
```
/autoresearch <skill-name>
```
Examples: `/autoresearch verify-dashboard`, `/autoresearch superpowers:brainstorming`

### Quality Checklist (applied to any skill)
1. **Trigger** — Does the skill clearly state when to invoke it?
2. **Gotchas** — Does it have a pitfalls/gotchas section?
3. **Examples** — Does it include at least one concrete example?
4. **Progressive disclosure** — Summary first, details after?
5. **Tool specificity** — Does it name specific tools/commands (not vague "check the code")?
6. **Verification** — Does it include a verification step?
7. **Conciseness** — No filler, no redundant instructions?
8. **Actionability** — Steps are actions, not principles?

### Loop
```
load skill → score (count yes) → identify lowest item →
make ONE targeted change → re-score →
keep if score improved, revert if not →
repeat until score ≥ 7/8 or no improvement possible →
commit
```

### Scope
- **Project skills** (`.claude/skills/`): read with `Read` tool, edit with `Edit` tool
- **Superpowers plugin skills**: read current content via `Skill` tool, note improvements, apply via `Edit` tool on the plugin skill file path

### Stopping conditions
- Score reaches 7/8 or 8/8
- Two consecutive iterations produce no improvement
- Skill is a stub (< 100 words) — flag to user before looping

---

## Files Created / Modified

| File | Action |
|---|---|
| `CLAUDE.md` | Modify — append `## Context Preservation` section |
| `.claude/hooks/generate-handoff.sh` | Create |
| `.claude/hooks/check-syntax.js` | Create |
| `.claude/settings.json` | Create (project-level hook config) |
| `.claude/skills/add-portfolio-company.md` | Create |
| `.claude/skills/update-capital-calls.md` | Create |
| `.claude/skills/verify-dashboard.md` | Create |
| `.claude/skills/new-feature.md` | Create |
| `.claude/skills/autoresearch.md` | Create |
| `.gitignore` | Modify — add `HANDOFF.md` |

---

## Out of Scope

- Dashboard source code changes
- Global `~/.claude/` changes (all changes are project-scoped)
- Blocking hooks (all hooks are warn-only)
- CI/CD integration
- Automated test suite for skills
