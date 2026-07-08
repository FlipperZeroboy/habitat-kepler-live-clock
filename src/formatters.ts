import type {
  HabitatModule,
  IndustryResource,
  ProductionBlueprint,
} from "./habitat";
import { formatJsonField, formatNumber } from "./cli-utils";

export function moduleStatus(module: HabitatModule) {
  return String(module.runtimeAttributes.status ?? "unknown");
}

export function moduleHealth(module: HabitatModule) {
  return String(module.runtimeAttributes.health ?? "unknown");
}

export function modulePowerDrawKw(module: HabitatModule) {
  const status = moduleStatus(module);
  const powerDrawKw = module.runtimeAttributes.powerDrawKw;

  if (!powerDrawKw || typeof powerDrawKw !== "object" || Array.isArray(powerDrawKw)) {
    return 0;
  }

  const draw = (powerDrawKw as Record<string, unknown>)[status];
  return typeof draw === "number" && Number.isFinite(draw) ? draw : 0;
}

export function printModuleStatusTable(modules: HabitatModule[]) {
  const rows = modules.map((module) => ({
    name: module.displayName,
    state: moduleStatus(module),
    powerDrawKw: modulePowerDrawKw(module),
  }));
  const nameWidth = Math.max("Module".length, ...rows.map((row) => row.name.length));
  const stateWidth = Math.max("State".length, ...rows.map((row) => row.state.length));
  const totalPowerDrawKw = rows.reduce((total, row) => total + row.powerDrawKw, 0);
  const energyCostPerTickKwh = totalPowerDrawKw / 3600;

  console.log(`${"Module".padEnd(nameWidth)}  ${"State".padEnd(stateWidth)}  Power Draw`);
  console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(stateWidth)}  ----------`);

  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth)}  ${row.state.padEnd(stateWidth)}  ${formatNumber(row.powerDrawKw)} kW`,
    );
  }

  console.log("");
  console.log(`Total Power Draw: ${formatNumber(totalPowerDrawKw)} kW`);
  console.log(`Energy Cost Per Tick: ${formatNumber(energyCostPerTickKwh)} kWh`);
}

export function printModule(module: HabitatModule) {
  console.log(`ID: ${module.id}`);
  console.log(`Habitat ID: ${module.habitatId}`);
  console.log(`Blueprint ID: ${module.blueprintId}`);
  console.log(`Module Type: ${module.moduleType}`);
  console.log(`Name: ${module.displayName}`);
  console.log(`Source: ${module.source}`);
  console.log(`Status: ${moduleStatus(module)}`);
  console.log(`Health: ${moduleHealth(module)}`);
  console.log(`Capabilities: ${module.capabilities.length > 0 ? module.capabilities.join(", ") : "none"}`);
  console.log(`Connected To: ${module.connectedTo.length > 0 ? module.connectedTo.join(", ") : "none"}`);
  console.log(`Runtime Attributes: ${JSON.stringify(module.runtimeAttributes)}`);
}

export function printBlueprintTable(blueprints: ProductionBlueprint[]) {
  const rows = blueprints.map((blueprint) => ({
    id: blueprint.blueprintId,
    name: blueprint.displayName,
    output: blueprint.output?.itemType ? String(blueprint.output.itemType) : "unknown",
    buildTicks: blueprint.buildTicks === undefined ? "unknown" : String(blueprint.buildTicks),
    repeatable: blueprint.repeatable === undefined ? "unknown" : blueprint.repeatable ? "yes" : "no",
  }));
  const idWidth = Math.max("Blueprint ID".length, ...rows.map((row) => row.id.length));
  const nameWidth = Math.max("Name".length, ...rows.map((row) => row.name.length));
  const outputWidth = Math.max("Output".length, ...rows.map((row) => row.output.length));
  const buildTicksWidth = Math.max("Build Ticks".length, ...rows.map((row) => row.buildTicks.length));

  console.log(
    `${"Blueprint ID".padEnd(idWidth)}  ${"Name".padEnd(nameWidth)}  ${"Output".padEnd(outputWidth)}  ${"Build Ticks".padEnd(buildTicksWidth)}  Repeatable`,
  );
  console.log(
    `${"-".repeat(idWidth)}  ${"-".repeat(nameWidth)}  ${"-".repeat(outputWidth)}  ${"-".repeat(buildTicksWidth)}  ----------`,
  );

  for (const row of rows) {
    console.log(
      `${row.id.padEnd(idWidth)}  ${row.name.padEnd(nameWidth)}  ${row.output.padEnd(outputWidth)}  ${row.buildTicks.padEnd(buildTicksWidth)}  ${row.repeatable}`,
    );
  }
}

export function printBlueprint(blueprint: ProductionBlueprint) {
  console.log(`ID: ${blueprint.blueprintId}`);
  console.log(`Name: ${blueprint.displayName}`);
  console.log(`Description: ${blueprint.description ?? "none"}`);
  console.log(`Status: ${blueprint.status ?? "unknown"}`);
  console.log(`Build Ticks: ${blueprint.buildTicks ?? "unknown"}`);
  console.log(`Repeatable: ${blueprint.repeatable === undefined ? "unknown" : blueprint.repeatable ? "yes" : "no"}`);
  console.log(`Output: ${formatJsonField(blueprint.output)}`);
  console.log(`Inputs: ${formatJsonField(blueprint.inputs)}`);
  console.log(`Production Cost: ${formatJsonField(blueprint.productionCost)}`);
  console.log(`Required Facility: ${formatJsonField(blueprint.requiredFacility)}`);
  console.log(`Prerequisites: ${blueprint.prerequisites?.length ? blueprint.prerequisites.join(", ") : "none"}`);
  console.log(`Unlocks: ${blueprint.unlocks?.length ? blueprint.unlocks.join(", ") : "none"}`);
  console.log(`Capabilities: ${blueprint.capabilities?.length ? blueprint.capabilities.join(", ") : "none"}`);
}

export function printResourceTable(resources: IndustryResource[]) {
  const rows = resources.map((resource) => ({
    type: resource.resourceType,
    name: resource.displayName,
    kind: resource.kind,
    rarity: resource.rarity,
    unit: resource.unit ?? "n/a",
  }));
  const typeWidth = Math.max("Resource Type".length, ...rows.map((row) => row.type.length));
  const nameWidth = Math.max("Name".length, ...rows.map((row) => row.name.length));
  const kindWidth = Math.max("Kind".length, ...rows.map((row) => row.kind.length));
  const rarityWidth = Math.max("Rarity".length, ...rows.map((row) => row.rarity.length));

  console.log(
    `${"Resource Type".padEnd(typeWidth)}  ${"Name".padEnd(nameWidth)}  ${"Kind".padEnd(kindWidth)}  ${"Rarity".padEnd(rarityWidth)}  Unit`,
  );
  console.log(
    `${"-".repeat(typeWidth)}  ${"-".repeat(nameWidth)}  ${"-".repeat(kindWidth)}  ${"-".repeat(rarityWidth)}  ----`,
  );

  for (const row of rows) {
    console.log(
      `${row.type.padEnd(typeWidth)}  ${row.name.padEnd(nameWidth)}  ${row.kind.padEnd(kindWidth)}  ${row.rarity.padEnd(rarityWidth)}  ${row.unit}`,
    );
  }
}

export function printResourceCatalogNotes() {
  console.log("Resource catalog: possible resource types in the Kepler world.");
  console.log("Local inventory: resources your habitat owns will be handled later.");
  console.log("Blueprint requirements: resources or modules needed to build something later.");
}
