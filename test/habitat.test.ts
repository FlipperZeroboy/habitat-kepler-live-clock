import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkLocalConfig,
  createModule,
  deleteModule,
  getLocalStatusSummary,
  getRegistrationFilePath,
  getRegistrationStatus,
  listModules,
  loadLocalRegistration,
  registerHabitat,
  showModule,
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
    moduleCount: 2,
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
