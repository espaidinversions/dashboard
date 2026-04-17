# DRY Cleanup Assessment

## Duplicated Patterns

- Local storage access was repeated across `Dashboard`, `FundsIndex`, `FundDetail`, `CompanyDetail`, `CompaniesIndex`, and `AdminPanel`. The same `getItem` / `JSON.parse` / `setItem` / `try-catch` logic appeared in several places with slightly different defaults.
- ISO date formatting was repeated in `AdminUsers`, `AdminActivity`, `PortfolioCompaniesTab`, and `SearchersTab`.
- Multiple-value formatting and color selection were repeated in the fund/company views, with the same `x.yx` display and the same threshold-based color logic.
- A few one-off helpers were local to a single file but already matched a stable shared pattern, such as persisted dark-mode flags.

## Risks

- Leaving storage logic duplicated makes persistence behavior drift over time, especially when one screen changes its fallback or error handling.
- Repeating the same date and multiple formatters makes small UI inconsistencies more likely and increases the number of places that need to be updated together.
- Over-abstracting view-specific helpers would add indirection without reducing complexity, so not every repeated-looking function should be shared.

## Recommendations

- Share storage helpers for JSON values and boolean flags, and use them consistently in components that read or write `localStorage`.
- Share date and multiple-format helpers where the formatting intent is identical across views.
- Keep chart-specific and page-specific helpers local unless a second consumer appears.

## Applied

- Added shared storage helpers in `src/utils.js`.
- Replaced repeated dark-mode, JSON storage, date formatting, and multiple formatting code at the obvious call sites.
- Kept PM chart grouping helpers local because they are view-specific and do not yet reduce complexity when shared.
