# Kepler Registration CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the previous local Habitat CRUD CLI with Kepler registration, status, and unregister commands.

**Architecture:** Keep the command surface in `src/index.ts` and move Kepler config, persistence, and HTTP behavior into a testable module. Persist durable registration data in project-local `.habitat/registration.json`.

**Tech Stack:** Bun, TypeScript, Commander, Bun test, built-in `fetch`, built-in `crypto.randomUUID`.

## Global Constraints

- Commands are exactly `habitat register --name "<habitat name>"`, `habitat status`, and `habitat unregister`.
- Registration request JSON keys must be `displayName` and `habitatUuid`.
- Config is read from `.env` using `KEPLER_BASE_URL` and `KEPLER_PLANET_TOKEN`.
- Persist local data under `.habitat` as JSON.
- Do not persist planet IDs, region IDs, world IDs, callback URLs, stream URLs, replay URLs, or a second token.
- Remove old local object CRUD behavior from code and help output.
- This folder is not currently a Git repository, so commit steps are intentionally skipped.

---

### Task 1: Test Kepler Registration Behavior

**Files:**
- Create: `test/habitat.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces expected exported functions from `src/habitat.ts`: `registerHabitat`, `getRegistrationFilePath`, `loadLocalRegistration`, `getHabitatDirectory`.

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run `bun test` and confirm missing module/export failures**
- [ ] **Step 3: Implement storage/config/registration**
- [ ] **Step 4: Run `bun test` and confirm registration tests pass**

### Task 2: Test Status and Unregister Behavior

**Files:**
- Modify: `test/habitat.test.ts`
- Modify: `src/habitat.ts`

**Interfaces:**
- Produces `getRegistrationStatus` and `unregisterHabitat`.

- [ ] **Step 1: Write failing tests for GET `/habitats/{habitatId}/registration` and DELETE `/habitats/{habitatId}`**
- [ ] **Step 2: Run `bun test` and confirm failures**
- [ ] **Step 3: Implement status and unregister**
- [ ] **Step 4: Run `bun test` and confirm pass**

### Task 3: Replace CLI Surface

**Files:**
- Modify: `src/index.ts`
- Delete: `src/store.ts`
- Modify: `.gitignore`
- Modify: `test/cli.test.ts`

**Interfaces:**
- CLI imports functions from `src/habitat.ts`.

- [ ] **Step 1: Write failing CLI help test showing old commands are absent and new commands are present**
- [ ] **Step 2: Run `bun test` and confirm failure**
- [ ] **Step 3: Replace `src/index.ts` with focused Commander commands**
- [ ] **Step 4: Delete old store module and add `.habitat` to `.gitignore`**
- [ ] **Step 5: Run `bun test` and `bunx tsc --noEmit`**
