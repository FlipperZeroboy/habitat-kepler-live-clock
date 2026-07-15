# Habitat Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a same-project React/TypeScript Habitat dashboard backed exclusively by the existing Hono REST API.

**Architecture:** Add a Vite React app under `web/`, with a typed same-origin API client and a single dashboard state coordinator. Extend the existing `/power/overview` REST response with backend-owned power metrics, proxy `/api` in development, and serve the production build from Hono.

**Tech Stack:** Bun, TypeScript, Hono, React, Vite, Bun test, CSS custom properties.

## Global Constraints

- Use `/Users/tshekou/labs/habitat-cli`; do not create a second repository.
- Use the supplied dashboard screenshot only for layout and information hierarchy.
- The browser may use only the existing Hono REST API; it must not read SQLite or call Kepler directly.
- Support both light and dark mode with readable text and controls.
- Do not add blueprint construction, inventory management, crew controls, or other later features.
- Do not commit, push, create a repository, or open a pull request.

### Task 1: Add frontend tooling and development/production wiring

**Files:**
- Modify: `/Users/tshekou/labs/habitat-cli/package.json`
- Modify: `/Users/tshekou/labs/habitat-cli/src/server.ts`
- Create: `/Users/tshekou/labs/habitat-cli/vite.config.ts`
- Create: `/Users/tshekou/labs/habitat-cli/web/index.html`
- Create: `/Users/tshekou/labs/habitat-cli/web/src/main.tsx`

- [ ] Add React, ReactDOM, Vite, and their TypeScript types; add `dev:web` and `build:web` scripts.
- [ ] Configure Vite to serve `web` and proxy `/api` to `http://localhost:8787`.
- [ ] Add an empty React mount page.
- [ ] Add Hono production serving for `web/dist`, preserving all REST routes and returning the SPA entry for browser navigation.
- [ ] Run `bun install`, `bun run build:web`, and `bunx tsc --noEmit`.

### Task 2: Expose the backend-owned power overview

**Files:**
- Modify: `/Users/tshekou/labs/habitat-cli/src/server.ts`
- Modify: `/Users/tshekou/labs/habitat-cli/src/api-client.ts`
- Modify: `/Users/tshekou/labs/habitat-cli/test/server.test.ts`
- Modify: `/Users/tshekou/labs/habitat-cli/test/api-client.test.ts`

- [ ] Write a failing server test proving `GET /power/overview` returns modules plus generation, consumption, net balance, battery values, and solar condition from injected dependencies.
- [ ] Run the focused test and confirm it fails because the route currently returns only `{ modules }`.
- [ ] Implement the smallest backend response change using existing Habitat runtime values and the existing solar route logic; keep all power rules in `src/habitat.ts` or a backend helper.
- [ ] Update typed client response models and add request coverage.
- [ ] Run focused tests, then `bun run test`.

### Task 3: Build the typed API client and dashboard state coordinator

**Files:**
- Create: `/Users/tshekou/labs/habitat-cli/web/src/api.ts`
- Create: `/Users/tshekou/labs/habitat-cli/web/src/types.ts`
- Create: `/Users/tshekou/labs/habitat-cli/web/src/use-dashboard.ts`
- Create: `/Users/tshekou/labs/habitat-cli/web/src/use-dashboard.test.ts`

- [ ] Write failing tests for loading all dashboard resources, registering/unregistering, toggling module status, preset/custom ticks, and refresh-after-mutation.
- [ ] Run the focused tests and confirm the missing client/coordinator behavior fails.
- [ ] Implement a small REST client using `/api/registration`, `/api/status`, `/api/modules`, `/api/power/overview`, `/api/solar/irradiance`, and `/api/ticks`.
- [ ] Implement refresh and mutation state with explicit `loading`, `mutating`, `error`, and `registration === null` states.
- [ ] Validate custom tick values in the UI as a positive whole number, while still relying on the API as the authority.
- [ ] Run the focused tests and `bun run test`.

### Task 4: Implement the dashboard interface and theme

**Files:**
- Create: `/Users/tshekou/labs/habitat-cli/web/src/App.tsx`
- Create: `/Users/tshekou/labs/habitat-cli/web/src/styles.css`
- Modify: `/Users/tshekou/labs/habitat-cli/web/src/main.tsx`
- Create: `/Users/tshekou/labs/habitat-cli/web/src/App.test.tsx`

- [ ] Write failing component tests for unregistered/register form, registered overview, module status toggle, tick controls, unregister confirmation, loading, and API error states.
- [ ] Run the focused tests and confirm they fail before implementation.
- [ ] Implement the reference-inspired single-screen shell: navigation rail, header, metric cards, power balance, solar/tick controls, module table, and separated danger zone.
- [ ] Render all values from dashboard state; do not hard-code Habitat names, IDs, module data, power values, or fake activity.
- [ ] Add CSS variable themes, theme toggle, focus styles, responsive layout, status pills, and readable light/dark controls.
- [ ] Run component tests and build the app.

### Task 5: Verify live dev, shared CLI state, and production serving

**Files:**
- Modify if needed: `/Users/tshekou/labs/habitat-cli/README.md` or a focused dashboard usage note only if the repo already has a suitable documentation location.

- [ ] Start `bun run server` from `/Users/tshekou/labs/habitat-cli` and keep it running.
- [ ] Start `bun run dev:web` and open the printed Vite URL.
- [ ] Verify registration state, module state, offline/online transition, two preset tick values, one custom tick, unregister, and re-register.
- [ ] After a website module change, run `habitat module status` and `habitat power status` and compare the live values.
- [ ] Change a module with the CLI and refresh the browser to confirm the website sees it.
- [ ] Stop development processes, run `bun run build:web`, restart `bun run server`, and open `http://localhost:8787`.
- [ ] Confirm the built dashboard loads and still reads/mutates the backend state.
- [ ] Run `bun run test` and `bunx tsc --noEmit` before reporting completion.

## Self-review

- Route coverage: registration, status, modules, power overview, solar, ticks, and module status are covered.
- Success criteria: React/TypeScript, both themes, API-only browser state, registration controls, module power/status, power balance, tick presets/custom input, loading/empty/error states, and CLI parity are covered.
- Non-goals: construction, inventory, crew, EVA, direct Kepler, database access, publication, and commits are explicitly excluded.
