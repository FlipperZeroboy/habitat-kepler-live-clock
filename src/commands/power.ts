import { Command } from "commander";
import { createApiClient, type PowerOverviewResponse } from "../api-client";
import { printError } from "../cli-utils";
import { printModuleStatusTable } from "../formatters";

export function createPowerCommand() {
  const apiClient = createApiClient();
  const powerCommand = new Command("power")
    .description("Inspect local Habitat power state.")
    .summary("Show the current power overview");

  powerCommand
    .command("overview")
    .description("Show module power draw and battery state.")
    .action(async () => {
      try {
        const response = await apiClient.get<PowerOverviewResponse>("/power/overview");

        if (response.modules.length === 0) {
          console.log("No modules found.");
          return;
        }

        printModuleStatusTable(response.modules);
      } catch (error) {
        printError(error);
      }
    });

  return powerCommand;
}
