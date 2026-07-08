import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("help advertises only Kepler registration commands from the Habitat command set", async () => {
  const proc = Bun.spawn(["bun", "run", "src/index.ts", "--help"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const errorOutput = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  expect(exitCode).toBe(0);
  expect(errorOutput).toBe("");
  expect(output).toContain("register");
  expect(output).toContain("status");
  expect(output).toContain("unregister");
  expect(output).toContain("config");
  expect(output).toContain("module");
  expect(output).not.toContain("zone");
  expect(output).not.toContain("door");
  expect(output).not.toContain("airlock");
  expect(output).not.toContain("sensor");
  expect(output).not.toContain("rover");
  expect(output).not.toContain("greenhouse");
});

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "habitat-cli-"));
  await writeFile(
    join(tempDir, ".env"),
    "KEPLER_BASE_URL=https://planet.turingguild.com\nKEPLER_PLANET_TOKEN=test-token\n",
    "utf8",
  );
  await mkdir(join(tempDir, ".habitat"), { recursive: true });
  await writeFile(
    join(tempDir, ".habitat", "registration.json"),
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
            id: "module-1",
            habitatId: "habitat_11111111_1111_4111_8111_111111111111",
            blueprintId: "command-module",
            moduleType: "command-module",
            displayName: "Command Module",
            connectedTo: [],
            runtimeAttributes: { health: 100, status: "active", powerDrawKw: { active: 2, idle: 1 } },
            capabilities: ["habitat-command"],
            source: "kepler-registration",
            createdAt: "2026-07-06T12:00:00.000Z",
            updatedAt: "2026-07-06T12:00:00.000Z",
          },
          {
            id: "module-2",
            habitatId: "habitat_11111111_1111_4111_8111_111111111111",
            blueprintId: "life-support",
            moduleType: "life-support",
            displayName: "Life Support",
            connectedTo: ["module-1"],
            runtimeAttributes: { health: 99, status: "idle", powerDrawKw: { idle: 5 } },
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
});

async function writeTickRegistration() {
  await writeFile(
    join(tempDir, ".habitat", "registration.json"),
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
              currentEnergyKwh: 500,
              energyStorageKwh: 500,
              powerDrawKw: { offline: 0 },
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
            runtimeAttributes: { health: 100, status: "active", powerDrawKw: { active: 2 } },
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
            runtimeAttributes: { health: 100, status: "active", powerDrawKw: { active: 5 } },
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

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("module list and show print local module state", async () => {
  const listProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "list"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const listOutput = await new Response(listProc.stdout).text();
  expect(await listProc.exited).toBe(0);
  expect(listOutput).toContain("1 | command-module-1 | Command Module | active | 100");
  expect(listOutput).toContain("2 | life-support-1 | Life Support | idle | 99");
  expect(listOutput).not.toContain("\nmodule-1 |");
  expect(listOutput.startsWith("module-1 |")).toBe(false);

  const showProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "show", "2"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const showOutput = await new Response(showProc.stdout).text();
  expect(await showProc.exited).toBe(0);
  expect(showOutput).toContain("ID: module-2");
  expect(showOutput).toContain("Capabilities: atmosphere-control");
  expect(showOutput).toContain("Connected To: module-1");
});

test("module status prints current power table and one-tick energy cost", async () => {
  const statusProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "status"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const output = await new Response(statusProc.stdout).text();
  const errorOutput = await new Response(statusProc.stderr).text();
  expect(await statusProc.exited).toBe(0);
  expect(errorOutput).toBe("");
  expect(output).toContain("Module");
  expect(output).toContain("State");
  expect(output).toContain("Power Draw");
  expect(output).toContain("Command Module");
  expect(output).toContain("active");
  expect(output).toContain("2 kW");
  expect(output).toContain("Life Support");
  expect(output).toContain("idle");
  expect(output).toContain("5 kW");
  expect(output).toContain("Total Power Draw: 7 kW");
  expect(output).toContain("Energy Cost Per Tick: 0.00194 kWh");
});

test("module set-status updates one module and prints current power draw", async () => {
  const statusProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "set-status", "module-1", "idle"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const output = await new Response(statusProc.stdout).text();
  const errorOutput = await new Response(statusProc.stderr).text();
  expect(await statusProc.exited).toBe(0);
  expect(errorOutput).toBe("");
  expect(output).toContain("Updated module module-1 to idle.");
  expect(output).toContain("Current Power Draw: 1 kW");

  const stored = JSON.parse(await readFile(join(tempDir, ".habitat", "habitat-modules.json"), "utf8"));
  const updated = stored.find((module: { id: string }) => module.id === "module-1");
  expect(updated.runtimeAttributes).toEqual({
    health: 100,
    status: "idle",
    powerDrawKw: { active: 2, idle: 1 },
  });
});

test("module set-status rejects unsupported statuses", async () => {
  const statusProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "set-status", "module-1", "sleeping"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const output = await new Response(statusProc.stdout).text();
  const errorOutput = await new Response(statusProc.stderr).text();
  expect(await statusProc.exited).toBe(1);
  expect(output).toBe("");
  expect(errorOutput).toContain("Status must be one of: offline, idle, online, active, damaged.");
});

test("module commands accept friendly module handles and condition alias", async () => {
  const showProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "show", "command-module-1"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const showOutput = await new Response(showProc.stdout).text();
  expect(await showProc.exited).toBe(0);
  expect(showOutput).toContain("ID: module-1");

  const updateProc = Bun.spawn(
    [
      "bun",
      "run",
      "src/index.ts",
      "module",
      "update",
      "command-module-1",
      "--status",
      "maintenance",
      "--condition",
      "87",
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
    },
  );

  expect(await updateProc.exited).toBe(0);

  const updatedShowProc = Bun.spawn(["bun", "run", "src/index.ts", "module", "show", "command-module-1"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const updatedShowOutput = await new Response(updatedShowProc.stdout).text();
  expect(await updatedShowProc.exited).toBe(0);
  expect(updatedShowOutput).toContain("Status: maintenance");
  expect(updatedShowOutput).toContain("Health: 87");
});

test("tick command prints power summary and persists battery drain", async () => {
  await writeTickRegistration();

  const tickProc = Bun.spawn(["bun", "run", "src/index.ts", "tick", "60"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
  });

  const tickOutput = await new Response(tickProc.stdout).text();
  expect(await tickProc.exited).toBe(0);
  expect(tickOutput).toContain("Ticks Advanced: 60");
  expect(tickOutput).toContain("Current Tick: 60");
  expect(tickOutput).toContain("Total Power Draw: 7 kW");
  expect(tickOutput).toContain("Energy Used: 0.11667 kWh");
  expect(tickOutput).toContain("Battery Energy: 499.88333 / 500 kWh");
  expect(tickOutput).toContain("Power Shortage: 0 kWh");

  const stored = JSON.parse(
    await readFile(join(tempDir, ".habitat", "registration.json"), "utf8"),
  );
  expect(stored.currentTick).toBe(60);
  expect(stored.modules[0].runtimeAttributes.currentEnergyKwh).toBeCloseTo(499.8833333333, 10);
});

test("tick command rejects invalid counts", async () => {
  await writeTickRegistration();

  for (const count of ["0", "-1", "abc"]) {
    const tickProc = Bun.spawn(["bun", "run", "src/index.ts", "tick", count], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HABITAT_PROJECT_ROOT: tempDir },
    });

    const stderr = await new Response(tickProc.stderr).text();
    expect(await tickProc.exited).toBe(1);
    expect(stderr).toContain("tick count must be a positive integer");
  }
});
