import { Command } from "commander";
import {
  createApiClient,
  type ModuleDeleteResponse,
  type ModuleResponse,
  type ModulesResponse,
} from "../api-client";
import type { HabitatModule } from "../habitat";
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

function assertCliStatus(status: string) {
  const statuses = ["offline", "idle", "online", "active", "damaged"];

  if (!statuses.includes(status)) {
    throw new Error(`Status must be one of: ${statuses.join(", ")}.`);
  }
}

async function resolveModuleId(handle: string, apiClient: ReturnType<typeof createApiClient>) {
  const response = await apiClient.get<ModulesResponse>("/modules");
  const modules = response.modules;
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
  const apiClient = createApiClient();
  const moduleCommand = new Command("module")
    .description("Manage local Habitat modules.")
    .summary("CRUD for local modules");

  moduleCommand
    .command("list")
    .description("List local modules as: id | blueprintId | displayName | status | health.")
    .action(async () => {
      try {
        const modules = (await apiClient.get<ModulesResponse>("/modules")).modules;

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
        const modules = (await apiClient.get<ModulesResponse>("/modules")).modules;

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
        assertCliStatus(status);
        const id = await resolveModuleId(moduleHandle, apiClient);
        const module = (await apiClient.put<ModuleResponse>(`/modules/${encodeURIComponent(id)}`, { status })).module;
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
        const id = await resolveModuleId(moduleHandle, apiClient);
        printModule((await apiClient.get<ModuleResponse>(`/modules/${encodeURIComponent(id)}`)).module);
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
        const module = (await apiClient.put<ModuleResponse>("/modules", {
          blueprintId: options.blueprintId,
          name: options.name,
        })).module;
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
          const id = await resolveModuleId(moduleHandle, apiClient);
          const module = (await apiClient.put<ModuleResponse>(`/modules/${encodeURIComponent(id)}`, {
            name: options.name,
            status: options.status,
            health: options.health ?? options.condition,
          })).module;
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
        const id = await resolveModuleId(moduleHandle, apiClient);
        const response = await apiClient.delete<ModuleDeleteResponse>(`/modules/${encodeURIComponent(id)}`);
        console.log(`Deleted module: ${response.moduleId}`);
      } catch (error) {
        printError(error);
      }
    });

  return moduleCommand;
}
