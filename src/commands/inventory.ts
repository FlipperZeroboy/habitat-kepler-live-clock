import { Command } from "commander";
import {
  createApiClient,
  type InventoryAddResponse,
  type InventoryRemoveResponse,
  type InventoryResponse,
} from "../api-client";
import { printError } from "../cli-utils";

function parseQuantity(value: string) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive number.");
  }

  return quantity;
}

export function createInventoryCommand() {
  const apiClient = createApiClient();
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
        const result = (await apiClient.put<InventoryAddResponse>("/inventory", {
          operation: "add",
          resource,
          quantity,
        })).inventory;

        console.log(`Added ${result.added} ${result.resource} to ${result.storageModuleName}.`);
        console.log(`Current Quantity: ${result.quantity}`);
      } catch (error) {
        printError(error);
      }
    });

  inventoryCommand
    .command("remove")
    .description("Remove a resource quantity from local inventory.")
    .argument("<resource>", "Resource type, such as ferrite or silicate-glass")
    .argument("<quantity>", "Positive resource quantity", parseQuantity)
    .action(async (resource: string, quantity: number) => {
      try {
        const result = (await apiClient.put<InventoryRemoveResponse>("/inventory", {
          operation: "remove",
          resource,
          quantity,
        })).inventory;

        console.log(`Removed ${result.removed} ${result.resource} from ${result.storageModuleName}.`);
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
        const inventory = (await apiClient.get<InventoryResponse>("/inventory")).inventory;

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
