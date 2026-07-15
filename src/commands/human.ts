import { Command } from "commander";
import { createApiClient, type HumanResponse, type HumansResponse } from "../api-client";
import { printError } from "../cli-utils";

export function createHumanCommand() {
  const apiClient = createApiClient();
  const humanCommand = new Command("human")
    .description("Manage starter Habitat humans.")
    .summary("List local humans and their module locations");

  humanCommand
    .command("list")
    .description("List local humans and their assigned modules.")
    .option("--json", "Print the humans as JSON")
    .action(async (options: { json?: boolean }) => {
      try {
        const humans = (await apiClient.get<HumansResponse>("/humans")).humans;

        if (options.json) {
          console.log(JSON.stringify({ humans }, null, 2));
          return;
        }

        if (humans.length === 0) {
          console.log("No humans found.");
          return;
        }

        for (const human of humans) {
          console.log(`${human.id} | ${human.displayName} | ${human.locationModuleId}`);
        }
      } catch (error) {
        printError(error);
      }
    });

  humanCommand
    .command("move")
    .description("Move a human to a Habitat module with available crew capacity.")
    .argument("<human-id>", "Human id")
    .argument("<module-id>", "Destination module id")
    .action(async (humanId: string, moduleId: string) => {
      try {
        const human = (await apiClient.put<HumanResponse>(`/humans/${encodeURIComponent(humanId)}/location`, { moduleId })).human;
        console.log(`Moved ${human.displayName} to ${human.locationModuleId}.`);
      } catch (error) {
        printError(error);
      }
    });

  return humanCommand;
}
