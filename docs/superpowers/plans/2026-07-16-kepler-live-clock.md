# Kepler Live Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted manual/Kepler clock modes, an authenticated backend-owned Kepler WebSocket, local watch streaming, and the requested CLI commands without changing existing Habitat state ownership.

**Architecture:** Keep `src/habitat.ts` as the local simulation and registration domain, extending `LocalRegistration` with one saved stream credential plus clock telemetry. Keep `src/local-state.ts` as the additive SQLite migration boundary. Keep `src/server.ts` as the long-running WebSocket owner and local API event broadcaster; keep `src/index.ts` as an HTTP-only CLI client.

**Tech Stack:** Bun, TypeScript, Hono, Bun WebSocket server, SQLite via `bun:sqlite`, Commander, Bun Test.

## Global Constraints

- Listening defaults to off after registration.
- Manual ticks are allowed only in manual mode and rejected in Kepler mode.
- Kepler tick notices apply exactly their positive whole-number `advancedBy` value.
- Reconnects never request or apply missed ticks.
- Persist all clock mode and telemetry through the existing `.habitat/habitat.sqlite` state.
- Store exactly one authoritative returned `apiToken` with registration state; never log or commit it.
- `habitat clock watch` uses only the local Habitat API.
- Preserve existing registration, module, human, inventory, construction, power, atmosphere, exploration, and alert data.
- Do not push to GitHub.

---

### Task 1: Add the additive SQLite clock-state model

**Files:**
- Modify: `src/habitat.ts` types around `LocalRegistration` and runtime options
- Modify: `src/local-state.ts` schema, normalization, load, and save paths
- Test: `test/habitat.test.ts`

**Interfaces:**
- Produces `ClockMode`, `StreamMetadata`, `ClockState`, and `LocalRegistration.streamUrl`, `LocalRegistration.apiToken`, `LocalRegistration.stream`, `LocalRegistration.clock`.
- Keeps `getLocalStateStore(cwd).load()` backward-compatible with databases created before the migration.

- [ ] Write failing tests proving old state loads with `clock.mode === "manual"`, new fields round-trip, and all existing modules/humans/alerts survive the migration.
- [ ] Run `bun test test/habitat.test.ts` and confirm the new assertions fail because the fields are absent.
- [ ] Add `clock` and stream credential types; add `ALTER TABLE habitat_state ADD COLUMN ...` statements with safe defaults/nullability for existing rows.
- [ ] Serialize stream metadata and clock telemetry as JSON or scalar columns consistently with the current store; preserve the token only in the registration state row.
- [ ] Normalize missing legacy values to manual mode, null telemetry, and empty stream metadata without changing existing state.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit: `feat: persist live clock state`

### Task 2: Capture registration stream credentials and expose status data

**Files:**
- Modify: `src/habitat.ts` registration and local status summary functions
- Modify: `src/server.ts` registration/status response types and routes
- Modify: `src/api-client.ts` response types
- Modify: `src/index.ts` registration and status output
- Test: `test/habitat.test.ts`, `test/server.test.ts`, `test/cli.test.ts`

**Interfaces:**
- Produces `getClockStatus`, `setClockListening`, and a status response containing stream URL, full token, stream metadata, and persisted clock telemetry.
- Registration persists `body.streamUrl`, `body.apiToken`, and `body.stream` while keeping `currentTick` initialized from existing Habitat behavior.

- [ ] Add failing registration/status tests using a fake response with `streamUrl`, `apiToken`, and `stream` metadata.
- [ ] Run only those tests and confirm failure.
- [ ] Persist the returned fields during `registerHabitat`; default `clock.mode` to `manual` and `listening` to false.
- [ ] Extend `/status` JSON and human output to reveal the saved stream URL and full token, while leaving `/registration` redacted and ensuring backend logs never include the token.
- [ ] Run focused habitat/server/CLI tests and confirm pass.
- [ ] Commit: `feat: persist and report Kepler stream credentials`

### Task 3: Add backend clock mode routes and manual tick guard

**Files:**
- Modify: `src/habitat.ts` clock state functions and `tickHabitat` guard option
- Modify: `src/server.ts` `/clock/status`, `/clock/listen`, and `/ticks`
- Modify: `src/api-client.ts` clock request/response types and methods if needed
- Modify: `src/index.ts` `clock` command group and manual tick messaging
- Test: `test/habitat.test.ts`, `test/server.test.ts`, `test/cli.test.ts`

**Interfaces:**
- `setClockListening(enabled: boolean, options?: RuntimeOptions): Promise<ClockState>` persists mode and telemetry without duplicating credentials.
- `GET /clock/status` returns the persisted clock state.
- `POST /clock/listen` accepts `{ enabled: boolean }`.

- [ ] Add failing tests for default off, listen-on/off persistence across fresh store loads, `/ticks` rejection in Kepler mode, and CLI command output.
- [ ] Run focused tests and confirm failure.
- [ ] Implement state mutation and exact user-facing rejection: manual ticks are unavailable while Kepler listening is enabled; use `habitat clock listen off` first.
- [ ] Add Commander subcommands with `clock status`, `clock listen on`, and `clock listen off`; keep `habitat tick <count>` unchanged when off.
- [ ] Run focused tests and confirm pass.
- [ ] Commit: `feat: add persisted Habitat clock modes`

### Task 4: Implement the backend-owned Kepler WebSocket listener

**Files:**
- Create: `src/kepler-stream.ts`
- Modify: `src/server.ts` Bun server startup and clock route integration
- Modify: `src/habitat.ts` telemetry update/apply helpers
- Test: `test/kepler-stream.test.ts`, `test/server.test.ts`

**Interfaces:**
- `createKeplerStream(options)` owns one socket lifecycle, sends `{ type: "hello", apiToken, subscribe: ["ticks"] }`, and exposes `start`, `stop`, and reconnect behavior.
- It receives a callback `(notice: PlanetTickMessage) => Promise<void>` only after validating `type`, `advancedBy`, and listening state.

- [ ] Add fake WebSocket tests for exact hello payload, no `lastAppliedPlanetTick`, application of `advancedBy: 10`, ignored invalid/non-tick messages, and no token in logs.
- [ ] Add disconnect/reconnect tests proving a new hello is sent and no catch-up field is added or missed tick applied.
- [ ] Run the new stream tests and confirm failure.
- [ ] Implement the socket adapter around Bun’s WebSocket server/client APIs with injectable WebSocket factory/timers for deterministic tests.
- [ ] On successful message application, persist absolute Kepler tick, advancedBy, message time, and connection/message telemetry; on failure, persist the latest connection error without leaking credentials.
- [ ] Ensure explicit listen-off stops the socket and cancels reconnect attempts.
- [ ] Run stream/server tests and confirm pass.
- [ ] Commit: `feat: connect Habitat clock to Kepler ticks`

### Task 5: Add local clock watch streaming and CLI watch

**Files:**
- Modify: `src/server.ts` local subscriber registry and `GET /clock/watch`
- Modify: `src/api-client.ts` streaming helper
- Modify: `src/index.ts` `habitat clock watch`
- Test: `test/server.test.ts`, `test/cli.test.ts`

**Interfaces:**
- Local watch events contain only sanitized applied-tick data: absolute Kepler tick, `advancedBy`, local current tick, and message time.
- The local API stream never includes `apiToken`.

- [ ] Add failing route tests that subscribe locally, trigger an applied tick, and observe one event without a Kepler connection from the client.
- [ ] Run the focused tests and confirm failure.
- [ ] Implement a local newline-delimited JSON or SSE stream with clean disconnect handling and subscriber cleanup.
- [ ] Implement the long-running Commander action that prints each future event and exits cleanly on interruption; do not issue a WebSocket connection from CLI code.
- [ ] Run CLI/server tests and confirm pass.
- [ ] Commit: `feat: add local Habitat clock watch`

### Task 6: Full verification and restart proof

**Files:**
- Modify: documentation only if command examples or deployment notes need updating
- Test: all existing and new tests

- [ ] Run `bun run test`.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `git diff --check` and inspect `git status` for secrets or `.habitat` files.
- [ ] Start the backend with a temporary state directory, verify `clock listen on`, stop/restart the backend, and verify `clock status` still reports Kepler mode and connection telemetry without exposing secrets in logs.
- [ ] Verify `habitat tick 1` works in manual mode and is rejected in Kepler mode.
- [ ] Verify `habitat clock watch` receives a backend-applied future notice and that the CLI process does not create a second Kepler socket.
- [ ] Do not push or create a GitHub repository.
