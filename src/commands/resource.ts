import { Command } from "commander";
import { listResourceCatalog } from "../habitat";
import { printError } from "../cli-utils";
import {
  printResourceCatalogNotes,
  printResourceTable,
} from "../formatters";

export function createResourceCommand() {
  const resourceCommand = new Command("resource")
    .description("Inspect official Kepler resource types.")
    .summary("Read-only Kepler resource catalog");

  resourceCommand
    .command("list")
    .description("List possible resource types from the official Kepler catalog.")
    .action(async () => {
      try {
        const catalog = await listResourceCatalog();

        console.log(`Catalog Version: ${catalog.catalogVersion}`);
        printResourceCatalogNotes();

        if (catalog.resources.length === 0) {
          console.log("");
          console.log("No resource types found.");
          return;
        }

        console.log("");
        printResourceTable(catalog.resources);
      } catch (error) {
        printError(error);
      }
    });

  return resourceCommand;
}
