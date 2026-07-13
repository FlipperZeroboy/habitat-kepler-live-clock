import { Command } from "commander";
import { createApiClient } from "../api-client";
import type { BlueprintCatalogResponse, ProductionBlueprint } from "../habitat";
import { printError } from "../cli-utils";
import {
  printBlueprint,
  printBlueprintTable,
} from "../formatters";

export function createBlueprintCommand() {
  const apiClient = createApiClient();
  const blueprintCommand = new Command("blueprint")
    .description("Inspect official Kepler production blueprints.")
    .summary("Read-only Kepler blueprint catalog");

  blueprintCommand
    .command("list")
    .description("List official Kepler production blueprints.")
    .action(async () => {
      try {
        const catalog = await apiClient.get<BlueprintCatalogResponse>("/catalog/blueprints");

        if (catalog.blueprints.length === 0) {
          console.log("No blueprints found.");
          return;
        }

        console.log(`Catalog Version: ${catalog.catalogVersion}`);
        console.log("");
        printBlueprintTable(catalog.blueprints);
      } catch (error) {
        printError(error);
      }
    });

  blueprintCommand
    .command("show")
    .description("Show one official Kepler production blueprint.")
    .argument("<blueprint-id>", "Official blueprint id")
    .action(async (blueprintId: string) => {
      try {
        printBlueprint(await apiClient.get<ProductionBlueprint>("/catalog/blueprints/" + encodeURIComponent(blueprintId)));
      } catch (error) {
        printError(error);
      }
    });

  return blueprintCommand;
}
