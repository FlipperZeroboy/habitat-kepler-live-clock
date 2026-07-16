# Task 1 Report — Dashboard clock data flow

Base commit: `5ec77978eed1cccacf491a5e35bc42cfb305f281`

## What changed

- Added `ClockStatus` and `ClockStatusResponse` to `web/src/types.ts`.
- Extended `DashboardData` with a required `clock` field.
- Added `habitatApi.clockStatus()` in `web/src/api.ts` to read `GET /clock/status`.
- Updated `useDashboard.refresh()` in `web/src/use-dashboard.ts` to load registration, status, power, and clock data together and store `clock` in dashboard state.

## Verification

- `bunx tsc --noEmit --module ESNext --moduleResolution Bundler --target ESNext --strict --skipLibCheck --jsx react-jsx --lib DOM,DOM.Iterable,ESNext --types vite/client,react,react-dom web/src/types.ts web/src/api.ts web/src/use-dashboard.ts`
- `bunx tsc --noEmit`

## Notes

- The repository’s root `tsconfig.json` only includes `src/`, so the focused web compile was necessary to validate the Task 1 dashboard files directly.
- No other files were modified.
