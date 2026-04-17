# Cleanup Track 4: Circular Dependencies

## Critical Assessment

I ran a manual import-graph pass across `src` and `scripts`. `madge`/`knip`/`dependency-cruiser` are not installed in this workspace, so this audit was done with direct graph inspection instead of an external analyzer.

The current graph is mostly clean. I did not find any strongly connected component that forms a real circular dependency in the repo-owned JS/JSX/MJS code. The PM layer is already close to a healthy shape:

- `src/data/publicMarketsModel.js` is a data-only aggregator.
- `src/components/publicMarkets/*` mostly consume that model and render UI.
- `scripts/*` generate data and do not import back from the UI layer.

The main structural risk is not an active cycle today. It is dependency breadth:

- several child PM components were importing the PM model directly even though the parent already owns the data
- shared helper modules are still doing more than one job in places, which makes future back-edges easier to introduce
- barrels are small and safe right now, but they should stay leaf-only if more exports are added later

## Recommendations

- Keep `src/components` one-way: parent containers can read `PM_MODEL`, but leaf sections should receive plain props.
- Keep `src/data` pure. Shared helpers should not import UI modules, and generated modules should remain data-only.
- Prefer extracting leaf utility modules over adding barrels or intermediate re-export layers.
- If a future import crosses from a child component back into a parent-owned data module, treat that as a design smell and move the dependency upward.
- Re-run a graph check after any feature that adds a new shared helper, especially in the PM model and charts area.

## Implemented Simplifications

- Removed direct PM-model imports from `PublicMarketsSummarySection.jsx` and `PublicMarketsTransactionsSection.jsx`.
- `PublicMarketsTab.jsx` now owns the PM transaction data and passes it down as props.
- The `CumulativeFlowsChart` input is now supplied by the parent container instead of being re-fetched inside the child section.

## Result

No circular dependency was found to remove. The dependency graph is still acyclic, and the PM UI is now slightly flatter and easier to keep that way.
