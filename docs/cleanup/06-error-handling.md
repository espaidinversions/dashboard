# Cleanup Track 6: Error Handling

## Critical Assessment

The codebase is mostly disciplined about boundary handling, but there are a few places where errors are still being swallowed or converted into silent fallbacks without a strong reason.

The main problem is not the presence of `try/catch` itself. The problem is where it is used to hide invalid internal state or to keep running after a code path should fail loudly. In practice, that showed up in three places:

- `api/auth-settings.js` was discarding invalid stored domains one by one instead of failing the read.
- `scripts/portfolio_build_values.py` had fallback branches that tried to recover from missing generated data even though that generated data is part of the build contract.
- `scripts/transactions_export_js.py` had broad exception handling around local parsing and a zero-division guard that could be expressed directly.

The remaining exception handling in the repository is mostly justified:

- file and JSON parsing for external inputs
- network fallbacks for live rates and rate limiting
- guarded admin and API entry points that need to translate failures into user-facing responses

## Recommendations

- Fail fast when reading trusted internal configuration. If a stored value is invalid, surface it instead of dropping it.
- Narrow exception types in scripts. Catch the specific parse or I/O errors that can happen, not `Exception` as a blanket recovery path.
- Remove fallback branches that only exist to keep old generated artifacts alive when the pipeline already guarantees fresh generation.
- Keep recovery only where the input is genuinely external or volatile, such as uploaded files, PDFs, JSON, HTTP calls, and rate-limit backends.

## Implemented Simplifications

- Removed silent per-item swallowing of invalid allowed-domain values.
- Removed the fallback import path for workbook totals in the PM value builder.
- Narrowed broad parsing catches in the PM build and transaction export scripts.
- Replaced an unnecessary `ZeroDivisionError` guard with explicit unit checks.

