#!/usr/bin/env node

console.error(
  "This generator is retired: src/data/searchers.js was removed when searchers and companies moved to Supabase. " +
  "Use the existing checked-in migration/report artifacts or write a Supabase-backed replacement."
);
process.exit(1);
