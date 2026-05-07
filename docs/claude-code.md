# Claude Code Guide

This file keeps the project-specific Claude workflow out of `CLAUDE.md` so the default session context stays lean.

## Task Workflow

- Plan before any task with 3+ meaningful steps, architectural impact, or verification branching.
- Re-plan when implementation reveals a bad assumption instead of pushing through.
- For bug reports, move directly toward reproduction, root cause, fix, and proof.
- Do not mark work complete until it has been verified with the most relevant local check.

## Repo Guardrails

- Keep edits minimal and scoped to the request.
- Prefer modifying source files over generated output.
- Existing files in `supabase/migrations/` are immutable. Add a new migration for schema changes.
- Avoid touching `dist/`, `.vercel/`, `.git/`, and `node_modules/`.
- Review `tasks/lessons.md` at the start of non-trivial work and append new lessons after user corrections.

## Context Preservation

Preserve these implementation patterns across compaction and handoff:

- Theme context: keep the `useTheme()` contract as `{ tc, dark, toggle }`; do not pass raw theme objects through the provider value.
- Dashboard local storage bootstrap: use `localStorage.getItem("tc_rawCC")` with `RAW_CC_DEFAULT` from `src/config.js`; `loadFromLS` remains private to the dashboard layer.
- Routing: `BrowserRouter` + `AppRoutes` in `src/router.jsx`; fund IDs come from `slugify(r.fons)`, company IDs from `slugify(c.nom)`.
- Task continuity: preserve current open items from `tasks/todo.md` and note files changed during the session.

## Verification

Use the narrowest proof that demonstrates the change:

- `npm run verify` for cross-cutting app changes.
- `npm run build` for bundling or route/export changes when full verify is unnecessary.
- Targeted script or test runs for isolated data or tooling changes.

## Skill Routing

When a matching skill is available, use it first.

- Product ideas, prioritization, or “should we build this?”: `office-hours`
- Bugs, regressions, broken flows, 500s: `investigate`
- Ship, deploy, PR, release: `ship`
- QA and exploratory testing: `qa`
- Code review: `review`
- Architecture review: `plan-eng-review`
- Design or polish work: `design-consultation` or `design-review`

## Supporting Docs

Load on demand instead of front-loading them:

- `PROJECT.md` for project map and commands
- `INSTRUCTIONS.md` for data schema details
- `docs/code-quality-routine.md` for cleanup and audit workflow
- `docs/dashboard-data-bootstrap.md` for data loading behavior
- `docs/security-deployment-checklist.md` for deploy/security checks
