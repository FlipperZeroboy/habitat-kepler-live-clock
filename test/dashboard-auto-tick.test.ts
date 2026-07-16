import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoTickControl } from "../web/src/App";
import { createAutoTickScheduler } from "../web/src/use-auto-tick";

test("runs one immediate tick and one tick per interval", async () => {
  const calls: number[] = [];
  let intervalCallback: (() => void) | undefined;

  const scheduler = createAutoTickScheduler({
    tick: async () => {
      calls.push(1);
      return true;
    },
    isManualAllowed: () => true,
    setIntervalImpl: (callback) => {
      intervalCallback = callback;
      return 1 as ReturnType<typeof setInterval>;
    },
    clearIntervalImpl: () => {},
  });

  scheduler.start();
  await Promise.resolve();
  intervalCallback?.();
  await Promise.resolve();

  expect(calls).toEqual([1, 1]);
});

test("does not start while manual ticks are unavailable", () => {
  let calls = 0;

  const scheduler = createAutoTickScheduler({
    tick: async () => {
      calls += 1;
      return true;
    },
    isManualAllowed: () => false,
    setIntervalImpl: () => 1 as ReturnType<typeof setInterval>,
    clearIntervalImpl: () => {},
  });

  scheduler.start();

  expect(calls).toBe(0);
  expect(scheduler.running()).toBe(false);
});

test("stops after a tick failure and reports the error", async () => {
  let errorCalls = 0;
  let clearCalls = 0;

  const scheduler = createAutoTickScheduler({
    tick: async () => false,
    isManualAllowed: () => true,
    onError: () => {
      errorCalls += 1;
    },
    setIntervalImpl: () => 1 as ReturnType<typeof setInterval>,
    clearIntervalImpl: () => {
      clearCalls += 1;
    },
  });

  scheduler.start();
  await Promise.resolve();

  expect(scheduler.running()).toBe(false);
  expect(errorCalls).toBe(1);
  expect(clearCalls).toBe(1);
});

test("skips overlapping interval callbacks while a tick is still running", async () => {
  let intervalCallback: (() => void) | undefined;
  let resolveTick: ((value: boolean) => void) | undefined;
  let calls = 0;

  const scheduler = createAutoTickScheduler({
    tick: () => {
      calls += 1;
      return new Promise<boolean>((resolve) => {
        resolveTick = resolve;
      });
    },
    isManualAllowed: () => true,
    setIntervalImpl: (callback) => {
      intervalCallback = callback;
      return 1 as ReturnType<typeof setInterval>;
    },
    clearIntervalImpl: () => {},
  });

  scheduler.start();
  intervalCallback?.();
  intervalCallback?.();
  await Promise.resolve();

  expect(calls).toBe(1);

  resolveTick?.(true);
  await Promise.resolve();
});

test("renders auto-tick control with manual mode and start action", () => {
  const html = renderToStaticMarkup(
    createElement(AutoTickControl, {
      mode: "manual",
      manualTicksAllowed: true,
      mutating: false,
      running: false,
      onToggle: () => {},
    }),
  );

  expect(html).toContain("Clock mode: Manual");
  expect(html).toContain("Auto Tick off");
  expect(html).toContain("One in-game tick per second");
  expect(html).toContain("Start Auto Tick");
  expect(html).not.toContain("disabled");
});

test("renders disabled auto-tick control while Kepler listening is on", () => {
  const html = renderToStaticMarkup(
    createElement(AutoTickControl, {
      mode: "kepler",
      manualTicksAllowed: false,
      mutating: false,
      running: true,
      onToggle: () => {},
    }),
  );

  expect(html).toContain("Clock mode: Kepler");
  expect(html).toContain("Auto Tick on");
  expect(html).toContain("Unavailable while Kepler listening is on");
  expect(html).toContain("Stop Auto Tick");
  expect(html).toContain("disabled");
});
