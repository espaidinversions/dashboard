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
