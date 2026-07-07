import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
            runtimeAttributes: { health: 100, status: "active" },
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
            runtimeAttributes: { health: 99, status: "idle" },
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
