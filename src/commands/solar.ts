import { Command } from "commander";
import { getSolarIrradiance } from "../habitat";
import { formatNumber, printError } from "../cli-utils";

export function createSolarCommand() {
  const solarCommand = new Command("solar")
    .description("Inspect Kepler sunlight used by local solar charging.")
    .summary("Read current planet-side solar irradiance");

  solarCommand
    .command("status")
    .description("Show the current Kepler solar irradiance.")
    .action(async () => {
      try {
        const solar = await getSolarIrradiance();
        console.log(`Solar Irradiance: ${formatNumber(solar.solarIrradiance.wPerM2)} W/m2`);
        console.log(`Condition: ${solar.solarIrradiance.condition}`);

        if (solar.solarIrradiance.wPerM2 > 0) {
          console.log(
            `Kepler reports ${solar.solarIrradiance.condition} conditions. Local solar charging will use this irradiance.`,
          );
        } else {
          console.log("Kepler reports no usable sunlight. Local solar charging will not run.");
        }
      } catch (error) {
        printError(error);
      }
    });

  return solarCommand;
}
