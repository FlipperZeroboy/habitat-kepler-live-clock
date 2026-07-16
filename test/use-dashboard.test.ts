import { expect, test } from "bun:test";
import { createSharedTickOperationGuard, runDashboardMutation } from "../web/src/use-dashboard";

test("refreshes after a failed tick and preserves the original error message", async () => {
  const calls: string[] = [];

  const result = await runDashboardMutation({
    operation: async () => {
      calls.push("tick");
      throw new Error("Manual ticks are unavailable while Kepler listening is enabled. Run `habitat clock listen off` first.");
    },
    refresh: async () => {
      calls.push("refresh");
    },
    refreshOnError: true,
  });

  expect(calls).toEqual(["tick", "refresh"]);
  expect(result).toEqual({
    ok: false,
    errorMessage: "Manual ticks are unavailable while Kepler listening is enabled. Run `habitat clock listen off` first.",
  });
});

test("returns false instead of rejecting when the refresh after a failed tick also fails", async () => {
  const result = await runDashboardMutation({
    operation: async () => {
      throw new Error("Backend request failed with HTTP 409.");
    },
    refresh: async () => {
      throw new Error("Could not reach the Habitat backend. Start it with `bun run server`.");
    },
    refreshOnError: true,
  });

  expect(result).toEqual({
    ok: false,
    errorMessage: "Backend request failed with HTTP 409.",
  });
});

test("returns false when the refresh after a successful tick fails", async () => {
  let refreshCalls = 0;

  const result = await runDashboardMutation({
    operation: async () => {
      return { ok: true };
    },
    refresh: async () => {
      refreshCalls += 1;
      throw new Error("Could not reach the Habitat backend. Start it with `bun run server`.");
    },
    refreshOnError: true,
  });

  expect(refreshCalls).toBe(1);
  expect(result).toEqual({
    ok: false,
    errorMessage: "Could not reach the Habitat backend. Start it with `bun run server`.",
  });
});

test("shared tick operation guard reuses the in-flight tick promise for concurrent requests", async () => {
  let resolveOperation: ((value: boolean) => void) | undefined;
  const counts: number[] = [];
  const guardedTick = createSharedTickOperationGuard(async (count: number) => {
    counts.push(count);
    return await new Promise<boolean>((resolve) => {
      resolveOperation = resolve;
    });
  });

  const firstTick = guardedTick(60);
  const secondTick = guardedTick(1);

  expect(firstTick).toBe(secondTick);
  expect(counts).toEqual([60]);

  resolveOperation?.(true);

  expect(await firstTick).toBe(true);
  expect(await secondTick).toBe(true);

  const thirdTick = guardedTick(10);
  expect(thirdTick).not.toBe(firstTick);
  expect(counts).toEqual([60, 10]);
});
