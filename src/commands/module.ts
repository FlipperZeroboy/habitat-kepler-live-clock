import { Command } from "commander";
import {
  createModule,
  deleteModule,
  listModules,
  setModuleStatus,
  showModule,
  updateModule,
  type HabitatModule,
} from "../habitat";
import { formatNumber, parseHealth, printError } from "../cli-utils";
import {
  moduleHealth,
  modulePowerDrawKw,
  moduleStatus,
  printModule,
  printModuleStatusTable,
} from "../formatters";

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

export function createModuleCommand() {
  const moduleCommand = new Command("module")
    .description("Manage local Habitat modules.")
    .summary("CRUD for local modules");

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

  return moduleCommand;
}
