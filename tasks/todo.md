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
