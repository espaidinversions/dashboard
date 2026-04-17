# Cleanup Track 3 - Unused Code

Scope: repo-wide unused-code audit, with removals limited to files that had no references anywhere in the repository and no runtime import path.

## Findings

### 1. `src/data/publicMarketsRawArchive.js`
- Evidence: repo-wide exact-path search returned no references.
- Evidence: exported symbol `PM_POSITIONS_RAW_ARCHIVE` was only defined in the file itself.
- Assessment: this is an orphaned archive artifact, not part of the active PM model.
- Recommendation: remove it. The active model already uses `src/data/publicMarkets.js` and `src/data/publicMarketsModel.js`.

### 2. `src/data/ubsPositions.js`
- Evidence: repo-wide exact-path search returned no references.
- Evidence: exported symbol `UBS_POSITIONS` was only defined in the file itself.
- Assessment: this is a legacy static holdings table that is no longer imported by the PM pipeline.
- Recommendation: remove it. Current UBS holdings are sourced from the generated PM model.

### 3. `src/data/wamPositions.js`
- Evidence: repo-wide exact-path search returned no references.
- Evidence: exported symbol `WAM_POSITIONS` was only defined in the file itself.
- Assessment: this is a legacy static holdings table that is no longer imported by the PM pipeline.
- Recommendation: remove it. Current WAM holdings are sourced from the generated PM model.

## Removals Implemented

- Deleted `src/data/publicMarketsRawArchive.js`
- Deleted `src/data/ubsPositions.js`
- Deleted `src/data/wamPositions.js`

## Notes

- I did not remove files that were only "probably" unused.
- I left review artifacts, generated outputs, and docs references alone unless they were provably dead from the repo-wide search.
- The active public-markets model remains intact; this cleanup only removes orphaned legacy data files.
