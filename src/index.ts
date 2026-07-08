#!/usr/bin/env bun

import { Command } from "commander";
import pkg from "../package.json";
import {
  checkLocalConfig,
  createModule,
  deleteModule,
  getLocalStatusSummary,
  getRegistrationStatus,
  listModules,
  registerHabitat,
  setModuleStatus,
  showModule,
  tickHabitat,
  unregisterHabitat,
  updateModule,
  type HabitatModule,
} from "./habitat";

const program = new Command();

function printError(error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseHealth(value: string) {
  const health = Number(value);

  if (Number.isNaN(health)) {
    throw new Error("health must be a number");
  }

  return health;
}

function parseTickCount(value: string) {
  const count = Number(value);

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("tick count must be a positive integer");
  }

  return count;
}

function formatNumber(value: number) {
  return Number(value.toFixed(5)).toString();
}

function moduleStatus(module: HabitatModule) {
  return String(module.runtimeAttributes.status ?? "unknown");
}

function moduleHealth(module: HabitatModule) {
  return String(module.runtimeAttributes.health ?? "unknown");
}

function modulePowerDrawKw(module: HabitatModule) {
  const status = moduleStatus(module);
  const powerDrawKw = module.runtimeAttributes.powerDrawKw;

  if (!powerDrawKw || typeof powerDrawKw !== "object" || Array.isArray(powerDrawKw)) {
    return 0;
  }

  const draw = (powerDrawKw as Record<string, unknown>)[status];
  return typeof draw === "number" && Number.isFinite(draw) ? draw : 0;
}

function printModuleStatusTable(modules: HabitatModule[]) {
  const rows = modules.map((module) => ({
    name: module.displayName,
    state: moduleStatus(module),
    powerDrawKw: modulePowerDrawKw(module),
  }));
  const nameWidth = Math.max("Module".length, ...rows.map((row) => row.name.length));
  const stateWidth = Math.max("State".length, ...rows.map((row) => row.state.length));
  const totalPowerDrawKw = rows.reduce((total, row) => total + row.powerDrawKw, 0);
  const energyCostPerTickKwh = totalPowerDrawKw / 3600;

  console.log(`${"Module".padEnd(nameWidth)}  ${"State".padEnd(stateWidth)}  Power Draw`);
  console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(stateWidth)}  ----------`);

  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth)}  ${row.state.padEnd(stateWidth)}  ${formatNumber(row.powerDrawKw)} kW`,
    );
  }

  console.log("");
  console.log(`Total Power Draw: ${formatNumber(totalPowerDrawKw)} kW`);
  console.log(`Energy Cost Per Tick: ${formatNumber(energyCostPerTickKwh)} kWh`);
}

function printModule(module: HabitatModule) {
  console.log(`ID: ${module.id}`);
  console.log(`Habitat ID: ${module.habitatId}`);
  console.log(`Blueprint ID: ${module.blueprintId}`);
  console.log(`Module Type: ${module.moduleType}`);
  console.log(`Name: ${module.displayName}`);
  console.log(`Source: ${module.source}`);
  console.log(`Status: ${moduleStatus(module)}`);
  console.log(`Health: ${moduleHealth(module)}`);
  console.log(`Capabilities: ${module.capabilities.length > 0 ? module.capabilities.join(", ") : "none"}`);
  console.log(`Connected To: ${module.connectedTo.length > 0 ? module.connectedTo.join(", ") : "none"}`);
  console.log(`Runtime Attributes: ${JSON.stringify(module.runtimeAttributes)}`);
}

function moduleHandle(module: HabitatModule, modules: HabitatModule[]) {
  const sameTypeModules = modules.filter(
    (entry) => entry.moduleType === module.moduleType,
  );
  const typeIndex = sameTypeModules.indexOf(module) + 1;

  return `${module.moduleType}-${typeIndex}`;
}

async function resolveModuleId(handle: string) {
  const modules = await listModules();
  const index = Number(handle);

  if (Number.isInteger(index) && index > 0 && String(index) === handle) {
    const module = modules[index - 1];

    if (!module) {
      throw new Error(`Module number not found: ${handle}`);
    }

    return module.id;
  }

  const module = modules.find((entry) => moduleHandle(entry, modules) === handle);

  if (module) {
    return module.id;
  }

  return handle;
}

const moduleCommand = new Command("module")
  .description("Manage local Habitat modules.")
  .summary("CRUD for local modules");

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

moduleCommand
  .command("list")
  .description("List local modules as: id | blueprintId | displayName | status | health.")
  .action(async () => {
    try {
      const modules = await listModules();

      if (modules.length === 0) {
        console.log("No modules found.");
        return;
      }

      for (const module of modules) {
        const index = modules.indexOf(module) + 1;
        console.log(
          `${index} | ${moduleHandle(module, modules)} | ${module.displayName} | ${moduleStatus(module)} | ${moduleHealth(module)}`,
        );
      }
    } catch (error) {
      printError(error);
    }
  });

moduleCommand
  .command("status")
  .description("Show each module's current state and power draw.")
  .action(async () => {
    try {
      const modules = await listModules();

      if (modules.length === 0) {
        console.log("No modules found.");
        return;
      }

      printModuleStatusTable(modules);
    } catch (error) {
      printError(error);
    }
  });

moduleCommand
  .command("set-status")
  .description("Set one local module runtime state.")
  .argument("<module-id>", "Module id, number from list, or friendly module handle")
  .argument("<status>", "One of: offline, idle, online, active, damaged")
  .action(async (moduleHandle: string, status: string) => {
    try {
      const id = await resolveModuleId(moduleHandle);
      const module = await setModuleStatus(id, status);
      console.log(`Updated module ${module.id} to ${moduleStatus(module)}.`);
      console.log(`Current Power Draw: ${formatNumber(modulePowerDrawKw(module))} kW`);
    } catch (error) {
      printError(error);
    }
  });

moduleCommand
  .command("show")
  .description("Show one local module by id.")
  .argument("<module>", "Module number from list, or full module id")
  .action(async (moduleHandle: string) => {
    try {
      const id = await resolveModuleId(moduleHandle);
      printModule(await showModule(id));
    } catch (error) {
      printError(error);
    }
  });

moduleCommand
  .command("create")
  .description("Create a local module from a saved module blueprint.")
  .requiredOption("--blueprint-id <id>", "Saved blueprint id")
  .option("--name <name>", "Module display name")
  .action(async (options: { blueprintId: string; name?: string }) => {
    try {
      const module = await createModule({
        blueprintId: options.blueprintId,
        name: options.name,
      });
      console.log(`Created module: ${module.id}`);
    } catch (error) {
      printError(error);
    }
  });

moduleCommand
  .command("update")
  .description("Update a local module name, status, or health.")
  .argument("<module>", "Module number from list, or full module id")
  .option("--name <name>", "Module display name")
  .option("--status <status>", "Runtime status")
  .option("--health <number>", "Runtime health", parseHealth)
  .option("--condition <number>", "Runtime condition; alias for --health", parseHealth)
  .action(
    async (
      moduleHandle: string,
      options: { name?: string; status?: string; health?: number; condition?: number },
    ) => {
      try {
        const id = await resolveModuleId(moduleHandle);
        const module = await updateModule(id, {
          name: options.name,
          status: options.status,
          health: options.health ?? options.condition,
        });
        console.log(`Updated module: ${module.id}`);
      } catch (error) {
        printError(error);
      }
    },
  );

moduleCommand
  .command("delete")
  .description("Delete a local module by id.")
  .argument("<module>", "Module number from list, or full module id")
  .action(async (moduleHandle: string) => {
    try {
      const id = await resolveModuleId(moduleHandle);
      await deleteModule(id);
      console.log(`Deleted module: ${id}`);
    } catch (error) {
      printError(error);
    }
  });

program.addCommand(moduleCommand);

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
