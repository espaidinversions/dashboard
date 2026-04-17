# Cleanup Track 2: Type Consolidation

## Assessment

The codebase has a small number of high-value shapes that are repeated across JS and Python, but they were previously expressed as ad hoc object literals in each script or module. That is manageable while the repo is small, but it creates drift risk in the PM/public-markets pipeline and in the `src/db.js` adapter layer.

The main problem is not the absence of TypeScript. It is the absence of shared shape vocabulary. Before this cleanup, PM rows, transaction rows, value series points, dashboard payload rows, and database row transforms were all being re-described in multiple places. The practical cost is that changes to one pipeline stage can silently desynchronize the others.

The strongest candidates for consolidation were:

- PM/public-markets data records and transaction/value series shapes.
- The dashboard/API payloads in `src/db.js`.
- Python generator row shapes in `scripts/*.py`.

## Recommendations

1. Keep the canonical PM/public-markets shapes in a shared JSDoc module, and use it from the model adapter, value utilities, and model export script.
2. Keep the dashboard/API payload shapes in a second shared JSDoc module, and use it from `src/db.js` instead of repeating row maps inline.
3. Keep Python generator row shapes in one `TypedDict` module, and annotate the PM generator scripts against those shared types.
4. Prefer type-shape consolidation over broader runtime validation unless a script accepts untrusted input. The repo is mostly deterministic data transformation code, so shared shape definitions give most of the value with the least churn.
5. Leave the generated data modules generated. Type definitions should describe them, not replace them.

## Implemented

- Added [src/data/publicMarketsTypes.js](../../src/data/publicMarketsTypes.js) for PM/public-markets shapes.
- Added [src/data/dashboardTypes.js](../../src/data/dashboardTypes.js) for dashboard/API payload shapes.
- Consolidated the Python PM row shapes into [scripts/pm_model_types.py](../../scripts/pm_model_types.py), and moved the active PM scripts to package-qualified imports from `scripts.pm_model_types`.
- Annotated the core PM adapter and utilities in:
  - [src/data/publicMarketsModel.js](../../src/data/publicMarketsModel.js)
  - [src/data/pmValueUtils.js](../../src/data/pmValueUtils.js)
  - [src/data/pmClosedUtils.js](../../src/data/pmClosedUtils.js)
  - [src/data/pmIdentity.js](../../src/data/pmIdentity.js)
- Annotated the API/data conversion layer in [src/db.js](../../src/db.js).
- Annotated the PM generators in:
  - [scripts/transactions_export_js.py](../../scripts/transactions_export_js.py)
  - [scripts/portfolio_build_values.py](../../scripts/portfolio_build_values.py)
  - [scripts/enrich_closed_positions.py](../../scripts/enrich_closed_positions.py)
  - [scripts/pm_model_export_js.mjs](../../scripts/pm_model_export_js.mjs)

## Residual Gaps

- The wider UI component tree still consumes plain objects without explicit JSDoc types. That is acceptable for now because the shared model layer already carries the important shapes.
- Some generated monthly/value series remain intentionally loose because their keys are dynamic by design.
- A full runtime schema layer would be useful only if more external inputs are introduced; today it would add complexity without much payoff.
