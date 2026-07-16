import { expect, test } from "bun:test";
import { runDashboardMutation } from "../web/src/use-dashboard";

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
