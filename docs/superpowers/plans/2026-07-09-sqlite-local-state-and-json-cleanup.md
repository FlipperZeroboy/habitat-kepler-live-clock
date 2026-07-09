# SQLite Local State And JSON Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active JSON local-state backend with Bun SQLite and remove all runtime JSON persistence and fallback behavior.

**Architecture:** Keep the existing `LocalStateStore` interface so commands and simulation logic remain unchanged. Replace its JSON implementation with a SQLite implementation at `.habitat/habitat.sqlite`; store local habitat metadata, mutable modules, and local simulation history only. Kepler catalog, blueprint, unlock, stream, replay, and shared-world data remain fetched from Kepler and are never made authoritative by SQLite.

**Tech Stack:** Bun 1.3.14, `bun:sqlite`, TypeScript, Bun test.

## Global Constraints

- The database filename is exactly `habitat.sqlite`.
- The active database path is `.habitat/habitat.sqlite`.
- No source code may read or write `registration.json`, `habitat-modules.json`, or any replacement JSON state file.
- Missing `.habitat/habitat.sqlite` must make local-state commands report no registration or fail; they must not fall back to JSON.
- Kepler remains authoritative for registration, catalogs, blueprints, unlocks, stream URLs, replay URLs, and shared world state.
- SQLite stores only student-side local Habitat state and references such as Kepler IDs.
- Preserve current terminal behavior except for persistence-file wording, which must identify SQLite.
- Verify with `bun run test`, `bunx tsc --noEmit`, and the explicit database rename/restore test.

---

### Task 1: Implement the Bun SQLite local-state store

**Files:**
- Modify: `src/local-state.ts`
- Modify: `src/habitat.ts`
- Test: `test/habitat.test.ts`

**Interfaces:**
- Preserve `LocalStateStore` with `load`, `save`, and `delete`.
- Add `getDatabaseFilePath(cwd?: string): string` returning `<cwd>/.habitat/habitat.sqlite`.
- `getLocalStateStore(cwd)` must return only the SQLite implementation.

- [ ] **Step 1: Add failing SQLite contract tests**

Test that `getLocalStateStore(tempDir).save(registration)` creates `.habitat/habitat.sqlite`, that a fresh store loads the same local state, and that deleting the store removes the SQLite file. Add a missing-database test asserting `load()` returns `null` when the database is absent.

- [ ] **Step 2: Implement schema initialization**

Use `import { Database } from "bun:sqlite"`. Create the parent directory, open `habitat.sqlite`, and initialize tables with `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS habitat_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  habitat_uuid TEXT NOT NULL,
  habitat_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  current_tick INTEGER NOT NULL,
  power_summary_json TEXT NOT NULL,
  tick_history_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  habitat_id TEXT NOT NULL,
  blueprint_id TEXT NOT NULL,
  module_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  connected_to_json TEXT NOT NULL,
  runtime_attributes_json TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Do not create catalog, blueprint, unlock, stream, replay, or world-state tables.

- [ ] **Step 3: Implement transactional load/save/delete**

Store local `LocalRegistration` metadata in `habitat_state`, mutable modules in `modules`, and reconstruct the existing TypeScript model on load. Use a transaction for save: replace the singleton habitat row and replace all module rows atomically. Preserve empty `starterModules` and `blueprints` on re-load rather than treating the database as a catalog cache. Use prepared statements and JSON columns only for nested local runtime structures.

`load()` must return `null` when `habitat_state` has no row. `delete()` must remove the database file after closing the connection. No JSON file fallback is permitted.

- [ ] **Step 4: Update config and CLI wording**

Change `ConfigCheck.registrationFile` to `databaseFile`, update `habitat config` to print `Database File: .habitat/habitat.sqlite`, and update registration/unregistration messages to refer to the SQLite database rather than JSON registration files. Remove JSON path helper exports and their imports.

- [ ] **Step 5: Run the focused SQLite tests**

```sh
bun test test/habitat.test.ts
```

Expected: PASS after converting persistence fixtures to use `getLocalStateStore(tempDir).save(...)` instead of writing JSON files.

### Task 2: Remove all JSON safety-net usage

**Files:**
- Modify: `test/habitat.test.ts`
- Modify: `test/cli.test.ts`
- Modify: `src/local-state.ts`
- Modify: `src/habitat.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Replace test JSON fixtures with SQLite fixtures**

Update test helpers and assertions to create/read local state through the store or database queries. Tests may inspect SQLite rows, but must not write `registration.json` or `habitat-modules.json`.

- [ ] **Step 2: Search for forbidden active persistence references**

Run:

```sh
rg -n "registration\.json|habitat-modules\.json|habitat-inventory\.json|readFile\(|writeFile\(|JSON\.parse|JSON\.stringify" src
```

Expected: no JSON local-state reads/writes remain in `src`; `.env` parsing and HTTP JSON handling may remain.

- [ ] **Step 3: Verify normal CLI behavior**

Run:

```sh
bun run src/index.ts module list
bun run src/index.ts module status
bun run src/index.ts status
```

Expected: commands read the existing `.habitat/habitat.sqlite` state and do not create JSON files.

- [ ] **Step 4: Verify database dependency deliberately**

Run from `.habitat`:

```sh
mv habitat.sqlite habitat.sqlite-old
cd ..
bun run src/index.ts status
status=$?
cd .habitat
mv habitat.sqlite-old habitat.sqlite
cd ..
bun run src/index.ts status
```

Expected: the first status command reports no local registration or exits nonzero; it must not show the old habitat. The restored database makes status work again.

- [ ] **Step 5: Run complete verification**

```sh
bun run test
bunx tsc --noEmit
git diff --check
```

- [ ] **Step 6: Commit the SQLite migration and cleanup**

```sh
git add src/local-state.ts src/habitat.ts src/index.ts test/habitat.test.ts test/cli.test.ts docs/superpowers/plans/2026-07-09-sqlite-local-state-and-json-cleanup.md
git commit -m "feat: persist local habitat state in sqlite"
```
