import { Command } from "commander";
import { createApiClient } from "../api-client";
import { parseScanCoordinate, parseSensorStrength, parseScanRadius, printError } from "../cli-utils";
import type { WorldScanResponse } from "../habitat";
import { printWorldScan } from "../formatters";

export function createScanCommand() {
  const apiClient = createApiClient();
  const scanCommand = new Command("scan")
    .description("Estimate nearby Kepler resources without collecting them.")
    .summary("Read-only resource probability scan")
    .requiredOption("--x <integer>", "Scanner origin x coordinate", parseScanCoordinate)
    .requiredOption("--y <integer>", "Scanner origin y coordinate", parseScanCoordinate)
    .requiredOption("--strength <0-100>", "Effective sensor strength", parseSensorStrength)
    .requiredOption("--radius <0-5>", "Centered scan radius in tiles", parseScanRadius)
    .option("--json", "Print the complete Kepler response as JSON");

  scanCommand.action(async (options: {
    x: number;
    y: number;
    strength: number;
    radius: number;
    json?: boolean;
  }) => {
    try {
      const query = new URLSearchParams({
        x: String(options.x),
        y: String(options.y),
        strength: String(options.strength),
        radius: String(options.radius),
      });
      const response = await apiClient.get<WorldScanResponse>(`/scan?${query}`);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printWorldScan(response.scan);
    } catch (error) {
      printError(error);
    }
  });

  return scanCommand;
}
