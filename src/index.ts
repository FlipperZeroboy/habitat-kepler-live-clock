#!/usr/bin/env bun

import { Command } from "commander";
import pkg from "../package.json";
import {
  checkLocalConfig,
} from "./habitat";
import { createApiClient, type ClockStatusResponse, type RegistrationResponse, type StatusResponse, type TickResponse } from "./api-client";
import { createBlueprintCommand } from "./commands/blueprint";
import { createConstructCommand } from "./commands/construct";
import { createConstructionCommand } from "./commands/construction";
import { createInventoryCommand } from "./commands/inventory";
import { createHumanCommand } from "./commands/human";
import { createEvaCommand } from "./commands/eva";
import { createCollectCommand } from "./commands/collect";
import { createAlertCommand } from "./commands/alert";
import { createModuleCommand } from "./commands/module";
import { createPowerCommand } from "./commands/power";
import { createResourceCommand } from "./commands/resource";
import { createScanCommand } from "./commands/scan";
import { createSolarCommand } from "./commands/solar";
import { formatNumber, parseTickCount, printError } from "./cli-utils";

const globalJsonRequested = process.argv[2] === "--json";
if (globalJsonRequested) {
  process.argv.splice(2, 1);
}

const program = new Command();
const apiClient = createApiClient();

program
  .name("habitat")
  .description("Register and manage this local Habitat CLI with the Kepler Planet Server.")
  .version(pkg.version)
  .showHelpAfterError("(run `habitat --help` for usage)")
  .addHelpText(
    "after",
    `

Configuration:
  CLI calls the local backend at HABITAT_API_BASE_URL (default: http://localhost:8787).
  The backend reads KEPLER_BASE_URL and KEPLER_PLANET_TOKEN from .env.
  The backend stores local Habitat state in .habitat/habitat.sqlite.

Examples:
  habitat register --name "Artemis Ridge"
  habitat status
  habitat unregister
  habitat config
  habitat solar status
  habitat tick 60
  habitat clock status
  habitat clock listen on
  habitat clock listen off
  habitat clock watch
  habitat power overview
  habitat power status
  habitat blueprint list
  habitat construct small-solar-array --dry-run
  habitat construction status
  habitat inventory add ferrite 90
  habitat inventory remove ferrite 10
  habitat inventory list
  habitat resource list
  habitat scan --x 3 --y -2 --strength 60
  habitat human list
  habitat eva status
  habitat collect <quantity-kg>
  habitat alert list
  habitat module list`,
  );

program
  .command("config")
  .description("Check local Kepler configuration without contacting Kepler.")
  .action(async () => {
    try {
      const config = await checkLocalConfig();
      console.log(`Base URL: ${config.baseUrl}`);
      console.log(`Token Loaded: ${config.tokenLoaded ? "yes" : "no"}`);
      console.log(`Database File: ${config.databaseFile}`);
    } catch (error) {
      printError(error);
    }
  });

program
  .command("register")
  .description("Register this habitat through the local Habitat backend.")
  .requiredOption("--name <habitat name>", "Habitat display name")
  .action(async (options: { name: string }) => {
    try {
      const response = await apiClient.post<RegistrationResponse>("/registration", {
        displayName: options.name,
      });
      const registration = response.registration;

      if (!registration) {
        throw new Error("Backend registration did not return a registration.");
      }

      console.log(`Registered habitat: ${registration.displayName}`);
      console.log(`Habitat ID: ${registration.habitatId}`);
      console.log("Local state database: .habitat/habitat.sqlite");
    } catch (error) {
      printError(error);
    }
  });

program
  .command("status")
  .description("Show this habitat registration and local state status.")
  .option("--json", "Print status as JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const response = await apiClient.get<StatusResponse>("/status");
      if (options.json || globalJsonRequested) {
        console.log(JSON.stringify(response.status, null, 2));
        return;
      }
      const { habitat, currentTick, moduleCount, powerSummary } = response.status;

      console.log(`Habitat ID: ${habitat.id}`);
      console.log(`Slug: ${habitat.habitatSlug}`);
      console.log(`Name: ${habitat.displayName}`);
      console.log(`Catalog Version: ${habitat.catalogVersion}`);
      console.log(`Status: ${habitat.status}`);
      console.log(`Last Seen: ${habitat.lastSeenAt ?? "never"}`);
      console.log(`Current Tick: ${currentTick}`);
      console.log(`Stream URL: ${response.status.streamUrl ?? "not available"}`);
      console.log(`Stream API Token: ${response.status.apiToken ?? "not available"}`);
      console.log(`Stream Subscriptions: ${response.status.stream?.subscriptions?.join(", ") ?? "not available"}`);
      if (response.status.stream) {
        console.log(
          `Planet Clock: ${response.status.stream.status} (tick ${response.status.stream.currentTick}, ${response.status.stream.ticksPerPulse} ticks/pulse, ${response.status.stream.tickIntervalMs} ms interval)`,
        );
      } else {
        console.log("Planet Clock: not available");
      }
      console.log(`Clock Mode: ${response.status.clock?.mode ?? "manual"}`);
      console.log(`Modules: ${moduleCount}`);
      console.log(`Total Power Draw: ${formatNumber(powerSummary.totalPowerDrawKw)} kW`);
      console.log(
        `Battery Energy: ${formatNumber(powerSummary.batteryEnergyKwh)} / ${formatNumber(powerSummary.batteryCapacityKwh)} kWh`,
      );
    } catch (error) {
      printError(error);
    }
  });

program
  .command("tick")
  .description("Advance the local habitat power simulation by one-second ticks.")
  .argument("<count>", "Positive integer number of one-second ticks", parseTickCount)
  .action(async (count: number) => {
    try {
      const result = (await apiClient.post<TickResponse>("/ticks", { count })).tick;

      console.log(`Ticks Advanced: ${result.ticksAdvanced}`);
      console.log(`Current Tick: ${result.currentTick}`);
      console.log(`Total Power Draw: ${formatNumber(result.totalPowerDrawKw)} kW`);
      console.log(`Energy Used: ${formatNumber(result.energyUsedKwh)} kWh`);
      console.log(
        `Battery Energy: ${formatNumber(result.batteryEnergyKwh)} / ${formatNumber(result.batteryCapacityKwh)} kWh`,
      );
      console.log(`Power Shortage: ${formatNumber(result.powerShortageKwh)} kWh`);
      console.log(`Solar Generated: ${formatNumber(result.solarGeneratedKwh)} kWh`);
      if (result.solarChargedKwh > 0) {
        console.log(`Solar Charged: ${formatNumber(result.solarChargedKwh)} kWh`);
      } else {
        console.log(`Solar Charging: none (${result.solarChargingReason})`);
      }

      if (result.batteryCapacityKwh > 0 && result.batteryEnergyKwh <= 0) {
        console.log("No usable battery energy remains.");
      }

      if (result.completedConstructionJobs.length > 0) {
        console.log("Construction Completed:");

        for (const job of result.completedConstructionJobs) {
          console.log(`${job.blueprintId} -> ${job.outputModuleId}`);
          console.log(`Facility Available: ${job.facilityName}`);
        }
      }
    } catch (error) {
      printError(error);
    }
  });

const clock = program.command("clock").description("Control Kepler live clock listening.");

clock
  .command("status")
  .description("Show the persisted Habitat clock mode and connection state.")
  .option("--json", "Print clock status as JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const { clock: state } = await apiClient.get<ClockStatusResponse>("/clock/status");
      if (options.json || globalJsonRequested) {
        console.log(JSON.stringify(state, null, 2));
        return;
      }
      const listening = state.listening ?? state.mode === "kepler";
      const manualTicksAllowed = state.manualTicksAllowed ?? state.mode === "manual";
      console.log(`Clock Mode: ${state.mode}`);
      console.log(`Listening: ${listening ? "on" : "off"}`);
      console.log(`Manual Ticks Allowed: ${manualTicksAllowed ? "yes" : "no"}`);
      console.log(`Connection Status: ${state.connectionStatus ?? (state.connected ? "connected" : "disconnected")}`);
      console.log(`Kepler Connected: ${state.connected ? "yes" : "no"}`);
      console.log(`Last Kepler Tick: ${state.lastKeplerTick ?? "never"}`);
      console.log(`Last Advanced By: ${state.lastAdvancedBy ?? "never"}`);
      console.log(`Last Connected: ${state.lastConnectedAt ?? "never"}`);
      console.log(`Last Message: ${state.lastMessageAt ?? "never"}`);
      console.log(`Last Connection Error: ${state.lastConnectionError ?? "none"}`);
    } catch (error) {
      printError(error);
    }
  });

const listen = clock.command("listen").description("Enable or disable Kepler tick listening.");

for (const [name, enabled] of [["on", true], ["off", false]] as const) {
  listen
    .command(name)
    .description(`${enabled ? "Enable" : "Disable"} Kepler tick listening.`)
    .action(async () => {
      try {
        const response = await apiClient.post<ClockStatusResponse>("/clock/listen", { enabled });
        console.log(`Clock listening: ${response.clock.mode}`);
      } catch (error) {
        printError(error);
      }
    });
}

clock
  .command("watch")
  .description("Watch future Kepler ticks applied by the local Habitat backend.")
  .action(async () => {
    const abortController = new AbortController();
    const stop = () => abortController.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      const response = await fetch(`${apiClient.baseUrl}/clock/watch`, { signal: abortController.signal });
      if (!response.ok || !response.body) {
        throw new Error(`Could not open the local Habitat clock watch (HTTP ${response.status}).`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const data = event.split("\n").find((line) => line.startsWith("data: "));
          if (data) console.log(data.slice(6));
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        printError(error);
      }
    } finally {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
  });

program
  .command("unregister")
  .description("Unregister this habitat through the backend and remove local SQLite state.")
  .action(async () => {
    try {
      const response = await apiClient.delete<RegistrationResponse>("/registration");
      console.log(`Unregistered habitat: ${response.habitatId ?? response.registration?.habitatId ?? "local habitat"}`);
      console.log("Removed local state database: .habitat/habitat.sqlite");
    } catch (error) {
      printError(error);
    }
  });

program.addCommand(createBlueprintCommand());
program.addCommand(createConstructCommand());
program.addCommand(createConstructionCommand());
program.addCommand(createInventoryCommand());
program.addCommand(createHumanCommand());
program.addCommand(createEvaCommand());
program.addCommand(createCollectCommand());
program.addCommand(createAlertCommand());
program.addCommand(createResourceCommand());
program.addCommand(createScanCommand());
program.addCommand(createSolarCommand());
program.addCommand(createModuleCommand());
program.addCommand(createPowerCommand());

program
  .command("* [commandParts...]", { hidden: true })
  .description("Handle unknown commands.")
  .allowUnknownOption(true)
  .action((commandParts: string[]) => {
    const commandName = commandParts.join(" ");
    console.error(`Unknown command: ${commandName}`);
    console.error("Try `habitat --help`.");
    process.exitCode = 1;
  });

await program.parseAsync();
