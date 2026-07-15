import { Command } from "commander";
import { createApiClient, type CollectionResponse } from "../api-client";
import { printError } from "../cli-utils";

export function createCollectCommand() {
  const apiClient = createApiClient();
  return new Command("collect")
    .description("Collect material at the deployed explorer's current tile.")
    .argument("<quantity-kg>", "Positive whole kilograms")
    .action(async (quantityText: string) => {
      try {
        const quantityKg = Number(quantityText);
        if (!Number.isInteger(quantityKg) || quantityKg <= 0) {
          throw new Error("Collection quantity must be a positive whole number.");
        }
        const result = await apiClient.post<CollectionResponse>("/collect", { quantityKg });
        console.log(`Collected ${result.collection.collectedKg} kg of ${result.collection.resourceType}.`);
        console.log(`Position: (${result.collection.x}, ${result.collection.y})`);
        console.log(`Remaining on tile: ${result.collection.remainingKg} kg`);
      } catch (error) {
        printError(error);
      }
    });
}
