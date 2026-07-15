import { Command } from "commander";
import { createApiClient } from "../api-client";
import { parseScanRadius, parseSensorStrength, printError } from "../cli-utils";
import type { WorldScanResponse } from "../habitat";
import { printWorldScan } from "../formatters";

export function createScanCommand() {
  const apiClient = createApiClient();
  const command = new Command("scan")
    .description("Estimate nearby Kepler resources without collecting them.")
    .summary("Read-only resource probability scan")
    .requiredOption("--strength <0-100>", "Effective sensor strength")
    .option("--radius <0-5>", "Scan radius in tiles", "0")
    .option("--json", "Print the complete JSON response");

  command.action(async (options: { strength: string; radius: string; json?: boolean }) => {
    try {
      const strength = parseSensorStrength(options.strength);
      const radius = parseScanRadius(options.radius);
      const query = new URLSearchParams({
        strength: String(strength),
        radius: String(radius),
      });
      const response = await apiClient.get<WorldScanResponse>(`/scan?${query}`);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        printWorldScan(response.scan);
      }
    } catch (error) {
      printError(error);
    }
  });

  return command;
}
