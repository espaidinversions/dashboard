# Cleanup Track 7: Legacy and Transitional Code

## Critical Assessment

The repo had already converged on `src/data/publicMarketsModel.js` as the runtime PM API and `src/generated/publicMarkets/publicMarketsModel.generated.js` as the generated artifact. What remained was a thin layer of compatibility shims in `src/data/` that no longer had any internal consumers.

Those shims were pure transitional baggage:

- they duplicated generated output under old import paths
- they kept obsolete file names alive after the canonical paths had already stabilized
- they made it harder to tell which files were still part of the contract versus historical residue

I did not find any dead fallback logic that was safe to remove beyond those shims. The remaining fallback behavior in the repo still serves a boundary role, such as external network access, file parsing, or bootstrapping from volatile inputs.

## Recommendations

- Delete compatibility shims as soon as the repo no longer imports them.
- Prefer one canonical generated artifact and one runtime wrapper instead of keeping parallel paths.
- Update stale comments and docstrings when a retired file name is still mentioned.
- Keep actual boundary fallbacks, but do not keep retired code paths for convenience.

## Implemented Changes

- Deleted `src/data/fundPrices.js`.
- Deleted `src/data/pmTer.js`.
- Deleted `src/data/publicMarketsRawWorkbook.js`.
- Updated the PM source comment to describe it as builder input instead of legacy compatibility surface.
- Updated the closed-position enrichment docstring to point at the canonical PM transactions model instead of the retired `pmTransactions.js` path.

