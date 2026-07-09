#!/usr/bin/env bun

import { Command } from "commander";
import pkg from "../package.json";
import {
  checkLocalConfig,
  getLocalStatusSummary,
  getRegistrationStatus,
  registerHabitat,
  tickHabitat,
  unregisterHabitat,
} from "./habitat";
import { createBlueprintCommand } from "./commands/blueprint";
import { createConstructCommand } from "./commands/construct";
import { createConstructionCommand } from "./commands/construction";
import { createInventoryCommand } from "./commands/inventory";
import { createModuleCommand } from "./commands/module";
import { createResourceCommand } from "./commands/resource";
import { formatNumber, parseTickCount, printError } from "./cli-utils";

const program = new Command();

program
  .name("habitat")
  .description("Register and manage this local Habitat CLI with the Kepler Planet Server.")
  .version(pkg.version)
  .showHelpAfterError("(run `habitat --help` for usage)")
  .addHelpText(
    "after",
    `

Configuration:
  Reads KEPLER_BASE_URL and KEPLER_PLANET_TOKEN from .env.
  Stores registration data in .habitat/registration.json.

Examples:
  habitat register --name "Artemis Ridge"
  habitat status
  habitat unregister
  habitat config
  habitat tick 60
  habitat blueprint list
  habitat construct small-solar-array --dry-run
  habitat construction status
  habitat inventory add ferrite 90
  habitat inventory list
  habitat resource list
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
      console.log(`Registration File: ${config.registrationFile}`);
    } catch (error) {
      printError(error);
    }
  });

program
  .command("register")
  .description("Register this habitat with the Kepler Planet Server.")
  .requiredOption("--name <habitat name>", "Habitat display name")
  .action(async (options: { name: string }) => {
    try {
      const registration = await registerHabitat(options.name);
      console.log(`Registered habitat: ${registration.displayName}`);
      console.log(`Habitat ID: ${registration.habitatId}`);
      console.log("Local registration: .habitat/registration.json");
    } catch (error) {
      printError(error);
    }
  });

program
  .command("status")
  .description("Show this habitat registration status from Kepler.")
  .action(async () => {
    try {
      const status = await getRegistrationStatus();
      const summary = await getLocalStatusSummary();
      const habitat = status.habitat;

      console.log(`Habitat ID: ${habitat.id}`);
      console.log(`Slug: ${habitat.habitatSlug}`);
      console.log(`Name: ${habitat.displayName}`);
      console.log(`Catalog Version: ${habitat.catalogVersion}`);
      console.log(`Status: ${habitat.status}`);
      console.log(`Last Seen: ${habitat.lastSeenAt ?? "never"}`);
      console.log(`Current Tick: ${summary.currentTick}`);
      console.log(`Modules: ${summary.moduleCount}`);
      console.log(`Total Power Draw: ${formatNumber(summary.powerSummary.totalPowerDrawKw)} kW`);
      console.log(
        `Battery Energy: ${formatNumber(summary.powerSummary.batteryEnergyKwh)} / ${formatNumber(summary.powerSummary.batteryCapacityKwh)} kWh`,
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
      const result = await tickHabitat(count);

      console.log(`Ticks Advanced: ${result.ticksAdvanced}`);
      console.log(`Current Tick: ${result.currentTick}`);
      console.log(`Total Power Draw: ${formatNumber(result.totalPowerDrawKw)} kW`);
      console.log(`Energy Used: ${formatNumber(result.energyUsedKwh)} kWh`);
      console.log(
        `Battery Energy: ${formatNumber(result.batteryEnergyKwh)} / ${formatNumber(result.batteryCapacityKwh)} kWh`,
      );
      console.log(`Power Shortage: ${formatNumber(result.powerShortageKwh)} kWh`);

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

program
  .command("unregister")
  .description("Unregister this habitat from Kepler and remove the local registration file.")
  .action(async () => {
    try {
      const result = await unregisterHabitat();
      console.log(`Unregistered habitat: ${result.habitatId}`);
      console.log("Removed local registration: .habitat/registration.json");
    } catch (error) {
      printError(error);
    }
  });

program.addCommand(createBlueprintCommand());
program.addCommand(createConstructCommand());
program.addCommand(createConstructionCommand());
program.addCommand(createInventoryCommand());
program.addCommand(createResourceCommand());
program.addCommand(createModuleCommand());

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
