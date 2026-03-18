#!/usr/bin/env bash
# Generates HANDOFF.md from git + tasks artifacts.
# Anchors to project root using script location (safe regardless of cwd).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

RECENT_COMMITS="$(git log --oneline -10 2>/dev/null || echo '(no git history)')"
GIT_STATUS="$(git status --short 2>/dev/null || echo '(clean)')"

if [ -f "tasks/todo.md" ]; then
  TASKS="$(cat tasks/todo.md)"
else
  TASKS="(tasks/todo.md not found)"
fi

cat > "$PROJECT_ROOT/HANDOFF.md" << HANDOFF
# Session Handoff
Generated: $TIMESTAMP

## Recent Commits
\`\`\`
$RECENT_COMMITS
\`\`\`

## Current Tasks

$TASKS

## Dirty Files
\`\`\`
$GIT_STATUS
\`\`\`

## Resume With
At the start of the next session, read:
1. \`CLAUDE.md\` — project rules and context preservation patterns
2. \`HANDOFF.md\` (this file) — last session state
3. \`tasks/lessons.md\` — past corrections
HANDOFF
