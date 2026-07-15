import { Command } from "commander";
import { createApiClient, type EvaResponse } from "../api-client";
import { printError } from "../cli-utils";

function printEva(eva: EvaResponse["eva"]) {
  console.log(`Explorer: ${eva.deployedHumanId ?? "none"}`);
  console.log(`Position: (${eva.position.x}, ${eva.position.y})`);
  console.log(`Carried Resources: ${Object.keys(eva.carriedResources).length === 0 ? "none" : JSON.stringify(eva.carriedResources)}`);
  console.log(`Carrying Capacity: ${eva.maxCarryCapacityKg} kg`);
}

export function createEvaCommand() {
  const apiClient = createApiClient();
  const command = new Command("eva").description("Manage local EVA exploration state.");

  command.command("status").description("Show the current explorer, position, and carried resources.").action(async () => {
    try { printEva((await apiClient.get<EvaResponse>("/eva")).eva); } catch (error) { printError(error); }
  });

  command.command("deploy").description("Deploy a human from the active suitport.").argument("<human-id>", "Human id").action(async (humanId: string) => {
    try { printEva((await apiClient.post<EvaResponse>("/eva/deploy", { humanId })).eva); } catch (error) { printError(error); }
  });

  command.command("move").description("Move one adjacent grid tile.").argument("<x>", "Destination x coordinate").argument("<y>", "Destination y coordinate").action(async (x: string, y: string) => {
    try {
      const parsedX = Number(x); const parsedY = Number(y);
      if (!Number.isInteger(parsedX) || !Number.isInteger(parsedY)) throw new Error("EVA coordinates must be integers.");
      printEva((await apiClient.post<EvaResponse>("/eva/move", { x: parsedX, y: parsedY })).eva);
    } catch (error) { printError(error); }
  });

  command.command("dock").description("Dock the explorer at (0, 0).").action(async () => {
    try { printEva((await apiClient.post<EvaResponse>("/eva/dock", {})).eva); } catch (error) { printError(error); }
  });

  return command;
}
