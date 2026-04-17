# Cleanup Track 8 - Comment Quality

## Critical Assessment

The repo had a small but real amount of comment noise after the PM model refactor:

- migration-history notes that described previous wiring rather than current behavior
- repeated inline interpolation markers where a single provenance note was enough
- comments that repeated what the code already made obvious

Most comments are still useful. The right target here is not "remove comments"; it is "keep comments that explain intent, provenance, or a non-obvious contract, and trim comments that only narrate cleanup history."

The highest-value cleanup targets were:

- `src/data/publicMarkets.js`
- `src/components/Dashboard.jsx`
- `src/utils.js`

## Recommendations

- Keep comments that explain why a block exists, where data comes from, or what a non-obvious contract is.
- Remove comments that only narrate prior migrations, temporary compatibility, or the last cleanup pass.
- Prefer one concise provenance note over many repeated inline markers.
- If a comment can be replaced by clearer code, remove it instead of rewriting it verbosely.

## Implemented

- Trimmed the PM provenance block in `src/data/publicMarkets.js`.
- Removed repeated inline interpolation markers from the PM monthly series.
- Replaced the dashboard bootstrap comment in `src/components/Dashboard.jsx` with a shorter state-loading note.
- Shortened the month-format comment in `src/utils.js`.

## Result

The remaining comments are shorter and more maintainable, and they still preserve the domain context that helps a new maintainer understand the PM data model.
