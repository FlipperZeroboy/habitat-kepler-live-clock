# Kepler Live Clock Design

## Goal

Extend the existing Habitat CLI and Hono backend with an operator-selected
manual or Kepler-driven clock while preserving the current CLI, REST, and
SQLite ownership boundaries.

## User contract

The CLI exposes:

- `habitat clock status`
- `habitat clock listen on`
- `habitat clock listen off`
- `habitat tick <count>`
- `habitat clock watch`

Listening is off after registration. Manual ticks are allowed only while it is
off. Turning listening on makes the backend connect to Kepler and causes future
authenticated `planet_tick` notices to advance local state. Turning listening
off closes the backend connection and returns the backend to manual mode.

`clock watch` talks only to the local Habitat API and observes notices applied
by the backend; it never opens a second Kepler connection.

## State and migration

The existing `habitat_state` SQLite row remains authoritative. An additive
migration adds nullable/defaulted clock columns rather than replacing or
rewriting existing registration, module, human, inventory, construction,
power, atmosphere, exploration, and alert data.

Registration state stores one copy of the returned Kepler stream credentials:

- `stream_url`
- `api_token`
- serialized stream metadata

Clock state stores:

- `clock_mode` (`manual` or `kepler`)
- `last_kepler_tick`
- `last_advanced_by`
- `last_connected_at`
- `last_message_at`
- `last_connection_error`

The token is persisted with registration state, not duplicated in a
clock-specific table or column. It is excluded from logs. It is intentionally
returned by the operator-facing status command and status JSON.

## Backend architecture

`src/server.ts` remains the long-running owner of the Kepler WebSocket. The
backend starts no socket while clock mode is manual. When mode changes to
Kepler, it reads the saved registration token and stream URL, opens the socket,
sends the authenticated `hello`, and subscribes to `ticks`.

The client hello does not include `lastAppliedPlanetTick`, so reconnects do not
request replay or catch-up. A `planet_tick` is considered applicable only when
the persisted mode is Kepler and the connection is the active listener. Its
`advancedBy` value is validated as a positive integer and passed unchanged to
the existing `tickHabitat` implementation.

Unexpected disconnects record an error, close the active connection, and retry
with bounded delay while listening remains enabled. Reconnection never applies
missed ticks. Explicit listen-off cancels retries and closes the socket.

The backend keeps a small in-process subscriber registry for local watch
clients. After a tick is successfully applied, it publishes a sanitized event
containing the absolute Kepler tick, `advancedBy`, local tick summary, and
message time. The stream is local-only; it does not expose the Kepler token.

## HTTP and CLI behavior

- `/status` includes the registration stream URL, full token, stream metadata,
  and persisted clock state.
- `GET /clock/status` returns clock mode and connection state.
- `POST /clock/listen` with `{ "enabled": true|false }` persists the selected
  mode and starts/stops the backend listener.
- `POST /ticks` rejects manual ticks in Kepler mode with an actionable message.
- `GET /clock/watch` provides a local event stream for future applied ticks;
  the CLI prints each event until interrupted.

The CLI remains a transport/formatting layer. It does not read SQLite, hold
Kepler credentials, or connect to Kepler directly.

## Testing

Tests will cover registration credential and metadata persistence, default
manual mode, additive migration preservation, status visibility, mode
persistence across fresh state-store/backend instances, manual tick rejection,
socket hello authentication without catch-up fields, exact `advancedBy`
application, local watch delivery, disconnect/reconnect without replay, and
the five CLI commands.
