---
name: autoresearch
description: Meta-skill for tightening a weak skill or workflow via a scored quality loop
type: project
---

# Autoresearch

**Trigger:** Use when a skill, script, or workflow feels weak, vague, incomplete, or hard to trust. Use after creating or changing a workflow to sharpen it.

**Invocation:** `/autoresearch <target>`

Examples:
- `/autoresearch verify-dashboard`
- `/autoresearch update-capital-calls`
- `/autoresearch superpowers:brainstorming`
- `/autoresearch public-markets`

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

## Repo Workflow

For this dashboard, autoresearch is used to keep the public-markets workbook and the app data in sync.

- Run `npm run pm:autoresearch` to:
  - read the latest `Mercats Públics/*.xlsx` workbook
  - generate `src/data/publicMarketsRawWorkbook.js`
  - write `docs/pm-autoresearch.md` and `docs/pm-autoresearch.json`
  - compare the workbook against the committed raw data overlays
- Treat the workbook as the source of truth for current holdings and totals.
- Regenerate downstream reports after the overlay changes:
  - `npm run pm:value-report`
  - `npm run build`

## Repo Gotchas

- Do not overwrite curated metadata fields with empty workbook cells.
- Keep the overlay merge additive: workbook values should win, but only for fields the workbook actually supplies.
- If the workbook parser starts pulling in proposal or allocation tables, tighten the row filters before trusting the report.

## Loading Skills

- **Project skills** (`.claude/skills/`): use `Read` tool, edit with `Edit` tool
- **Superpowers plugin skills**: use `Skill` tool to load content; the skill output header shows "Base directory" — use `Edit` tool on the skill file at that path

## Meta Gotchas

- **Don't chase style** — only fix structural gaps (missing trigger, missing verification, etc.). Rewording a sentence that already works is not an improvement.
- **Identical rewrites = stop** — if two consecutive iterations produce the same change or no net score gain, the skill needs user context, not more looping.
- **Superpowers skills are read-only via Skill tool** — you can read their content but cannot edit the plugin source. Flag to user if a superpowers skill scores below 6/8.
- **Don't inflate scores** — a "yes" requires the item to be meaningfully present, not just technically present with a one-word mention.

## Stopping Conditions

- Score reaches 7/8 or 8/8
- Two consecutive iterations produce no improvement
- Skill is a stub (< 100 words) — flag to user before looping, request more context
