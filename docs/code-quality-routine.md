# Code Quality Routine

This repo now has a repeatable post-fix validation path instead of one-off cleanup checks.

## Commands

- `npm run audit:unused`
  Runs `knip` against the live JS/JSX/MJS tree.
- `npm run audit:cycles`
  Runs `madge` for circular-dependency detection across `src`, `api`, `scripts`, `server.js`, and `vite.config.js`.
- `npm run audit:code`
  Runs both structural audits.
- `npm run verify`
  Runs the full routine: tests, production build, unused-code audit, and cycle audit.

## Scope Rules

- `knip` ignores generated modules under `src/generated` and review artifacts under `scripts/out`.
- Vercel API route files and standalone repo scripts are declared as entrypoints so they are not misclassified as dead code.
- Generated PM artifacts are verified through `npm run pm:refresh`, not by direct source-usage checks.

## Python Script Import Rule

The canonical PM Python type module lives at `scripts/pm_model_types.py`.

- Package-style execution should use `python -m scripts.<module>`.
- PM scripts import types via `from scripts.pm_model_types import ...`.
- The old root-level compatibility bridge has been removed.

## When To Run It

Run `npm run verify` after code changes that touch app behavior, shared utilities, routing, API handlers, or repository structure.

Run `npm run pm:refresh` before `npm run verify` when the change affects the public-markets data pipeline or generated PM artifacts.

Run the dashboard bootstrap flow from [docs/dashboard-data-bootstrap.md](./dashboard-data-bootstrap.md) when an environment is meant to be DB-authoritative but the editable dashboard tables are empty.
