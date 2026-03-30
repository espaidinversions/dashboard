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

## Example

Feature: "Add CSV export button to the monthly breakdown tab"

```
git checkout -b feat/monthly-export
→ brainstorming → spec: docs/superpowers/specs/2026-03-30-monthly-export-design.md
→ writing-plans → plan: docs/superpowers/plans/2026-03-30-monthly-export-plan.md
→ subagent-driven-development → implement, verify, PR
```

## Reference

- `docs/superpowers/specs/` — existing specs for pattern reference
- `docs/superpowers/plans/` — existing plans for task structure reference

## Verification

After implementation:
- [ ] Spec committed to `docs/superpowers/specs/`
- [ ] Plan committed to `docs/superpowers/plans/`
- [ ] `/verify-dashboard` checklist passes (no console errors, build exits 0)
- [ ] Feature branch merged or PR open — never leave work on `main` directly

## Gotchas

- Spec review loop must pass before writing the plan (enforced by brainstorming skill)
- Don't skip brainstorming — unexamined assumptions in "simple" features cause the most wasted work
