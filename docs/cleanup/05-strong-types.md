# Cleanup 05: Strong Types

## Assessment

The repo is not broadly type-heavy. The real weak points are the data pipeline scripts that parse external inputs and emit the generated PM modules consumed by the app. Those boundaries were mostly using raw `dict`, `list[dict]`, and ambiguous JSON return values instead of named record shapes.

I attempted `knip` and `madge`, but this environment cannot fetch them from npm, so the audit here is based on direct code inspection and the PM pipeline itself. That was enough to identify the high-value weak boundaries:
- `scripts/parse_bank_movements_pdf.py`
- `scripts/transactions_export_js.py`
- `scripts/portfolio_build_values.py`
- `scripts/portfolio_export_js.py`
- `src/data/publicMarketsModel.js`

The important finding is that the repo did not have many literal `any` / `unknown` annotations to remove. The work here is mainly about replacing untyped collection shapes and ambiguous return values with concrete, defensible record types.

## Recommendations

1. Give the PM pipeline a shared Python type module for the concrete record kinds it already uses.
2. Keep JSON import helpers generic only at the boundary, then normalize to named record shapes immediately.
3. Prefer `dict[str, T]` / `list[T]` over bare `dict` / `list[dict]` in generator code.
4. Add JSDoc to shared JS helpers so editor tooling sees the collection contracts, even though the runtime remains JS.
5. Leave legacy scripts alone unless they feed the runtime model or a generated artifact directly.

## Implemented

- Added shared PM Python types in `scripts/pm_model_types.py`.
- Typed the bank PDF parser, transaction exporter, snapshot portfolio builder, and PM values exporter.
- Added JSDoc to the shared PM model index helpers.

## Residual Risk

There are still older utility scripts outside the main PM pipeline that use loose dictionaries. They are lower priority because they do not feed the app’s runtime model directly, but they remain candidates for the same treatment later. The transitional compatibility shims are gone; the active PM scripts now import the canonical type module directly from `scripts.pm_model_types`.
