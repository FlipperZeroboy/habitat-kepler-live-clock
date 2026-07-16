# Habitat Dashboard Auto-Tick Design

## Goal

Add a dashboard control for automatically advancing the local Habitat simulation by one in-game tick every real-world second.

## Scope

This feature is dashboard-only. It uses the existing local Habitat API and does not add a new persisted clock mode, backend scheduler, or direct Kepler connection.

## Behavior

- The dashboard displays an Auto Tick control in the clock/status area.
- Starting Auto Tick schedules one request per real-world second to `POST /ticks` with `{ "count": 1 }`.
- Stopping Auto Tick cancels future requests immediately.
- Auto Tick is unavailable while the backend reports Kepler listening enabled.
- If the backend returns HTTP 409 because Kepler listening became enabled, the dashboard stops Auto Tick and refreshes clock status.
- Successful ticks refresh the displayed clock and power/module state.
- Auto Tick is session-scoped and is not persisted across browser, backend, or system restarts.
- The dashboard never opens a WebSocket to Kepler; all requests use the local Habitat API.

## Architecture

The React dashboard owns a timer and an in-flight request guard so slow API calls cannot overlap. It reads `GET /clock/status` to determine whether manual ticks are allowed and uses the existing API client for `POST /ticks`. The backend remains authoritative: its existing manual-tick rejection protects the contract even if dashboard state is stale.

When Auto Tick is enabled, the first tick runs immediately, followed by one-tick requests every second. A stop action clears the timer and prevents a queued result from starting another request. Any API failure stops the timer and presents the existing dashboard error state.

## Testing and verification

- Run the existing automated test suite and TypeScript check.
- Build the dashboard with Vite.
- With the backend in manual mode, start Auto Tick and confirm the local current tick and power values advance once per second.
- Stop Auto Tick and confirm requests stop.
- Enable Kepler listening through the CLI, refresh the dashboard, and confirm Auto Tick is disabled.
- If Kepler listening is enabled while Auto Tick is running, confirm the next 409 response stops Auto Tick.
- Confirm the dashboard remains a local API client and does not create a Kepler WebSocket.

