# Habitat Local-State Repository Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one explicit local-state persistence boundary while preserving the Habitat CLI’s current JSON behavior and Kepler ownership boundary.

**Architecture:** Commands and simulation logic will continue to use the existing `LocalRegistration` model, but file-specific reads and writes will move behind a local-state repository seam. This first milestone keeps the JSON adapter as the active backend; a later milestone can add a `bun:sqlite` adapter without changing command behavior or storing Kepler-owned catalog data locally.

**Tech Stack:** Bun, TypeScript, Bun test, existing `node:fs/promises` JSON persistence.

## Global Constraints

- Kepler remains authoritative for registration, catalogs, blueprints, unlocks, stream URLs, replay URLs, and shared world state.
- Local persistence contains only Habitat CLI student-side state after registration.
- Read-only Kepler catalog and blueprint commands must not write local state.
- Do not add dual writes or change terminal output in this milestone.
- Do not commit `.env`, `.habitat/`, `node_modules/`, or local secrets.
- Verify with `bun run test` and `bunx tsc --noEmit`.

---

### Task 1: Define the local persistence seam

**Files:**
- Create: `src/local-state.ts`
- Modify: `src/habitat.ts`
- Test: `test/habitat.test.ts`

**Interfaces:**
- `src/local-state.ts` produces `LocalStateStore`, `JsonLocalStateStore`, `getLocalStateStore`, `getRegistrationFilePath`, and `getModulesFilePath`.
- `src/habitat.ts` consumes the repository for local registration/module load, save, and delete operations.

- [ ] **Step 1: Add a failing repository contract test**

Add a test that creates a temporary directory, constructs the JSON store, saves a minimal `LocalRegistration`, loads it again, and verifies that the module array is loaded from the separate module file. Also verify that deleting the registration removes both JSON files.

The test must use the existing `LocalRegistration` shape and assert the observable contract:

```ts
const store = getLocalStateStore(tempDir);
await store.save(registration);
expect(await store.load()).toEqual(registration);
await store.delete();
expect(await store.load()).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
bun test test/habitat.test.ts
```

Expected: FAIL because `src/local-state.ts` and `getLocalStateStore` do not exist yet.

- [ ] **Step 3: Implement the JSON repository**

Move the existing path and JSON persistence behavior into `src/local-state.ts`:

```ts
export type LocalStateStore = {
  load(): Promise<LocalRegistration | null>;
  save(registration: LocalRegistration): Promise<void>;
  delete(): Promise<void>;
};
```

The JSON implementation must:

- create `.habitat` when saving;
- read `registration.json` and optionally override `registration.modules` from `habitat-modules.json`;
- write both files from one `save` call;
- remove both files from one `delete` call;
- preserve the current missing-file behavior by returning `null` when registration does not exist;
- avoid importing or fetching Kepler catalogs;
- keep path resolution based on the caller-provided `cwd`.

Export the existing path helpers from this module and update `habitat.ts` to import and use the store instead of directly calling `readFile`, `writeFile`, or `rm` for local state. Keep `.env` parsing on the existing filesystem path for now.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```sh
bun test test/habitat.test.ts
```

Expected: PASS, including existing registration, tick, module, inventory, construction, and unregister tests.

- [ ] **Step 5: Run the complete verification commands**

Run:

```sh
bun run test
bunx tsc --noEmit
```

Expected: all tests pass and TypeScript exits successfully. Confirm that `git diff -- .habitat` is empty and no secrets are staged.

- [ ] **Step 6: Commit the persistence-boundary milestone**

```sh
git add src/local-state.ts src/habitat.ts test/habitat.test.ts docs/superpowers/plans/2026-07-09-local-state-repository-boundary.md
git commit -m "refactor: isolate local habitat persistence"
```

### Task 2: Review the seam before SQLite implementation

**Files:**
- Review: `src/local-state.ts`
- Review: `src/habitat.ts`
- Review: `test/habitat.test.ts`

- [ ] **Step 1: Confirm the boundary in live CLI behavior**

Run the existing read-only and local commands against a temporary fixture or the current local state:

```sh
bun run src/index.ts module list
bun run src/index.ts module status
bun run src/index.ts resource list
```

Confirm that module commands still read local state, resource catalog still calls Kepler, and no new catalog or blueprint JSON file is created.

- [ ] **Step 2: Stop for approval of the SQLite schema**

Before adding `bun:sqlite`, review which local fields should become relational columns versus JSON columns. The next design decision must explicitly cover `habitats`, `modules`, `inventory`, `construction_jobs`, and `tick_history`, while excluding authoritative Kepler catalog ownership.
