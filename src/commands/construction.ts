import { Command } from "commander";
import {
  createApiClient,
  type ConstructionCancelResponse,
  type ConstructionJobsResponse,
  type ModulesResponse,
} from "../api-client";
import type { HabitatModule } from "../habitat";
import { formatNumber, printError } from "../cli-utils";

function moduleHandle(module: HabitatModule, modules: HabitatModule[]) {
  const sameTypeModules = modules.filter(
    (entry) => entry.moduleType === module.moduleType,
  );
  const typeIndex = sameTypeModules.indexOf(module) + 1;

  return `${module.moduleType}-${typeIndex}`;
}

async function resolveModuleId(handle: string, apiClient: ReturnType<typeof createApiClient>) {
  const modules = (await apiClient.get<ModulesResponse>("/modules")).modules;
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

export function createConstructionCommand() {
  const apiClient = createApiClient();
  const constructionCommand = new Command("construction")
    .description("Inspect local construction jobs.")
    .summary("Show local construction progress");

  constructionCommand
    .command("status")
    .description("Show active local construction jobs and remaining build time.")
    .action(async () => {
      try {
        const jobs = (await apiClient.get<ConstructionJobsResponse>("/construction")).jobs;

        if (jobs.length === 0) {
          console.log("No active construction jobs.");
          return;
        }

        console.log("Active Construction Jobs");
        console.log("Job ID | Blueprint | Facility | Output Module | Remaining");

        for (const { facilityName, job } of jobs) {
          console.log(
            `${job.id} | ${job.blueprintId} | ${facilityName} | ${job.outputModuleId} | ${job.remainingTicks} / ${job.buildTicks} ticks remaining (${formatNumber(job.remainingTicks / 3600)} / ${formatNumber(job.buildTicks / 3600)} hours)`,
          );
        }
      } catch (error) {
        printError(error);
      }
    });

  constructionCommand
    .command("cancel")
    .description("Cancel an active local construction job without refunding materials.")
    .argument("<facility>", "Construction facility number, friendly handle, or full module id")
    .action(async (facilityHandle: string) => {
      try {
        const facilityId = await resolveModuleId(facilityHandle, apiClient);
        const result = (await apiClient.delete<ConstructionCancelResponse>(`/construction/${encodeURIComponent(facilityId)}`)).construction;

        console.log(`Canceled construction job ${result.jobId} for ${result.blueprintId}.`);
        console.log(`${result.facilityName} is available again.`);
        console.log("No output module was created.");
        console.log("Spent materials were not refunded.");
      } catch (error) {
        printError(error);
      }
    });

  return constructionCommand;
}
