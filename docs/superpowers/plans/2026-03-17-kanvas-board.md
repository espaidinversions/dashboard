# Kanvas Board Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone read-only kanban board page at `/board.html` that renders `Dashboard.canvas` visually, and split `CLAUDE.md` into behavioral rules vs project context.

**Architecture:** A single `public/board.html` file (HTML + inline JS + inline CSS, no build step) fetches canvas data from a new `GET /api/board` Express endpoint, parses the canvas JSON client-side, and renders kanban columns with rich task cards. A separate `PROJECT.md` holds project context extracted from `CLAUDE.md`.

**Tech Stack:** Express (Node.js, ESM), vanilla JS (no framework), inline CSS, Outfit font (Google Fonts, already used in dashboard).

**Spec:** `docs/superpowers/specs/2026-03-17-kanvas-board-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server.js` | Modify | Add `GET /api/board` endpoint |
| `public/board.html` | Create | Full standalone board page (HTML + JS + CSS) |
| `CLAUDE.md` | Modify | Strip to behavioral rules only |
| `PROJECT.md` | Create | Project context (tech stack, file map, Kanvas commands) |

No new dependencies. No build step changes.

---

## Task 1: Add `GET /api/board` endpoint

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add `readFileSync` to the existing import**

In `server.js` line 2, change:
```js
import { writeFileSync } from "fs";
```
to:
```js
import { writeFileSync, readFileSync, existsSync } from "fs";
```

- [ ] **Step 2: Add the canvas file path constant**

After line 8 (`const RAW_DATA = ...`), add:
```js
const CANVAS_FILE = join(__dirname, "Dashboard.canvas");
```

- [ ] **Step 3: Write the endpoint**

Add before `app.listen(...)`:
```js
// ── GET /api/board ────────────────────────────────────────
// Returns raw canvas JSON { nodes, edges } from Dashboard.canvas

app.get("/api/board", (req, res) => {
  try {
    if (!existsSync(CANVAS_FILE)) {
      return res.status(404).json({ error: "Canvas not found" });
    }
    const raw = readFileSync(CANVAS_FILE, "utf-8");
    const canvas = JSON.parse(raw);
    res.json({ nodes: canvas.nodes || [], edges: canvas.edges || [] });
  } catch (e) {
    console.error("/api/board error:", e);
    res.status(500).json({ error: "Invalid canvas" });
  }
});
```

- [ ] **Step 4: Restart the server and verify the endpoint**

```bash
# In one terminal (if not already running):
node server.js

# In another terminal:
curl http://localhost:3001/api/board
```

Expected: JSON with `nodes` array (10 task nodes + 4 group nodes + 3 status nodes = 17 total) and `edges: []`.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: add GET /api/board endpoint for canvas data"
```

---

## Task 2: `board.html` — scaffold, CSS, and data fetch

**Files:**
- Create: `public/board.html`

- [ ] **Step 1: Create the HTML skeleton**

Create `public/board.html` with this base:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanvas Board</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* styles go here in Task 3 */
  </style>
</head>
<body>
  <div id="header"></div>
  <div id="legend"></div>
  <div id="board"></div>
  <div id="error" style="display:none"></div>
  <script>
    // JS goes here in Tasks 3-4
  </script>
</body>
</html>
```

- [ ] **Step 2: Add the CSS**

Replace `/* styles go here in Task 3 */` with:
```css
*, *::before, *::after { box-sizing: border-box; }

:root {
  --bg:       #0f1923;
  --card:     #16232f;
  --border:   #253548;
  --text:     #d4e4f0;
  --text-mid: #7a9eb8;
  --text-dim: #4e6e88;

  --purple: #9b7cc8;
  --red:    #ef5350;
  --orange: #e8922a;
  --cyan:   #70b0dc;
  --green:  #5cc88a;
  --gray:   #4e6e88;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Outfit', system-ui, sans-serif;
  font-size: 14px;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* Header */
#header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 12px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}
#header h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}
#header h1 span { color: var(--green); }
#last-refreshed { font-size: 11px; color: var(--text-dim); }
#refresh-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-mid);
  padding: 5px 12px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  transition: border-color 0.15s ease, color 0.15s ease;
}
#refresh-btn:hover { border-color: var(--green); color: var(--green); }

/* Legend */
#legend {
  display: flex;
  gap: 18px;
  padding: 9px 28px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-mid);
  flex-wrap: wrap;
}
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-dot {
  width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
}

/* Board */
#board {
  display: flex;
  gap: 14px;
  padding: 20px 28px 48px;
  overflow-x: auto;
  align-items: flex-start;
}

/* Column */
.column {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.column-header {
  padding: 10px 12px 8px;
  background: var(--card);
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-bottom: 4px;
}
.column-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--text-mid);
  margin-bottom: 6px;
}
.column-badges { display: flex; gap: 4px; flex-wrap: wrap; }
.count-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 4px;
}

/* Cards */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  border-top-width: 3px;
  padding: 10px 12px;
}
.card.dimmed { opacity: 0.5; }
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}
.card-id {
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 10px;
  color: var(--text-dim);
}
.card-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 4px;
}
.card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
  line-height: 1.4;
}
.card-desc {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}
.card-deps { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.dep-chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--border);
  color: var(--text-mid);
  font-family: 'DM Mono', 'Courier New', monospace;
}
.dep-chip.blocks { color: var(--orange); }
.dep-chip.waiting { color: var(--gray); }

/* Error banner */
#error {
  margin: 20px 28px;
  padding: 12px 16px;
  background: #2a0f0f;
  border: 1px solid #ef5350;
  border-radius: 8px;
  color: #ef5350;
  font-size: 13px;
}
```

- [ ] **Step 3: Add the JS data fetch**

Inside `<script>`, add:
```js
const STATE_MAP = {
  "6": { name: "Proposed", color: "var(--purple)" },
  "1": { name: "To Do",    color: "var(--red)"    },
  "2": { name: "Active",   color: "var(--orange)" },
  "5": { name: "Review",   color: "var(--cyan)"   },
  "4": { name: "Done",     color: "var(--green)"  },
  "0": { name: "Blocked",  color: "var(--gray)"   },
};
const STATE_ORDER = ["2","1","6","5","0","4"]; // Active→Todo→Proposed→Review→Blocked→Done
const DIMMED = new Set(["0","4"]);

async function fetchBoard() {
  const res = await fetch("/api/board");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Quick smoke test: open http://localhost:5173/board.html and check console
fetchBoard().then(d => console.log("nodes:", d.nodes.length, "edges:", d.edges.length));
```

- [ ] **Step 4: Verify in browser**

Start dev server (`npm run dev`) and open `http://localhost:5173/board.html`.
Open browser console — expected: `nodes: 17 edges: 0` (14 tasks + 3 status nodes).

- [ ] **Step 5: Commit**

```bash
git add public/board.html
git commit -m "feat: board.html scaffold with CSS and data fetch"
```

---

## Task 3: Canvas parsing functions

**Files:**
- Modify: `public/board.html` (JS section)

- [ ] **Step 1: Add task node detection**

Add after `DIMMED` constant:
```js
const TASK_ID_RE = /^##\s+([A-Z]{1,4}-\d{2})\s+(.*)/m;

function isTaskNode(node) {
  return node.type === "text" && TASK_ID_RE.test(node.text || "");
}

function parseTaskNode(node) {
  const match = (node.text || "").match(TASK_ID_RE);
  const id    = match[1];
  const title = match[2].trim();
  // Description: all lines after the first ## heading line
  const lines = node.text.split("\n");
  const descLines = lines.slice(1).map(l => l.trim()).filter(Boolean);
  const desc = descLines.join(" ").trim();
  return { id, title, desc };
}
```

- [ ] **Step 2: Add state and group helpers**

```js
function getState(node) {
  const code = node.color ?? "0";
  return STATE_MAP[code] ?? STATE_MAP["0"];
}

function getStateCode(node) {
  return node.color ?? "0";
}

function getGroupName(node, groups) {
  for (const g of groups) {
    if (
      node.x >= g.x &&
      node.x <= g.x + g.width &&
      node.y >= g.y &&
      node.y <= g.y + g.height
    ) return g.label || "Other";
  }
  return "Other";
}
```

- [ ] **Step 3: Add dependency builder**

```js
function buildDeps(taskNodes, edges) {
  // Map node id → task id
  const nodeToTask = {};
  taskNodes.forEach(n => {
    const { id } = parseTaskNode(n);
    nodeToTask[n.id] = id;
  });

  // blocks[taskId] = list of task IDs this task is blocking
  // waitingOn[taskId] = list of task IDs this task is waiting on
  const blocks = {}, waitingOn = {};
  taskNodes.forEach(n => {
    const { id } = parseTaskNode(n);
    blocks[id] = [];
    waitingOn[id] = [];
  });

  edges.forEach(e => {
    const from = nodeToTask[e.fromNode];
    const to   = nodeToTask[e.toNode];
    if (from && to) {
      blocks[from].push(to);
      waitingOn[to].push(from);
    }
  });

  return { blocks, waitingOn };
}
```

- [ ] **Step 4: Add card sorter**

```js
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const ai = STATE_ORDER.indexOf(a.stateCode);
    const bi = STATE_ORDER.indexOf(b.stateCode);
    return ai - bi;
  });
}
```

- [ ] **Step 5: Wire up a parse function and log output**

```js
function parseCanvas({ nodes, edges }) {
  const groups    = nodes.filter(n => n.type === "group");
  const taskNodes = nodes.filter(isTaskNode);
  const { blocks, waitingOn } = buildDeps(taskNodes, edges);

  const cards = taskNodes.map(n => {
    const { id, title, desc } = parseTaskNode(n);
    return {
      id,
      title,
      desc,
      stateCode: getStateCode(n),
      state:     getState(n),
      group:     getGroupName(n, groups),
      blocks:    blocks[id]    || [],
      waitingOn: waitingOn[id] || [],
    };
  });

  return { groups, cards };
}

// Smoke test
fetchBoard().then(data => {
  const { groups, cards } = parseCanvas(data);
  console.log("groups:", groups.map(g => g.label));
  console.log("cards:", cards.map(c => `${c.id} [${c.state.name}] ${c.group}`));
});
```

- [ ] **Step 6: Verify in browser console**

Expected console output:
```
groups: ['Data', 'Frontend', 'UX', 'Infrastructure']
cards: ['DA-01 [Proposed] Data', 'DA-02 [Proposed] Data', ...]
```
All 10 task cards listed with correct group and state.

- [ ] **Step 7: Commit**

```bash
git add public/board.html
git commit -m "feat: canvas parsing — task detection, groups, state, deps"
```

---

## Task 4: Render kanban columns and cards

**Files:**
- Modify: `public/board.html` (JS section)

- [ ] **Step 1: Add `renderBadge` helper**

```js
function renderBadge(state, extraClass = "card-badge") {
  return `<span class="${extraClass}" style="background:${state.color}22;color:${state.color}">${state.name}</span>`;
}
```

- [ ] **Step 2: Add `renderDepChips` helper**

```js
function renderDepChips(blocks, waitingOn) {
  if (!blocks.length && !waitingOn.length) return "";
  const chips = [
    ...blocks.map(id    => `<span class="dep-chip blocks">blocks ${id}</span>`),
    ...waitingOn.map(id => `<span class="dep-chip waiting">waiting on ${id}</span>`),
  ];
  return `<div class="card-deps">${chips.join("")}</div>`;
}
```

- [ ] **Step 3: Add `renderCard`**

```js
function renderCard(card) {
  const dimmed = DIMMED.has(card.stateCode) ? " dimmed" : "";
  return `
    <div class="card${dimmed}" style="border-top-color:${card.state.color}">
      <div class="card-top">
        <span class="card-id">${card.id}</span>
        ${renderBadge(card.state)}
      </div>
      <div class="card-title">${card.title}</div>
      ${card.desc ? `<div class="card-desc">${card.desc}</div>` : ""}
      ${renderDepChips(card.blocks, card.waitingOn)}
    </div>`;
}
```

- [ ] **Step 4: Add `renderColumn`**

```js
function renderColumn(groupName, cards) {
  const sorted = sortCards(cards);

  // Count badges per state (only states present)
  const counts = {};
  cards.forEach(c => { counts[c.stateCode] = (counts[c.stateCode] || 0) + 1; });
  const countHtml = Object.entries(counts)
    .sort(([a],[b]) => STATE_ORDER.indexOf(a) - STATE_ORDER.indexOf(b))
    .map(([code, n]) => {
      const s = STATE_MAP[code] || STATE_MAP["0"];
      return `<span class="count-badge" style="background:${s.color}22;color:${s.color}">${n} ${s.name}</span>`;
    }).join("");

  return `
    <div class="column">
      <div class="column-header">
        <div class="column-title">${groupName}</div>
        <div class="column-badges">${countHtml}</div>
      </div>
      ${sorted.map(renderCard).join("")}
    </div>`;
}
```

- [ ] **Step 5: Add main `render` function**

```js
function render(data) {
  const { groups, cards } = parseCanvas(data);

  // Determine column order from group order in canvas (left to right by x)
  const groupNames = [...new Set(groups.sort((a,b) => a.x - b.x).map(g => g.label || "Other"))];

  // Group cards by group name
  const byGroup = {};
  groupNames.forEach(g => { byGroup[g] = []; });
  cards.forEach(c => {
    if (!byGroup[c.group]) byGroup[c.group] = [];
    byGroup[c.group].push(c);
  });

  document.getElementById("board").innerHTML =
    groupNames.map(g => renderColumn(g, byGroup[g] || [])).join("");
}
```

- [ ] **Step 6: Add header and legend render**

```js
function renderHeader(lastRefreshed) {
  document.getElementById("header").innerHTML = `
    <h1>Kanvas <span>Board</span></h1>
    <span id="last-refreshed">Refreshed ${lastRefreshed}</span>
    <button id="refresh-btn" onclick="loadAndRender()">↻ Refresh</button>`;
}

function renderLegend() {
  const items = [
    ["Proposed", "var(--purple)"],
    ["To Do",    "var(--red)"],
    ["Active",   "var(--orange)"],
    ["Review",   "var(--cyan)"],
    ["Done",     "var(--green)"],
    ["Blocked",  "var(--gray)"],
  ];
  document.getElementById("legend").innerHTML = items.map(([name, color]) =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${color}"></div>
       <span>${name}</span>
     </div>`
  ).join("");
}
```

- [ ] **Step 7: Wire up `loadAndRender` and polling**

Replace the smoke test `fetchBoard().then(...)` call with:
```js
async function loadAndRender() {
  const errEl = document.getElementById("error");
  try {
    const data = await fetchBoard();
    errEl.style.display = "none";
    render(data);
    renderHeader(new Date().toLocaleTimeString());
  } catch (e) {
    errEl.style.display = "block";
    errEl.textContent = `Failed to load board: ${e.message}`;
  }
}

renderLegend();
loadAndRender();
setInterval(loadAndRender, 30_000);
```

- [ ] **Step 8: Verify in browser**

Open `http://localhost:5173/board.html`. Expected:
- Header with title, timestamp, refresh button
- Legend strip with 6 colored dots
- 4 columns: Data (3 cards), Frontend (3 cards), UX (2 cards), Infrastructure (2 cards)
- Each card shows ID, Proposed badge, title, description preview
- All cards have purple top border (all proposed state)

- [ ] **Step 9: Commit**

```bash
git add public/board.html
git commit -m "feat: kanvas board — kanban columns, rich cards, legend, polling"
```

---

## Task 5: CLAUDE.md / PROJECT.md split

**Files:**
- Modify: `CLAUDE.md`
- Create: `PROJECT.md`

- [ ] **Step 1: Create `PROJECT.md`**

Create `PROJECT.md` with:
```markdown
# Turtle Capital Dashboard — Project Context

> Claude behavioral rules are in CLAUDE.md. This file covers project-specific context.

---

## Tech Stack

- **Frontend:** React 18.3 + Vite 6 + Recharts 2.13
- **Backend:** Express 4.18 (Node.js, ESM, port 3001)
- **Styling:** Inline JSX styles via `useTheme()` + `src/index.css` for globals
- **Language:** Catalan (ca-ES) UI, English variable names
- **Build:** `npm run dev` (concurrently runs Vite on 5173 + Express on 3001)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/Dashboard.jsx` | Main app — tabs, KPIs, filters, charts |
| `src/components/PipelineFY26.jsx` | FY26 pipeline tab |
| `src/components/MensualTab.jsx` | Monthly breakdown tab |
| `src/components/SearchersTab.jsx` | Search fund tab |
| `src/components/PortfolioCompaniesTab.jsx` | Portfolio companies tab |
| `src/components/SharedComponents.jsx` | Logo, Badge, chart tooltips |
| `src/theme.js` | TC_LIGHT / TC_DARK palettes + ThemeContext |
| `src/config.js` | FY_LIST, color maps, EUR_USD rate |
| `src/utils.js` | Number formatters, CSV parsers |
| `src/index.css` | Global resets, animations, card hover |
| `server.js` | Express API — /api/pipeline, /api/capital-calls, /api/board |
| `public/board.html` | Standalone Kanvas board viewer |
| `Dashboard.canvas` | Kanvas task board (JSON) |
| `canvas-tool.py` | CLI for Kanvas board management |

See `INSTRUCTIONS.md` for full data schema (CSV columns, pipeline fields).

---

## Kanvas Session Commands

Run at session start:
```bash
python canvas-tool.py Dashboard.canvas status
python canvas-tool.py Dashboard.canvas normalize
python canvas-tool.py Dashboard.canvas ready
```

Quick reference:

| Command | Purpose |
|---------|---------|
| `status` | Board overview |
| `ready` | Red tasks available to start |
| `blocked` | Blocked tasks + causes |
| `show <ID>` | Full task detail |
| `start <ID>` | Red → Orange |
| `finish <ID>` | Orange → Cyan |
| `propose <GROUP> "<title>" "<desc>"` | Add purple proposal |
| `normalize` | Assign IDs, update blocked states |

Board viewer: `http://localhost:5173/board.html`

**Never edit `Dashboard.canvas` directly. Never mark a card green (human only).**
```

- [ ] **Step 2: Trim `CLAUDE.md` to behavioral rules only**

Replace the entire content of `CLAUDE.md` with:
```markdown
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
```

- [ ] **Step 3: Verify both files look right, then commit**

```bash
git add CLAUDE.md PROJECT.md
git commit -m "chore: split CLAUDE.md into behavioral rules + PROJECT.md context"
```

---

## Verification Checklist

Before calling this done:

- [ ] `curl http://localhost:3001/api/board` returns `{ nodes: [...], edges: [...] }`
- [ ] `curl http://localhost:3001/api/board` with `Dashboard.canvas` renamed → returns `404 { error: "Canvas not found" }`
- [ ] `http://localhost:5173/board.html` loads with 4 columns and 10 task cards
- [ ] Each card shows ID, status badge, title, description
- [ ] Header shows timestamp; refresh button re-fetches
- [ ] `CLAUDE.md` has no project-specific content
- [ ] `PROJECT.md` has tech stack, file map, Kanvas commands
