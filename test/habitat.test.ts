import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getRegistrationFilePath,
  getRegistrationStatus,
  loadLocalRegistration,
  registerHabitat,
  unregisterHabitat,
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
        starterModules: [{ id: "module-1", blueprintId: "command-module" }],
        blueprints: [{ blueprintId: "command-module", displayName: "Command Module Blueprint" }],
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

  const stored = await loadLocalRegistration(tempDir);
  expect(stored).toEqual(registration);

  const rawFile = await readFile(getRegistrationFilePath(tempDir), "utf8");
  expect(JSON.parse(rawFile)).toEqual(registration);
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
