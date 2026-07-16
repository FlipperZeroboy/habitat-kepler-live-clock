# Habitat Dashboard Auto-Tick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard-only Auto Tick control that advances one local in-game tick every real-world second through the existing Habitat API.

**Architecture:** Extend the dashboard API client and state model with `GET /clock/status`. Add a focused auto-tick hook that owns a one-second timer, runs one immediate tick, prevents overlapping requests, and stops on errors or when manual ticks become unavailable. Keep Kepler connectivity in the Hono backend; the dashboard never opens a Kepler WebSocket.

**Tech Stack:** Bun, TypeScript, React, Vite, Hono local REST API, Bun test.

## Global Constraints

- Auto Tick advances exactly one in-game tick per cycle.
- Each cycle occurs once per real-world second.
- Auto Tick is session-scoped and is not persisted.
- Auto Tick is unavailable while the backend reports Kepler listening enabled.
- A backend HTTP 409 stops Auto Tick and refreshes dashboard state.
- All dashboard requests use the local Habitat API; the dashboard never connects directly to Kepler.
- Preserve existing CLI, backend, SQLite, manual tick, and Kepler live-clock behavior.

---

### Task 1: Add clock status to the dashboard data flow

**Files:**
- Modify: `/Users/tshekou/labs/habitat-cli/web/src/types.ts`
- Modify: `/Users/tshekou/labs/habitat-cli/web/src/api.ts`
- Modify: `/Users/tshekou/labs/habitat-cli/web/src/use-dashboard.ts`

**Interfaces:**
- Consume the existing `GET /clock/status` response from the local backend.
- Produce `DashboardData.clock` with `mode`, `listening`, `manualTicksAllowed`, `connectionStatus`, and the persisted tick/error fields.

- [ ] **Step 1: Define dashboard clock types**

Add these types to `web/src/types.ts`:

```ts
export type ClockStatus = {
  mode: "manual" | "kepler";
  connected: boolean;
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";
  lastKeplerTick: number | null;
  lastAdvancedBy: number | null;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
  lastConnectionError: string | null;
  listening: boolean;
  manualTicksAllowed: boolean;
};

export type ClockStatusResponse = { clock: ClockStatus };
```

Add `clock: ClockStatus` to `DashboardData`.

- [ ] **Step 2: Add the local clock-status API call**

Import `ClockStatusResponse` in `web/src/api.ts` and add:

```ts
clockStatus: () => request<ClockStatusResponse>("/clock/status"),
```

Keep `tick(count)` unchanged so the dashboard continues to use `POST /ticks`.

- [ ] **Step 3: Load clock status during refresh**

Update `useDashboard.refresh` to request clock status with registration, status, and power data:

```ts
const [status, power, clockStatus] = await Promise.all([
  api.status(),
  api.powerOverview(),
  api.clockStatus(),
]);

setState({
  data: {
    registration: registrationResponse.registration,
    status: status.status,
    power,
    clock: clockStatus.clock,
  },
  registered: true,
  loading: false,
  mutating: null,
  error: null,
});
```

- [ ] **Step 4: Run the dashboard typecheck**

Run:

```sh
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit the data-flow changes**

```sh
git add web/src/types.ts web/src/api.ts web/src/use-dashboard.ts
git commit -m "Expose clock status to the dashboard"
```

### Task 2: Implement the one-second auto-tick hook

**Files:**
- Create: `/Users/tshekou/labs/habitat-cli/web/src/use-auto-tick.ts`
- Create: `/Users/tshekou/labs/habitat-cli/test/dashboard-auto-tick.test.ts`

**Interfaces:**
- Consume a `tick()` callback that advances exactly one tick and returns `Promise<boolean>`, the current `manualTicksAllowed` value, and an error callback.
- Produce `{ running, start, stop }` for the dashboard component.

- [ ] **Step 1: Write focused scheduler tests**

Test the scheduler’s observable contract with injected timer functions and a fake tick function:

```ts
import { describe, expect, test } from "bun:test";
import { createAutoTickScheduler } from "../web/src/use-auto-tick";

test("runs one immediate tick and one tick per interval", async () => {
  const calls: number[] = [];
  const scheduler = createAutoTickScheduler({
    tick: async () => { calls.push(1); return true; },
    isManualAllowed: () => true,
    setIntervalImpl: (callback) => { void callback(); return 1; },
    clearIntervalImpl: () => {},
  });

  scheduler.start();
  await Promise.resolve();
  expect(calls).toEqual([1, 1]);
});

test("does not start while manual ticks are unavailable", () => {
  let calls = 0;
  const scheduler = createAutoTickScheduler({
    tick: async () => { calls += 1; return true; },
    isManualAllowed: () => false,
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  scheduler.start();
  expect(calls).toBe(0);
  expect(scheduler.running()).toBe(false);
});

test("stops after a tick failure and reports the error", async () => {
  let stopped = false;
  const scheduler = createAutoTickScheduler({
    tick: async () => false,
    isManualAllowed: () => true,
    onError: () => { stopped = true; },
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  scheduler.start();
  await Promise.resolve();
  expect(scheduler.running()).toBe(false);
  expect(stopped).toBe(true);
});
```

The test doubles must also verify that a second timer callback does not invoke `tick` while the first tick promise is unresolved.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```sh
bun test test/dashboard-auto-tick.test.ts
```

Expected: FAIL because `createAutoTickScheduler` does not exist yet.

- [ ] **Step 3: Implement the scheduler and React hook**

Implement `createAutoTickScheduler` with these exact rules:

```ts
export type AutoTickSchedulerOptions = {
  tick: () => Promise<boolean>;
  isManualAllowed: () => boolean;
  onError?: (error: unknown) => void;
  setIntervalImpl?: (callback: () => void, delay: number) => ReturnType<typeof setInterval>;
  clearIntervalImpl?: (handle: ReturnType<typeof setInterval>) => void;
};
```

`start()` must return without scheduling when `isManualAllowed()` is false. Otherwise it starts a one-second interval and immediately invokes the tick operation. The in-flight guard skips overlapping callbacks. A `true` result means one tick was applied; a `false` result or rejected promise clears the interval, marks the scheduler stopped, and calls `onError`. `stop()` clears the interval and prevents future work.

The `useAutoTick` hook should create the scheduler with `useRef`, expose reactive `running`, `start`, and `stop` functions, and clean up with `stop()` on unmount. Its options are `{ tick: () => Promise<boolean>; manualTicksAllowed: boolean }`. The controller’s `advanceTicks` call already records any API error in dashboard state, so the hook only needs an optional `onError` callback for scheduler-level failures.

- [ ] **Step 4: Run the focused tests**

Run:

```sh
bun test test/dashboard-auto-tick.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the scheduler**

```sh
git add web/src/use-auto-tick.ts test/dashboard-auto-tick.test.ts
git commit -m "Add dashboard auto-tick scheduler"
```

### Task 3: Add the dashboard control and mode-aware UI

**Files:**
- Modify: `/Users/tshekou/labs/habitat-cli/web/src/App.tsx`
- Modify: `/Users/tshekou/labs/habitat-cli/web/src/styles.css`

**Interfaces:**
- Consume `controller.data.clock` and `controller.advanceTicks`.
- Produce visible Auto Tick status and start/stop controls in the existing Simulation control panel.

- [ ] **Step 1: Add the control markup**

In the simulation panel, display the current clock mode and a button with these states:

```tsx
<div className="auto-tick-control" aria-live="polite">
  <div>
    <p className="eyebrow">Automatic simulation</p>
    <strong>{autoTick.running ? "Auto Tick on" : "Auto Tick off"}</strong>
    <span className="muted">
      {data.clock.manualTicksAllowed ? "One in-game tick per second" : "Unavailable while Kepler listening is on"}
    </span>
  </div>
  <button
    className="button button-primary"
    disabled={!data.clock.manualTicksAllowed || controller.mutating !== null}
    onClick={() => autoTick.running ? autoTick.stop() : autoTick.start()}
  >
    {autoTick.running ? "Stop Auto Tick" : "Start Auto Tick"}
  </button>
</div>
```

Use an explicit `autoTickRunning` React state exposed by the hook so React re-renders when the scheduler starts or stops; do not call `running()` directly from JSX.

- [ ] **Step 2: Wire the hook to dashboard state**

Change `useDashboard.mutate` to return `true` after a successful operation and `false` after an operation fails, while preserving its existing error-state update. Change `advanceTicks` to return that boolean promise:

```ts
const mutate = useCallback(async (label: string, operation: () => Promise<unknown>) => {
  setState((current) => ({ ...current, mutating: label, error: null }));
  try {
    await operation();
    await refresh();
    return true;
  } catch (error) {
    setState((current) => ({ ...current, mutating: null, error: messageFor(error) }));
    return false;
  }
}, [refresh]);

const advanceTicks = useCallback(
  (count: number) => mutate(`tick:${count}`, () => api.tick(count)),
  [api, mutate],
);
```

Create the hook in `Dashboard` with a tick adapter that advances exactly one tick through the controller:

```ts
const autoTick = useAutoTick({
  tick: () => controller.advanceTicks(1),
  manualTicksAllowed: data.clock.manualTicksAllowed,
});
```

If the backend refresh reports `manualTicksAllowed: false` while Auto Tick is running, stop it in an effect. Preserve the existing preset and custom tick controls; their requests remain backend-protected and should be disabled while `controller.mutating` is active. `controller.advanceTicks(1)` already refreshes status and power after success, so the auto-tick hook must not issue a second refresh.

- [ ] **Step 3: Add responsive styling**

Add `.auto-tick-control` styles matching the existing panel controls: a bordered, horizontally spaced control row that stacks at the existing mobile breakpoint. Include readable disabled-state styling and preserve both dark and light themes.

- [ ] **Step 4: Build the dashboard**

Run:

```sh
bun run build:web
```

Expected: Vite completes successfully and updates `web/dist` if the repository tracks built assets.

- [ ] **Step 5: Commit the dashboard control**

```sh
git add web/src/App.tsx web/src/styles.css web/src/use-dashboard.ts
git commit -m "Add dashboard auto-tick control"
```

### Task 4: Verify the integrated capability and publish

**Files:**
- Modify: `/Users/tshekou/labs/habitat-cli/web/dist/*` only if the project’s existing workflow tracks generated assets.

- [ ] **Step 1: Run all automated checks**

```sh
bun --no-env-file test
bunx tsc --noEmit
bun run build:web
git diff --check
```

Expected: all tests pass, typechecking succeeds, the dashboard build succeeds, and `git diff --check` produces no output.

- [ ] **Step 2: Verify manual auto-tick through the dashboard**

Start the backend:

```sh
export HABITAT_API_BASE_URL=http://127.0.0.1:8787
bun run server
```

With `habitat clock listen off`, open the dashboard and confirm:

- Auto Tick is enabled.
- Starting it advances the displayed current tick by one every second.
- Battery/power values refresh after each tick.
- Stopping it prevents further changes.

- [ ] **Step 3: Verify Kepler-mode protection**

In another terminal:

```sh
export HABITAT_API_BASE_URL=http://127.0.0.1:8787
habitat clock listen on
```

Confirm the dashboard disables Auto Tick after refresh. If Auto Tick was already running, confirm the backend’s 409 response stops it. Confirm the dashboard does not open a second Kepler connection.

- [ ] **Step 4: Restore safe testing mode**

```sh
habitat clock listen off
habitat clock status
```

Expected: manual mode, listening off, manual ticks allowed.

- [ ] **Step 5: Inspect and commit final changes**

```sh
git status --short
git diff --stat
git add web docs/superpowers/specs/2026-07-16-dashboard-auto-tick-design.md docs/superpowers/plans/2026-07-16-dashboard-auto-tick.md
git commit -m "Add Habitat dashboard auto-tick mode"
```

- [ ] **Step 6: Push the existing published repository**

```sh
git push github HEAD
```

Verify the commit appears at:

```text
https://github.com/FlipperZeroboy/habitat-kepler-live-clock
```
