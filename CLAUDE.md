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

---

## gstack

Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`,
`/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`,
`/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`,
`/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`,
`/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

If skills aren't working, run: `cd ~/.claude/skills/gstack && bash setup --no-prefix`

---

## Context Preservation

> When context is compressed, Claude must preserve these patterns exactly.

- **ThemeContext pattern** — Outer wrapper: `const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1")`. Provider receives `{ tc, dark, toggle: () => setDark(d => !d) }` — never the raw color object (`TC_LIGHT`/`TC_DARK`). `useTheme()` returns `{ tc, dark, toggle }`.
- **Data loading pattern** — `localStorage.getItem("tc_rawCC")` with `RAW_CC_DEFAULT` fallback (imported from `src/config.js`). `loadFromLS` is private to `Dashboard.jsx` — never import or call it elsewhere.
- **Routing** — `BrowserRouter` + `AppRoutes` in `src/router.jsx`. Fund IDs: `slugify(r.fons)`. Company IDs: `slugify(c.nom)`. Routes: `/` (Dashboard), `/investments` (InvestmentsIndex), `/fund/:id` (FundDetail), `/company/:id` (CompanyDetail).
- **Active task status** — current `[ ]` items in `tasks/todo.md`.
- **Files modified this session** — list of files changed so Claude doesn't re-read everything next turn.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
