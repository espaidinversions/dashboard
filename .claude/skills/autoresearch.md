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
