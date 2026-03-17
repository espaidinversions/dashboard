# Kanvas Board — Design Spec
**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Two parallel deliverables:
1. A standalone read-only Kanvas board page at `/board.html`
2. A split of `CLAUDE.md` into behavioral rules vs project context (`PROJECT.md`)

---

## Part 1 — Kanvas Board Page

### Purpose
A personal task-tracking board for Eduard, separate from the team-facing financial dashboard. Renders the `Dashboard.canvas` Kanvas file visually without requiring Obsidian.

### Architecture

**New file: `public/board.html`**
- Self-contained: HTML + inline JS + inline CSS. No framework, no build step.
- Fetches canvas data from `/api/board` on load.
- Polls every 30 seconds for updates (read-only, lightweight).

**New Express endpoint: `GET /api/board`**
- Reads `Dashboard.canvas` from the project root using `fs.readFileSync`.
- Parses and returns `{ nodes: [...], edges: [...] }` directly from the canvas JSON.
- Error handling: if the file is missing or malformed, return `{ error: "Canvas not found" }` with HTTP 404; if JSON parse fails, return `{ error: "Invalid canvas" }` with HTTP 500. Matches the pattern of existing `/api/pipeline` and `/api/capital-calls` endpoints.

**`public/board.html` static serving**
- Placed in `public/` (Vite's default `publicDir`). Vite serves static assets from `public/` directly — `board.html` is accessible at `http://localhost:5173/board.html` without conflicting with the SPA fallback (which only triggers for routes without a file extension). In prod, Express serves `dist/` which includes the copied `public/` contents.

**Access URLs**
- Dev: `http://localhost:5173/board.html`
- Prod: `http://localhost:3001/board.html`

### Layout

**Header bar**
- Page title: "Kanvas Board"
- Last-refreshed timestamp
- Manual refresh button

**Color legend**
- Horizontal strip below header: Purple=Proposed · Red=To Do · Orange=Active · Cyan=Review · Green=Done · Gray=Blocked

**Kanban columns**
- 4 columns side by side: Data · Frontend · UX · Infrastructure
- Each column header shows group name + task count badges per state
- Columns scroll independently if card count overflows

### Canvas Parsing Logic

The `/api/board` endpoint returns raw canvas JSON. All rendering logic lives in `board.html`.

**Distinguishing task nodes from non-task nodes**
Canvas nodes are task cards if their `text` field contains a Task ID pattern: `## XX-NN` (e.g. `## DA-01`). Nodes without this pattern (Legend, Errors, Warnings status cards) are filtered out and not rendered.

**Group membership (spatial containment)**
Groups in the canvas JSON have `type: "group"` with `x`, `y`, `width`, `height`. A task node belongs to a group if the node's `(x, y)` coordinates fall within the group's bounding box: `node.x >= group.x && node.x <= group.x + group.width && node.y >= group.y && node.y <= group.y + group.height`.

**Node text parsing**
Task node `text` is Markdown. Parse:
- Task ID: first `## XX-NN` heading (e.g. `## DA-01 Add FY2027 support` → ID=`DA-01`, title=`Add FY2027 support`)
- Description: text content after the heading line

**Color-to-state mapping** (Obsidian numeric codes)

| Code | Color | State |
|------|-------|-------|
| `"6"` | Purple | Proposed |
| `"1"` | Red | To Do |
| `"2"` | Orange | Active |
| `"5"` | Cyan | Review |
| `"4"` | Green | Done |
| `"0"` or absent | Gray | Blocked |

**Dependency chips (from edges)**
Canvas edges encode dependencies: `fromNode` = blocker, `toNode` = dependent (blocked by fromNode). For each task card, derive:
- `blocks`: all task IDs where this node is `fromNode` in an edge
- `waitingOn`: all task IDs where this node is `toNode` in an edge
Only render chips if the arrays are non-empty.

### Card Design (Rich — Option C)

Each task card shows:
- **Top border** in state color
- **Status badge** (top-right): "Proposed" / "To Do" / "Active" / "Review" / "Done" / "Blocked"
- **Task ID** in monospace (e.g. `DA-01`)
- **Title** in bold
- **Description preview** truncated to 2 lines
- **Dependency chips** (only if present):
  - `blocks: FR-03` — tasks this card is blocking
  - `waiting on: FR-02` — tasks this card is waiting for

**Card ordering within each column**
1. Active (orange)
2. To Do (red)
3. Proposed (purple)
4. Review (cyan)
5. Blocked (gray) — dimmed at opacity 0.5
6. Done (green) — dimmed at opacity 0.5

### Visual Style
- Dark theme: `#0f1923` page background, `#16232f` cards, `#253548` borders
- Same color palette as the existing TC_DARK dashboard theme
- Font: Outfit (already loaded in project)
- Non-task canvas cards (Legend, Errors, Warnings) are filtered out and not rendered

---

## Part 2 — CLAUDE.md / PROJECT.md Split

### Problem
`CLAUDE.md` currently mixes Claude behavioral instructions with project-specific context, making it harder to update either independently.

### Solution

**`CLAUDE.md`** — Claude behavioral rules only:
- Karpathy workflow practices (6 rules)
- Task management protocol
- Core principles
- Single reference line: `→ See PROJECT.md for project context.`

**`PROJECT.md`** — Project context only:
- Tech stack (React 18, Vite, Recharts, Express)
- File map (components, data files, config)
- Kanvas session commands (quick reference)
- Data schema references (points to INSTRUCTIONS.md for full detail)

**`INSTRUCTIONS.md`** — unchanged. User-facing data documentation, not Claude instructions.

---

## Out of Scope
- Board interactivity (start/finish/pause) — read-only only
- Light mode for board page
- Embedding board inside the React dashboard
- Canvas Watcher Obsidian plugin
