# Claude Working Instructions — Turtle Capital Dashboard

> Behavioral rules for Claude in this project. See PROJECT.md for project context.

---

## Workflow Orchestration

### 1. Plan Before Acting
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways mid-task, STOP and re-plan — do not keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy
- Offload research, exploration, and parallel analysis to subagents.
- One task per subagent for focused execution.

### 3. Self-Improvement Loop
- After any correction from the user, update `tasks/lessons.md` immediately.
- Review `tasks/lessons.md` at the start of every session.

### 4. Verification Before Done
- Never mark a task complete without proving it works.
- Ask yourself: "Would a staff engineer approve this?"

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer.

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Point at logs, errors, failing tests — resolve them.

---

## Task Management Protocol

1. **Plan First** — Write plan to `tasks/todo.md` with checkable items.
2. **Verify Plan** — Check in before starting implementation.
3. **Track Progress** — Mark items `[x]` as you go.
4. **Explain Actions** — High-level summary at each step.
5. **Document Results** — Add review section to `tasks/todo.md` when done.
6. **Capture Lessons** — Update `tasks/lessons.md` after corrections.

---

## Core Principles

- **Simplicity First** — Make every change as simple as possible. Impact minimal code.
- **No Laziness** — Find root causes. No temporary fixes.
- **Minimal Impact** — Only touch what's necessary.

---

→ See PROJECT.md for project context, file map, and Kanvas commands.
