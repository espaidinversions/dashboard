# Claude Working Instructions

Read only the minimum needed:

- `PROJECT.md` for project structure, key commands, and architecture entry points.
- `docs/claude-code.md` for task workflow, repo guardrails, and context-preservation rules.
- `tasks/lessons.md` before non-trivial work if it exists.

Core rules:

- Plan before any multi-step or architectural change.
- Fix root causes, not symptoms.
- Keep edits narrow and avoid unrelated churn.
- Verify before declaring work complete.
- Update `tasks/lessons.md` after user corrections.

Context boundaries:

- Respect `.claudeignore`; do not pull large datasets or generated output into context unless the task requires it.
- Prefer source files over generated artifacts.
- Existing Supabase migrations are immutable; add a new migration instead of editing an old one.

Useful references:

- `docs/claude-code.md#task-workflow`
- `docs/claude-code.md#context-preservation`
- `docs/claude-code.md#skill-routing`

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
