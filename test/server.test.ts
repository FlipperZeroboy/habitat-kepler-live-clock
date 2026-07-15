import { expect, test } from "bun:test";
import { createApp, getServerConfig } from "../src/server";

test("server config defaults to all interfaces on port 8787", () => {
  expect(getServerConfig({})).toEqual({ host: "0.0.0.0", port: 8787 });
});

test("server config accepts host and port environment overrides", () => {
  expect(getServerConfig({
    HABITAT_API_HOST: "0.0.0.0",
    HABITAT_API_PORT: "18787",
  })).toEqual({ host: "0.0.0.0", port: 18787 });
});

test("GET /registration returns a null registration when no habitat is registered", async () => {
  const app = createApp({
    getRegistration: async () => null,
  });

  const response = await app.request("/registration");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual({ registration: null });
});

test("GET /registration returns the registered habitat JSON shape", async () => {
  const registration = {
    habitatUuid: "11111111-1111-4111-8111-111111111111",
    habitatId: "habitat_11111111_1111_4111_8111_111111111111",
    displayName: "Artemis Ridge",
    apiToken: "habitat-api-token",
  };
  const app = createApp({
    getRegistration: async () => registration,
  });

  const response = await app.request("/registration");

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toEqual({
    registration: {
      habitatUuid: registration.habitatUuid,
      habitatId: registration.habitatId,
      displayName: registration.displayName,
    },
  });
  expect(JSON.stringify(body)).not.toContain("habitat-api-token");
});

test("POST /registration registers through the backend and returns structured JSON", async () => {
  let requestedName = "";
  const registration = {
    habitatUuid: "11111111-1111-4111-8111-111111111111",
    habitatId: "habitat_11111111_1111_4111_8111_111111111111",
    displayName: "Artemis Ridge",
    apiToken: "habitat-api-token",
  };
  const app = createApp({
    registerHabitat: async (name: string) => {
      requestedName = name;
      return registration;
    },
  });

  const response = await app.request("/registration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "Artemis Ridge" }),
  });

  expect(response.status).toBe(201);
  expect(requestedName).toBe("Artemis Ridge");
  expect(await response.json()).toEqual({
    registration: {
      habitatUuid: registration.habitatUuid,
      habitatId: registration.habitatId,
      displayName: registration.displayName,
    },
  });
});

test("GET /status combines remote registration status with local state summary", async () => {
  const app = createApp({
    getRegistrationStatus: async () => ({
      habitat: {
        id: "habitat-1",
        habitatSlug: "artemis-ridge",
        displayName: "Artemis Ridge",
        catalogVersion: "2026-06-24",
        status: "active",
        lastSeenAt: "2026-07-10T12:00:00.000Z",
      },
    }),
    getLocalStatusSummary: async () => ({
      currentTick: 60,
      moduleCount: 3,
      powerSummary: {
        totalPowerDrawKw: 7,
        energyUsedKwh: 0.11667,
        batteryEnergyKwh: 100,
        batteryCapacityKwh: 200,
        powerShortageKwh: 0,
      },
    }),
  });

  const response = await app.request("/status");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: {
      habitat: {
        id: "habitat-1",
        habitatSlug: "artemis-ridge",
        displayName: "Artemis Ridge",
        catalogVersion: "2026-06-24",
        status: "active",
        lastSeenAt: "2026-07-10T12:00:00.000Z",
      },
      currentTick: 60,
      moduleCount: 3,
      powerSummary: {
        totalPowerDrawKw: 7,
        energyUsedKwh: 0.11667,
        batteryEnergyKwh: 100,
        batteryCapacityKwh: 200,
        powerShortageKwh: 0,
      },
    },
  });
});

test("GET /humans returns starter humans from local registration state", async () => {
  const app = createApp({
    listHumans: async () => [
      { id: "human-1", displayName: "Abigail", locationModuleId: "module-1" },
      { id: "human-2", displayName: "Adam", locationModuleId: "module-1" },
    ],
  });

  const response = await app.request("/humans");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    humans: [
      { id: "human-1", displayName: "Abigail", locationModuleId: "module-1" },
      { id: "human-2", displayName: "Adam", locationModuleId: "module-1" },
    ],
  });
});

test("PUT /humans/:id/location moves a human through the local API", async () => {
  const app = createApp({
    moveHuman: async (humanId: string, moduleId: string) => ({ id: humanId, displayName: "Abigail", locationModuleId: moduleId }),
  });

  const response = await app.request("/humans/human-1/location", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ moduleId: "module-2" }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    human: { id: "human-1", displayName: "Abigail", locationModuleId: "module-2" },
  });
});

test("EVA routes expose persisted deployment and movement state", async () => {
  const app = createApp({
    getEvaStatus: async () => ({ deployedHumanId: "human-1", position: { x: 0, y: 0 }, carriedResources: {}, maxCarryCapacityKg: 10 }),
    deployHuman: async (humanId: string) => ({ deployedHumanId: humanId, position: { x: 0, y: 0 }, carriedResources: {}, maxCarryCapacityKg: 10 }),
    moveExplorer: async (x: number, y: number) => ({ deployedHumanId: "human-1", position: { x, y }, carriedResources: {}, maxCarryCapacityKg: 10 }),
    dockExplorer: async () => ({ deployedHumanId: null, position: { x: 0, y: 0 }, carriedResources: {}, maxCarryCapacityKg: 10 }),
  });

  expect(await (await app.request("/eva")).json()).toEqual({ eva: { deployedHumanId: "human-1", position: { x: 0, y: 0 }, carriedResources: {}, maxCarryCapacityKg: 10 } });
  expect((await app.request("/eva/deploy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ humanId: "human-1" }) })).status).toBe(200);
  expect(await (await app.request("/eva/move", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: 1, y: 0 }) })).json()).toEqual({ eva: { deployedHumanId: "human-1", position: { x: 1, y: 0 }, carriedResources: {}, maxCarryCapacityKg: 10 } });
  expect((await app.request("/eva/dock", { method: "POST" })).status).toBe(200);
});

test("alert routes list and acknowledge persisted alerts", async () => {
  const alert = {
    id: "alert-1", code: "human-deployed-outside", title: "Human deployed outside habitat",
    description: "A human is outside.", severity: "warning", status: "open", source: "eva",
    openedAt: "2026-07-15T00:00:00.000Z", lastObservedAt: "2026-07-15T00:00:00.000Z", occurrenceCount: 1,
  } as const;
  const app = createApp({
    listAlerts: async () => [alert],
    acknowledgeAlert: async (id: string) => ({ ...alert, id, status: "acknowledged", acknowledgedAt: "2026-07-15T00:01:00.000Z" }),
  });

  expect(await (await app.request("/alerts")).json()).toEqual({ alerts: [alert] });
  expect(await (await app.request("/alerts/alert-1/acknowledge", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json()).toMatchObject({ alert: { id: "alert-1", status: "acknowledged" } });
});

test("DELETE /registration unregisters through the backend", async () => {
  let called = false;
  const app = createApp({
    unregisterHabitat: async () => {
      called = true;
      return { habitatId: "habitat-1" };
    },
  });

  const response = await app.request("/registration", { method: "DELETE" });

  expect(response.status).toBe(200);
  expect(called).toBe(true);
  expect(await response.json()).toEqual({ registration: null, habitatId: "habitat-1" });
});

test("catalog and solar routes proxy structured backend data", async () => {
  const app = createApp({
    listBlueprintCatalog: async () => ({ catalogVersion: "v1", blueprints: [{ blueprintId: "bp-1" }] }),
    showBlueprint: async (blueprintId: string) => ({ blueprintId, displayName: "Survey Rover" }),
    listResourceCatalog: async () => ({ catalogVersion: "v1", resources: [{ resourceType: "water" }] }),
    getSolarIrradiance: async () => ({ solarIrradiance: { wPerM2: 900, condition: "clear" } }),
  });

  expect(await (await app.request("/catalog/blueprints")).json()).toEqual({
    catalogVersion: "v1",
    blueprints: [{ blueprintId: "bp-1" }],
  });
  expect(await (await app.request("/catalog/blueprints/bp-1")).json()).toEqual({
    blueprintId: "bp-1",
    displayName: "Survey Rover",
  });
  expect(await (await app.request("/catalog/resources")).json()).toEqual({
    catalogVersion: "v1",
    resources: [{ resourceType: "water" }],
  });
  expect(await (await app.request("/solar/irradiance")).json()).toEqual({
    solarIrradiance: { wPerM2: 900, condition: "clear" },
  });
});

test("GET /power/overview returns backend-owned balance and solar data", async () => {
  const modules = [
    {
      id: "solar-1",
      runtimeAttributes: { status: "online", powerGenerationKw: 12, powerDrawKw: { online: 1 } },
      capabilities: ["solar-generation"],
      moduleType: "solar-array",
    },
    {
      id: "lab-1",
      runtimeAttributes: { status: "online", powerDrawKw: { online: 5 } },
      capabilities: [],
      moduleType: "laboratory",
    },
  ];
  const app = createApp({
    listModules: async () => modules as never,
    getLocalStatusSummary: async () => ({
      currentTick: 120,
      moduleCount: 2,
      powerSummary: {
        totalPowerDrawKw: 6,
        energyUsedKwh: 0.2,
        batteryEnergyKwh: 40,
        batteryCapacityKwh: 80,
        powerShortageKwh: 0,
      },
    }),
    getSolarIrradiance: async () => ({ solarIrradiance: { wPerM2: 700, condition: "partly-cloudy" } }),
  });

  const response = await app.request("/power/overview");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    power: {
      generationKw: 12,
      consumptionKw: 6,
      netPowerKw: 6,
      batteryEnergyKwh: 0,
      batteryCapacityKwh: 0,
      powerShortageKwh: 0,
    },
    solarIrradiance: { wPerM2: 700, condition: "partly-cloudy" },
    modules: [
      { ...modules[0], powerDrawKw: 1, powerGenerationKw: 12 },
      { ...modules[1], powerDrawKw: 5, powerGenerationKw: 0 },
    ],
  });
});

test("scan route maps validated query parameters and preserves the Kepler response", async () => {
  let requested: unknown;
  const scan = { scan: { modelVersion: "resource-probability-v2", origin: { x: 3, y: -2 }, sensorStrength: 60, radiusTiles: 0, tiles: [] } };
  const app = createApp({
    scanHabitat: async (options) => {
      requested = options;
      return scan;
    },
    getEvaStatus: async () => ({ deployedHumanId: "human-1", position: { x: 3, y: -2 }, carriedResources: {}, maxCarryCapacityKg: 10 }),
  });

  const response = await app.request("/scan?strength=60");

  expect(response.status).toBe(200);
  expect(requested).toEqual({ sensorStrength: 60, radiusTiles: 0 });
  expect(await response.json()).toEqual(scan);
});

test("scan route rejects invalid query parameters with structured errors", async () => {
  const app = createApp({ scanHabitat: async () => ({ scan: {} }) });
  for (const [query, message] of [
    ["strength=101", "sensor strength must be an integer between 0 and 100"],
    ["strength=60&radius=6", "scan radius must be an integer between 0 and 5"],
  ]) {
    const response = await app.request(`/scan?${query}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { message } });
  }
});

test("POST /collect delegates to local collection logic", async () => {
  const app = createApp({
    collectResource: async (quantityKg: number) => ({ collection: { x: 1, y: 0, resourceType: "ferrite", unit: "kg", collectedKg: quantityKg, remainingKg: 10 }, eva: { deployedHumanId: "human-1", position: { x: 1, y: 0 }, carriedResources: { ferrite: quantityKg }, maxCarryCapacityKg: 10 } }),
  });
  const response = await app.request("/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quantityKg: 1 }) });
  expect(response.status).toBe(200);
  expect((await response.json()).collection.resourceType).toBe("ferrite");
});

test("backend errors are returned as structured JSON", async () => {
  const app = createApp({
    getRegistration: async () => {
      throw new Error("Kepler is unavailable.");
    },
  });

  const response = await app.request("/registration");

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: { message: "Kepler is unavailable." } });
});

test("module and inventory routes proxy local state operations", async () => {
  const module = {
    id: "module-1",
    habitatId: "habitat-1",
    blueprintId: "command-module",
    moduleType: "command-module",
    displayName: "Command Module",
    connectedTo: [],
    runtimeAttributes: { status: "active" },
    capabilities: [],
    source: "kepler-registration" as const,
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedAt: "2026-07-10T12:00:00.000Z",
  };
  const requests: string[] = [];
  const app = createApp({
    listModules: async () => [module],
    showModule: async () => module,
    createModule: async () => module,
    updateModule: async () => module,
    deleteModule: async () => undefined,
    listInventory: async () => [{ resource: "ferrite", quantity: 10 }],
    addInventoryResource: async () => ({
      resource: "ferrite",
      added: 3,
      quantity: 13,
      storageModuleId: "cache-1",
      storageModuleName: "Supply Cache",
    }),
    removeInventoryResource: async () => ({
      resource: "ferrite",
      removed: 3,
      quantity: 10,
      storageModuleId: "cache-1",
      storageModuleName: "Supply Cache",
    }),
  });

  const listResponse = await app.request("/modules");
  expect(await listResponse.json()).toEqual({ modules: [module] });

  const showResponse = await app.request("/modules/module-1");
  expect(await showResponse.json()).toEqual({ module });

  const createResponse = await app.request("/modules", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blueprintId: "command-module", name: "Command Module" }),
  });
  expect(createResponse.status).toBe(201);
  expect(await createResponse.json()).toEqual({ module });

  const updateResponse = await app.request("/modules/module-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "offline" }),
  });
  expect(await updateResponse.json()).toEqual({ module });

  const deleteResponse = await app.request("/modules/module-1", { method: "DELETE" });
  expect(await deleteResponse.json()).toEqual({ moduleId: "module-1" });

  const inventoryListResponse = await app.request("/inventory");
  expect(await inventoryListResponse.json()).toEqual({ inventory: [{ resource: "ferrite", quantity: 10 }] });

  const inventoryAddResponse = await app.request("/inventory", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "add", resource: "ferrite", quantity: 3 }),
  });
  expect(await inventoryAddResponse.json()).toEqual({
    inventory: {
      resource: "ferrite",
      quantity: 13,
      added: 3,
      storageModuleId: "cache-1",
      storageModuleName: "Supply Cache",
    },
  });

  const inventoryRemoveResponse = await app.request("/inventory", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "remove", resource: "ferrite", quantity: 3 }),
  });
  expect(await inventoryRemoveResponse.json()).toEqual({
    inventory: {
      resource: "ferrite",
      quantity: 10,
      removed: 3,
      storageModuleId: "cache-1",
      storageModuleName: "Supply Cache",
    },
  });

  expect(requests).toEqual([]);
});

test("backend logs the REST route without logging request data", async () => {
  const logs: string[] = [];
  const app = createApp({
    logger: (line) => logs.push(line),
    listModules: async () => [],
  });

  const response = await app.request("/power/overview");

  expect(response.status).toBe(200);
  expect(logs).toContain("[habitat-api] GET /power/overview -> 0 modules");
  expect(logs.join("\n")).not.toContain("Bearer");
  expect(logs.join("\n")).not.toContain("token");
});
