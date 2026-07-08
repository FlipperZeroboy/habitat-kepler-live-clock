import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkLocalConfig,
  createModule,
  deleteModule,
  listBlueprintCatalog,
  listResourceCatalog,
  getLocalStatusSummary,
  getModulesFilePath,
  getRegistrationFilePath,
  getRegistrationStatus,
  listModules,
  loadLocalRegistration,
  registerHabitat,
  setModuleStatus,
  showBlueprint,
  showModule,
  tickHabitat,
  unregisterHabitat,
  updateModule,
} from "../src/habitat";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "habitat-cli-"));
  await writeFile(
    join(tempDir, ".env"),
    "KEPLER_BASE_URL=https://planet.turingguild.com\nKEPLER_PLANET_TOKEN=test-token\n",
    "utf8",
  );
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writePowerRegistration({
  currentEnergyKwh = 10,
  energyStorageKwh = 10,
}: {
  currentEnergyKwh?: number;
  energyStorageKwh?: number;
} = {}) {
  await mkdir(join(tempDir, ".habitat"), { recursive: true });
  await writeFile(
    getRegistrationFilePath(tempDir),
    JSON.stringify(
      {
        habitatUuid: "11111111-1111-4111-8111-111111111111",
        habitatId: "habitat_11111111_1111_4111_8111_111111111111",
        displayName: "Artemis Ridge",
        registeredAt: "2026-07-06T12:00:00.000Z",
        currentTick: 0,
        starterModules: [],
        blueprints: [],
        modules: [
          {
            id: "battery-1",
            habitatId: "habitat_11111111_1111_4111_8111_111111111111",
            blueprintId: "basic-battery",
            moduleType: "basic-battery",
            displayName: "Basic Battery",
            connectedTo: [],
            runtimeAttributes: {
              health: 100,
              status: "offline",
              currentEnergyKwh,
              energyStorageKwh,
              powerDrawKw: { offline: 0, active: 0 },
            },
            capabilities: ["power-storage"],
            source: "kepler-registration",
            createdAt: "2026-07-06T12:00:00.000Z",
            updatedAt: "2026-07-06T12:00:00.000Z",
          },
          {
            id: "command-1",
            habitatId: "habitat_11111111_1111_4111_8111_111111111111",
            blueprintId: "command-module",
            moduleType: "command-module",
            displayName: "Command Module",
            connectedTo: [],
            runtimeAttributes: {
              health: 100,
              status: "active",
              powerDrawKw: { offline: 0, idle: 1, active: 2, damaged: 0 },
            },
            capabilities: ["habitat-command"],
            source: "kepler-registration",
            createdAt: "2026-07-06T12:00:00.000Z",
            updatedAt: "2026-07-06T12:00:00.000Z",
          },
          {
            id: "life-support-1",
            habitatId: "habitat_11111111_1111_4111_8111_111111111111",
            blueprintId: "life-support",
            moduleType: "life-support",
            displayName: "Life Support",
            connectedTo: ["command-1"],
            runtimeAttributes: {
              health: 100,
              status: "active",
              powerDrawKw: { offline: 0, active: 5 },
            },
            capabilities: ["atmosphere-control"],
            source: "kepler-registration",
            createdAt: "2026-07-06T12:00:00.000Z",
            updatedAt: "2026-07-06T12:00:00.000Z",
          },
        ],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

test("registerHabitat sends OpenAPI request keys and persists returned registration data", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });

    return new Response(
      JSON.stringify({
        habitatId: "habitat_11111111_1111_4111_8111_111111111111",
        starterModules: [
          {
            id: "module-1",
            blueprintId: "command-module",
            displayName: "Command Module",
            connectedTo: [],
            runtimeAttributes: { health: 100, status: "active" },
            capabilities: ["habitat-command"],
          },
          {
            id: "module-2",
            blueprintId: "custom-lab",
            displayName: "Custom Lab",
            connectedTo: ["module-1"],
            runtimeAttributes: { health: 88, status: "idle" },
            capabilities: ["custom-science"],
          },
        ],
        blueprints: [
          {
            blueprintId: "command-module",
            displayName: "Command Module Blueprint",
            output: { itemType: "module", moduleType: "command-module", quantity: 1 },
            runtimeAttributes: { health: 100, status: "active" },
            capabilities: ["habitat-command"],
          },
        ],
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  };

  const registration = await registerHabitat("Artemis Ridge", {
    cwd: tempDir,
    fetchImpl,
    randomUuid: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-07-06T12:00:00.000Z"),
  });

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe("https://planet.turingguild.com/habitats/register");
  expect(requests[0].init.method).toBe("POST");
  expect(requests[0].init.headers).toEqual({
    Authorization: "Bearer test-token",
    "Content-Type": "application/json",
  });
  expect(JSON.parse(String(requests[0].init.body))).toEqual({
    displayName: "Artemis Ridge",
    habitatUuid: "11111111-1111-4111-8111-111111111111",
  });

  expect(registration).toMatchObject({
    habitatUuid: "11111111-1111-4111-8111-111111111111",
    habitatId: "habitat_11111111_1111_4111_8111_111111111111",
    displayName: "Artemis Ridge",
    registeredAt: "2026-07-06T12:00:00.000Z",
    currentTick: 0,
  });
  expect(registration.modules).toEqual([
    {
      id: "module-1",
      habitatId: "habitat_11111111_1111_4111_8111_111111111111",
      blueprintId: "command-module",
      moduleType: "command-module",
      displayName: "Command Module",
      connectedTo: [],
      runtimeAttributes: { health: 100, status: "active" },
      capabilities: ["habitat-command"],
      source: "kepler-registration",
      createdAt: "2026-07-06T12:00:00.000Z",
      updatedAt: "2026-07-06T12:00:00.000Z",
    },
    {
      id: "module-2",
      habitatId: "habitat_11111111_1111_4111_8111_111111111111",
      blueprintId: "custom-lab",
      moduleType: "custom-lab",
      displayName: "Custom Lab",
      connectedTo: ["module-1"],
      runtimeAttributes: { health: 88, status: "idle" },
      capabilities: ["custom-science"],
      source: "kepler-registration",
      createdAt: "2026-07-06T12:00:00.000Z",
      updatedAt: "2026-07-06T12:00:00.000Z",
    },
  ]);

  const stored = await loadLocalRegistration(tempDir);
  expect(stored).toEqual(registration);

  const rawFile = await readFile(getRegistrationFilePath(tempDir), "utf8");
  expect(JSON.parse(rawFile)).toEqual(registration);
});

test("listBlueprintCatalog fetches official blueprints without changing local state", async () => {
  await writePowerRegistration();
  const beforeRegistration = await readFile(getRegistrationFilePath(tempDir), "utf8");
  const requests: Array<{ url: string; init: RequestInit }> = [];

  const result = await listBlueprintCatalog({
    cwd: tempDir,
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          catalogVersion: "2026-06-24",
          blueprints: [
            {
              id: "bp-1",
              blueprintId: "survey-rover",
              displayName: "Survey Rover",
              description: "Builds a rover for site surveys.",
              status: "published",
              output: { itemType: "rover", quantity: 1 },
              inputs: { spareParts: 4 },
              buildTicks: 120,
              repeatable: true,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe("https://planet.turingguild.com/catalog/blueprints");
  expect(requests[0].init.method).toBe("GET");
  expect(requests[0].init.headers).toEqual({
    Authorization: "Bearer test-token",
  });
  expect(result.catalogVersion).toBe("2026-06-24");
  expect(result.blueprints[0].blueprintId).toBe("survey-rover");
  expect(await readFile(getRegistrationFilePath(tempDir), "utf8")).toBe(beforeRegistration);
});

test("listResourceCatalog fetches official resource types without changing local state", async () => {
  await writePowerRegistration();
  const beforeRegistration = await readFile(getRegistrationFilePath(tempDir), "utf8");
  const requests: Array<{ url: string; init: RequestInit }> = [];

  const result = await listResourceCatalog({
    cwd: tempDir,
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          catalogVersion: "2026-06-24",
          resources: [
            {
              id: "resource-water",
              resourceType: "water",
              displayName: "Water",
              kind: "consumable",
              rarity: "common",
              description: "Reusable life-support water.",
              unit: "liters",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe("https://planet.turingguild.com/catalog/resources");
  expect(requests[0].init.method).toBe("GET");
  expect(requests[0].init.headers).toEqual({
    Authorization: "Bearer test-token",
  });
  expect(result.catalogVersion).toBe("2026-06-24");
  expect(result.resources[0].resourceType).toBe("water");
  expect(await readFile(getRegistrationFilePath(tempDir), "utf8")).toBe(beforeRegistration);
});

test("showBlueprint fetches one official blueprint and converts missing blueprints to a friendly error", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];

  const blueprint = await showBlueprint("rover-bay-upgrade", {
    cwd: tempDir,
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          blueprint: {
            id: "bp-2",
            blueprintId: "rover-bay-upgrade",
            displayName: "Rover Bay Upgrade",
            description: "Upgrades the rover bay.",
            status: "published",
            output: { itemType: "facility-upgrade", quantity: 1 },
            inputs: { spareParts: 8, power: 3 },
            productionCost: { powerKwh: 12 },
            requiredFacility: { moduleType: "rover-bay", level: 1 },
            buildTicks: 300,
            prerequisites: ["rover-bay"],
            unlocks: ["survey-rover"],
            repeatable: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  expect(requests[0].url).toBe("https://planet.turingguild.com/catalog/blueprints/rover-bay-upgrade");
  expect(blueprint.displayName).toBe("Rover Bay Upgrade");
  expect(blueprint.inputs).toEqual({ spareParts: 8, power: 3 });

  await expect(
    showBlueprint("missing-blueprint", {
      cwd: tempDir,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ error: { message: "not found" } }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
    }),
  ).rejects.toThrow("Blueprint not found: missing-blueprint");
});

test("tickHabitat advances one-second ticks and drains battery power", async () => {
  await writePowerRegistration();

  const result = await tickHabitat(1, { cwd: tempDir });

  expect(result).toMatchObject({
    startTick: 0,
    currentTick: 1,
    ticksAdvanced: 1,
    totalPowerDrawKw: 7,
    energyUsedKwh: 7 / 3600,
    batteryEnergyKwh: 10 - 7 / 3600,
    batteryCapacityKwh: 10,
    powerShortageKwh: 0,
  });

  const stored = await loadLocalRegistration(tempDir);
  expect(stored?.currentTick).toBe(1);
  expect(stored?.modules[0].runtimeAttributes.currentEnergyKwh).toBe(10 - 7 / 3600);
  expect(stored?.tickHistory).toHaveLength(1);
});

test("tickHabitat multiplies power use over multiple ticks", async () => {
  await writePowerRegistration();

  const result = await tickHabitat(60, { cwd: tempDir });

  expect(result.energyUsedKwh).toBe(7 / 60);
  expect(result.batteryEnergyKwh).toBe(10 - 7 / 60);
  expect(result.currentTick).toBe(60);
});

test("tickHabitat clamps battery energy and reports shortage", async () => {
  await writePowerRegistration({ currentEnergyKwh: 0.001, energyStorageKwh: 10 });

  const result = await tickHabitat(1, { cwd: tempDir });

  expect(result.batteryEnergyKwh).toBe(0);
  expect(result.powerShortageKwh).toBeCloseTo(7 / 3600 - 0.001, 10);
  expect((await loadLocalRegistration(tempDir))?.modules[0].runtimeAttributes.currentEnergyKwh).toBe(0);
});

test("module CRUD uses local modules and saved module blueprints", async () => {
  await registerHabitat("Artemis Ridge", {
    cwd: tempDir,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          habitatId: "habitat_11111111_1111_4111_8111_111111111111",
          starterModules: [
            {
              id: "starter-command",
              blueprintId: "command-module",
              displayName: "Command Module",
              connectedTo: [],
              runtimeAttributes: { health: 100, status: "active" },
              capabilities: ["habitat-command"],
            },
          ],
          blueprints: [
            {
              blueprintId: "small-solar-array",
              displayName: "Small Solar Array Blueprint",
              output: { itemType: "module", moduleType: "small-solar-array", quantity: 1 },
              runtimeAttributes: {
                health: 100,
                status: "idle",
                powerDrawKw: { offline: 0, idle: 0, active: 0, damaged: 0 },
              },
              capabilities: ["solar-generation"],
            },
            {
              blueprintId: "survey-rover",
              displayName: "Survey Rover Blueprint",
              output: { itemType: "rover", quantity: 1 },
              runtimeAttributes: { health: 100 },
              capabilities: ["starter-survey"],
            },
          ],
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    randomUuid: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-07-06T12:00:00.000Z"),
  });

  expect(await listModules({ cwd: tempDir })).toHaveLength(1);
  expect((await showModule("starter-command", { cwd: tempDir })).displayName).toBe("Command Module");

  const created = await createModule(
    { blueprintId: "small-solar-array", name: "Solar Test Array" },
    {
      cwd: tempDir,
      randomUuid: () => "33333333-3333-4333-8333-333333333333",
      now: () => new Date("2026-07-06T12:10:00.000Z"),
    },
  );

  expect(created).toEqual({
    id: "module_33333333_3333_4333_8333_333333333333",
    habitatId: "habitat_11111111_1111_4111_8111_111111111111",
    blueprintId: "small-solar-array",
    moduleType: "small-solar-array",
    displayName: "Solar Test Array",
    connectedTo: [],
    runtimeAttributes: {
      health: 100,
      status: "idle",
      powerDrawKw: { offline: 0, idle: 0, active: 0, damaged: 0 },
    },
    capabilities: ["solar-generation"],
    source: "local-blueprint",
    createdAt: "2026-07-06T12:10:00.000Z",
    updatedAt: "2026-07-06T12:10:00.000Z",
  });

  const updated = await updateModule(
    created.id,
    { name: "Solar Test Array Prime", status: "active", health: 95 },
    { cwd: tempDir, now: () => new Date("2026-07-06T12:20:00.000Z") },
  );

  expect(updated.displayName).toBe("Solar Test Array Prime");
  expect(updated.runtimeAttributes.status).toBe("active");
  expect(updated.runtimeAttributes.health).toBe(95);
  expect(updated.updatedAt).toBe("2026-07-06T12:20:00.000Z");

  await expect(
    createModule({ blueprintId: "survey-rover" }, { cwd: tempDir }),
  ).rejects.toThrow("Blueprint does not output a module: survey-rover");

  await deleteModule(created.id, { cwd: tempDir });
  expect((await listModules({ cwd: tempDir })).map((module) => module.id)).toEqual([
    "starter-command",
  ]);
});

test("setModuleStatus updates only runtime status and saves habitat modules", async () => {
  await writePowerRegistration();

  const before = await showModule("command-1", { cwd: tempDir });
  const updated = await setModuleStatus("command-1", "idle", { cwd: tempDir });

  expect(updated.id).toBe("command-1");
  expect(updated.runtimeAttributes.status).toBe("idle");
  expect(updated.runtimeAttributes.health).toBe(before.runtimeAttributes.health);
  expect(updated.runtimeAttributes.powerDrawKw).toEqual(before.runtimeAttributes.powerDrawKw);
  expect(updated.displayName).toBe(before.displayName);
  expect(updated.updatedAt).toBe(before.updatedAt);

  const storedRegistration = await loadLocalRegistration(tempDir);
  expect(storedRegistration?.modules.find((module) => module.id === "command-1")?.runtimeAttributes.status).toBe("idle");

  const storedModules = JSON.parse(await readFile(getModulesFilePath(tempDir), "utf8"));
  expect(storedModules.find((module: { id: string }) => module.id === "command-1").runtimeAttributes.status).toBe("idle");
});

test("setModuleStatus rejects unsupported runtime states", async () => {
  await writePowerRegistration();

  await expect(setModuleStatus("command-1", "sleeping", { cwd: tempDir })).rejects.toThrow(
    "Status must be one of: offline, idle, online, active, damaged.",
  );
});

test("getLocalStatusSummary reports the local module count", async () => {
  await registerHabitat("Artemis Ridge", {
    cwd: tempDir,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          habitatId: "habitat_11111111_1111_4111_8111_111111111111",
          starterModules: [
            {
              id: "module-1",
              blueprintId: "command-module",
              displayName: "Command Module",
              connectedTo: [],
              runtimeAttributes: { health: 100, status: "active" },
              capabilities: ["habitat-command"],
            },
            {
              id: "module-2",
              blueprintId: "life-support",
              displayName: "Life Support",
              connectedTo: ["module-1"],
              runtimeAttributes: { health: 100, status: "active" },
              capabilities: ["atmosphere-control"],
            },
          ],
          blueprints: [],
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    randomUuid: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-07-06T12:00:00.000Z"),
  });

  expect(await getLocalStatusSummary({ cwd: tempDir })).toEqual({
    currentTick: 0,
    moduleCount: 2,
    powerSummary: {
      totalPowerDrawKw: 0,
      energyUsedKwh: 0,
      batteryEnergyKwh: 0,
      batteryCapacityKwh: 0,
      powerShortageKwh: 0,
    },
  });
});

test("registerHabitat can run outside the project directory and still use the project .env and .habitat", async () => {
  const outsideDir = await mkdtemp(join(tmpdir(), "habitat-cli-outside-"));

  try {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const registration = await registerHabitat("The Hideout", {
      cwd: outsideDir,
      projectRoot: tempDir,
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(url), init: init ?? {} });

        return new Response(
          JSON.stringify({
            habitatId: "habitat_22222222_2222_4222_8222_222222222222",
            starterModules: [],
            blueprints: [],
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      },
      randomUuid: () => "22222222-2222-4222-8222-222222222222",
      now: () => new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(requests[0].url).toBe("https://planet.turingguild.com/habitats/register");
    expect(requests[0].init.headers).toEqual({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
    expect(await loadLocalRegistration(outsideDir)).toBeNull();
    expect(await loadLocalRegistration(tempDir)).toEqual(registration);
  } finally {
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("checkLocalConfig can verify project configuration from outside the project without network calls", async () => {
  const outsideDir = await mkdtemp(join(tmpdir(), "habitat-cli-outside-"));

  try {
    const config = await checkLocalConfig({
      cwd: outsideDir,
      projectRoot: tempDir,
    });

    expect(config).toEqual({
      baseUrl: "https://planet.turingguild.com",
      tokenLoaded: true,
      registrationFile: getRegistrationFilePath(tempDir),
    });
  } finally {
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("checkLocalConfig honors HABITAT_PROJECT_ROOT for installed launchers", async () => {
  const outsideDir = await mkdtemp(join(tmpdir(), "habitat-cli-outside-"));
  const previousProjectRoot = process.env.HABITAT_PROJECT_ROOT;
  process.env.HABITAT_PROJECT_ROOT = tempDir;

  try {
    await writeFile(join(outsideDir, ".env"), "OTHER_VALUE=true\n", "utf8");

    const config = await checkLocalConfig({
      cwd: outsideDir,
    });

    expect(config.registrationFile).toBe(getRegistrationFilePath(tempDir));
    expect(config.tokenLoaded).toBe(true);
  } finally {
    if (previousProjectRoot === undefined) {
      delete process.env.HABITAT_PROJECT_ROOT;
    } else {
      process.env.HABITAT_PROJECT_ROOT = previousProjectRoot;
    }

    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("getRegistrationStatus fetches the saved habitat registration from Kepler", async () => {
  await registerHabitat("Artemis Ridge", {
    cwd: tempDir,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          habitatId: "habitat_11111111_1111_4111_8111_111111111111",
          starterModules: [],
          blueprints: [],
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    randomUuid: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-07-06T12:00:00.000Z"),
  });

  const requests: Array<{ url: string; init: RequestInit }> = [];
  const status = await getRegistrationStatus({
    cwd: tempDir,
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          habitat: {
            id: "habitat_11111111_1111_4111_8111_111111111111",
            habitatSlug: "artemis-ridge",
            displayName: "Artemis Ridge",
            catalogVersion: "2026-06-24",
            status: "active",
            lastSeenAt: "2026-07-06T12:05:00.000Z",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(
    "https://planet.turingguild.com/habitats/habitat_11111111_1111_4111_8111_111111111111/registration",
  );
  expect(requests[0].init.method).toBe("GET");
  expect(requests[0].init.headers).toEqual({
    Authorization: "Bearer test-token",
  });
  expect(status.habitat.status).toBe("active");
  expect(status.habitat.habitatSlug).toBe("artemis-ridge");
});

test("unregisterHabitat deletes server registration before removing the local registration file", async () => {
  await registerHabitat("Artemis Ridge", {
    cwd: tempDir,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          habitatId: "habitat_11111111_1111_4111_8111_111111111111",
          starterModules: [],
          blueprints: [],
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    randomUuid: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-07-06T12:00:00.000Z"),
  });

  const requests: Array<{ url: string; init: RequestInit }> = [];
  const result = await unregisterHabitat({
    cwd: tempDir,
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 204 });
    },
  });

  expect(result.habitatId).toBe("habitat_11111111_1111_4111_8111_111111111111");
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(
    "https://planet.turingguild.com/habitats/habitat_11111111_1111_4111_8111_111111111111",
  );
  expect(requests[0].init.method).toBe("DELETE");
  expect(requests[0].init.headers).toEqual({
    Authorization: "Bearer test-token",
  });
  expect(await loadLocalRegistration(tempDir)).toBeNull();
});
