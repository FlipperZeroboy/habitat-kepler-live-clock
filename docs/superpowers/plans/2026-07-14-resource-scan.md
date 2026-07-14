# Habitat Resource Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `habitat scan` command that routes through the local Habitat API to Kepler and clearly reports resource probabilities and quantity estimates.

**Architecture:** Add a typed `scanHabitat` Kepler function in `src/habitat.ts`, expose it through a validated `GET /scan` Hono route in `src/server.ts`, and add a CLI command module that calls only the local API client. Human formatting stays in the command/formatter layer; JSON output returns the complete backend response.

**Tech Stack:** Bun, TypeScript, Commander, Hono, Bun Test, Kepler REST API.

## Global Constraints

- Keep the flow `Habitat CLI -> local Habitat API -> Kepler World`.
- Read `habitatId` from saved local registration; never require it in the CLI.
- Use `GET /world/scan` with `habitatId`, integer `x`, integer `y`, `sensorStrength` `0–100`, and `radiusTiles` `0–5`.
- Return Kepler’s scan response unchanged from the local API.
- Keep scan read-only; do not add local resource truth or collection behavior.
- Run `bun run test` and `bunx tsc --noEmit` before completion.

### Task 1: Add typed scan domain request

**Files:**
- Modify: `src/habitat.ts`
- Test: `test/habitat.test.ts`

**Interfaces:**
- Produces `WorldScanResponse`, `WorldScanOptions`, and `scanHabitat(options)` for the server route.

- [ ] **Step 1: Write the failing test**

Add a mocked Kepler test that saves a local registration, calls `scanHabitat({ x: 0, y: 0, sensorStrength: 100, radiusTiles: 0, cwd })`, and asserts the request URL contains the saved `habitatId` plus all four scan parameters, uses `GET`, sends the bearer token, and returns the exact mocked `{ scan: ... }` object.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
bun test test/habitat.test.ts
```

Expected: FAIL because `scanHabitat` and the scan types do not exist.

- [ ] **Step 3: Implement the minimal domain function**

Define the OpenAPI response types, validate integer coordinates and the strength/radius bounds, load local registration and Kepler config, build `URLSearchParams`, call `${config.baseUrl}/world/scan` with the existing bearer-header pattern, call `assertOk`, and return the parsed response unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```sh
bun test test/habitat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/habitat.ts test/habitat.test.ts
git commit -m "feat: add Kepler resource scan request"
```

### Task 2: Expose the validated local API route

**Files:**
- Modify: `src/server.ts`
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes `scanHabitat` from `src/habitat.ts`.
- Produces `GET /scan?x=...&y=...&strength=...&radius=...` returning the scan response.

- [ ] **Step 1: Write the failing tests**

Add tests that inject a `scanHabitat` function into `createApp`, verify `/scan` passes numeric values and returns the exact response, and verify missing, non-integer, out-of-range strength, and out-of-range radius values return HTTP 400 with clear structured errors.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```sh
bun test test/server.test.ts
```

Expected: FAIL because `/scan` is not registered and `createApp` has no scan dependency.

- [ ] **Step 3: Implement the route**

Add `scanHabitat` to the server imports and `AppOptions`, create the default function using the logged Kepler fetch, parse and validate `x`, `y`, `strength`, and `radius`, call the scan function, set the proxy log summary, and return its response unchanged.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```sh
bun test test/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/server.ts test/server.test.ts
git commit -m "feat: proxy resource scans through habitat API"
```

### Task 3: Add CLI scan command and formatting

**Files:**
- Create: `src/commands/scan.ts`
- Modify: `src/index.ts`
- Modify: `src/formatters.ts`
- Test: `test/cli.test.ts`

**Interfaces:**
- Consumes `GET /scan` through `createApiClient()`.
- Produces `habitat scan --x <integer> --y <integer> --strength <0-100> --radius <0-5> [--json]`.

- [ ] **Step 1: Write the failing CLI tests**

Add help coverage for `scan`, then spawn the CLI against the existing mocked backend pattern and assert human output includes every tile’s coordinates, distance, top candidate, confidence, quantity estimate, and all probabilities for a radius-zero scan. Add a ranged-quantity case and assert `--json` prints parseable complete JSON.

- [ ] **Step 2: Run the focused CLI tests and verify they fail**

Run:

```sh
bun test test/cli.test.ts
```

Expected: FAIL because the command and formatter do not exist.

- [ ] **Step 3: Implement the command and formatter**

Create Commander options with strict integer/range parsers, call `/scan` with URL-encoded query parameters, print `JSON.stringify(response, null, 2)` for `--json`, and otherwise print a clear tile-by-tile report. Show exact quantities as `N kg (exact)` and ranges as `N–M kg (estimated; about E kg)`. For radius zero, print the full probability distribution.

- [ ] **Step 4: Run the focused CLI tests and verify they pass**

Run:

```sh
bun test test/cli.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/commands/scan.ts src/index.ts src/formatters.ts test/cli.test.ts
git commit -m "feat: add habitat scan command"
```

### Task 4: Full verification and live lab walkthrough

**Files:**
- Modify: `README.md` only if the repository already has one and the command documentation is needed; otherwise no additional file.

- [ ] **Step 1: Run required automated verification**

```sh
bun run test
bunx tsc --noEmit
git diff --check
```

Expected: all tests pass, typecheck exits 0, and diff check is clean.

- [ ] **Step 2: Verify local service and registration**

```sh
habitat status
```

If the service is not running, start it separately with `bun run server` and rerun `habitat status`.

- [ ] **Step 3: Verify exact and probabilistic scans**

```sh
habitat scan --x 0 --y 0 --strength 100 --radius 0
habitat scan --x 0 --y 0 --strength 40 --radius 2
habitat scan --x 0 --y 0 --strength 100 --radius 0 --json
```

Confirm the first scan identifies a resource and exact remaining quantity, while the weaker or farther tiles retain probabilities and quantity ranges.

- [ ] **Step 4: Commit any documentation-only adjustment**

```sh
git status --short
```

Do not commit `.env`, `.habitat/`, `node_modules/`, or secrets.
