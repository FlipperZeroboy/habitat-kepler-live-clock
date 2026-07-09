import { Command } from "commander";
import { addInventoryResource, listInventory } from "../habitat";
import { printError } from "../cli-utils";

function parseQuantity(value: string) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive number.");
  }

  return quantity;
}

export function createInventoryCommand() {
  const inventoryCommand = new Command("inventory")
    .description("Manage local Habitat inventory.")
    .summary("Local inventory stored in supply/cache modules");

  inventoryCommand
    .command("add")
    .description("Add a resource quantity to local inventory.")
    .argument("<resource>", "Resource type, such as ferrite or silicate-glass")
    .argument("<quantity>", "Positive resource quantity", parseQuantity)
    .action(async (resource: string, quantity: number) => {
      try {
        const result = await addInventoryResource(resource, quantity);

        console.log(`Added ${result.added} ${result.resource} to ${result.storageModuleName}.`);
        console.log(`Current Quantity: ${result.quantity}`);
      } catch (error) {
        printError(error);
      }
    });

  inventoryCommand
    .command("list")
    .description("List local inventory resources.")
    .action(async () => {
      try {
        const inventory = await listInventory();

        if (inventory.length === 0) {
          console.log("Local Inventory: empty");
          return;
        }

        console.log("Local Inventory");
        console.log("Resource | Quantity");

        for (const entry of inventory) {
          console.log(`${entry.resource} | ${entry.quantity}`);
        }
      } catch (error) {
        printError(error);
      }
    });

  return inventoryCommand;
}
