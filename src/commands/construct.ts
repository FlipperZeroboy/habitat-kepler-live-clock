import { Command } from "commander";
import {
  createApiClient,
  type ConstructionDryRunResponse,
  type ConstructionStartResponse,
} from "../api-client";
import { formatTicksAsHours, printError } from "../cli-utils";

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function moduleLabel(module: { displayName: string; runtimeAttributes: Record<string, unknown> } | undefined) {
  if (!module) {
    return "none";
  }

  return `${module.displayName}: ${String(module.runtimeAttributes.status ?? "unknown")}`;
}

function formatModuleToCreate(output: Record<string, unknown>) {
  const moduleType = typeof output.moduleType === "string" ? output.moduleType : "unknown";
  const quantity = typeof output.quantity === "number" ? output.quantity : 1;

  return `${moduleType} x${quantity}`;
}

export function createConstructCommand() {
  const apiClient = createApiClient();
  return new Command("construct")
    .description("Prepare local module construction from a Kepler blueprint.")
    .argument("<blueprint-id>", "Official Kepler blueprint id")
    .option("--dry-run", "Check whether construction can start without changing local files.")
    .action(async (blueprintId: string, options: { dryRun?: boolean }) => {
      try {
        if (!options.dryRun) {
          const result = (await apiClient.post<ConstructionStartResponse>("/construction", {
            blueprintId,
          })).construction;

          console.log(`Started Construction: ${result.job.blueprintId}`);
          console.log(`Construction Job: ${result.job.id}`);
          console.log(`Output Module ID: ${result.job.outputModuleId}`);
          console.log(`Build Ticks: ${result.job.buildTicks}`);
          console.log(`Build Time: ${formatTicksAsHours(result.job.buildTicks)}`);
          console.log(`Remaining Ticks: ${result.job.remainingTicks}`);
          console.log(`Remaining Time: ${formatTicksAsHours(result.job.remainingTicks)}`);
          console.log(`Facility: ${result.facility.displayName}`);
          console.log("Output module will be created when construction ticks complete.");
          return;
        }

        const result = (await apiClient.post<ConstructionDryRunResponse>("/construction", {
          blueprintId,
          dryRun: true,
        })).construction;
        const facilityType = typeof result.facilityRequirement.moduleType === "string"
          ? result.facilityRequirement.moduleType
          : "none";
        const prerequisites = result.prerequisites.length > 0
          ? result.prerequisites.join(", ")
          : "none";

        console.log(`Construction Dry Run: ${result.blueprintId}`);
        console.log(`Required Facility Exists: ${yesNo(result.facilityExists)} (${facilityType})`);
        console.log(`Fabricator Available: ${yesNo(result.facilityAvailable)} (${moduleLabel(result.facility)})`);
        console.log(`Supply Cache Online: ${yesNo(result.supplyCacheOnline)} (${moduleLabel(result.supplyCache)})`);
        console.log(`Prerequisites Met: ${yesNo(result.prerequisitesMet)} (${prerequisites})`);
        console.log(`Inventory Sufficient: ${yesNo(result.inventorySufficient)}`);

        for (const check of result.inventoryChecks) {
          const status = check.sufficient
            ? "ok"
            : `missing ${check.required - check.available}`;

          console.log(`${check.resource}: need ${check.required}, have ${check.available}, ${status}`);
        }

        console.log(`Module To Create: ${formatModuleToCreate(result.moduleToCreate)}`);
        console.log(`Resources To Spend: ${JSON.stringify(result.resourcesToSpend)}`);
        console.log(`Build Ticks: ${result.buildTicks ?? "unknown"}`);
        console.log(`Build Time: ${result.buildTicks === undefined ? "unknown" : formatTicksAsHours(result.buildTicks)}`);
        console.log(`Runtime Attributes: ${JSON.stringify(result.runtimeAttributes)}`);
        console.log(`Capabilities: ${result.capabilities.length > 0 ? result.capabilities.join(", ") : "none"}`);
        console.log(`Usable Power: ${yesNo(result.hasUsablePower)}`);
        console.log(`Can Start Construction: ${yesNo(result.canStart)}`);
      } catch (error) {
        printError(error);
      }
    });
}
